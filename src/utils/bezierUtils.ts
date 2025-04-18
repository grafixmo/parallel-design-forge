import {
  ControlPoint,
  Point,
  CurveStyle, // Asegúrate que estos tipos estén definidos en ../types/bezier
  CurveConfig,
  TransformSettings,
  SelectionRect
} from '../types/bezier'; // Ajusta la ruta si es necesario

// Generate a unique ID (simple version)
export const generateId = (): string => {
  // Consider using a more robust UUID library in production if needed
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

// Calculate normal vector at a point on the curve segment (approximation using tangent)
// Note: For accurate normals on a curve, derivatives are needed. This is simpler.
export const calculateNormal = (p0: Point, p1: Point): Point => {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return { x: 0, y: 1 }; // Default normal (e.g., upwards) if points coincide

  // Perpendicular vector: (-dy, dx) normalized
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
  if (distance === 0) return { x: 0, y: 0 }; // Or handle as error
  return { x: dx / distance, y: dy / distance };
};

// Get point on a cubic Bézier curve at parameter t (0 <= t <= 1)
// p0: start point, p1: handleOut of start, p2: handleIn of end, p3: end point
export const getCurvePointAtT = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  let x = uuu * p0.x; // (1-t)^3 * p0.x
  x += 3 * uu * t * p1.x; // 3 * (1-t)^2 * t * p1.x
  x += 3 * u * tt * p2.x; // 3 * (1-t) * t^2 * p2.x
  x += ttt * p3.x; // t^3 * p3.x

  let y = uuu * p0.y;
  y += 3 * uu * t * p1.y;
  y += 3 * u * tt * p2.y;
  y += ttt * p3.y;

  return { x, y };
};

// Find the point on a cubic Bézier curve segment closest to a given point
// (Uses approximation by sampling)
export const findClosestPointOnCurve = (
  startPoint: ControlPoint, endPoint: ControlPoint, targetPoint: Point, steps = 10
): { point: Point; t: number; distance: number } => {

  let minDistance = Infinity;
  let closestPoint: Point = startPoint;
  let closestT = 0;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = getCurvePointAtT(startPoint, startPoint.handleOut, endPoint.handleIn, endPoint, t);
    const dist = calculateDistance(p, targetPoint);

    if (dist < minDistance) {
      minDistance = dist;
      closestPoint = p;
      closestT = t;
    }
  }
  return { point: closestPoint, t: closestT, distance: minDistance };
};


// Calculate approximate length of a cubic Bézier curve segment
// (Uses approximation by summing lengths of linear segments)
export const getPathLength = (startPoint: ControlPoint, endPoint: ControlPoint, steps = 20): number => {
  let length = 0;
  let prevPoint = startPoint;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const currentPoint = getCurvePointAtT(startPoint, startPoint.handleOut, endPoint.handleIn, endPoint, t);
    length += calculateDistance(prevPoint, currentPoint);
    prevPoint = currentPoint;
  }
  return length;
};


// Generate points for a parallel curve segment
export const calculateParallelPoint = (
  startPoint: ControlPoint, endPoint: ControlPoint, t: number, distance: number
): Point => {
  // Simple approximation: calculate normal at point t and offset
  // More accurate methods involve curve offsetting algorithms
  const p = getCurvePointAtT(startPoint, startPoint.handleOut, endPoint.handleIn, endPoint, t);

  // Calculate tangent (derivative approximation)
  const t1 = Math.max(0, t - 0.01);
  const t2 = Math.min(1, t + 0.01);
  const p1 = getCurvePointAtT(startPoint, startPoint.handleOut, endPoint.handleIn, endPoint, t1);
  const p2 = getCurvePointAtT(startPoint, startPoint.handleOut, endPoint.handleIn, endPoint, t2);

  // Calculate normal from tangent
  const normal = calculateNormal(p1, p2);

  // Offset point along the normal
  return {
    x: p.x + normal.x * distance,
    y: p.y + normal.y * distance,
  };
};

// Check if any point of an object is within a selection box
export const checkPointInObjectSelection = (obj: BezierObject, rect: SelectionRect): boolean => {
  return obj.points.some(p => isPointInSelectionRect(p, rect));
};

// Check if a point is within a selection rectangle
export const isPointInSelectionRect = (point: Point, rect: SelectionRect): boolean => {
  const x = point.x;
  const y = point.y;
  const rectX = Math.min(rect.startX, rect.startX + rect.width);
  const rectY = Math.min(rect.startY, rect.startY + rect.height);
  const rectWidth = Math.abs(rect.width);
  const rectHeight = Math.abs(rect.height);

  return x >= rectX && x <= rectX + rectWidth && y >= rectY && y <= rectY + rectHeight;
};


// ---- NUEVAS FUNCIONES AÑADIDAS ----

/**
 * Generates an SVG path data 'd' string from an array of ControlPoints.
 * Uses Cubic Bezier commands (C).
 * @param points Array of ControlPoint objects.
 * @returns The SVG path 'd' string or null if not possible.
 */
export const generatePathData = (points: ControlPoint[]): string | null => {
  if (!points || points.length < 2) {
    console.warn("generatePathData: Needs at least 2 points.");
    return null;
  }

  // Start with Move To command for the first point
  let d = `M ${points[0].x} ${points[0].y}`;

  // Add Cubic Bezier segments for subsequent points
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];

    // Use handleOut of the previous point and handleIn of the current point
    // Ensure handles exist (validateAndRepairPoint should guarantee this)
    d += ` C ${prev.handleOut.x} ${prev.handleOut.y}, ${p.handleIn.x} ${p.handleIn.y}, ${p.x} ${p.y}`;
  }

  // Note: Closing the path ('Z') would depend on a property of the BezierObject itself,
  // which isn't available in this function scope. It should be added externally if needed.
  return d;
};


/**
 * Validates and repairs a control point object to ensure all properties
 * are valid numbers and exist, applying defaults if necessary.
 * @param point The potentially incomplete or invalid point object.
 * @returns A valid ControlPoint object.
 */
export const validateAndRepairPoint = (point: any): ControlPoint => {
  const defaultX = 0;
  const defaultY = 0;

  // Ensure x and y are valid numbers, default to 0 otherwise
  const x = (typeof point?.x === 'number' && !isNaN(point.x)) ? point.x : defaultX;
  const y = (typeof point?.y === 'number' && !isNaN(point.y)) ? point.y : defaultY;

  // Validate handleIn, default to a position relative to the main point
  let handleIn: Point = { x: x - 30, y: y }; // Default relative position
  if (point?.handleIn && typeof point.handleIn.x === 'number' && !isNaN(point.handleIn.x) &&
      typeof point.handleIn.y === 'number' && !isNaN(point.handleIn.y)) {
    handleIn = { x: point.handleIn.x, y: point.handleIn.y };
  }

  // Validate handleOut, default to a position relative to the main point
  let handleOut: Point = { x: x + 30, y: y }; // Default relative position
  if (point?.handleOut && typeof point.handleOut.x === 'number' && !isNaN(point.handleOut.x) &&
      typeof point.handleOut.y === 'number' && !isNaN(point.handleOut.y)) {
    handleOut = { x: point.handleOut.x, y: point.handleOut.y };
  }

  // Ensure point has an ID, generate one if missing or invalid
  const id = (typeof point?.id === 'string' && point.id) ? point.id : generateId();

  return { x, y, handleIn, handleOut, id };
};

/**
 * Default curve style helper function.
 */
const defaultCurveStyle = (): CurveStyle => ({
  color: '#000000', width: 2, fill: 'none', opacity: 1,
  lineCap: 'round', lineJoin: 'round', dashArray: ''
});


/**
 * Returns a default curve configuration object.
 */
export const defaultCurveConfig = (): CurveConfig => ({
  parallelCount: 1,
  spacing: 5,
  styles: [defaultCurveStyle()] // Include at least one default style
});


/**
 * Returns default transform settings.
 */
export const defaultTransform = (): TransformSettings => ({
  rotation: 0,
  scaleX: 1,
  scaleY: 1
});

// ---- FIN NUEVAS FUNCIONES AÑADIDAS ----


// -------------------------------------------------------------------------
// ATENCIÓN: La siguiente función 'parsePathData' parece redundante con
// la función 'approximateControlPointsFromPath' definida en svgExporter.ts.
// Revisa si realmente necesitas esta versión más simple o si puedes eliminarla
// para evitar confusión.
// -------------------------------------------------------------------------
/**
 * Simplified parser for SVG path 'd' attribute to ControlPoints.
 * Handles only M, L, C commands. Might be less accurate than
 * approximateControlPointsFromPath in svgExporter.ts.
 * @param d The path data string.
 * @returns An array of ControlPoint objects.
 */
export const parsePathData = (d: string): ControlPoint[] => {
  const points: ControlPoint[] = [];
  const commands = d.match(/[MLC][^MLC]*/gi); // Only matches M, L, C

  if (!commands) return points;

  let currentX = 0;
  let currentY = 0;

  for (const command of commands) {
    const type = command[0];
    const args = command.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

    if (type === 'M') {
      currentX = args[0];
      currentY = args[1];
      // Create a simple point for M (handles would need context)
      points.push(validateAndRepairPoint({ x: currentX, y: currentY }));
    } else if (type === 'L') {
       currentX = args[0];
       currentY = args[1];
       // Create a simple point for L (handles would need context)
       points.push(validateAndRepairPoint({ x: currentX, y: currentY }));
    } else if (type === 'C') {
      if (args.length === 6) {
        const cp1x = args[0], cp1y = args[1];
        const cp2x = args[2], cp2y = args[3];
        const endX = args[4], endY = args[5];

        // Update previous point's handleOut (if exists)
        if (points.length > 0) {
          points[points.length - 1].handleOut = { x: cp1x, y: cp1y };
        }

        // Create new point with handleIn
        const newPoint = validateAndRepairPoint({
          x: endX,
          y: endY,
          handleIn: { x: cp2x, y: cp2y },
          // Approximate handleOut (can be improved)
          handleOut: { x: endX + (endX - cp2x), y: endY + (endY - cp2y) }
        });
        points.push(newPoint);
        currentX = endX;
        currentY = endY;
      }
    }
  }

  return points;
};


// Apply transformation to a point relative to a center
export const transformPoint = (
  point: Point,
  centerX: number,
  centerY: number,
  rotation: number, // Degrees
  scaleX: number,
  scaleY: number
): Point => {
  // 1. Translate point so center is the origin
  const x = point.x - centerX;
  const y = point.y - centerY;

  // 2. Rotate
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const xRot = x * cos - y * sin;
  const yRot = x * sin + y * cos;

  // 3. Scale
  const xScaled = xRot * scaleX;
  const yScaled = yRot * scaleY;

  // 4. Translate point back
  return {
    x: xScaled + centerX,
    y: yScaled + centerY
  };
};

// Apply transformation to all points and handles of a ControlPoint array
export const transformControlPoints = (
  points: ControlPoint[],
  centerX: number,
  centerY: number,
  rotation: number, // Degrees
  scaleX: number,
  scaleY: number
): ControlPoint[] => {
  return points.map(point => {
    const transformedPoint = transformPoint(point, centerX, centerY, rotation, scaleX, scaleY);
    const transformedHandleIn = transformPoint(point.handleIn, centerX, centerY, rotation, scaleX, scaleY);
    const transformedHandleOut = transformPoint(point.handleOut, centerX, centerY, rotation, scaleX, scaleY);

    return {
      ...point, // Keep original id
      x: transformedPoint.x,
      y: transformedPoint.y,
      handleIn: transformedHandleIn,
      handleOut: transformedHandleOut
    };
  });
};