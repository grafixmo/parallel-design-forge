
import { Point, ControlPoint, ControlPointType, SelectionRect } from '@/types/bezier';
import { isPointNear, isPointInSelectionRect, generateId } from '../bezierUtils';

// Check if a point is within the bounds of selected points
export const isClickWithinSelectedPointsBounds = (
  x: number,
  y: number,
  selectedPoints: ControlPoint[],
  padding: number = 20
): boolean => {
  if (selectedPoints.length === 0) return false;
  
  // Find min/max bounds of selected points
  const minX = Math.min(...selectedPoints.map(p => p.x));
  const minY = Math.min(...selectedPoints.map(p => p.y));
  const maxX = Math.max(...selectedPoints.map(p => p.x));
  const maxY = Math.max(...selectedPoints.map(p => p.y));
  
  // Check if click is within the bounding box of selected points
  return (
    x >= minX - padding && 
    x <= maxX + padding && 
    y >= minY - padding && 
    y <= maxY + padding
  );
};

// Convert screen coordinates to canvas coordinates (accounting for zoom)
export const screenToCanvas = (
  screenX: number, 
  screenY: number, 
  panOffset: Point, 
  zoom: number
): Point => {
  return {
    x: (screenX - panOffset.x) / zoom,
    y: (screenY - panOffset.y) / zoom
  };
};

// Convert canvas coordinates to screen coordinates
export const canvasToScreen = (
  canvasX: number, 
  canvasY: number, 
  panOffset: Point, 
  zoom: number
): Point => {
  return {
    x: canvasX * zoom + panOffset.x,
    y: canvasY * zoom + panOffset.y
  };
};

// Find a point near the given coordinates
export const findPointNearCoordinates = (
  x: number, 
  y: number, 
  points: ControlPoint[], 
  pointRadius: number, 
  handleRadius: number, 
  zoom: number,
  isDrawingMode: boolean,
  selectedPointsIndices: number[]
): { found: boolean; pointIndex: number; type: ControlPointType } | null => {
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    
    // Check main point
    if (isPointNear({ x, y }, point, pointRadius / zoom)) {
      return { found: true, pointIndex: i, type: ControlPointType.MAIN };
    }
    
    // Check handles
    // FIX: Always check handles in drawing mode OR if the point is selected
    // This ensures handles are always interactive
    if (isDrawingMode || selectedPointsIndices.includes(i)) {
      // Check handle in
      if (isPointNear({ x, y }, point.handleIn, handleRadius / zoom)) {
        return { found: true, pointIndex: i, type: ControlPointType.HANDLE_IN };
      }
      
      // Check handle out
      if (isPointNear({ x, y }, point.handleOut, handleRadius / zoom)) {
        return { found: true, pointIndex: i, type: ControlPointType.HANDLE_OUT };
      }
    }
  }
  
  return { found: false, pointIndex: -1, type: ControlPointType.MAIN };
};

// Update the selection rectangle
export const updateSelectionRect = (
  startPoint: Point,
  currentPoint: Point
): SelectionRect => {
  return {
    startX: Math.min(startPoint.x, currentPoint.x),
    startY: Math.min(startPoint.y, currentPoint.y),
    width: Math.abs(currentPoint.x - startPoint.x),
    height: Math.abs(currentPoint.y - startPoint.y)
  };
};

// Find points inside the selection rectangle
export const findPointsInSelectionRect = (
  points: ControlPoint[],
  selectionRect: SelectionRect
): number[] => {
  return points.reduce((indices: number[], point, index) => {
    if (isPointInSelectionRect(point, selectionRect)) {
      indices.push(index);
    }
    return indices;
  }, []);
};

// Get cursor style based on context
export const getCursorStyle = (
  isSpacePressed: boolean,
  isCanvasDragging: boolean,
  isDrawingMode: boolean,
  isMultiDragging: boolean,
  selectedPointsIndices: number[],
  isSelecting: boolean
): string => {
  if (isSpacePressed || isCanvasDragging) return 'grab';
  if (isDrawingMode) return 'crosshair';
  if (isMultiDragging || (selectedPointsIndices.length > 0 && !isSelecting)) return 'move';
  return 'default';
};

// Generate new control point
export const createNewControlPoint = (x: number, y: number): ControlPoint => {
  return {
    x,
    y,
    handleIn: { x: x - 50, y },
    handleOut: { x: x + 50, y },
    id: generateId()
  };
};

// Modify point or handle during dragging
export const updatePointDuringDrag = (
  points: ControlPoint[],
  pointIndex: number,
  type: ControlPointType,
  newX: number,
  newY: number,
  lastX: number,
  lastY: number
): ControlPoint[] => {
  const updatedPoints = [...points];
  
  // Make sure the point index is valid
  if (pointIndex < 0 || pointIndex >= updatedPoints.length) {
    return updatedPoints;
  }
  
  const point = { ...updatedPoints[pointIndex] };
  
  if (type === ControlPointType.MAIN) {
    // Move the entire point and its handles
    const deltaX = newX - lastX;
    const deltaY = newY - lastY;
    
    point.x += deltaX;
    point.y += deltaY;
    point.handleIn.x += deltaX;
    point.handleIn.y += deltaY;
    point.handleOut.x += deltaX;
    point.handleOut.y += deltaY;
  } else if (type === ControlPointType.HANDLE_IN) {
    // Move handle in
    point.handleIn.x = newX;
    point.handleIn.y = newY;
  } else if (type === ControlPointType.HANDLE_OUT) {
    // Move handle out
    point.handleOut.x = newX;
    point.handleOut.y = newY;
  }
  
  updatedPoints[pointIndex] = point;
  return updatedPoints;
};

// Update multiple points during dragging
export const updateMultiplePointsDuringDrag = (
  points: ControlPoint[],
  selectedIndices: number[],
  deltaX: number,
  deltaY: number
): ControlPoint[] => {
  const updatedPoints = [...points];
  
  selectedIndices.forEach(index => {
    if (index >= 0 && index < updatedPoints.length) {
      const point = { ...updatedPoints[index] };
      
      // Move the point and its handles
      point.x += deltaX;
      point.y += deltaY;
      point.handleIn.x += deltaX;
      point.handleIn.y += deltaY;
      point.handleOut.x += deltaX;
      point.handleOut.y += deltaY;
      
      updatedPoints[index] = point;
    }
  });
  
  return updatedPoints;
};
