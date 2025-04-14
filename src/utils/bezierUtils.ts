import { ControlPoint, Point, CurveStyle, SelectionRect, BezierObject } from '../types/bezier';

// Generate a unique ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

// Calculate distance between two points
export const calculateDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Check if a point is near another point (within a radius)
export const isPointNear = (p1: Point, p2: Point, radius: number): boolean => {
  return calculateDistance(p1, p2) <= radius;
};

// Calculate normal vector at a point on the bezier curve
export const calculateNormal = (p0: Point, p1: Point): Point => {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  if (len === 0) return { x: 0, y: 0 };
  
  return {
    x: -dy / len,
    y: dx / len
  };
};

// Calculate a point at t (0-1) on a cubic bezier curve
export const calculateBezierPoint = (
  p0: Point, 
  p1: Point, 
  p2: Point, 
  p3: Point, 
  t: number
): Point => {
  const cx = 3 * (p1.x - p0.x);
  const bx = 3 * (p2.x - p1.x) - cx;
  const ax = p3.x - p0.x - cx - bx;
  
  const cy = 3 * (p1.y - p0.y);
  const by = 3 * (p2.y - p1.y) - cy;
  const ay = p3.y - p0.y - cy - by;
  
  const tSquared = t * t;
  const tCubed = tSquared * t;
  
  return {
    x: ax * tCubed + bx * tSquared + cx * t + p0.x,
    y: ay * tCubed + by * tSquared + cy * t + p0.y
  };
};

// Calculate a parallel curve point with offset distance
export const calculateParallelPoint = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
  distance: number
): Point => {
  const point = calculateBezierPoint(p0, p1, p2, p3, t);
  
  // Calculate derivative for normal
  const t2 = t * t;
  const t1 = 1 - t;
  const t12 = t1 * t1;
  
  const qx = 3 * t12 * (p1.x - p0.x) + 6 * t1 * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
  const qy = 3 * t12 * (p1.y - p0.y) + 6 * t1 * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y);
  
  const len = Math.sqrt(qx * qx + qy * qy);
  if (len === 0) return point;
  
  const nx = -qy / len;
  const ny = qx / len;
  
  return {
    x: point.x + nx * distance,
    y: point.y + ny * distance
  };
};

// Improved SVG path data generation from control points
export const generatePathData = (points: ControlPoint[], offset = 0): string => {
  if (points.length < 2) return '';
  
  let pathData = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    
    // Use properly calculated control points for smoother curves
    pathData += ` C ${current.handleOut.x} ${current.handleOut.y}, ${next.handleIn.x} ${next.handleIn.y}, ${next.x} ${next.y}`;
  }
  
  return pathData;
};

// Check if a point is inside a selection rectangle
export const isPointInSelectionRect = (point: Point, rect: SelectionRect): boolean => {
  const minX = Math.min(rect.startX, rect.startX + rect.width);
  const maxX = Math.max(rect.startX, rect.startX + rect.width);
  const minY = Math.min(rect.startY, rect.startY + rect.height);
  const maxY = Math.max(rect.startY, rect.startY + rect.height);
  
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
};

// Improved SVG path to bezier points converter with better handle placement
export const svgPathToBezierPoints = (pathData: string): ControlPoint[] => {
  const points: ControlPoint[] = [];
  const commands = pathData.match(/[MLCQTASZ][^MLCQTASZ]*/gi);
  
  if (!commands) return points;
  
  let currentX = 0;
  let currentY = 0;
  let firstX = 0;
  let firstY = 0;
  let lastControlX = 0;
  let lastControlY = 0;
  let hasStartedPath = false;
  
  for (const cmd of commands) {
    const type = cmd[0].toUpperCase();
    // More robust value parsing - handles different formats of numbers
    const values = cmd.substring(1).trim().split(/[\s,]+/).map(parseFloat).filter(v => !isNaN(v));
    
    // For relative commands, convert to absolute
    const isRelative = cmd[0] !== cmd[0].toUpperCase();
    
    switch (type) {
      case 'M': // Move to
        if (values.length >= 2) {
          const x = isRelative ? currentX + values[0] : values[0];
          const y = isRelative ? currentY + values[1] : values[1];
          
          // Start a new path
          if (!hasStartedPath) {
            firstX = x;
            firstY = y;
            hasStartedPath = true;
          }
          
          // Calculate proper handle positions
          const handleOffset = 50; // Default handle distance
          
          const newPoint = {
            x,
            y,
            handleIn: { 
              x: x - handleOffset, 
              y 
            },
            handleOut: { 
              x: x + handleOffset, 
              y 
            },
            id: generateId()
          };
          
          points.push(newPoint);
          
          // Update current position
          currentX = x;
          currentY = y;
          
          // Process subsequent points as Line commands
          for (let i = 2; i < values.length; i += 2) {
            if (i + 1 < values.length) {
              const lineX = isRelative ? currentX + values[i] : values[i];
              const lineY = isRelative ? currentY + values[i+1] : values[i+1];
              
              // Create a smooth curve between points
              const dx = lineX - currentX;
              const dy = lineY - currentY;
              const distance = Math.sqrt(dx*dx + dy*dy);
              const handleLen = Math.min(distance / 3, 50);
              
              // Add handles to previous point
              if (points.length > 0) {
                const prevPoint = points[points.length - 1];
                prevPoint.handleOut = {
                  x: prevPoint.x + (dx / distance) * handleLen,
                  y: prevPoint.y + (dy / distance) * handleLen
                };
              }
              
              // Add the new point
              const linePoint = {
                x: lineX,
                y: lineY,
                handleIn: {
                  x: lineX - (dx / distance) * handleLen,
                  y: lineY - (dy / distance) * handleLen
                },
                handleOut: {
                  x: lineX + (dx / distance) * handleLen,
                  y: lineY + (dy / distance) * handleLen
                },
                id: generateId()
              };
              
              points.push(linePoint);
              currentX = lineX;
              currentY = lineY;
            }
          }
        }
        break;
        
      case 'L': // Line to
        for (let i = 0; i < values.length; i += 2) {
          if (i + 1 < values.length) {
            const x = isRelative ? currentX + values[i] : values[i];
            const y = isRelative ? currentY + values[i+1] : values[i+1];
            
            // Calculate direction and handle lengths
            const dx = x - currentX;
            const dy = y - currentY;
            const distance = Math.sqrt(dx*dx + dy*dy);
            const handleLen = Math.min(distance / 3, 50);
            
            // Add handles to previous point if it exists
            if (points.length > 0) {
              const prevPoint = points[points.length - 1];
              prevPoint.handleOut = {
                x: prevPoint.x + (dx / distance) * handleLen,
                y: prevPoint.y + (dy / distance) * handleLen
              };
            }
            
            // Add the new point
            const newPoint = {
              x,
              y,
              handleIn: {
                x: x - (dx / distance) * handleLen,
                y: y - (dy / distance) * handleLen
              },
              handleOut: {
                x: x + (dx / distance) * handleLen,
                y: y + (dy / distance) * handleLen
              },
              id: generateId()
            };
            
            points.push(newPoint);
            currentX = x;
            currentY = y;
          }
        }
        break;
        
      case 'H': // Horizontal line
        for (let i = 0; i < values.length; i++) {
          const x = isRelative ? currentX + values[i] : values[i];
          
          // Calculate direction and handle lengths
          const dx = x - currentX;
          const distance = Math.abs(dx);
          const handleLen = Math.min(distance / 3, 50);
          const direction = dx > 0 ? 1 : -1;
          
          // Add handles to previous point if it exists
          if (points.length > 0) {
            const prevPoint = points[points.length - 1];
            prevPoint.handleOut = {
              x: prevPoint.x + direction * handleLen,
              y: prevPoint.y
            };
          }
          
          // Add the new point
          const newPoint = {
            x,
            y: currentY,
            handleIn: {
              x: x - direction * handleLen,
              y: currentY
            },
            handleOut: {
              x: x + direction * handleLen,
              y: currentY
            },
            id: generateId()
          };
          
          points.push(newPoint);
          currentX = x;
        }
        break;
        
      case 'V': // Vertical line
        for (let i = 0; i < values.length; i++) {
          const y = isRelative ? currentY + values[i] : values[i];
          
          // Calculate direction and handle lengths
          const dy = y - currentY;
          const distance = Math.abs(dy);
          const handleLen = Math.min(distance / 3, 50);
          const direction = dy > 0 ? 1 : -1;
          
          // Add handles to previous point if it exists
          if (points.length > 0) {
            const prevPoint = points[points.length - 1];
            prevPoint.handleOut = {
              x: prevPoint.x,
              y: prevPoint.y + direction * handleLen
            };
          }
          
          // Add the new point
          const newPoint = {
            x: currentX,
            y,
            handleIn: {
              x: currentX,
              y: y - direction * handleLen
            },
            handleOut: {
              x: currentX,
              y: y + direction * handleLen
            },
            id: generateId()
          };
          
          points.push(newPoint);
          currentY = y;
        }
        break;
        
      case 'C': // Cubic Bezier
        for (let i = 0; i < values.length; i += 6) {
          if (i + 5 < values.length) {
            const c1x = isRelative ? currentX + values[i] : values[i];
            const c1y = isRelative ? currentY + values[i+1] : values[i+1];
            const c2x = isRelative ? currentX + values[i+2] : values[i+2];
            const c2y = isRelative ? currentY + values[i+3] : values[i+3];
            const x = isRelative ? currentX + values[i+4] : values[i+4];
            const y = isRelative ? currentY + values[i+5] : values[i+5];
            
            // Improve existing points with better handle placement
            if (points.length > 0) {
              const prevPoint = points[points.length - 1];
              // Set handle out for the previous point
              prevPoint.handleOut = { x: c1x, y: c1y };
            }
            
            // Add the new end point with both handles
            const newPoint = {
              x,
              y,
              handleIn: { x: c2x, y: c2y },
              handleOut: { 
                // Mirror the handleIn by default
                x: x + (x - c2x),
                y: y + (y - c2y)
              },
              id: generateId()
            };
            
            points.push(newPoint);
            
            // Update current position and last control point
            currentX = x;
            currentY = y;
            lastControlX = c2x;
            lastControlY = c2y;
          }
        }
        break;
        
      case 'S': // Smooth cubic Bezier
        for (let i = 0; i < values.length; i += 4) {
          if (i + 3 < values.length) {
            // Calculate the first control point by reflecting the last control point
            let c1x, c1y;
            
            if (points.length > 0 && (type === 'S' || type === 'T')) {
              // Reflect the previous control point
              c1x = 2 * currentX - lastControlX;
              c1y = 2 * currentY - lastControlY;
            } else {
              // If no previous curve, control point is coincident with current point
              c1x = currentX;
              c1y = currentY;
            }
            
            const c2x = isRelative ? currentX + values[i] : values[i];
            const c2y = isRelative ? currentY + values[i+1] : values[i+1];
            const x = isRelative ? currentX + values[i+2] : values[i+2];
            const y = isRelative ? currentY + values[i+3] : values[i+3];
            
            // Update existing points with better handle placement
            if (points.length > 0) {
              const prevPoint = points[points.length - 1];
              prevPoint.handleOut = { x: c1x, y: c1y };
            }
            
            // Add the new end point with both handles
            const newPoint = {
              x,
              y,
              handleIn: { x: c2x, y: c2y },
              handleOut: { 
                x: x + (x - c2x),
                y: y + (y - c2y)
              },
              id: generateId()
            };
            
            points.push(newPoint);
            
            // Update current position and last control point
            currentX = x;
            currentY = y;
            lastControlX = c2x;
            lastControlY = c2y;
          }
        }
        break;
        
      case 'Q': // Quadratic Bezier
        for (let i = 0; i < values.length; i += 4) {
          if (i + 3 < values.length) {
            const qx = isRelative ? currentX + values[i] : values[i];
            const qy = isRelative ? currentY + values[i+1] : values[i+1];
            const x = isRelative ? currentX + values[i+2] : values[i+2];
            const y = isRelative ? currentY + values[i+3] : values[i+3];
            
            // Convert quadratic to cubic control points
            // CP1 = start + 2/3 * (QP - start)
            // CP2 = end + 2/3 * (QP - end)
            const cp1x = currentX + 2/3 * (qx - currentX);
            const cp1y = currentY + 2/3 * (qy - currentY);
            const cp2x = x + 2/3 * (qx - x);
            const cp2y = y + 2/3 * (qy - y);
            
            // Update existing points with better handle placement
            if (points.length > 0) {
              const prevPoint = points[points.length - 1];
              prevPoint.handleOut = { x: cp1x, y: cp1y };
            }
            
            // Add the new end point with both handles
            const newPoint = {
              x,
              y,
              handleIn: { x: cp2x, y: cp2y },
              handleOut: { 
                x: x + (x - cp2x),
                y: y + (y - cp2y)
              },
              id: generateId()
            };
            
            points.push(newPoint);
            
            // Update current position and last control point
            currentX = x;
            currentY = y;
            lastControlX = qx;
            lastControlY = qy;
          }
        }
        break;
        
      case 'T': // Smooth quadratic Bezier
        for (let i = 0; i < values.length; i += 2) {
          if (i + 1 < values.length) {
            // Calculate the control point by reflecting the last control point
            let qx, qy;
            
            if (type === 'T' && (points.length > 0)) {
              // Reflect the previous control point
              qx = 2 * currentX - lastControlX;
              qy = 2 * currentY - lastControlY;
            } else {
              // If no previous curve, control point is coincident with current point
              qx = currentX;
              qy = currentY;
            }
            
            const x = isRelative ? currentX + values[i] : values[i];
            const y = isRelative ? currentY + values[i+1] : values[i+1];
            
            // Convert quadratic to cubic control points
            const cp1x = currentX + 2/3 * (qx - currentX);
            const cp1y = currentY + 2/3 * (qy - currentY);
            const cp2x = x + 2/3 * (qx - x);
            const cp2y = y + 2/3 * (qy - y);
            
            // Update existing points with better handle placement
            if (points.length > 0) {
              const prevPoint = points[points.length - 1];
              prevPoint.handleOut = { x: cp1x, y: cp1y };
            }
            
            // Add the new end point with both handles
            const newPoint = {
              x,
              y,
              handleIn: { x: cp2x, y: cp2y },
              handleOut: { 
                x: x + (x - cp2x),
                y: y + (y - cp2y)
              },
              id: generateId()
            };
            
            points.push(newPoint);
            
            // Update current position and last control point
            currentX = x;
            currentY = y;
            lastControlX = qx;
            lastControlY = qy;
          }
        }
        break;
        
      case 'A': // Arc
        // Elliptical arc requires complex calculations to convert to cubic bezier
        for (let i = 0; i < values.length; i += 7) {
          if (i + 6 < values.length) {
            const rx = values[i];
            const ry = values[i+1];
            const angle = values[i+2];
            const largeArcFlag = values[i+3];
            const sweepFlag = values[i+4];
            const x = isRelative ? currentX + values[i+5] : values[i+5];
            const y = isRelative ? currentY + values[i+6] : values[i+6];
            
            // Convert arc to cubic bezier segments
            const arcToBezier = approximateArcToBezier(
              currentX, currentY, 
              rx, ry, 
              angle * Math.PI / 180, 
              largeArcFlag, 
              sweepFlag, 
              x, y
            );
            
            // Add all segments
            for (let j = 0; j < arcToBezier.length; j += 6) {
              const c1x = arcToBezier[j];
              const c1y = arcToBezier[j+1];
              const c2x = arcToBezier[j+2];
              const c2y = arcToBezier[j+3];
              const endX = arcToBezier[j+4];
              const endY = arcToBezier[j+5];
              
              // Add handles to previous point
              if (points.length > 0) {
                const prevPoint = points[points.length - 1];
                prevPoint.handleOut = { x: c1x, y: c1y };
              }
              
              // Add the new point
              const newPoint = {
                x: endX,
                y: endY,
                handleIn: { x: c2x, y: c2y },
                handleOut: { 
                  x: endX + (endX - c2x),
                  y: endY + (endY - c2y)
                },
                id: generateId()
              };
              
              points.push(newPoint);
              
              // Update tracking variables
              currentX = endX;
              currentY = endY;
              lastControlX = c2x;
              lastControlY = c2y;
            }
          }
        }
        break;
        
      case 'Z': // Close path
        if (points.length > 0 && (currentX !== firstX || currentY !== firstY)) {
          // Calculate direction to first point
          const dx = firstX - currentX;
          const dy = firstY - currentY;
          const distance = Math.sqrt(dx*dx + dy*dy);
          const handleLen = Math.min(distance / 3, 50);
          
          // Add handles to last point
          if (points.length > 0) {
            const lastPoint = points[points.length - 1];
            lastPoint.handleOut = {
              x: lastPoint.x + (dx / distance) * handleLen,
              y: lastPoint.y + (dy / distance) * handleLen
            };
          }
          
          // Create handles for the first point
          if (points.length > 0) {
            const firstPoint = points[0];
            firstPoint.handleIn = {
              x: firstPoint.x - (dx / distance) * handleLen,
              y: firstPoint.y - (dy / distance) * handleLen
            };
          }
          
          // Reset to first point
          currentX = firstX;
          currentY = firstY;
        }
        
        // Reset path tracking
        hasStartedPath = false;
        break;
    }
  }
  
  return points;
};

// Approximate an elliptical arc with cubic bezier curves
function approximateArcToBezier(
  x1: number, y1: number, 
  rx: number, ry: number, 
  phi: number, 
  largeArcFlag: number, 
  sweepFlag: number, 
  x2: number, y2: number
): number[] {
  // If the endpoints are identical, then this is equivalent to omitting the arc
  if (x1 === x2 && y1 === y2) {
    return [];
  }
  
  // If rx = 0 or ry = 0 then this arc is treated as a straight line
  if (rx === 0 || ry === 0) {
    // Return a line segment
    return [
      x1, y1,    // First control point (coincident with start)
      x2, y2,    // Second control point (coincident with end)
      x2, y2     // End point
    ];
  }
  
  // Make sure rx and ry are positive
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  
  // Transform from endpoint to center parameterization
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  
  // Step 1: Compute (x1', y1')
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;
  
  // Step 2: Compute (cx', cy')
  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  
  // Check if the radii are big enough
  const radiiCheck = x1pSq / rxSq + y1pSq / rySq;
  if (radiiCheck > 1) {
    rx *= Math.sqrt(radiiCheck);
    ry *= Math.sqrt(radiiCheck);
    rxSq = rx * rx;
    rySq = ry * ry;
  }
  
  // Step 3: Compute (cx', cy')
  let sign = (largeArcFlag === sweepFlag) ? -1 : 1;
  let sq = ((rxSq * rySq) - (rxSq * y1pSq) - (rySq * x1pSq)) / ((rxSq * y1pSq) + (rySq * x1pSq));
  sq = sq < 0 ? 0 : sq;
  const coef = sign * Math.sqrt(sq);
  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * (-(ry * x1p) / rx);
  
  // Step 4: Compute (cx, cy) from (cx', cy')
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
  
  // Step 5: Compute start and sweep angles
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;
  
  // Compute the angle start
  let n = Math.sqrt(ux * ux + uy * uy);
  let p = ux; // cos(startAngle)
  sign = uy < 0 ? -1 : 1;
  let startAngle = sign * Math.acos(p / n);
  
  // Compute the sweep angle
  n = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  p = ux * vx + uy * vy;
  sign = (ux * vy - uy * vx) < 0 ? -1 : 1;
  let sweepAngle = sign * Math.acos(p / n);
  
  if (sweepFlag === 0 && sweepAngle > 0) {
    sweepAngle -= 2 * Math.PI;
  } else if (sweepFlag === 1 && sweepAngle < 0) {
    sweepAngle += 2 * Math.PI;
  }
  
  // Approximation constants based on the sweet angle
  const arcSegs = Math.ceil(Math.abs(sweepAngle) / (Math.PI / 2));
  const result: number[] = [];
  
  // Approximate the arc using bezier curves
  for (let i = 0; i < arcSegs; i++) {
    const theta1 = startAngle + i * sweepAngle / arcSegs;
    const theta2 = startAngle + (i + 1) * sweepAngle / arcSegs;
    
    const bezierPoints = approxArcSegment(
      cx, cy, rx, ry, phi, theta1, theta2
    );
    
    result.push(...bezierPoints);
  }
  
  return result;
}

// Approximate a single arc segment with a cubic bezier curve
function approxArcSegment(
  cx: number, cy: number, 
  rx: number, ry: number, 
  phi: number, 
  theta1: number, theta2: number
): number[] {
  // Angle constant
  const alpha = Math.sin(theta2 - theta1) * (Math.sqrt(4 + 3 * Math.pow(Math.tan((theta2 - theta1) / 2), 2)) - 1) / 3;
  
  // Calculate points
  const sinTheta1 = Math.sin(theta1);
  const cosTheta1 = Math.cos(theta1);
  const sinTheta2 = Math.sin(theta2);
  const cosTheta2 = Math.cos(theta2);
  
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  
  // Calculate the start and end points
  const x1 = cx + rx * (cosPhi * cosTheta1 - sinPhi * sinTheta1);
  const y1 = cy + ry * (sinPhi * cosTheta1 + cosPhi * sinTheta1);
  
  const x2 = cx + rx * (cosPhi * cosTheta2 - sinPhi * sinTheta2);
  const y2 = cy + ry * (sinPhi * cosTheta2 + cosPhi * sinTheta2);
  
  // Calculate control points
  const c1x = x1 + alpha * (-rx * cosPhi * sinTheta1 - ry * sinPhi * cosTheta1);
  const c1y = y1 + alpha * (-rx * sinPhi * sinTheta1 + ry * cosPhi * cosTheta1);
  
  const c2x = x2 - alpha * (-rx * cosPhi * sinTheta2 - ry * sinPhi * cosTheta2);
  const c2y = y2 - alpha * (-rx * sinPhi * sinTheta2 + ry * cosPhi * cosTheta2);
  
  return [c1x, c1y, c2x, c2y, x2, y2];
}

// Process SVG path objects into control points
export const processSVGPathObjects = (svgObjects: any[]): ControlPoint[] => {
  let allPoints: ControlPoint[] = [];
  
  for (const obj of svgObjects) {
    if (obj.type === 'path' && obj.d) {
      const pathPoints = svgPathToBezierPoints(obj.d);
      allPoints = [...allPoints, ...pathPoints];
    }
  }
  
  return allPoints;
};

// Convert various shape formats to BezierObjects
export const convertShapesDataToObjects = (shapesData: any): BezierObject[] => {
  const objects: BezierObject[] = [];
  
  // Log the incoming data to help with debugging
  console.log('Converting shapes data:', 
    typeof shapesData, 
    Array.isArray(shapesData) ? 'is array' : 'not array',
    shapesData
  );
  
  // Normalize to array if needed
  let dataArray = shapesData;
  
  // If it's a string, try to parse it
  if (typeof shapesData === 'string') {
    try {
      dataArray = JSON.parse(shapesData);
      console.log('Parsed string data:', dataArray);
    } catch (err) {
      console.error('Failed to parse string data:', err);
      return objects;
    }
  }
  
  // If it's not an array after normalization, try to extract objects array
  if (!Array.isArray(dataArray)) {
    if (typeof dataArray === 'object' && dataArray !== null) {
      if (dataArray.objects && Array.isArray(dataArray.objects)) {
        console.log('Found objects array in data object');
        dataArray = dataArray.objects;
      } else {
