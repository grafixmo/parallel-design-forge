import { ControlPoint, BezierObject } from '@/types/bezier';
import { generateId } from './bezierUtils';

/**
 * Simplified curve-focused SVG importer that prevents freezing and visual clutter
 */

// Main function to import SVG and convert to bezier objects
export const importSVGtoCurves = (svgContent: string): BezierObject[] => {
  try {
    console.log('Starting curve-focused SVG import...');
    
    // Parse SVG content
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    
    // Check for parsing errors
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
      console.error('SVG parse error:', parserError.textContent);
      throw new Error('Invalid SVG format');
    }
    
    // Get all path elements
    const pathElements = svgDoc.querySelectorAll('path');
    if (pathElements.length === 0) {
      console.warn('No path elements found in SVG');
      return [];
    }
    
    // Limit the number of paths to process to prevent freezing
    const maxPaths = 10;
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
      
      try {
        // Convert path to control points with intelligent simplification
        const points = intelligentPathToPoints(pathData, index);
        
        if (points.length >= 2) {
          // Create bezier object with the points
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
            name: `Curve ${index + 1}`,
            isSelected: false
          });
        }
      } catch (err) {
        console.error(`Error processing path ${index}:`, err);
      }
    });
    
    // Center and scale the objects if we have any
    if (objects.length > 0) {
      centerAndScaleObjects(objects);
    }
    
    console.log(`Successfully imported ${objects.length} curves with ${objects.reduce((sum, obj) => sum + obj.points.length, 0)} total points`);
    
    return objects;
  } catch (error) {
    console.error('Error importing SVG:', error);
    throw error;
  }
};

// Convert path to control points with intelligent simplification
const intelligentPathToPoints = (pathData: string, pathIndex: number): ControlPoint[] => {
  // Track state during path processing
  let currentX = 0;
  let currentY = 0;
  let firstX = 0;
  let firstY = 0;
  let points: ControlPoint[] = [];
  
  try {
    // Parse SVG path commands
    const commands = pathData.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    
    // Skip overly complex paths
    if (commands.length > 30) {
      console.warn(`Path ${pathIndex} has ${commands.length} commands, simplifying to prevent freezing`);
    }
    
    // Analyze the path to determine if it's complex
    const isComplexPath = commands.length > 15 || pathData.length > 200;
    
    // Use different strategies for simple vs complex paths
    if (isComplexPath) {
      // For complex paths, extract just the key points
      return extractKeyPoints(pathData, pathIndex);
    }
    
    // For simpler paths, process more carefully
    for (let i = 0; i < Math.min(commands.length, 30); i++) {
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
            
            // Add the first point
            if (points.length === 0) {
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
            
            // Only add points that are significant distance apart
            const lastPoint = points[points.length - 1];
            const dx = endX - lastPoint.x;
            const dy = endY - lastPoint.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance > 15) { // Only add points that are more than 15px apart
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
            
            // Check if this curve is significant
            const lastPoint = points[points.length - 1];
            const dx = endX - lastPoint.x;
            const dy = endY - lastPoint.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance > 10) { // Only add points for significant curves
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
                  x: endX + (endX - control2X) * 0.5, // Shorter handle out
                  y: endY + (endY - control2Y) * 0.5
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
          // Only close path if it adds value
          if (points.length > 1 && (Math.abs(currentX - firstX) > 10 || Math.abs(currentY - firstY) > 10)) {
            const lastPoint = points[points.length - 1];
            const firstPoint = points[0];
            
            // Calculate handles for a smooth connection back to start
            const dx = firstPoint.x - lastPoint.x;
            const dy = firstPoint.y - lastPoint.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance > 0) {
              const handleDistance = distance / 3;
              const ratio = handleDistance / distance;
              
              // Update the last point's handle out
              lastPoint.handleOut = {
                x: lastPoint.x + dx * ratio,
                y: lastPoint.y + dy * ratio
              };
              
              // Update the first point's handle in
              firstPoint.handleIn = {
                x: firstPoint.x - dx * ratio,
                y: firstPoint.y - dy * ratio
              };
            }
          }
          break;
      }
    }
    
    // If we ended up with too many points, simplify further
    if (points.length > 12) {
      points = simplifyPoints(points, 12);
    }
    
    return points;
  } catch (error) {
    console.error('Error in intelligentPathToPoints:', error);
    // Return a simple square as fallback
    return createFallbackShape(pathIndex);
  }
};

// Extract just key points from a complex path
const extractKeyPoints = (pathData: string, pathIndex: number): ControlPoint[] => {
  try {
    // Parse SVG path commands
    const commands = pathData.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    const points: ControlPoint[] = [];
    
    let currentX = 0;
    let currentY = 0;
    let firstX = 0;
    let firstY = 0;
    
    // Just extract key points (start points and end points of curves)
    // with a maximum number of points
    const maxPoints = 8;
    let pointsAdded = 0;
    
    for (let i = 0; i < commands.length && pointsAdded < maxPoints; i++) {
      const command = commands[i];
      const type = command.charAt(0);
      const args = command.substring(1)
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat)
        .filter(n => !isNaN(n));
      
      // Only process move and curve endpoints to get an approximation
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
              points.push({
                x: currentX,
                y: currentY,
                handleIn: { 
                  x: currentX - 20, 
                  y: currentY 
                },
                handleOut: { 
                  x: currentX + 20, 
                  y: currentY 
                },
                id: generateId()
              });
              pointsAdded++;
            }
          }
          break;
          
        case 'C': // Cubic Bézier (absolute)
        case 'c': // Cubic Bézier (relative)
          if (args.length >= 6) {
            let endX, endY;
            
            if (type === 'C') {
              endX = args[4];
              endY = args[5];
            } else {
              endX = currentX + args[4];
              endY = currentY + args[5];
            }
            
            // Only add this point if it's far enough from the last one
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              const dx = endX - lastPoint.x;
              const dy = endY - lastPoint.y;
              const distance = Math.sqrt(dx*dx + dy*dy);
              
              if (distance > 30) { // Only significant points
                points.push({
                  x: endX,
                  y: endY,
                  handleIn: { 
                    x: endX - 20, 
                    y: endY 
                  },
                  handleOut: { 
                    x: endX + 20, 
                    y: endY 
                  },
                  id: generateId()
                });
                pointsAdded++;
              }
            }
            
            currentX = endX;
            currentY = endY;
          }
          break;
          
        case 'L': // Line to (absolute)
        case 'l': // Line to (relative)
          if (args.length >= 2 && i % 3 === 0) { // Only sample some of the line points
            let endX, endY;
            
            if (type === 'L') {
              endX = args[0];
              endY = args[1];
            } else {
              endX = currentX + args[0];
              endY = currentY + args[1];
            }
            
            // Only add this point if it's far enough from the last one
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              const dx = endX - lastPoint.x;
              const dy = endY - lastPoint.y;
              const distance = Math.sqrt(dx*dx + dy*dy);
              
              if (distance > 50) { // Only very significant points
                points.push({
                  x: endX,
                  y: endY,
                  handleIn: { 
                    x: endX - 20, 
                    y: endY 
                  },
                  handleOut: { 
                    x: endX + 20, 
                    y: endY 
                  },
                  id: generateId()
                });
                pointsAdded++;
              }
            }
            
            currentX = endX;
            currentY = endY;
          }
          break;
      }
    }
    
    // If we found some points but not enough for a good shape, add some connecting points
    if (points.length >= 2 && points.length < 4) {
      // Calculate the bounding box
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;
      
      points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
      
      // Add a point at midpoints if needed
      if (points.length === 2) {
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        
        points.splice(1, 0, {
          x: midX,
          y: minY,
          handleIn: { x: midX - 20, y: minY },
          handleOut: { x: midX + 20, y: minY },
          id: generateId()
        });
        
        points.push({
          x: midX,
          y: maxY,
          handleIn: { x: midX - 20, y: maxY },
          handleOut: { x: midX + 20, y: maxY },
          id: generateId()
        });
      }
    }
    
    // If we still don't have enough points, create a simple shape
    if (points.length < 2) {
      return createFallbackShape(pathIndex);
    }
    
    // Setup decent handles
    setupHandles(points);
    
    return points;
  } catch (error) {
    console.error('Error in extractKeyPoints:', error);
    return createFallbackShape(pathIndex);
  }
};

// Setup reasonable handles for a set of points
const setupHandles = (points: ControlPoint[]): void => {
  if (points.length < 2) return;
  
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const prev = i > 0 ? points[i - 1] : points[points.length - 1];
    const next = i < points.length - 1 ? points[i + 1] : points[0];
    
    // Calculate directions to previous and next points
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

// Simplify points by removing some
const simplifyPoints = (points: ControlPoint[], targetCount: number): ControlPoint[] => {
  if (points.length <= targetCount) return points;
  
  // Keep first and last points always
  const simplified: ControlPoint[] = [points[0]];
  
  // Calculate how many interior points to keep
  const interiorPointsToKeep = targetCount - 2;
  
  if (interiorPointsToKeep <= 0) {
    simplified.push(points[points.length - 1]);
    return simplified;
  }
  
  // Calculate stride to skip points
  const stride = Math.max(1, Math.floor((points.length - 2) / interiorPointsToKeep));
  
  // Add interior points at regular intervals
  for (let i = stride; i < points.length - 1; i += stride) {
    simplified.push(points[i]);
    if (simplified.length >= targetCount - 1) break;
  }
  
  // Add the last point
  simplified.push(points[points.length - 1]);
  
  // Setup handles for the simplified set
  setupHandles(simplified);
  
  return simplified;
};

// Create a fallback shape if parsing fails
const createFallbackShape = (pathIndex: number): ControlPoint[] => {
  // Create a simple square
  const offset = pathIndex * 20;
  const size = 80;
  
  const points: ControlPoint[] = [
    {
      x: 100 + offset,
      y: 100 + offset,
      handleIn: { x: 80 + offset, y: 100 + offset },
      handleOut: { x: 120 + offset, y: 100 + offset },
      id: generateId()
    },
    {
      x: 100 + size + offset,
      y: 100 + offset,
      handleIn: { x: 100 + size - 20 + offset, y: 100 + offset },
      handleOut: { x: 100 + size + 20 + offset, y: 100 + offset },
      id: generateId()
    },
    {
      x: 100 + size + offset,
      y: 100 + size + offset,
      handleIn: { x: 100 + size + offset, y: 100 + size - 20 + offset },
      handleOut: { x: 100 + size + offset, y: 100 + size + 20 + offset },
      id: generateId()
    },
    {
      x: 100 + offset,
      y: 100 + size + offset,
      handleIn: { x: 100 + 20 + offset, y: 100 + size + offset },
      handleOut: { x: 100 - 20 + offset, y: 100 + size + offset },
      id: generateId()
    }
  ];
  
  return points;
};

// Center and scale objects to fit in canvas
const centerAndScaleObjects = (objects: BezierObject[]): void => {
  if (objects.length === 0) return;
  
  // Find bounding box of all points
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  objects.forEach(obj => {
    obj.points.forEach(point => {
      minX = Math.min(minX, point.x, point.handleIn.x, point.handleOut.x);
      minY = Math.min(minY, point.y, point.handleIn.y, point.handleOut.y);
      maxX = Math.max(maxX, point.x, point.handleIn.x, point.handleOut.x);
      maxY = Math.max(maxY, point.y, point.handleIn.y, point.handleOut.y);
    });
  });
  
  // Calculate dimensions and center
  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;
  
  // Target canvas center (approximate)
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
      // Transform main point
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
