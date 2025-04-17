
import { ControlPoint, Point, CurveStyle, SelectionRect } from '../types/bezier';

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

// Calculate unit vector (normalized direction vector)
export const calculateUnitVector = (p1: Point, p2: Point): Point => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance === 0) return { x: 1, y: 0 }; // Default direction if points are identical
  
  return {
    x: dx / distance,
    y: dy / distance
  };
};

// Calculate handle points for a new point based on drawing direction
export const calculateNaturalHandles = (prevPoint: Point, currentPoint: Point, handleLength: number = 50): { handleIn: Point, handleOut: Point } => {
  // Calculate unit vector in the direction of drawing
  const directionVector = calculateUnitVector(prevPoint, currentPoint);
  
  // Scale handle length based on distance between points
  const distance = calculateDistance(prevPoint, currentPoint);
  const adjustedLength = Math.min(handleLength, distance / 2);
  
  // Scale for incoming handle (opposite direction)
  const handleInX = currentPoint.x - directionVector.x * adjustedLength;
  const handleInY = currentPoint.y - directionVector.y * adjustedLength;
  
  // Scale for outgoing handle (same direction)
  const handleOutX = currentPoint.x + directionVector.x * adjustedLength;
  const handleOutY = currentPoint.y + directionVector.y * adjustedLength;
  
  return {
    handleIn: { x: handleInX, y: handleInY },
    handleOut: { x: handleOutX, y: handleOutY }
  };
};

// Create a control point with natural handles
export const createControlPoint = (
  x: number, 
  y: number, 
  previousPoint?: Point
): ControlPoint => {
  if (!previousPoint) {
    // First point - use default horizontal handles
    return {
      x,
      y,
      handleIn: { x: x - 50, y },
      handleOut: { x: x + 50, y },
      id: generateId()
    };
  }
  
  // Calculate handles based on drawing direction
  const { handleIn, handleOut } = calculateNaturalHandles(previousPoint, { x, y });
  
  return {
    x,
    y,
    handleIn,
    handleOut,
    id: generateId()
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

// Generate SVG path data from control points
export const generatePathData = (points: ControlPoint[], offset = 0): string => {
  if (points.length < 2) return '';
  
  let pathData = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    
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

// Convert SVG path data to bezier points
export const svgPathToBezierPoints = (pathData: string): ControlPoint[] => {
  const points: ControlPoint[] = [];
  const commands = pathData.match(/[MLCZ][^MLCZ]*/g);
  
  if (!commands) return points;
  
  let currentX = 0;
  let currentY = 0;
  
  for (const cmd of commands) {
    const type = cmd[0];
    const values = cmd.substring(1).trim().split(/[\s,]+/).map(parseFloat);
    
    if (type === 'M') {
      currentX = values[0];
      currentY = values[1];
      
      points.push({
        x: currentX,
        y: currentY,
        handleIn: { x: currentX - 50, y: currentY },
        handleOut: { x: currentX + 50, y: currentY },
        id: generateId()
      });
    } 
    else if (type === 'C') {
      // Each cubic bezier command has 6 values: c1x, c1y, c2x, c2y, x, y
      for (let i = 0; i < values.length; i += 6) {
        const lastPoint = points[points.length - 1];
        if (lastPoint) {
          lastPoint.handleOut = { x: values[i], y: values[i + 1] };
        }
        
        const newPoint = {
          x: values[i + 4],
          y: values[i + 5],
          handleIn: { x: values[i + 2], y: values[i + 3] },
          handleOut: { x: values[i + 4] + 50, y: values[i + 5] },
          id: generateId()
        };
        
        points.push(newPoint);
        currentX = newPoint.x;
        currentY = newPoint.y;
      }
    }
  }
  
  return points;
};

// Apply transformation to a point
export const transformPoint = (
  point: Point, 
  centerX: number, 
  centerY: number, 
  rotation: number, 
  scaleX: number, 
  scaleY: number
): Point => {
  // Translate to origin
  const x = point.x - centerX;
  const y = point.y - centerY;
  
  // Rotate
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  
  const xRot = x * cos - y * sin;
  const yRot = x * sin + y * cos;
  
  // Scale
  const xScaled = xRot * scaleX;
  const yScaled = yRot * scaleY;
  
  // Translate back
  return {
    x: xScaled + centerX,
    y: yScaled + centerY
  };
};

// Apply transformation to all control points
export const transformControlPoints = (
  points: ControlPoint[],
  centerX: number,
  centerY: number,
  rotation: number,
  scaleX: number,
  scaleY: number
): ControlPoint[] => {
  return points.map(point => {
    const transformedPoint = transformPoint(point, centerX, centerY, rotation, scaleX, scaleY);
    const transformedHandleIn = transformPoint(point.handleIn, centerX, centerY, rotation, scaleX, scaleY);
    const transformedHandleOut = transformPoint(point.handleOut, centerX, centerY, rotation, scaleX, scaleY);
    
    return {
      ...point,
      x: transformedPoint.x,
      y: transformedPoint.y,
      handleIn: transformedHandleIn,
      handleOut: transformedHandleOut
    };
  });
};
