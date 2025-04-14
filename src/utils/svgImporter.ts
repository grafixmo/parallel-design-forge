
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
  viewBox?: { x: number, y: number, width: number, height: number };
}

// Track current worker and request
let currentWorker: Worker | null = null;
let currentRequestId: string | null = null;

// Create a function to prepare a worker
const createSVGWorker = () => {
  return new Worker(new URL('./svgWorker.ts', import.meta.url), { type: 'module' });
};

// Generate a unique request ID
const generateRequestId = () => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
};

// Cancel any in-progress SVG parsing
export const cancelSVGParsing = () => {
  if (currentWorker && currentRequestId) {
    currentWorker.postMessage({
      type: 'cancel',
      requestId: currentRequestId
    });
    
    // Don't terminate the worker yet - wait for the cancel confirmation
    currentRequestId = null;
  }
};

// Always use the worker for path processing
// This avoids the main thread freezing regardless of SVG complexity
export const parseSVGContent = (
  svgContent: string, 
  options?: SVGImportOptions,
  onProgress?: (progress: number) => void
): Promise<SVGImportResult> => {
  return new Promise((resolve, reject) => {
    try {
      // Cancel any in-progress parsing
      cancelSVGParsing();
      
      // Report initial progress
      if (onProgress) onProgress(0.05);
      
      // Generate new request ID
      const requestId = generateRequestId();
      currentRequestId = requestId;
      
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
      
      // Get SVG dimensions and viewBox
      const width = parseFloat(svgElement.getAttribute('width') || '800');
      const height = parseFloat(svgElement.getAttribute('height') || '600');
      
      // Parse viewBox if present - critical for preserving original positioning
      let viewBox = { x: 0, y: 0, width, height };
      const viewBoxAttr = svgElement.getAttribute('viewBox');
      
      if (viewBoxAttr) {
        const [x, y, w, h] = viewBoxAttr.split(/[\s,]+/).map(parseFloat);
        if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) {
          viewBox = { x, y, width: w, height: h };
        }
      }
      
      // Find all path elements
      const pathElements = svgDoc.querySelectorAll('path');
      if (pathElements.length === 0) {
        throw new Error('No paths found in the SVG');
      }
      
      if (onProgress) onProgress(0.1);
      
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
      if (onProgress) onProgress(0.15);
      
      // Create a new worker for path processing
      if (currentWorker) {
        currentWorker.terminate();
      }
      currentWorker = createSVGWorker();
      
      currentWorker.onmessage = (e) => {
        const { type, progress, results, error, viewBox: resultViewBox, requestId: responseId } = e.data;
        
        // Ignore messages for old requests
        if (responseId !== currentRequestId) return;
        
        if (type === 'progress' && onProgress) {
          // Scale worker progress from 0.2 to 0.9 in our overall process
          onProgress(0.15 + (progress * 0.8));
        } else if (type === 'complete') {
          // Worker completed processing all paths
          const objects: BezierObject[] = results.map((result, index) => {
            // Create curve config - preserve original styling
            const curveConfig: CurveConfig = {
              styles: [
                { color: pathsData[index].color, width: pathsData[index].width }
              ],
              parallelCount: 0,
              spacing: 0
            };
            
            // Create transform settings - NO TRANSFORMATION by default
            // This preserves the original SVG positioning
            const transform: TransformSettings = {
              rotation: 0,
              scaleX: 1.0,
              scaleY: 1.0
            };
            
            // Create BezierObject with original positions preserved
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
          
          // Terminate the worker and clear tracking variables
          currentWorker.terminate();
          currentWorker = null;
          currentRequestId = null;
          
          resolve({
            objects,
            width,
            height,
            viewBox: resultViewBox || viewBox
          });
        } else if (type === 'error') {
          currentWorker.terminate();
          currentWorker = null;
          currentRequestId = null;
          reject(new Error(error));
        } else if (type === 'canceled') {
          currentWorker.terminate();
          currentWorker = null;
          reject(new Error('SVG import canceled'));
        }
      };
      
      // Handle worker errors
      currentWorker.onerror = (err) => {
        currentWorker?.terminate();
        currentWorker = null;
        currentRequestId = null;
        reject(new Error('Worker error: ' + err.message));
      };
      
      // Start the worker with the path data and viewBox information
      currentWorker.postMessage({
        paths: pathsData,
        options: {
          ...options,
          simplifyPaths: options?.simplifyPaths || (pathsData.length > 20) // Simplify if many paths
        },
        viewBox,
        requestId
      });
    } catch (error) {
      console.error('Error parsing SVG:', error);
      if (onProgress) onProgress(1.0); // Ensure progress completes even on error
      reject(error);
    }
  });
};

// Helper function to scale and center objects to fit the canvas
export const transformImportedObjects = (
  objects: BezierObject[],
  viewBox: { x: number, y: number, width: number, height: number },
  canvasWidth: number,
  canvasHeight: number,
  options?: SVGImportOptions
): BezierObject[] => {
  
  // If we should preserve original positioning, return objects as-is
  if (options?.preserveViewBox === true && !options?.fitToCanvas && !options?.centerOnCanvas) {
    return objects;
  }
  
  // If no objects, return empty array
  if (objects.length === 0) {
    return [];
  }
  
  // Find bounds of all objects
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  objects.forEach(obj => {
    obj.points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });
  
  const objectsWidth = maxX - minX;
  const objectsHeight = maxY - minY;
  
  // Define target dimensions
  const targetWidth = options?.targetWidth || (canvasWidth * 0.9);
  const targetHeight = options?.targetHeight || (canvasHeight * 0.9);
  
  // Calculate scaling factors
  let scaleX = 1;
  let scaleY = 1;
  
  if (options?.fitToCanvas) {
    // Calculate scaling to fit while maintaining aspect ratio
    const widthRatio = targetWidth / objectsWidth;
    const heightRatio = targetHeight / objectsHeight;
    
    // Use the smaller ratio to ensure it fits entirely
    const scaleFactor = Math.min(widthRatio, heightRatio);
    scaleX = scaleFactor;
    scaleY = scaleFactor;
  }
  
  // Calculate offsets for centering
  let offsetX = 0;
  let offsetY = 0;
  
  if (options?.centerOnCanvas) {
    // Center in canvas
    offsetX = (canvasWidth - objectsWidth * scaleX) / 2 - minX * scaleX;
    offsetY = (canvasHeight - objectsHeight * scaleY) / 2 - minY * scaleY;
  }
  
  // Transform all objects
  return objects.map(obj => {
    const transformedPoints = obj.points.map(point => ({
      ...point,
      x: point.x * scaleX + offsetX,
      y: point.y * scaleY + offsetY,
      handleIn: {
        x: point.handleIn.x * scaleX + offsetX,
        y: point.handleIn.y * scaleY + offsetY
      },
      handleOut: {
        x: point.handleOut.x * scaleX + offsetX,
        y: point.handleOut.y * scaleY + offsetY
      }
    }));
    
    return {
      ...obj,
      points: transformedPoints
    };
  });
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
