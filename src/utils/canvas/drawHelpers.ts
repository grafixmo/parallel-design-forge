import { ControlPoint, Point, SelectionRect, ControlPointType } from '@/types/bezier';

// Helper function to draw a grid
export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zoom: number,
  panOffset: Point
) => {
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1 / zoom; // Adjust line width for zoom

  const gridSize = 20;
  const visibleWidth = width / zoom;
  const visibleHeight = height / zoom;
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

// Helper function to draw the background image
export const drawBackgroundImage = (
  ctx: CanvasRenderingContext2D,
  backgroundImageObj: HTMLImageElement | null,
  backgroundOpacity: number,
  canvasWidth: number,
  canvasHeight: number,
  zoom: number
) => {
  if (backgroundImageObj) {
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
  }
};

// Helper function to draw the Bezier curves
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

// Helper function to calculate a point on a parallel curve
const calculateParallelPoint = (
  p0: ControlPoint,
  p1: Point,
  p2: Point,
  p3: ControlPoint,
  t: number,
  offset: number
): Point => {
  const x = calculateBezierPoint(p0.x, p1.x, p2.x, p3.x, t);
  const y = calculateBezierPoint(p0.y, p1.y, p2.y, p3.y, t);

  // Approximate tangent vector (normalize to get direction)
  const dx = calculateBezierTangent(p0.x, p1.x, p2.x, p3.x, t);
  const dy = calculateBezierTangent(p0.y, p1.y, p2.y, p3.y, t);
  const magnitude = Math.sqrt(dx * dx + dy * dy);

  // If the magnitude is zero, the tangent is undefined, return the original point
  if (magnitude === 0) {
    return { x, y };
  }

  const tangentX = dx / magnitude;
  const tangentY = dy / magnitude;

  // Calculate normal vector (perpendicular to tangent)
  const normalX = -tangentY;
  const normalY = tangentX;

  // Offset the point along the normal
  return {
    x: x + normalX * offset,
    y: y + normalY * offset
  };
};

// Helper function to calculate a point on a Bezier curve
const calculateBezierPoint = (
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number => {
  const u = 1 - t;
  return (
    p0 * u * u * u +
    3 * p1 * t * u * u +
    3 * p2 * t * t * u +
    p3 * t * t * t
  );
};

// Helper function to calculate the tangent of a Bezier curve
const calculateBezierTangent = (
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number => {
  const u = 1 - t;
  return (
    -3 * p0 * u * u +
    3 * p1 * (u * u - 2 * t * u) +
    3 * p2 * (2 * t * u - t * t) +
    3 * p3 * t * t
  );
};

// Helper function to draw handle lines
export const drawHandleLines = (
  ctx: CanvasRenderingContext2D,
  points: ControlPoint[],
  isDrawingMode: boolean,
  selectedPoint: { pointIndex: number; type: ControlPointType } | null,
  selectedPointsIndices: number[],
  zoom: number
) => {
  const HANDLE_LINE_COLOR = 'rgba(52, 152, 219, 0.5)';
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

// Helper function to draw control points and handles
export const drawControlPoints = (
  ctx: CanvasRenderingContext2D,
  points: ControlPoint[],
  isDrawingMode: boolean,
  selectedPoint: { pointIndex: number; type: ControlPointType } | null,
  selectedPointsIndices: number[],
  zoom: number,
  isCurrentGroup: boolean = true
) => {
  const POINT_RADIUS = 8;
  const HANDLE_RADIUS = 6;
  const POINT_COLOR = '#3498db'; // Blue
  const CONTROL_POINT_COLOR = '#2ecc71'; // Green
  const SELECTED_COLOR = '#e74c3c'; // Red

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

// Helper function to draw the selection rectangle
export const drawSelectionRect = (
  ctx: CanvasRenderingContext2D,
  isSelecting: boolean,
  selectionRect: SelectionRect | null,
  zoom: number
) => {
  if (isSelecting && selectionRect) {
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
  }
};

// Helper function to draw multi-selection indicator
export const drawMultiSelectionIndicator = (
  ctx: CanvasRenderingContext2D,
  isDrawingMode: boolean,
  selectedPoints: ControlPoint[],
  zoom: number
) => {
  if (!isDrawingMode && selectedPoints.length > 1) {
    // Draw a bounding box or highlight around the selected points

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
  }
};

export const drawUIIndicators = (
  ctx: CanvasRenderingContext2D, 
  zoom: number, 
  isDrawingMode: boolean, 
  isMultiDragging: boolean, 
  selectedPointsIndices: number[], 
  mousePos: { x: number; y: number },
  isSpacePressed: boolean,
  isCanvasDragging: boolean,
  isNewObjectMode?: boolean
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
  const modeText = isDrawingMode 
    ? (isNewObjectMode ? 'Drawing: New Object' : 'Drawing: Add Points') 
    : 'Selection';
  ctx.fillText(`Mode: ${modeText}`, 10, 40);
  
  // Show drag indicator when dragging multiple points
  if (isMultiDragging && selectedPointsIndices.length > 0) {
    ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
    ctx.font = '12px Arial';
    ctx.fillText(`Moving ${selectedPointsIndices.length} points`, 10, 60);
  }
};
