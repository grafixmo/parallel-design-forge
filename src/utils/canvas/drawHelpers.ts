
import { ControlPoint, Point, SelectionRect, ControlPointType } from '@/types/bezier';

const POINT_COLOR = '#3498db'; // Blue
const CONTROL_POINT_COLOR = '#2ecc71'; // Green
const SELECTED_COLOR = '#e74c3c'; // Red
const HANDLE_LINE_COLOR = 'rgba(52, 152, 219, 0.5)';

// Draw grid on canvas
export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  zoom: number,
  panOffset: Point
) => {
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1 / zoom; // Adjust line width for zoom
  
  const gridSize = 20;
  const visibleWidth = canvasWidth / zoom;
  const visibleHeight = canvasHeight / zoom;
  const offsetX = -panOffset.x / zoom;
  const offsetY = -panOffset.y / zoom;
  
  // Calculate grid bounds
  const startX = Math.floor(offsetX / gridSize) * gridSize;
  const startY = Math.floor(offsetY / gridSize) * gridSize;
  const endX = offsetX + visibleWidth;
  const endY = offsetY + visibleHeight;
  
  for (let x = startX; x < endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + visibleHeight);
    ctx.stroke();
  }
  
  for (let y = startY; y < endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(offsetX, y);
    ctx.lineTo(offsetX + visibleWidth, y);
    ctx.stroke();
  }
};

// Draw background image
export const drawBackgroundImage = (
  ctx: CanvasRenderingContext2D,
  backgroundImageObj: HTMLImageElement | null,
  backgroundOpacity: number,
  canvasWidth: number,
  canvasHeight: number,
  zoom: number
) => {
  if (!backgroundImageObj) return;
  
  ctx.globalAlpha = backgroundOpacity;
  
  // Calculate scaling to fit the canvas while maintaining aspect ratio
  const scale = Math.min(
    canvasWidth / backgroundImageObj.width,
    canvasHeight / backgroundImageObj.height
  ) / zoom; // Adjust for zoom
  
  const scaledWidth = backgroundImageObj.width * scale;
  const scaledHeight = backgroundImageObj.height * scale;
  
  const x = (canvasWidth / zoom - scaledWidth) / 2;
  const y = (canvasHeight / zoom - scaledHeight) / 2;
  
  ctx.drawImage(backgroundImageObj, x, y, scaledWidth, scaledHeight);
  ctx.globalAlpha = 1.0;
};

// Draw the main and parallel curves
export const drawCurves = (
  ctx: CanvasRenderingContext2D,
  points: ControlPoint[],
  curveColor: string,
  curveWidth: number,
  parallelCount: number,
  parallelSpacing: number,
  parallelColors: string[],
  parallelWidths: number[],
  zoom: number
) => {
  if (points.length < 2) return;
  
  // Draw parallel curves first (behind main curve)
  for (let p = 1; p <= parallelCount; p++) {
    const offset = p * parallelSpacing;
    const color = parallelColors[p - 1] || parallelColors[0] || curveColor;
    const width = parallelWidths[p - 1] || parallelWidths[0] || curveWidth;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = width / zoom; // Adjust for zoom
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    
    // Draw each segment between control points
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      
      // Sample points along the curve and offset them
      const steps = 30; // More steps = smoother curve
      
      for (let t = 0; t <= steps; t++) {
        const normalizedT = t / steps;
        
        const offsetPoint = calculateParallelPoint(
          current,
          current.handleOut,
          next.handleIn,
          next,
          normalizedT,
          offset
        );
        
        if (t === 0) {
          ctx.moveTo(offsetPoint.x, offsetPoint.y);
        } else {
          ctx.lineTo(offsetPoint.x, offsetPoint.y);
        }
      }
    }
    
    ctx.stroke();
  }
  
  // Draw main curve
  ctx.strokeStyle = curveColor;
  ctx.lineWidth = curveWidth / zoom; // Adjust for zoom
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  ctx.beginPath();
  
  // Draw bezier curve through all points
  ctx.moveTo(points[0].x, points[0].y);
  
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    
    ctx.bezierCurveTo(
      current.handleOut.x, current.handleOut.y,
      next.handleIn.x, next.handleIn.y,
      next.x, next.y
    );
  }
  
  ctx.stroke();
};

// Draw handle lines
export const drawHandleLines = (
  ctx: CanvasRenderingContext2D,
  points: ControlPoint[],
  isDrawingMode: boolean,
  selectedPoint: { pointIndex: number, type: ControlPointType } | null,
  selectedPointsIndices: number[],
  zoom: number
) => {
  ctx.strokeStyle = HANDLE_LINE_COLOR;
  ctx.lineWidth = 1 / zoom; // Adjust for zoom
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    
    // Only show handles in drawing mode or if the point is selected
    if (isDrawingMode || selectedPoint?.pointIndex === i || selectedPointsIndices.includes(i)) {
      // Draw handle lines
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.handleIn.x, point.handleIn.y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.handleOut.x, point.handleOut.y);
      ctx.stroke();
    }
  }
};

// Draw control points and handles
export const drawControlPoints = (
  ctx: CanvasRenderingContext2D,
  points: ControlPoint[],
  isDrawingMode: boolean,
  selectedPoint: { pointIndex: number, type: ControlPointType } | null,
  selectedPointsIndices: number[],
  zoom: number
) => {
  const POINT_RADIUS = 8;
  const HANDLE_RADIUS = 6;
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const isPointSelected = selectedPoint?.pointIndex === i || selectedPointsIndices.includes(i);
    
    // Draw handle points - only visible in drawing mode or when point is selected
    if (isDrawingMode || isPointSelected) {
      ctx.fillStyle = CONTROL_POINT_COLOR;
      
      // Handle In
      ctx.beginPath();
      ctx.arc(point.handleIn.x, point.handleIn.y, HANDLE_RADIUS / zoom, 0, Math.PI * 2);
      if (selectedPoint && selectedPoint.pointIndex === i && selectedPoint.type === ControlPointType.HANDLE_IN) {
        ctx.fillStyle = SELECTED_COLOR;
      } else {
        ctx.fillStyle = CONTROL_POINT_COLOR;
      }
      ctx.fill();
      
      // Handle Out
      ctx.beginPath();
      ctx.arc(point.handleOut.x, point.handleOut.y, HANDLE_RADIUS / zoom, 0, Math.PI * 2);
      if (selectedPoint && selectedPoint.pointIndex === i && selectedPoint.type === ControlPointType.HANDLE_OUT) {
        ctx.fillStyle = SELECTED_COLOR;
      } else {
        ctx.fillStyle = CONTROL_POINT_COLOR;
      }
      ctx.fill();
    }
    
    // Draw main point
    ctx.beginPath();
    ctx.arc(point.x, point.y, POINT_RADIUS / zoom, 0, Math.PI * 2);
    
    // Change color if selected
    if (selectedPoint && selectedPoint.pointIndex === i && selectedPoint.type === ControlPointType.MAIN) {
      ctx.fillStyle = SELECTED_COLOR;
    } else if (selectedPointsIndices.includes(i)) {
      ctx.fillStyle = SELECTED_COLOR;
    } else {
      ctx.fillStyle = POINT_COLOR;
    }
    
    ctx.fill();
  }
};

// Draw selection rectangle
export const drawSelectionRect = (
  ctx: CanvasRenderingContext2D,
  isSelecting: boolean,
  selectionRect: SelectionRect | null,
  zoom: number
) => {
  if (!isSelecting || !selectionRect) return;
  
  ctx.strokeStyle = 'rgba(52, 152, 219, 0.8)';
  ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
  ctx.lineWidth = 2 / zoom; // Adjust for zoom
  
  ctx.beginPath();
  ctx.rect(
    selectionRect.startX,
    selectionRect.startY,
    selectionRect.width,
    selectionRect.height
  );
  ctx.fill();
  ctx.stroke();
};

// Draw multi-selection indicator
export const drawMultiSelectionIndicator = (
  ctx: CanvasRenderingContext2D,
  isDrawingMode: boolean,
  selectedPointsIndices: number[],
  points: ControlPoint[],
  zoom: number
) => {
  if (isDrawingMode || selectedPointsIndices.length <= 1) return;
  
  // Draw a bounding box or highlight around the selected points
  const selectedPoints = selectedPointsIndices.map(index => points[index]);
  
  // Find min/max bounds of selected points
  const minX = Math.min(...selectedPoints.map(p => p.x));
  const minY = Math.min(...selectedPoints.map(p => p.y));
  const maxX = Math.max(...selectedPoints.map(p => p.x));
  const maxY = Math.max(...selectedPoints.map(p => p.y));
  
  // Draw dashed rectangle around selected points
  ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([5 / zoom, 3 / zoom]);
  
  ctx.beginPath();
  ctx.rect(minX - 10 / zoom, minY - 10 / zoom, maxX - minX + 20 / zoom, maxY - minY + 20 / zoom);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw move icon in the center
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  // Draw a simple move icon
  ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 15 / zoom, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = 'white';
  ctx.font = `${24 / zoom}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⤸', centerX, centerY);
};

// Draw UI indicators (zoom level, mode)
export const drawUIIndicators = (
  ctx: CanvasRenderingContext2D,
  zoom: number,
  isDrawingMode: boolean,
  isMultiDragging: boolean,
  selectedPointsIndices: number[],
  mousePos: Point,
  isSpacePressed: boolean,
  isCanvasDragging: boolean
) => {
  // Draw zoom level indicator
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.font = '12px Arial';
  ctx.fillText(`Zoom: ${Math.round(zoom * 100)}%`, 10, 20);
  
  // Draw cursor based on interaction state
  if (isSpacePressed || isCanvasDragging) {
    const cursorSize = 20;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.font = `${cursorSize}px Arial`;
    ctx.fillText('✋', mousePos.x, mousePos.y);
  }
  
  // Show current mode indicator
  ctx.fillStyle = isDrawingMode ? 'rgba(46, 204, 113, 0.6)' : 'rgba(231, 76, 60, 0.6)';
  ctx.font = '12px Arial';
  ctx.fillText(`Mode: ${isDrawingMode ? 'Drawing' : 'Selection'}`, 10, 40);
  
  // Show drag indicator when dragging multiple points
  if (isMultiDragging && selectedPointsIndices.length > 0) {
    ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
    ctx.font = '12px Arial';
    ctx.fillText(`Moving ${selectedPointsIndices.length} points`, 10, 60);
  }
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

// Calculate a point on a bezier curve
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
