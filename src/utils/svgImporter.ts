
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
      
      // Create curve config that respects original styling
      // Important: Set parallelCount to 0 to avoid adding parallel curves
      const curveConfig: CurveConfig = {
        styles: [
          { 
            color: pathData.color, 
            width: pathData.width 
          }
        ],
        parallelCount: 0, // No parallel curves
        spacing: 0
      };
      
      // Create transform settings - default to no transformation
      const transform: TransformSettings = {
        rotation: 0,
        scaleX: 1.0,
        scaleY: 1.0
      };
      
      // Create BezierObject with proper name
      return {
        id: generateId(),
        points,
        curveConfig,
        transform,
        name: `Imported Path ${index + 1}`,
        isSelected: false
      };
    });
    
    // Position imported objects to make them visible in the canvas
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
// Improved to better preserve original positioning
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
  
  // Calculate dimensions
  const width = maxX - minX;
  const height = maxY - minY;
  
  // Calculate offset to center the objects in canvas
  const offsetX = 400 - (minX + width / 2);
  const offsetY = 300 - (minY + height / 2);
  
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
  
  // Only scale if needed to fit in viewable area
  if (width > 700 || height > 500) {
    const scale = Math.min(700 / width, 500 / height) * 0.8; // 80% of max scale for padding
    
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
        
        // Also scale handles proportionally with the same scale
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

// Completely rewritten to better respect SVG path commands and curve shapes
const convertPathToPoints = (path: string): ControlPoint[] => {
  const points: ControlPoint[] = [];
  
  try {
    // Parse SVG path commands
    const commands = path.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    
    let currentX = 0;
    let currentY = 0;
    let firstX = 0;
    let firstY = 0;
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const type = command.charAt(0);
      const args = command.substring(1)
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat)
        .filter(n => !isNaN(n));
      
      // Process each command type
      switch (type) {
        case 'M': // Move to (absolute)
        case 'm': // Move to (relative)
          if (args.length >= 2) {
            if (type === 'M') {
              currentX = args[0];
              currentY = args[1];
            } else {
              currentX += args[0];
              currentY += args[1];
            }
            
            // Remember first point for Z command
            if (points.length === 0) {
              firstX = currentX;
              firstY = currentY;
            }
            
            // Only add point if we're starting a new subpath
            if (points.length === 0 || type === 'M') {
              const handleOffset = 0.01; // Just a tiny offset to avoid zero-length handles
              points.push({
                x: currentX,
                y: currentY,
                handleIn: { 
                  x: currentX - handleOffset, 
                  y: currentY 
                },
                handleOut: { 
                  x: currentX + handleOffset, 
                  y: currentY 
                },
                id: generateId()
              });
            }
          }
          break;
          
        case 'L': // Line to (absolute)
        case 'l': // Line to (relative)
          if (args.length >= 2) {
            let endX, endY;
            
            if (type === 'L') {
              endX = args[0];
              endY = args[1];
            } else {
              endX = currentX + args[0];
              endY = currentY + args[1];
            }
            
            if (points.length > 0) {
              // Update the previous point's handle out along the line
              const prevPoint = points[points.length - 1];
              const dx = endX - prevPoint.x;
              const dy = endY - prevPoint.y;
              const distance = Math.sqrt(dx*dx + dy*dy);
              
              // For straight lines, just place handle at 1/3 of the way
              const handleDistance = distance / 3;
              const ratio = handleDistance / distance;
              
              prevPoint.handleOut = {
                x: prevPoint.x + dx * ratio,
                y: prevPoint.y + dy * ratio
              };
              
              // Add the new point with handles
              points.push({
                x: endX,
                y: endY,
                handleIn: {
                  x: endX - dx * ratio,
                  y: endY - dy * ratio
                },
                handleOut: {
                  x: endX + dx * ratio, // We'll adjust this if needed for next segment
                  y: endY + dy * ratio
                },
                id: generateId()
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
          break;
          
        case 'H': // Horizontal line (absolute)
        case 'h': // Horizontal line (relative)
          if (args.length >= 1) {
            const endX = type === 'H' ? args[0] : currentX + args[0];
            const endY = currentY;
            
            if (points.length > 0) {
              // Update previous point's handle
              const prevPoint = points[points.length - 1];
              const dx = endX - prevPoint.x;
              const distance = Math.abs(dx);
              const handleDistance = distance / 3;
              
              prevPoint.handleOut = {
                x: prevPoint.x + (dx > 0 ? handleDistance : -handleDistance),
                y: prevPoint.y
              };
              
              // Add the new point
              points.push({
                x: endX,
                y: endY,
                handleIn: {
                  x: endX - (dx > 0 ? handleDistance : -handleDistance),
                  y: endY
                },
                handleOut: {
                  x: endX + (dx > 0 ? handleDistance : -handleDistance),
                  y: endY
                },
                id: generateId()
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
          break;
          
        case 'V': // Vertical line (absolute)
        case 'v': // Vertical line (relative)
          if (args.length >= 1) {
            const endX = currentX;
            const endY = type === 'V' ? args[0] : currentY + args[0];
            
            if (points.length > 0) {
              // Update previous point's handle
              const prevPoint = points[points.length - 1];
              const dy = endY - prevPoint.y;
              const distance = Math.abs(dy);
              const handleDistance = distance / 3;
              
              prevPoint.handleOut = {
                x: prevPoint.x,
                y: prevPoint.y + (dy > 0 ? handleDistance : -handleDistance)
              };
              
              // Add the new point
              points.push({
                x: endX,
                y: endY,
                handleIn: {
                  x: endX,
                  y: endY - (dy > 0 ? handleDistance : -handleDistance)
                },
                handleOut: {
                  x: endX,
                  y: endY + (dy > 0 ? handleDistance : -handleDistance)
                },
                id: generateId()
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
          break;
          
        case 'C': // Cubic Bézier (absolute)
        case 'c': // Cubic Bézier (relative)
          if (args.length >= 6) {
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
            
            if (points.length > 0) {
              // Update the previous point's handleOut
              const prevPoint = points[points.length - 1];
              prevPoint.handleOut = {
                x: control1X,
                y: control1Y
              };
              
              // Add the new point with its handleIn from the curve
              points.push({
                x: endX,
                y: endY,
                handleIn: {
                  x: control2X,
                  y: control2Y
                },
                handleOut: {
                  x: endX + (endX - control2X), // Mirror handleIn as default
                  y: endY + (endY - control2Y)
                },
                id: generateId()
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
          break;
          
        case 'S': // Smooth cubic Bézier (absolute)
        case 's': // Smooth cubic Bézier (relative)
          if (args.length >= 4) {
            let control2X, control2Y, endX, endY;
            
            if (type === 'S') {
              control2X = args[0];
              control2Y = args[1];
              endX = args[2];
              endY = args[3];
            } else {
              control2X = currentX + args[0];
              control2Y = currentY + args[1];
              endX = currentX + args[2];
              endY = currentY + args[3];
            }
            
            let control1X = currentX;
            let control1Y = currentY;
            
            // Reflect previous control point if it exists
            if (points.length > 0) {
              const prevPoint = points[points.length - 1];
              
              // Reflect the previous handle about the current point
              control1X = 2 * currentX - prevPoint.handleOut.x;
              control1Y = 2 * currentY - prevPoint.handleOut.y;
              
              // Update the previous point's handleOut
              prevPoint.handleOut = {
                x: control1X,
                y: control1Y
              };
              
              // Add the new point
              points.push({
                x: endX,
                y: endY,
                handleIn: {
                  x: control2X,
                  y: control2Y
                },
                handleOut: {
                  x: endX + (endX - control2X), // Mirror handleIn as default
                  y: endY + (endY - control2Y)
                },
                id: generateId()
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
          break;
          
        case 'Q': // Quadratic Bézier (absolute)
        case 'q': // Quadratic Bézier (relative)
          if (args.length >= 4) {
            let controlX, controlY, endX, endY;
            
            if (type === 'Q') {
              controlX = args[0];
              controlY = args[1];
              endX = args[2];
              endY = args[3];
            } else {
              controlX = currentX + args[0];
              controlY = currentY + args[1];
              endX = currentX + args[2];
              endY = currentY + args[3];
            }
            
            // Convert quadratic to cubic
            if (points.length > 0) {
              const prevPoint = points[points.length - 1];
              
              // Convert quadratic control point to two cubic control points
              // Formula: CP1 = start + 2/3 * (QP - start)
              // Formula: CP2 = end + 2/3 * (QP - end)
              const startX = prevPoint.x;
              const startY = prevPoint.y;
              
              const cp1x = startX + 2/3 * (controlX - startX);
              const cp1y = startY + 2/3 * (controlY - startY);
              const cp2x = endX + 2/3 * (controlX - endX);
              const cp2y = endY + 2/3 * (controlY - endY);
              
              // Update the previous point's handleOut
              prevPoint.handleOut = {
                x: cp1x,
                y: cp1y
              };
              
              // Add the new point
              points.push({
                x: endX,
                y: endY,
                handleIn: {
                  x: cp2x,
                  y: cp2y
                },
                handleOut: {
                  x: endX + (endX - cp2x),
                  y: endY + (endY - cp2y)
                },
                id: generateId()
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
          break;
          
        case 'T': // Smooth quadratic Bézier (absolute)
        case 't': // Smooth quadratic Bézier (relative)
          if (args.length >= 2) {
            let endX, endY;
            
            if (type === 'T') {
              endX = args[0];
              endY = args[1];
            } else {
              endX = currentX + args[0];
              endY = currentY + args[1];
            }
            
            // Infer control point by reflecting the previous control point
            let controlX = currentX;
            let controlY = currentY;
            
            // Find the previous control point
            if (points.length > 0) {
              const prevPoint = points[points.length - 1];
              
              // Get the implicit control point by reflecting the previous one
              controlX = 2 * currentX - prevPoint.handleOut.x;
              controlY = 2 * currentY - prevPoint.handleOut.y;
              
              // Convert quadratic to cubic as in Q command
              const startX = prevPoint.x;
              const startY = prevPoint.y;
              
              const cp1x = startX + 2/3 * (controlX - startX);
              const cp1y = startY + 2/3 * (controlY - startY);
              const cp2x = endX + 2/3 * (controlX - endX);
              const cp2y = endY + 2/3 * (controlY - endY);
              
              // Update the previous point's handleOut
              prevPoint.handleOut = {
                x: cp1x,
                y: cp1y
              };
              
              // Add the new point
              points.push({
                x: endX,
                y: endY,
                handleIn: {
                  x: cp2x,
                  y: cp2y
                },
                handleOut: {
                  x: endX + (endX - cp2x),
                  y: endY + (endY - cp2y)
                },
                id: generateId()
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
          break;
          
        case 'A': // Elliptical arc (absolute)
        case 'a': // Elliptical arc (relative)
          // Arc commands are complex - simplified approximation
          if (args.length >= 7) {
            const rx = Math.abs(args[0]);
            const ry = Math.abs(args[1]);
            const xAxisRotation = args[2];
            const largeArcFlag = args[3];
            const sweepFlag = args[4];
            
            let endX, endY;
            if (type === 'A') {
              endX = args[5];
              endY = args[6];
            } else {
              endX = currentX + args[5];
              endY = currentY + args[6];
            }
            
            if (points.length > 0) {
              // For arcs, we'll add a simple cubic approximation
              // This is a very basic approximation - arcs are complex
              const prevPoint = points[points.length - 1];
              
              // Simple cubic approximation with handles at 1/3 distance
              const dx = endX - prevPoint.x;
              const dy = endY - prevPoint.y;
              
              // Apply a slight curve - this is very approximate
              const midX = (prevPoint.x + endX) / 2;
              const midY = (prevPoint.y + endY) / 2;
              
              // Push out the mid point slightly to create a curve
              // The sign of this offset depends on the sweep flag
              const offset = (sweepFlag === 1 ? 1 : -1) * Math.min(rx, ry) * 0.5;
              
              // Perpendicular direction
              const perpX = -dy;
              const perpY = dx;
              const length = Math.sqrt(perpX*perpX + perpY*perpY);
              if (length > 0) {
                const offsetX = midX + perpX / length * offset;
                const offsetY = midY + perpY / length * offset;
                
                // Set handles to create a curve through the offset point
                prevPoint.handleOut = {
                  x: prevPoint.x + (offsetX - prevPoint.x) * 0.5,
                  y: prevPoint.y + (offsetY - prevPoint.y) * 0.5
                };
                
                // Add the endpoint with a handle coming from the offset point
                points.push({
                  x: endX,
                  y: endY,
                  handleIn: {
                    x: endX - (endX - offsetX) * 0.5,
                    y: endY - (endY - offsetY) * 0.5
                  },
                  handleOut: {
                    x: endX + (endX - offsetX) * 0.2, // Smaller handle out
                    y: endY + (endY - offsetY) * 0.2
                  },
                  id: generateId()
                });
              }
            }
            
            currentX = endX;
            currentY = endY;
          }
          break;
          
        case 'Z': // Close path
        case 'z':
          // Connect back to the first point
          if (points.length > 0 && (firstX !== currentX || firstY !== currentY)) {
            const prevPoint = points[points.length - 1];
            const firstPoint = points[0];
            
            // Calculate handles for a line back to the start
            const dx = firstPoint.x - prevPoint.x;
            const dy = firstPoint.y - prevPoint.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance > 0) {
              const handleDistance = distance / 3;
              const ratio = handleDistance / distance;
              
              // Update the last point's handle out
              prevPoint.handleOut = {
                x: prevPoint.x + dx * ratio,
                y: prevPoint.y + dy * ratio
              };
              
              // Update the first point's handle in
              firstPoint.handleIn = {
                x: firstPoint.x - dx * ratio,
                y: firstPoint.y - dy * ratio
              };
            }
            
            currentX = firstX;
            currentY = firstY;
          }
          break;
      }
    }
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
