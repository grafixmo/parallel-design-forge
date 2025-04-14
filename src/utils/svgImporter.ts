
import { ControlPoint, BezierObject, CurveConfig, TransformSettings } from '../types/bezier';
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
  viewBox?: { minX: number, minY: number, width: number, height: number };
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
    
    // Get SVG dimensions and viewBox
    const width = parseFloat(svgElement.getAttribute('width') || '800');
    const height = parseFloat(svgElement.getAttribute('height') || '600');
    
    // Get viewBox attribute if it exists
    let viewBox = undefined;
    const viewBoxAttr = svgElement.getAttribute('viewBox');
    
    if (viewBoxAttr) {
      const viewBoxValues = viewBoxAttr.split(/\s+|,/).map(parseFloat);
      if (viewBoxValues.length === 4) {
        viewBox = {
          minX: viewBoxValues[0],
          minY: viewBoxValues[1],
          width: viewBoxValues[2],
          height: viewBoxValues[3]
        };
        console.log("Found viewBox:", viewBox);
      }
    }
    
    // Find all path elements
    const pathElements = svgDoc.querySelectorAll('path');
    if (pathElements.length === 0) {
      throw new Error('No paths found in the SVG');
    }
    
    // Extract path data
    const pathsData: SVGPathData[] = [];
    pathElements.forEach((pathElement) => {
      const d = pathElement.getAttribute('d');
      if (d) {
        pathsData.push({
          path: d,
          color: pathElement.getAttribute('stroke') || '#000000',
          width: parseFloat(pathElement.getAttribute('stroke-width') || '2')
        });
      }
    });
    
    // Calculate appropriate scale and offset to center the design
    let scale = 1.0;
    let offsetX = 0;
    let offsetY = 0;
    
    // If we have viewBox, use it to calculate scale and offset
    if (viewBox) {
      // Calculate scale to fit the design in canvas while maintaining aspect ratio
      // We'll scale to 80% of the canvas size to leave some margin
      const canvasWidth = 800; // Default canvas width
      const canvasHeight = 600; // Default canvas height
      
      const scaleX = (canvasWidth * 0.8) / viewBox.width;
      const scaleY = (canvasHeight * 0.8) / viewBox.height;
      
      // Use the smaller scale to fit the design fully within the canvas
      scale = Math.min(scaleX, scaleY);
      
      // Center the design in the canvas
      offsetX = (canvasWidth - viewBox.width * scale) / 2 - viewBox.minX * scale;
      offsetY = (canvasHeight - viewBox.height * scale) / 2 - viewBox.minY * scale;
    }
    
    console.log(`Calculated scale: ${scale}, offsetX: ${offsetX}, offsetY: ${offsetY}`);
    
    // Convert paths to BezierObjects
    const objects: BezierObject[] = pathsData.map((pathData, index) => {
      // Get points, applying the scale and offset
      const points = convertPathToPoints(pathData.path, scale, offsetX, offsetY);
      
      // If points are at the wrong size or position, log info
      if (points.length > 0) {
        const xValues = points.map(p => p.x);
        const yValues = points.map(p => p.y);
        const minX = Math.min(...xValues);
        const minY = Math.min(...yValues);
        const maxX = Math.max(...xValues);
        const maxY = Math.max(...yValues);
        
        console.log(`Path ${index+1} bounds: (${minX},${minY}) - (${maxX},${maxY}), size: ${maxX-minX}x${maxY-minY}`);
      }
      
      // Create curve config - preserve original SVG styling
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
        name: `SVG Path ${index + 1}`,
        isSelected: index === 0 // Select the first imported path by default
      };
    });
    
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

// Convert SVG path string to ControlPoint objects
const convertPathToPoints = (
  path: string, 
  scale: number = 1.0, 
  offsetX: number = 0, 
  offsetY: number = 0
): ControlPoint[] => {
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
          currentX = args[0] * scale + offsetX;
          currentY = args[1] * scale + offsetY;
        } else {
          currentX += args[0] * scale;
          currentY += args[1] * scale;
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
          control1X = args[0] * scale + offsetX;
          control1Y = args[1] * scale + offsetY;
          control2X = args[2] * scale + offsetX;
          control2Y = args[3] * scale + offsetY;
          endX = args[4] * scale + offsetX;
          endY = args[5] * scale + offsetY;
        } else {
          control1X = currentX + args[0] * scale;
          control1Y = currentY + args[1] * scale;
          control2X = currentX + args[2] * scale;
          control2Y = currentY + args[3] * scale;
          endX = currentX + args[4] * scale;
          endY = currentY + args[5] * scale;
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
          endX = args[0] * scale + offsetX;
          endY = args[1] * scale + offsetY;
        } else {
          endX = currentX + args[0] * scale;
          endY = currentY + args[1] * scale;
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
