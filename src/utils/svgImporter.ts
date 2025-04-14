import { ControlPoint, BezierObject, CurveConfig, TransformSettings, Point } from '../types/bezier';
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
  transform?: string;
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

// Maximum number of paths to process at once
const MAX_PATHS_PER_BATCH = 15;

// Parse SVG string into BezierObject objects with improved attribute preservation
export const parseSVGContent = async (svgContent: string): Promise<SVGImportResult> => {
  try {
    // Create a DOM parser
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    
    // Check for parsing errors
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Invalid SVG format: ' + parserError.textContent);
    }
    
    // Get the root SVG element
    const svgElement = svgDoc.querySelector('svg');
    if (!svgElement) {
      throw new Error('No SVG element found');
    }
    
    // Log parsing started
    console.log('Parsing SVG with dimensions:', 
      svgElement.getAttribute('width'), 
      svgElement.getAttribute('height')
    );
    
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
    const pathElements = Array.from(svgDoc.querySelectorAll('path'));
    if (pathElements.length === 0) {
      throw new Error('No paths found in the SVG');
    }
    
    console.log(`Found ${pathElements.length} paths in SVG`);
    
    if (pathElements.length > 100) {
      console.warn(`Large SVG detected with ${pathElements.length} paths. Processing may take time.`);
    }
    
    // Process paths in batches to prevent UI freezing
    const objects: BezierObject[] = [];
    
    // Extract path data with enhanced styling information
    const pathsData: SVGPathData[] = [];
    
    // Extract path data first
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
          strokeLinejoin: pathElement.getAttribute('stroke-linejoin') || undefined,
          transform: pathElement.getAttribute('transform') || undefined
        });
      }
    });
    
    // Process paths in batches to prevent UI freezing
    for (let i = 0; i < pathsData.length; i += MAX_PATHS_PER_BATCH) {
      const batch = pathsData.slice(i, i + MAX_PATHS_PER_BATCH);
      
      // Process batch
      const batchPromise = new Promise<BezierObject[]>((resolve) => {
        // Use setTimeout to give the UI thread a chance to breathe
        setTimeout(() => {
          const batchObjects = batch.map((pathData, index) => {
            try {
              const points = convertPathToPoints(pathData.path, pathData.transform);
              
              // Skip if no valid points
              if (points.length === 0) {
                console.warn(`Path ${i + index} has no valid points, skipping`);
                return null;
              }
              
              // Create curve config that preserves original styling
              const curveConfig: CurveConfig = {
                styles: [
                  { 
                    color: pathData.color, 
                    width: pathData.width 
                  }
                ],
                parallelCount: 0, // No parallel curves for imported SVGs
                spacing: 0
              };
              
              // Parse transform attribute
              const transform: TransformSettings = parseTransform(pathData.transform);
              
              // Create BezierObject with proper name and preserved attributes
              return {
                id: generateId(),
                points,
                curveConfig,
                transform,
                name: `Path ${i + index + 1}`,
                isSelected: false
              };
            } catch (err) {
              console.error(`Error processing path ${i + index}:`, err);
              return null;
            }
          }).filter(Boolean) as BezierObject[];
          
          resolve(batchObjects);
        }, 0);
      });
      
      const batchObjects = await batchPromise;
      objects.push(...batchObjects);
      
      // Log progress
      console.log(`Processed batch ${i / MAX_PATHS_PER_BATCH + 1}/${Math.ceil(pathsData.length / MAX_PATHS_PER_BATCH)}`);
      
      // Yield to browser to prevent freezing
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`SVG import complete: ${objects.length} objects created`);
    
    // Position imported objects to maintain original positions
    await positionImportedObjects(objects, { width, height, viewBox });
    
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

// Parse SVG transform attribute
const parseTransform = (transformAttr?: string): TransformSettings => {
  const defaultTransform: TransformSettings = {
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
        // If only one value is provided, use it for both scales
        defaultTransform.scaleY = scaleMatch[2] ? parseFloat(scaleMatch[2]) : defaultTransform.scaleX;
      }
    }
    
    return defaultTransform;
  } catch (e) {
    console.error('Error parsing transform:', e);
    return defaultTransform;
  }
};

// Position imported objects to maintain original layout and proportions
const positionImportedObjects = async (
  objects: BezierObject[], 
  svgInfo: { width: number, height: number, viewBox?: any }
): Promise<void> => {
  if (objects.length === 0) return;
  
  return new Promise<void>((resolve) => {
    setTimeout(() => {
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
      
      // If no viewBox is specified in the SVG, we need to center the objects
      if (!svgInfo.viewBox) {
        // Calculate dimensions
        const width = maxX - minX;
        const height = maxY - minY;
        
        // Calculate target canvas center
        const targetCenterX = 400; // Default canvas width / 2
        const targetCenterY = 300; // Default canvas height / 2
        
        // Calculate source center
        const sourceCenterX = minX + width / 2;
        const sourceCenterY = minY + height / 2;
        
        // Calculate offset to center the objects in canvas
        const offsetX = targetCenterX - sourceCenterX;
        const offsetY = targetCenterY - sourceCenterY;
        
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
        
        // Scale only if needed to fit in viewable area (preserving aspect ratio)
        if (width > 700 || height > 500) {
          const scale = Math.min(700 / width, 500 / height) * 0.9; // 90% of max scale for padding
          
          // Find center point after offset
          const centerX = sourceCenterX + offsetX;
          const centerY = sourceCenterY + offsetY;
          
          // Scale all objects around center
          objects.forEach(obj => {
            obj.points = obj.points.map(point => {
              // Distance from center
              const dx = point.x - centerX;
              const dy = point.y - centerY;
              
              // Scale distance
              const scaledX = centerX + dx * scale;
              const scaledY = centerY + dy * scale;
              
              // Also scale handles proportionally
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
      } else {
        // If viewBox is provided, try to maintain original positions
        const viewBoxWidth = svgInfo.viewBox.width;
        const viewBoxHeight = svgInfo.viewBox.height;
        
        // Calculate scale factor from viewBox to canvas
        const scaleX = 800 / viewBoxWidth;
        const scaleY = 600 / viewBoxHeight;
        const scale = Math.min(scaleX, scaleY) * 0.9; // Use 90% to create margin
        
        // Calculate translation to center the scaled viewBox
        const scaledViewBoxWidth = viewBoxWidth * scale;
        const scaledViewBoxHeight = viewBoxHeight * scale;
        
        const offsetX = (800 - scaledViewBoxWidth) / 2 - svgInfo.viewBox.minX * scale;
        const offsetY = (600 - scaledViewBoxHeight) / 2 - svgInfo.viewBox.minY * scale;
        
        // Apply scale and offset to all points
        objects.forEach(obj => {
          obj.points = obj.points.map(point => ({
            ...point,
            x: point.x * scale + offsetX,
            y: point.y * scale + offsetY,
            handleIn: {
              x: point.handleIn.x * scale + offsetX,
              y: point.handleIn.y * scale + offsetY
            },
            handleOut: {
              x: point.handleOut.x * scale + offsetX,
              y: point.handleOut.y * scale + offsetY
            }
          }));
        });
      }
      
      resolve();
    }, 0);
  });
};

// Improved SVG path to control points converter with higher precision and better handle placement
const convertPathToPoints = (path: string, transform?: string): ControlPoint[] => {
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
          // Better arc approximation
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
              // Improved arc handling to better approximate elliptical arcs
              const prevPoint = points[points.length - 1];
              const startX = prevPoint.x;
              const startY = prevPoint.y;
              
              // We'll use multiple cubic bezier segments to approximate the arc
              const arcPoints = approximateArc(
                startX, startY, 
                endX, endY, 
                rx, ry, 
                xAxisRotation, 
                largeArcFlag, 
                sweepFlag
              );
              
              if (arcPoints.length >= 3) {
                // Each arc segment needs 3 points: start, control1, control2, end
                // We already have the start point (prevPoint)
                
                for (let j = 0; j < arcPoints.length - 1; j += 3) {
                  const cp1 = arcPoints[j];
                  const cp2 = arcPoints[j + 1];
                  const end = arcPoints[j + 2];
                  
                  if (j === 0) {
                    // Update the previous point's handle out (first segment)
                    prevPoint.handleOut = {
                      x: cp1.x,
                      y: cp1.y
                    };
                  }
                  
                  // Add the endpoint with its handles
                  points.push({
                    x: end.x,
                    y: end.y,
                    handleIn: {
                      x: cp2.x,
                      y: cp2.y
                    },
                    handleOut: {
                      x: end.x + (end.x - cp2.x), // Mirror for now
                      y: end.y + (end.y - cp2.y)
                    },
                    id: generateId()
                  });
                }
              } else {
                // Fallback to simpler approximation if arc calculation fails
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

// Helper function to approximate elliptical arc with cubic bezier curves
const approximateArc = (
  x1: number, y1: number, 
  x2: number, y2: number, 
  rx: number, ry: number, 
  xAxisRotation: number, 
  largeArcFlag
