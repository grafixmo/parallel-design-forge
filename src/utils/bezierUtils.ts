
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
  
  // Check if it's an array
  if (Array.isArray(shapesData)) {
    // Process each item in the array
    shapesData.forEach((item, index) => {
      if (item.type === 'path' || item.d) {
        // This is SVG path data
        const pathData = item.d || '';
        const pathPoints = pathData ? svgPathToBezierPoints(pathData) : [];
        
        if (pathPoints.length > 0) {
          objects.push({
            id: item.id || generateId(),
            points: pathPoints,
            curveConfig: {
              styles: [
                { 
                  color: item.stroke || item.fill || '#000000', 
                  width: item.strokeWidth || 5 
                }
              ],
              parallelCount: 0,
              spacing: 0
            },
            transform: {
              rotation: item.rotation || 0,
              scaleX: item.scaleX || 1.0,
              scaleY: item.scaleY || 1.0
            },
            name: `Imported Path ${index + 1}`,
            isSelected: false
          });
        }
      } else if (item.type === 'spiral' || item.type === 'triangle' || item.type === 'circle') {
        // This is shape data - create simple control points for visualization
        const centerX = item.x || 0;
        const centerY = item.y || 0;
        const width = item.width || 100;
        const height = item.height || 100;
        
        // Determine color - handle both stroke and fill with fallbacks
        const color = item.stroke && item.strokeWidth > 0 
          ? item.stroke 
          : (item.fill || '#000000');
          
        const strokeWidth = typeof item.strokeWidth === 'number' ? item.strokeWidth : 5;
        
        let simplePoints: ControlPoint[] = [];
        
        if (item.type === 'circle') {
          // Create circle using 4 bezier curve points (more natural than straight lines)
          const radius = Math.min(width, height) / 2;
          const cp = 0.552284749831 * radius; // Control point distance for approximating a circle
          
          simplePoints = [
            // Top point
            {
              x: centerX, 
              y: centerY - radius,
              handleIn: { x: centerX - cp, y: centerY - radius },
              handleOut: { x: centerX + cp, y: centerY - radius },
              id: generateId()
            },
            // Right point
            {
              x: centerX + radius, 
              y: centerY,
              handleIn: { x: centerX + radius, y: centerY - cp },
              handleOut: { x: centerX + radius, y: centerY + cp },
              id: generateId()
            },
            // Bottom point
            {
              x: centerX, 
              y: centerY + radius,
              handleIn: { x: centerX + cp, y: centerY + radius },
              handleOut: { x: centerX - cp, y: centerY + radius },
              id: generateId()
            },
            // Left point
            {
              x: centerX - radius, 
              y: centerY,
              handleIn: { x: centerX - radius, y: centerY + cp },
              handleOut: { x: centerX - radius, y: centerY - cp },
              id: generateId()
            }
          ];
        } else if (item.type === 'triangle') {
          // Create a triangle
          const halfWidth = width / 2;
          const halfHeight = height / 2;
          
          simplePoints = [
            // Top point
            {
              x: centerX, 
              y: centerY - halfHeight,
              handleIn: { x: centerX - 20, y: centerY - halfHeight },
              handleOut: { x: centerX + 20, y: centerY - halfHeight },
              id: generateId()
            },
            // Bottom right
            {
              x: centerX + halfWidth, 
              y: centerY + halfHeight,
              handleIn: { x: centerX + halfWidth - 20, y: centerY + halfHeight },
              handleOut: { x: centerX + halfWidth + 20, y: centerY + halfHeight },
              id: generateId()
            },
            // Bottom left
            {
              x: centerX - halfWidth, 
              y: centerY + halfHeight,
              handleIn: { x: centerX - halfWidth - 20, y: centerY + halfHeight },
              handleOut: { x: centerX - halfWidth + 20, y: centerY + halfHeight },
              id: generateId()
            }
          ];
        } else if (item.type === 'spiral') {
          // Create a spiral
          const turns = item.spiralTurns || 3;
          const spacing = item.spiralSpacing || 5;
          const numPoints = turns * 8; // 8 points per turn for smoothness
          
          simplePoints = [];
          
          // Generate points for the spiral
          for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * turns * Math.PI * 2;
            const radius = (i / numPoints) * Math.min(width, height) / 2;
            
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            // Calculate handle positions
            const angleStep = (Math.PI * 2) / 16;
            const handleInAngle = angle - angleStep;
            const handleOutAngle = angle + angleStep;
            const handleDistance = (radius * Math.PI) / 8;
            
            simplePoints.push({
              x,
              y,
              handleIn: {
                x: x - Math.cos(handleInAngle) * handleDistance,
                y: y - Math.sin(handleInAngle) * handleDistance
              },
              handleOut: {
                x: x + Math.cos(handleOutAngle) * handleDistance,
                y: y + Math.sin(handleOutAngle) * handleDistance
              },
              id: generateId()
            });
          }
        }
        
        if (simplePoints.length > 0) {
          objects.push({
            id: item.id || generateId(),
            points: simplePoints,
            curveConfig: {
              styles: [
                { color, width: strokeWidth }
              ],
              parallelCount: 0,
              spacing: 0
            },
            transform: {
              rotation: item.rotation || 0,
              scaleX: 1.0,
              scaleY: 1.0
            },
            name: `Imported ${item.type} ${index + 1}`,
            isSelected: false
          });
        }
      } else if (item.points) {
        // This format already has points defined
        const pointsWithIds = item.points.map((point: any) => ({
          ...point,
          id: point.id || generateId(),
          handleIn: point.handleIn || { x: point.x - 50, y: point.y },
          handleOut: point.handleOut || { x: point.x + 50, y: point.y }
        }));
        
        if (pointsWithIds.length > 0) {
          objects.push({
            id: item.id || generateId(),
            points: pointsWithIds,
            curveConfig: {
              styles: [
                { 
                  color: item.stroke || item.fill || '#000000', 
                  width: item.strokeWidth || 5 
                }
              ],
              parallelCount: 0,
              spacing: 0
            },
            transform: {
              rotation: item.rotation || 0,
              scaleX: item.scaleX || 1.0,
              scaleY: item.scaleY || 1.0
            },
            name: `Imported Object ${index + 1}`,
            isSelected: false
          });
        }
      }
    });
  } else if (typeof shapesData === 'object' && shapesData !== null) {
    // Handle cases where the data is a single object
    console.log('Processing single object format', shapesData);
    
    // Try to handle as a legacy format or simple object
    if (shapesData.objects && Array.isArray(shapesData.objects)) {
      // This is likely a DesignData object
      return convertShapesDataToObjects(shapesData.objects);
    }
  }
  
  return objects;
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
