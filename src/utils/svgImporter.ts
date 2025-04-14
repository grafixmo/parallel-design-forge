import { ControlPoint, BezierObject, CurveConfig, TransformSettings, SVGImportOptions } from '../types/bezier';
import { generateId } from './bezierUtils';

interface SVGPathData {
  path: string;
  color: string;
  width: number;
}

interface SVGImportResult {
  objects: BezierObject[];
  width: number;
  height: number;
}

// Create a function to prepare a worker
const createSVGWorker = () => {
  return new Worker(new URL('./svgWorker.ts', import.meta.url), { type: 'module' });
};

// Helper to determine if an SVG is complex enough to require worker processing
const isSVGComplex = (
  pathsData: SVGPathData[],
  svgContent: string
): boolean => {
  // Consider both file size and path complexity
  const contentSize = svgContent.length;
  const pathCount = pathsData.length;
  const totalPathLength = pathsData.reduce((sum, p) => sum + p.path.length, 0);
  
  // Decision tree based on empirical thresholds
  // 1. Large files with multiple paths should use worker
  if (contentSize > 5000 && pathCount > 2) return true;
  
  // 2. Files with many paths should use worker regardless of file size
  if (pathCount > 5) return true;
  
  // 3. Files with complex paths (many commands/coordinates) should use worker
  if (totalPathLength > 3000) return true;
  
  // 4. Files with paths containing many curve commands should use worker
  const curveCommandCount = pathsData.reduce(
    (sum, p) => sum + (p.path.match(/[cC]/g) || []).length, 
    0
  );
  if (curveCommandCount > 10) return true;
  
  // Otherwise, process synchronously for small simple SVGs
  return false;
};

// Parse SVG string into BezierObject objects with progress callbacks
export const parseSVGContent = (
  svgContent: string, 
  options?: SVGImportOptions,
  onProgress?: (progress: number) => void
): Promise<SVGImportResult> => {
  return new Promise((resolve, reject) => {
    try {
      // Report initial progress
      if (onProgress) onProgress(0.1);
      
      // Create a DOM parser
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      
      // Check for parsing errors
      const parserError = svgDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Invalid SVG format');
      }
      
      // Get the root SVG element
      const svgElement = svgDoc.querySelector('svg');
      if (!svgElement) {
        throw new Error('No SVG element found');
      }
      
      // Get SVG dimensions
      const width = parseFloat(svgElement.getAttribute('width') || '800');
      const height = parseFloat(svgElement.getAttribute('height') || '600');
      
      // Find all path elements
      const pathElements = svgDoc.querySelectorAll('path');
      if (pathElements.length === 0) {
        throw new Error('No paths found in the SVG');
      }
      
      if (onProgress) onProgress(0.2);
      
      // Extract path data
      const pathsData: SVGPathData[] = [];
      pathElements.forEach((pathElement) => {
        const d = pathElement.getAttribute('d');
        if (d) {
          // Get style information (if option enabled)
          const useImportedStyle = options?.importStyle !== false;
          
          pathsData.push({
            path: d,
            color: useImportedStyle ? (pathElement.getAttribute('stroke') || '#000000') : '#000000',
            width: useImportedStyle ? parseFloat(pathElement.getAttribute('stroke-width') || '2') : 2
          });
        }
      });
      
      // Progress update for path extraction
      if (onProgress) onProgress(0.3);
      
      // Decide whether to use worker based on complexity analysis
      const shouldUseWorker = isSVGComplex(pathsData, svgContent);
      
      if (!shouldUseWorker) {
        // For simple SVGs, process synchronously to avoid worker overhead
        const objects: BezierObject[] = pathsData.map((pathData, index) => {
          const points = convertPathToPoints(pathData.path);
          
          // Create curve config
          const curveConfig: CurveConfig = {
            styles: [
              { color: pathData.color, width: pathData.width }
            ],
            parallelCount: 0,
            spacing: 0
          };
          
          // Create transform settings - default to no transformation
          const transform: TransformSettings = {
            rotation: 0,
            scaleX: 1.0,
            scaleY: 1.0
          };
          
          // Create BezierObject
          return {
            id: generateId(),
            points,
            curveConfig,
            transform,
            name: `Imported Path ${index + 1}`,
            isSelected: false
          };
        });
        
        if (onProgress) onProgress(1.0);
        
        resolve({
          objects,
          width,
          height
        });
      } else {
        // For more complex SVGs, process with a worker
        const worker = createSVGWorker();
        
        worker.onmessage = (e) => {
          const { type, progress, results, error } = e.data;
          
          if (type === 'progress' && onProgress) {
            // Scale worker progress from 0.3 to 0.9 in our overall process
            onProgress(0.3 + (progress * 0.6));
          } else if (type === 'complete') {
            // Worker completed processing all paths
            const objects: BezierObject[] = results.map((result, index) => {
              // Create curve config
              const curveConfig: CurveConfig = {
                styles: [
                  { color: pathsData[index].color, width: pathsData[index].width }
                ],
                parallelCount: 0,
                spacing: 0
              };
              
              // Create transform settings - default to no transformation
              const transform: TransformSettings = {
                rotation: 0,
                scaleX: 1.0,
                scaleY: 1.0
              };
              
              // Create BezierObject
              return {
                id: generateId(),
                points: result.points,
                curveConfig,
                transform,
                name: `Imported Path ${index + 1}`,
                isSelected: false
              };
            });
            
            if (onProgress) onProgress(1.0);
            
            // Terminate the worker
            worker.terminate();
            
            resolve({
              objects,
              width,
              height
            });
          } else if (type === 'error') {
            worker.terminate();
            reject(new Error(error));
          }
        };
        
        // Handle worker errors
        worker.onerror = (err) => {
          worker.terminate();
          reject(new Error('Worker error: ' + err.message));
        };
        
        // Start the worker with the path data
        worker.postMessage({
          paths: pathsData,
          options
        });
      }
    } catch (error) {
      console.error('Error parsing SVG:', error);
      if (onProgress) onProgress(1.0); // Ensure progress completes even on error
      reject(error);
    }
  });
};

// Convert SVG path string to ControlPoint objects (synchronous version for simple paths)
const convertPathToPoints = (path: string): ControlPoint[] => {
  const points: ControlPoint[] = [];
  
  try {
    // Command cache for better performance
    const commandCache = {};
    
    // More efficient path parsing
    const commands = path.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    
    let currentX = 0;
    let currentY = 0;
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const type = command.charAt(0);
      
      // Use cached args if we've seen this command before
      let args;
      if (commandCache[command]) {
        args = commandCache[command];
      } else {
        args = command.substring(1)
          .trim()
          .split(/[\s,]+/)
          .map(parseFloat)
          .filter(n => !isNaN(n));
        
        // Cache the parsed args for this command
        commandCache[command] = args;
      }
      
      if ((type === 'M' || type === 'm') && args.length >= 2) {
        // Move command
        if (type === 'M') {
          currentX = args[0];
          currentY = args[1];
        } else {
          currentX += args[0];
          currentY += args[1];
        }
        
        // Add first point
        points.push({
          x: currentX,
          y: currentY,
          handleIn: { x: currentX - 50, y: currentY },
          handleOut: { x: currentX + 50, y: currentY },
          id: generateId()
        });
      } else if ((type === 'C' || type === 'c') && args.length >= 6) {
        // Cubic bezier curve
        let control1X, control1Y, control2X, control2Y, endX, endY;
        
        if (type === 'C') {
          control1X = args[0];
          control1Y = args[1];
          control2X = args[2];
          control2Y = args[3];
          endX = args[4];
          endY = args[5];
        } else {
          control1X = currentX + args[0];
          control1Y = currentY + args[1];
          control2X = currentX + args[2];
          control2Y = currentY + args[3];
          endX = currentX + args[4];
          endY = currentY + args[5];
        }
        
        // Update the handle of the last point
        if (points.length > 0) {
          const lastPoint = points[points.length - 1];
          lastPoint.handleOut = { x: control1X, y: control1Y };
        }
        
        // Add new point with handle
        points.push({
          x: endX,
          y: endY,
          handleIn: { x: control2X, y: control2Y },
          handleOut: { x: endX + (endX - control2X), y: endY + (endY - control2Y) },
          id: generateId()
        });
        
        currentX = endX;
        currentY = endY;
      } else if ((type === 'L' || type === 'l') && args.length >= 2) {
        // Line command
        let endX, endY;
        
        if (type === 'L') {
          endX = args[0];
          endY = args[1];
        } else {
          endX = currentX + args[0];
          endY = currentY + args[1];
        }
        
        // Add new point (for lines, handles are aligned with the line)
        if (points.length > 0) {
          const lastPoint = points[points.length - 1];
          const dx = endX - lastPoint.x;
          const dy = endY - lastPoint.y;
          
          // Set the out handle of previous point along the line
          lastPoint.handleOut = {
            x: lastPoint.x + dx / 3,
            y: lastPoint.y + dy / 3
          };
          
          // Add new point with handle
          points.push({
            x: endX,
            y: endY,
            handleIn: {
              x: endX - dx / 3,
              y: endY - dy / 3
            },
            handleOut: {
              x: endX + dx / 3,
              y: endY + dy / 3
            },
            id: generateId()
          });
        }
        
        currentX = endX;
        currentY = endY;
      } else if ((type === 'Z' || type === 'z') && points.length > 1) {
        // Close path command - connect back to the first point
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        // Only add closing segment if we're not already at the start point
        if (Math.abs(lastPoint.x - firstPoint.x) > 0.1 || Math.abs(lastPoint.y - firstPoint.y) > 0.1) {
          const dx = firstPoint.x - lastPoint.x;
          const dy = firstPoint.y - lastPoint.y;
          
          // Set the out handle of last point along the closing line
          lastPoint.handleOut = {
            x: lastPoint.x + dx / 3,
            y: lastPoint.y + dy / 3
          };
          
          // Update the in handle of first point to match the curve
          firstPoint.handleIn = {
            x: firstPoint.x - dx / 3,
            y: firstPoint.y - dy / 3
          };
        }
      }
    }
  } catch (error) {
    console.error('Error converting path to points:', error);
  }
  
  return points;
};

// Read SVG file from input element with progress tracking
export const readSVGFile = (file: File, onProgress?: (progress: number) => void): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      if (onProgress) onProgress(1.0);
      resolve(e.target?.result as string);
    };
    
    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        // File read progress from 0 to 0.2 in our overall process
        const progress = event.loaded / event.total;
        onProgress(progress * 0.2);
      }
    };
    
    reader.onerror = (e) => {
      reject(new Error('Error reading SVG file'));
    };
    
    reader.readAsText(file);
  });
};
