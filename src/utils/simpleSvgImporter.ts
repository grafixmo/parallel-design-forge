
import { ControlPoint, BezierObject } from '@/types/bezier';
import { generateId } from './bezierUtils';

/**
 * Simple SVG importer that focuses on parsing basic SVG path elements
 * and converting them to BezierObject format
 */

// Parse SVG content into BezierObjects
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
    
    // Get all path elements
    const pathElements = svgDoc.querySelectorAll('path');
    if (pathElements.length === 0) {
      console.warn('No path elements found in SVG');
      return [];
    }
    
    // Convert path elements to BezierObject objects
    const objects: BezierObject[] = [];
    pathElements.forEach((pathElement, index) => {
      const pathData = pathElement.getAttribute('d');
      if (!pathData) return;
      
      // Extract stroke properties with defaults
      const stroke = pathElement.getAttribute('stroke') || '#000000';
      const strokeWidth = parseFloat(pathElement.getAttribute('stroke-width') || '2');
      
      // Convert path data to simplified control points
      const points = simplifyPathToControlPoints(pathData);
      if (points.length < 2) return;
      
      // Create BezierObject
      objects.push({
        id: generateId(),
        points,
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
        name: `Imported Path ${index + 1}`,
        isSelected: false
      });
    });
    
    console.log(`Imported ${objects.length} paths with a total of ${objects.reduce((sum, obj) => sum + obj.points.length, 0)} points`);
    return objects;
  } catch (error) {
    console.error('Error importing SVG:', error);
    throw error;
  }
};

// Simplified path conversion that creates fewer control points
const simplifyPathToControlPoints = (pathData: string): ControlPoint[] => {
  const points: ControlPoint[] = [];
  
  try {
    // Parse SVG path commands - only focus on most common commands
    const commands = pathData.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    
    // Skip if too complex (prevents freezing on complex SVGs)
    if (commands.length > 100) {
      console.warn('Path too complex, simplifying');
      // Only process a subset of commands to prevent overwhelming the UI
      commands.length = Math.min(commands.length, 100);
    }
    
    let currentX = 0;
    let currentY = 0;
    let firstX = 0;
    let firstY = 0;
    
    // Track command count to prevent too many points
    let commandCount = 0;
    const maxCommands = 50; // Limit the number of commands we process
    
    for (let i = 0; i < commands.length && commandCount < maxCommands; i++) {
      const command = commands[i];
      const type = command.charAt(0);
      const args = command.substring(1)
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat)
        .filter(n => !isNaN(n));
      
      // Skip unsupported commands to avoid creating too many points
      if (!['M', 'm', 'L', 'l', 'C', 'c', 'Z', 'z'].includes(type)) {
        continue;
      }
      
      commandCount++;
      
      // Process main path commands
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
              points.push({
                x: currentX,
                y: currentY,
                handleIn: { 
                  x: currentX - 10, 
                  y: currentY 
                },
                handleOut: { 
                  x: currentX + 10, 
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
            
            // Skip points that are too close to the previous point
            const lastPoint = points[points.length - 1];
            const dx = endX - lastPoint.x;
            const dy = endY - lastPoint.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Only add points that are at least 5px away from the previous point
            if (distance > 5) {
              // For straight lines, place handles at 1/3 of the way
              const handleDistance = distance / 3;
              const ratio = handleDistance / distance;
              
              // Update previous point's handle out
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
              
              currentX = endX;
              currentY = endY;
            }
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
            
            // Skip points that are too close to the previous point
            const lastPoint = points[points.length - 1];
            const dx = endX - lastPoint.x;
            const dy = endY - lastPoint.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Only add points that are at least 5px away from the previous point
            if (distance > 5) {
              // Update the previous point's handleOut
              lastPoint.handleOut = {
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
                  x: endX + (endX - control2X),
                  y: endY + (endY - control2Y)
                },
                id: generateId()
              });
              
              currentX = endX;
              currentY = endY;
            }
          }
          break;
          
        case 'Z': // Close path
        case 'z':
          // Connect back to the first point
          if (points.length > 1 && (Math.abs(currentX - firstX) > 5 || Math.abs(currentY - firstY) > 5)) {
            const lastPoint = points[points.length - 1];
            
            // Calculate handles for a line back to the start
            const dx = firstX - lastPoint.x;
            const dy = firstY - lastPoint.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance > 0) {
              const handleDistance = distance / 3;
              const ratio = handleDistance / distance;
              
              // Update the last point's handle out
              lastPoint.handleOut = {
                x: lastPoint.x + dx * ratio,
                y: lastPoint.y + dy * ratio
              };
            }
            
            currentX = firstX;
            currentY = firstY;
          }
          break;
      }
    }
    
    // Scale and center points if needed
    if (points.length > 0) {
      centerAndScalePoints(points);
    }
    
    console.log(`Converted path to ${points.length} control points`);
    
    // Safety check: limit points to prevent UI freezing
    if (points.length > 30) {
      console.warn(`Simplifying path from ${points.length} to 30 points`);
      // Simplify by taking every nth point to get about 30 points
      const stride = Math.max(1, Math.floor(points.length / 30));
      const simplifiedPoints: ControlPoint[] = [];
      
      for (let i = 0; i < points.length; i += stride) {
        simplifiedPoints.push(points[i]);
      }
      
      // Always include the last point
      if (simplifiedPoints[simplifiedPoints.length - 1] !== points[points.length - 1]) {
        simplifiedPoints.push(points[points.length - 1]);
      }
      
      return simplifiedPoints;
    }
    
    return points;
  } catch (error) {
    console.error('Error converting path to control points:', error);
    return [];
  }
};

// Center and scale points to fit within the canvas
const centerAndScalePoints = (points: ControlPoint[]): void => {
  // Find bounds
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  points.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
    
    // Also check handles
    minX = Math.min(minX, point.handleIn.x, point.handleOut.x);
    minY = Math.min(minY, point.handleIn.y, point.handleOut.y);
    maxX = Math.max(maxX, point.handleIn.x, point.handleOut.x);
    maxY = Math.max(maxY, point.handleIn.y, point.handleOut.y);
  });
  
  // Calculate center and dimensions
  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;
  
  // Target canvas center
  const targetCenterX = 400; // Canvas width / 2
  const targetCenterY = 300; // Canvas height / 2
  
  // Calculate translation to center
  const translateX = targetCenterX - centerX;
  const translateY = targetCenterY - centerY;
  
  // Calculate scale if needed (to fit into 80% of canvas)
  let scale = 1;
  if (width > 600 || height > 400) {
    scale = Math.min(600 / width, 400 / height) * 0.8;
  }
  
  // Apply transformation to all points
  points.forEach(point => {
    // Transform main point
    point.x = (point.x + translateX) * scale;
    point.y = (point.y + translateY) * scale;
    
    // Transform handles
    point.handleIn.x = (point.handleIn.x + translateX) * scale;
    point.handleIn.y = (point.handleIn.y + translateY) * scale;
    point.handleOut.x = (point.handleOut.x + translateX) * scale;
    point.handleOut.y = (point.handleOut.y + translateY) * scale;
  });
};

// Helper to read SVG file
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
