
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

// Create a function to prepare a worker
const createSVGWorker = () => {
  return new Worker(new URL('./svgWorker.ts', import.meta.url), { type: 'module' });
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
      
      // ALWAYS use worker for path processing to prevent freezing
      const worker = createSVGWorker();
      
      worker.onmessage = (e) => {
        const { type, progress, results, error, viewBox: resultViewBox } = e.data;
        
        if (type === 'progress' && onProgress) {
          // Scale worker progress from 0.3 to 0.9 in our overall process
          onProgress(0.3 + (progress * 0.6));
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
          
          // Terminate the worker
          worker.terminate();
          
          resolve({
            objects,
            width,
            height,
            viewBox: resultViewBox || viewBox
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
      
      // Start the worker with the path data and viewBox information
      worker.postMessage({
        paths: pathsData,
        options: {
          ...options,
          simplifyPaths: options?.simplifyPaths || (pathsData.length > 20) // Simplify if many paths
        },
        viewBox
      });
    } catch (error) {
      console.error('Error parsing SVG:', error);
      if (onProgress) onProgress(1.0); // Ensure progress completes even on error
      reject(error);
    }
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
