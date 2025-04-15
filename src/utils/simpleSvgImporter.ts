
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
 * This is a much simpler version that creates fewer, better-positioned points
 */
export const importSVG = (svgContent: string): BezierObject[] => {
  try {
    // Parse SVG content
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    
    // Check for parsing errors
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Invalid SVG format');
    }
    
    // Get viewBox or width/height
    const svgElement = svgDoc.querySelector('svg');
    let viewBox = { width: 800, height: 600 };
    
    if (svgElement) {
      const viewBoxAttr = svgElement.getAttribute('viewBox');
      if (viewBoxAttr) {
        const [, , w, h] = viewBoxAttr.split(' ').map(parseFloat);
        if (!isNaN(w) && !isNaN(h)) {
          viewBox = { width: w, height: h };
        }
      } else {
        const width = parseFloat(svgElement.getAttribute('width') || '800');
        const height = parseFloat(svgElement.getAttribute('height') || '600');
        viewBox = { width, height };
      }
    }
    
    // Get all path elements
    const pathElements = Array.from(svgDoc.querySelectorAll('path'));
    if (pathElements.length === 0) {
      console.warn('No path elements found in SVG');
      return [];
    }
    
    // Limit to max 5 paths to prevent freezing
    const maxPaths = 5;
    if (pathElements.length > maxPaths) {
      console.warn(`SVG contains ${pathElements.length} paths, limiting to ${maxPaths} to prevent freezing`);
      pathElements.length = maxPaths;
    }
    
    // Convert paths to BezierObjects
    const objects: BezierObject[] = [];
    const canvasWidth = 800;
    const canvasHeight = 600;
    
    pathElements.forEach((pathElement, index) => {
      const pathData = pathElement.getAttribute('d');
      if (!pathData) return;
      
      // Create simple shapes based on path data
      try {
        // Extract path properties
        const stroke = pathElement.getAttribute('stroke') || '#000000';
        const strokeWidth = parseFloat(pathElement.getAttribute('stroke-width') || '2');
        
        // Convert path to simple control points (maximum 8 points per shape)
        const points = convertPathToPoints(pathData, index);
        
        if (points.length >= 2) {
          // Scale points to fit canvas
          const scaledPoints = scalePointsToCanvas(points, viewBox, canvasWidth, canvasHeight);
          
          // Create bezier object
          objects.push({
            id: generateId(),
            points: scaledPoints,
            curveConfig: {
              styles: [{ color: stroke, width: strokeWidth }],
              parallelCount: 0,
              spacing: 0
            },
            transform: {
              rotation: 0,
              scaleX: 1.0,
              scaleY: 1.0
            },
            name: `Imported Shape ${index + 1}`,
            isSelected: false
          });
        }
      } catch (error) {
        console.error(`Error processing path ${index}:`, error);
      }
    });
    
    return objects;
  } catch (error) {
    console.error('Error importing SVG:', error);
    throw error;
  }
};

/**
 * Convert SVG path data to control points with a simpler approach
 * Limits to max 8 points per shape and sets proper handles
 */
const convertPathToPoints = (pathData: string, pathIndex: number): ControlPoint[] => {
  try {
    // Use a very simple approach: create a small number of evenly distributed points
    // This prevents freezing and creates cleaner shapes
    
    // For demo purpose, if path is too complex, create simple shapes
    if (pathData.length > 100) {
      return createSimpleShape(pathIndex);
    }
    
    // Extract basic commands
    const commands = pathData.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    
    // If too many commands, create a simple shape instead
    if (commands.length > 20) {
      return createSimpleShape(pathIndex);
    }
    
    // Try to parse the path data
    const points: ControlPoint[] = [];
    let currentX = 0;
    let currentY = 0;
    let firstX = 0;
    let firstY = 0;
    
    // Process only the main commands
    for (let i = 0; i < Math.min(commands.length, 20); i++) {
      const command = commands[i];
      const type = command.charAt(0);
      const args = command.substring(1)
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat)
        .filter(n => !isNaN(n));
      
      // Only handle the most common commands
      switch (type) {
        case 'M': // Move to (absolute)
          if (args.length >= 2) {
            currentX = args[0];
            currentY = args[1];
            
            if (points.length === 0) {
              firstX = currentX;
              firstY = currentY;
              
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
          if (args.length >= 2) {
            const newX = args[0];
            const newY = args[1];
            
            // Skip if too close to previous point
            if (points.length > 0) {
              const prevPoint = points[points.length - 1];
              const distance = Math.sqrt(
                Math.pow(newX - prevPoint.x, 2) + 
                Math.pow(newY - prevPoint.y, 2)
              );
              
              if (distance > 10) {
                // Add a point with reasonable handles
                points.push({
                  x: newX,
                  y: newY,
                  handleIn: { 
                    x: newX - (newX - prevPoint.x) / 3, 
                    y: newY - (newY - prevPoint.y) / 3 
                  },
                  handleOut: { 
                    x: newX + (newX - prevPoint.x) / 3, 
                    y: newY + (newY - prevPoint.y) / 3 
                  },
                  id: generateId()
                });
                
                currentX = newX;
                currentY = newY;
              }
            }
          }
          break;
        
        case 'Z': // Close path
          if (points.length > 1) {
            // Connect back to first point
            const lastPoint = points[points.length - 1];
            const distance = Math.sqrt(
              Math.pow(firstX - lastPoint.x, 2) + 
              Math.pow(firstY - lastPoint.y, 2)
            );
            
            if (distance > 10) {
              // Update the last point's handle
              lastPoint.handleOut = {
                x: lastPoint.x + (firstX - lastPoint.x) / 3,
                y: lastPoint.y + (firstY - lastPoint.y) / 3
              };
              
              // Update the first point's handle
              points[0].handleIn = {
                x: firstX - (firstX - lastPoint.x) / 3,
                y: firstY - (firstY - lastPoint.y) / 3
              };
            }
          }
          break;
      }
      
      // Limit to 8 points to prevent complexity
      if (points.length >= 8) {
        break;
      }
    }
    
    // If we couldn't parse enough points, create a simple shape
    if (points.length < 2) {
      return createSimpleShape(pathIndex);
    }
    
    return points;
  } catch (error) {
    console.error('Error converting path to points:', error);
    return createSimpleShape(pathIndex);
  }
};

/**
 * Create a simple shape as a fallback
 */
const createSimpleShape = (index: number): ControlPoint[] => {
  // Offset each shape slightly
  const offset = index * 30;
  const centerX = 400 + offset;
  const centerY = 300 + offset;
  
  // Create a simple square or circle
  if (index % 2 === 0) {
    // Square
    const size = 100;
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
  } else {
    // Simplified circle with 4 points
    const radius = 50;
    return [
      {
        x: centerX,
        y: centerY - radius,
        handleIn: { x: centerX - radius/2, y: centerY - radius },
        handleOut: { x: centerX + radius/2, y: centerY - radius },
        id: generateId()
      },
      {
        x: centerX + radius,
        y: centerY,
        handleIn: { x: centerX + radius, y: centerY - radius/2 },
        handleOut: { x: centerX + radius, y: centerY + radius/2 },
        id: generateId()
      },
      {
        x: centerX,
        y: centerY + radius,
        handleIn: { x: centerX + radius/2, y: centerY + radius },
        handleOut: { x: centerX - radius/2, y: centerY + radius },
        id: generateId()
      },
      {
        x: centerX - radius,
        y: centerY,
        handleIn: { x: centerX - radius, y: centerY + radius/2 },
        handleOut: { x: centerX - radius, y: centerY - radius/2 },
        id: generateId()
      }
    ];
  }
};

/**
 * Scale points to fit the canvas
 */
const scalePointsToCanvas = (
  points: ControlPoint[],
  viewBox: { width: number, height: number },
  canvasWidth: number,
  canvasHeight: number
): ControlPoint[] => {
  // Find bounds of points
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  points.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  // Calculate scale to fit canvas (80% of canvas size)
  const scaleX = (canvasWidth * 0.8) / Math.max(width, 10);
  const scaleY = (canvasHeight * 0.8) / Math.max(height, 10);
  const scale = Math.min(scaleX, scaleY);
  
  // Calculate center points
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;
  const targetCenterX = canvasWidth / 2;
  const targetCenterY = canvasHeight / 2;
  
  // Scale and center all points
  return points.map(point => {
    // Scale and center main point
    const scaledX = targetCenterX + (point.x - centerX) * scale;
    const scaledY = targetCenterY + (point.y - centerY) * scale;
    
    // Scale handles relative to the main point
    const handleInDX = point.handleIn.x - point.x;
    const handleInDY = point.handleIn.y - point.y;
    const handleOutDX = point.handleOut.x - point.x;
    const handleOutDY = point.handleOut.y - point.y;
    
    return {
      x: scaledX,
      y: scaledY,
      handleIn: {
        x: scaledX + handleInDX * scale,
        y: scaledY + handleInDY * scale
      },
      handleOut: {
        x: scaledX + handleOutDX * scale,
        y: scaledY + handleOutDY * scale
      },
      id: point.id
    };
  });
};
