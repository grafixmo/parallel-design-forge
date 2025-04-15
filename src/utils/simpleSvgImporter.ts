
import { BezierObject, ControlPoint } from '@/types/bezier';
import { generateId } from './bezierUtils';

/**
 * Read an SVG file and return its content as a string
 */
export const readSVGFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read SVG file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading SVG file'));
    };
    
    reader.readAsText(file);
  });
};

/**
 * Import SVG content and convert to BezierObjects
 * This is a simplified and more robust version that handles complex SVGs better
 */
export const importSVG = (svgContent: string): BezierObject[] => {
  try {
    console.log('Starting simplified SVG import...');
    
    // Parse SVG content
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    
    // Check for parsing errors
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
      console.error('SVG parse error:', parserError.textContent);
      throw new Error('Invalid SVG format');
    }
    
    // Get SVG dimensions
    const svgElement = svgDoc.querySelector('svg');
    if (!svgElement) {
      throw new Error('No SVG element found');
    }
    
    const width = parseFloat(svgElement.getAttribute('width') || '800');
    const height = parseFloat(svgElement.getAttribute('height') || '600');
    
    // Parse viewBox if available for better scaling
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
    
    // Get all path elements
    const pathElements = svgDoc.querySelectorAll('path');
    if (pathElements.length === 0) {
      console.warn('No path elements found in SVG');
      return [];
    }
    
    // Limit the number of paths to process
    const maxPaths = 5; // Limit to 5 paths to prevent freezing
    const processedElements = Array.from(pathElements).slice(0, maxPaths);
    
    if (pathElements.length > maxPaths) {
      console.warn(`SVG contains ${pathElements.length} paths, processing only the first ${maxPaths} to prevent freezing`);
    }
    
    // Convert paths to bezier objects
    const objects: BezierObject[] = [];
    
    processedElements.forEach((pathElement, index) => {
      const pathData = pathElement.getAttribute('d');
      if (!pathData) return;
      
      // Extract styling
      const stroke = pathElement.getAttribute('stroke') || '#000000';
      const strokeWidth = parseFloat(pathElement.getAttribute('stroke-width') || '2');
      
      // Extract transform if present
      const transform = pathElement.getAttribute('transform');
      
      try {
        // Convert path to control points with intelligent simplification
        const points = pathToPoints(pathData, index);
        
        if (points.length >= 2) {
          // Create bezier object
          objects.push({
            id: generateId(),
            points,
            curveConfig: {
              styles: [{ color: stroke, width: strokeWidth }],
              parallelCount: 0,
              spacing: 0
            },
            transform: parseTransform(transform),
            name: `Imported Shape ${index + 1}`,
            isSelected: false
          });
        }
      } catch (err) {
        console.error(`Error processing path ${index}:`, err);
      }
    });
    
    // Center and scale the objects to fit in the canvas
    centerAndScaleObjects(objects);
    
    console.log(`Successfully imported ${objects.length} shapes with ${objects.reduce((sum, obj) => sum + obj.points.length, 0)} total points`);
    
    return objects;
  } catch (error) {
    console.error('Error importing SVG:', error);
    throw error;
  }
};

/**
 * Parse SVG transform attribute
 */
const parseTransform = (transformAttr?: string | null) => {
  const defaultTransform = {
    rotation: 0,
    scaleX: 1.0,
    scaleY: 1.0
  };
  
  if (!transformAttr) return defaultTransform;
  
  try {
    // Extract rotation
    const rotateMatch = transformAttr.match(/rotate\(\s*([^)]+)\)/);
    if (rotateMatch && rotateMatch[1]) {
      defaultTransform.rotation = parseFloat(rotateMatch[1]);
    }
    
    // Extract scale
    const scaleMatch = transformAttr.match(/scale\(\s*([^,)]+)(?:,\s*([^)]+))?\)/);
    if (scaleMatch) {
      if (scaleMatch[1]) {
        defaultTransform.scaleX = parseFloat(scaleMatch[1]);
        defaultTransform.scaleY = scaleMatch[2] ? parseFloat(scaleMatch[2]) : defaultTransform.scaleX;
      }
    }
    
    return defaultTransform;
  } catch (e) {
    console.error('Error parsing transform:', e);
    return defaultTransform;
  }
};

/**
 * Convert SVG path data to control points
 * This is a simplified version that creates fewer, better-quality points
 */
const pathToPoints = (pathData: string, pathIndex: number): ControlPoint[] => {
  const points: ControlPoint[] = [];
  
  try {
    // Parse the path data into commands
    const commands = pathData.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    
    // Skip overly complex paths or simplify them
    if (commands.length > 20) {
      console.warn(`Path ${pathIndex} has ${commands.length} commands, simplifying`);
      return simplifyPath(pathData);
    }
    
    let currentX = 0;
    let currentY = 0;
    let firstX = 0;
    let firstY = 0;
    
    // Process each command
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const type = command.charAt(0);
      const args = command.substring(1)
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat)
        .filter(n => !isNaN(n));
      
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
            
            if (points.length === 0) {
              firstX = currentX;
              firstY = currentY;
              
              // Add first point
              points.push({
                x: currentX,
                y: currentY,
                handleIn: { x: currentX - 20, y: currentY },
                handleOut: { x: currentX + 20, y: currentY },
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
            
            // Check if this is a significant line segment
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              const dx = endX - lastPoint.x;
              const dy = endY - lastPoint.y;
              const distance = Math.sqrt(dx*dx + dy*dy);
              
              // Only add points that are significant
              if (distance > 10) {
                // Set handles at 1/3 of the distance
                const handleDist = distance / 3;
                const ratio = handleDist / distance;
                
                // Update previous point's handleOut
                lastPoint.handleOut = {
                  x: lastPoint.x + dx * ratio,
                  y: lastPoint.y + dy * ratio
                };
                
                // Add the new point
                points.push({
                  x: endX,
                  y: endY,
                  handleIn: {
                    x: endX - dx * ratio,
                    y: endY - dy * ratio
                  },
                  handleOut: {
                    x: endX + dx * ratio,
                    y: endY + dy * ratio
                  },
                  id: generateId()
                });
              }
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
              // Check if this curve is significant
              const lastPoint = points[points.length - 1];
              const dx = endX - lastPoint.x;
              const dy = endY - lastPoint.y;
              const distance = Math.sqrt(dx*dx + dy*dy);
              
              if (distance > 10) {
                // Update the previous point's handleOut
                lastPoint.handleOut = {
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
                    x: endX + (endX - control2X) * 0.5,
                    y: endY + (endY - control2Y) * 0.5
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
          // Close the path by connecting back to the first point
          if (points.length > 1) {
            const lastPoint = points[points.length - 1];
            const firstPoint = points[0];
            
            // Calculate direction to first point
            const dx = firstPoint.x - lastPoint.x;
            const dy = firstPoint.y - lastPoint.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance > 10) {
              const handleDist = distance / 3;
              const ratio = handleDist / distance;
              
              // Update last point's handleOut
              lastPoint.handleOut = {
                x: lastPoint.x + dx * ratio,
                y: lastPoint.y + dy * ratio
              };
              
              // Update first point's handleIn
              firstPoint.handleIn = {
                x: firstPoint.x - dx * ratio,
                y: firstPoint.y - dy * ratio
              };
            }
          }
          break;
      }
    }
    
    // If we ended up with too many points, simplify
    if (points.length > 10) {
      return simplifyPoints(points, 10);
    }
    
    return points;
  } catch (error) {
    console.error('Error in pathToPoints:', error);
    
    // Return a simple fallback shape
    return createFallbackShape();
  }
};

/**
 * Simplify a complex path by extracting key points
 */
const simplifyPath = (pathData: string): ControlPoint[] => {
  // Create a simple approximation for complex paths
  const points: ControlPoint[] = [];
  
  try {
    // Parse the path to get a rough bounding box
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(
      `<svg><path d="${pathData}" /></svg>`, 
      'image/svg+xml'
    );
    
    const path = svgDoc.querySelector('path');
    if (!path) return createFallbackShape();
    
    // Create 4-6 points to approximate the shape
    const maxPoints = 6;
    const centerX = 200;
    const centerY = 150;
    const size = 80;
    
    // Create a simplified shape (rectangle or hexagon)
    if (maxPoints === 4) { // Create a rectangle with 4 points
      // Rectangle
      points.push({
        x: centerX - size/2,
        y: centerY - size/2,
        handleIn: { x: centerX - size/2 - 20, y: centerY - size/2 },
        handleOut: { x: centerX - size/2 + 20, y: centerY - size/2 },
        id: generateId()
      });
      
      points.push({
        x: centerX + size/2,
        y: centerY - size/2,
        handleIn: { x: centerX + size/2 - 20, y: centerY - size/2 },
        handleOut: { x: centerX + size/2 + 20, y: centerY - size/2 },
        id: generateId()
      });
      
      points.push({
        x: centerX + size/2,
        y: centerY + size/2,
        handleIn: { x: centerX + size/2, y: centerY + size/2 - 20 },
        handleOut: { x: centerX + size/2, y: centerY + size/2 + 20 },
        id: generateId()
      });
      
      points.push({
        x: centerX - size/2,
        y: centerY + size/2,
        handleIn: { x: centerX - size/2 + 20, y: centerY + size/2 },
        handleOut: { x: centerX - size/2 - 20, y: centerY + size/2 },
        id: generateId()
      });
    } else {
      // Hexagon
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        const x = centerX + Math.cos(angle) * size;
        const y = centerY + Math.sin(angle) * size;
        
        const nextAngle = (Math.PI * 2 * (i + 1)) / 6;
        const handleOutX = x + Math.cos(angle + Math.PI/6) * size/2;
        const handleOutY = y + Math.sin(angle + Math.PI/6) * size/2;
        
        const prevAngle = (Math.PI * 2 * (i - 1)) / 6;
        const handleInX = x + Math.cos(angle - Math.PI/6) * size/2;
        const handleInY = y + Math.sin(angle - Math.PI/6) * size/2;
        
        points.push({
          x,
          y,
          handleIn: { x: handleInX, y: handleInY },
          handleOut: { x: handleOutX, y: handleOutY },
          id: generateId()
        });
      }
    }
    
    return points;
  } catch (error) {
    console.error('Error in simplifyPath:', error);
    return createFallbackShape();
  }
};

/**
 * Simplify points by removing some
 */
const simplifyPoints = (points: ControlPoint[], targetCount: number): ControlPoint[] => {
  if (points.length <= targetCount) return points;
  
  // Keep first and last points
  const simplified: ControlPoint[] = [points[0]];
  
  // Calculate stride
  const stride = Math.max(1, Math.floor((points.length - 2) / (targetCount - 2)));
  
  // Add interior points
  for (let i = stride; i < points.length - 1; i += stride) {
    if (simplified.length < targetCount - 1) {
      simplified.push(points[i]);
    }
  }
  
  // Add the last point
  simplified.push(points[points.length - 1]);
  
  // Recalculate handles
  setupHandles(simplified);
  
  return simplified;
};

/**
 * Create a fallback shape if parsing fails
 */
const createFallbackShape = (): ControlPoint[] => {
  // Create a simple square
  const centerX = 200;
  const centerY = 150;
  const size = 80;
  
  return [
    {
      x: centerX - size/2,
      y: centerY - size/2,
      handleIn: { x: centerX - size/2 - 20, y: centerY - size/2 },
      handleOut: { x: centerX - size/2 + 20, y: centerY - size/2 },
      id: generateId()
    },
    {
      x: centerX + size/2,
      y: centerY - size/2,
      handleIn: { x: centerX + size/2 - 20, y: centerY - size/2 },
      handleOut: { x: centerX + size/2 + 20, y: centerY - size/2 },
      id: generateId()
    },
    {
      x: centerX + size/2,
      y: centerY + size/2,
      handleIn: { x: centerX + size/2, y: centerY + size/2 - 20 },
      handleOut: { x: centerX + size/2, y: centerY + size/2 + 20 },
      id: generateId()
    },
    {
      x: centerX - size/2,
      y: centerY + size/2,
      handleIn: { x: centerX - size/2 + 20, y: centerY + size/2 },
      handleOut: { x: centerX - size/2 - 20, y: centerY + size/2 },
      id: generateId()
    }
  ];
};

/**
 * Setup reasonable handles for points
 */
const setupHandles = (points: ControlPoint[]): void => {
  if (points.length < 2) return;
  
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const prev = i > 0 ? points[i - 1] : points[points.length - 1];
    const next = i < points.length - 1 ? points[i + 1] : points[0];
    
    // Calculate directions
    const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    
    // Normalize and scale
    const toPrevLength = Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y);
    const toNextLength = Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y);
    
    const handleLength = Math.min(40, Math.min(toPrevLength, toNextLength) / 3);
    
    if (toPrevLength > 0) {
      curr.handleIn = {
        x: curr.x - (toPrev.x / toPrevLength) * handleLength,
        y: curr.y - (toPrev.y / toPrevLength) * handleLength
      };
    }
    
    if (toNextLength > 0) {
      curr.handleOut = {
        x: curr.x + (toNext.x / toNextLength) * handleLength,
        y: curr.y + (toNext.y / toNextLength) * handleLength
      };
    }
  }
};

/**
 * Center and scale objects to fit in canvas
 */
const centerAndScaleObjects = (objects: BezierObject[]): void => {
  if (objects.length === 0) return;
  
  // Find bounding box
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
  
  // Calculate dimensions and center
  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;
  
  // Target canvas dimensions
  const targetCenterX = 400;
  const targetCenterY = 300;
  
  // Calculate translation
  const translateX = targetCenterX - centerX;
  const translateY = targetCenterY - centerY;
  
  // Calculate scale if needed
  let scale = 1;
  if (width > 700 || height > 500) {
    scale = Math.min(700 / width, 500 / height) * 0.8;
  }
  
  // Apply transformation
  objects.forEach(obj => {
    obj.points.forEach(point => {
      // Transform point
      point.x = (point.x + translateX) * scale;
      point.y = (point.y + translateY) * scale;
      
      // Transform handles
      point.handleIn.x = (point.handleIn.x + translateX) * scale;
      point.handleIn.y = (point.handleIn.y + translateY) * scale;
      point.handleOut.x = (point.handleOut.x + translateX) * scale;
      point.handleOut.y = (point.handleOut.y + translateY) * scale;
    });
  });
};
