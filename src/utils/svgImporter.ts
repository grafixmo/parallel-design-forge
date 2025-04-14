
import { ControlPoint, BezierObject, CurveConfig, TransformSettings } from '../types/bezier';
import { generateId } from './bezierUtils';

interface SVGPathData {
  path: string;
  color: string;
  width: number;
  fill?: string;
  opacity?: number;
  strokeDasharray?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
}

interface SVGImportResult {
  objects: BezierObject[];
  width: number;
  height: number;
  viewBox?: {
    minX: number;
    minY: number;
    width: number;
    height: number;
  };
}

// Parse SVG string into BezierObject objects
export const parseSVGContent = (svgContent: string): SVGImportResult => {
  try {
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
    
    // Parse viewBox if available
    let viewBox = undefined;
    const viewBoxAttr = svgElement.getAttribute('viewBox');
    if (viewBoxAttr) {
      const viewBoxValues = viewBoxAttr.split(/\s+/).map(parseFloat);
      if (viewBoxValues.length === 4) {
        viewBox = {
          minX: viewBoxValues[0],
          minY: viewBoxValues[1],
          width: viewBoxValues[2],
          height: viewBoxValues[3]
        };
      }
    }
    
    // Find all path elements
    const pathElements = svgDoc.querySelectorAll('path');
    if (pathElements.length === 0) {
      throw new Error('No paths found in the SVG');
    }
    
    // Extract path data with enhanced styling information
    const pathsData: SVGPathData[] = [];
    pathElements.forEach((pathElement) => {
      const d = pathElement.getAttribute('d');
      if (d) {
        // Get all styling attributes
        pathsData.push({
          path: d,
          color: pathElement.getAttribute('stroke') || '#000000',
          width: parseFloat(pathElement.getAttribute('stroke-width') || '2'),
          fill: pathElement.getAttribute('fill') || 'none',
          opacity: parseFloat(pathElement.getAttribute('opacity') || '1'),
          strokeDasharray: pathElement.getAttribute('stroke-dasharray') || undefined,
          strokeLinecap: pathElement.getAttribute('stroke-linecap') || undefined,
          strokeLinejoin: pathElement.getAttribute('stroke-linejoin') || undefined
        });
      }
    });
    
    // Convert paths to BezierObjects with position adjustment
    const objects: BezierObject[] = pathsData.map((pathData, index) => {
      const points = convertPathToPoints(pathData.path);
      
      // Create curve config with enhanced styling
      const curveConfig: CurveConfig = {
        styles: [
          { 
            color: pathData.color, 
            width: pathData.width 
          }
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
    
    // Apply positioning to make the imported SVG visible
    positionImportedObjects(objects, { width, height, viewBox });
    
    return {
      objects,
      width,
      height,
      viewBox
    };
  } catch (error) {
    console.error('Error parsing SVG:', error);
    throw error;
  }
};

// Position imported objects to ensure they're visible in the canvas
const positionImportedObjects = (
  objects: BezierObject[], 
  svgInfo: { width: number, height: number, viewBox?: any }
): void => {
  if (objects.length === 0) return;
  
  // Find bounds of all objects
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  objects.forEach(obj => {
    obj.points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });
  
  // Calculate offset to center the objects in canvas
  // Place them in the center area (avoid toolbar area)
  const offsetX = 300 - (minX + (maxX - minX) / 2);
  const offsetY = 300 - (minY + (maxY - minY) / 2);
  
  // Apply offset to all points
  objects.forEach(obj => {
    obj.points = obj.points.map(point => ({
      ...point,
      x: point.x + offsetX,
      y: point.y + offsetY,
      handleIn: {
        x: point.handleIn.x + offsetX,
        y: point.handleIn.y + offsetY
      },
      handleOut: {
        x: point.handleOut.x + offsetX,
        y: point.handleOut.y + offsetY
      }
    }));
  });
  
  // Scale if needed to fit in viewable area
  const width = maxX - minX;
  const height = maxY - minY;
  
  if (width > 600 || height > 400) {
    const scale = Math.min(600 / width, 400 / height) * 0.8; // 80% of max scale for padding
    
    // Find center point after offset
    const centerX = minX + width/2 + offsetX;
    const centerY = minY + height/2 + offsetY;
    
    // Scale all objects around center
    objects.forEach(obj => {
      obj.points = obj.points.map(point => {
        // Distance from center
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        
        // Scale distance
        const scaledX = centerX + dx * scale;
        const scaledY = centerY + dy * scale;
        
        // Also scale handles
        const handleInDx = point.handleIn.x - centerX;
        const handleInDy = point.handleIn.y - centerY;
        const handleOutDx = point.handleOut.x - centerX;
        const handleOutDy = point.handleOut.y - centerY;
        
        return {
          ...point,
          x: scaledX,
          y: scaledY,
          handleIn: {
            x: centerX + handleInDx * scale,
            y: centerY + handleInDy * scale
          },
          handleOut: {
            x: centerX + handleOutDx * scale,
            y: centerY + handleOutDy * scale
          }
        };
      });
    });
  }
};

// Convert SVG path string to ControlPoint objects
const convertPathToPoints = (path: string): ControlPoint[] => {
  const points: ControlPoint[] = [];
  
  try {
    // Very basic path parsing - works for simple paths
    // This would need to be enhanced for complex paths
    const commands = path.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    
    let currentX = 0;
    let currentY = 0;
    
    commands.forEach((command) => {
      const type = command.charAt(0);
      const args = command.substring(1)
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat)
        .filter(n => !isNaN(n));
      
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
      }
      
      // Add support for other path commands as needed
    });
  } catch (error) {
    console.error('Error converting path to points:', error);
  }
  
  return points;
};

// Read SVG file from input element
export const readSVGFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    
    reader.onerror = (e) => {
      reject(new Error('Error reading SVG file'));
    };
    
    reader.readAsText(file);
  });
};
