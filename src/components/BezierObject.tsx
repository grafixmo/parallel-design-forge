
import React from 'react';
import { 
  BezierObject as BezierObjectType, 
  ControlPoint, 
  Point,
  ControlPointType, 
  SelectedPoint 
} from '@/types/bezier';
import { 
  isPointNear, 
  calculateParallelPoint 
} from '@/utils/bezierUtils';

interface BezierObjectProps {
  object: BezierObjectType;
  isSelected: boolean;
  zoom: number;
  selectedPoint: SelectedPoint | null;
  onPointSelect: (point: SelectedPoint) => void;
  onPointMove: (objectId: string, points: ControlPoint[]) => void;
  onSelect: (objectId: string, multiSelect: boolean) => void;
}

const BezierObject: React.FC<BezierObjectProps> = ({
  object,
  isSelected,
  zoom,
  selectedPoint,
  onPointSelect,
  onPointMove,
  onSelect
}) => {
  const {
    id: objectId,
    points,
    curveConfig,
    transform
  } = object;
  
  const POINT_RADIUS = 8;
  const HANDLE_RADIUS = 6;
  const POINT_COLOR = '#3498db'; // Blue
  const CONTROL_POINT_COLOR = '#2ecc71'; // Green
  const SELECTED_COLOR = '#e74c3c'; // Red
  const HANDLE_LINE_COLOR = 'rgba(52, 152, 219, 0.5)';
  
  // Check if point is within object to know if we should select
  const isPointInObject = (x: number, y: number, radius: number): boolean => {
    // First check all control points
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      // Check main point
      if (isPointNear({ x, y }, point, radius)) {
        return true;
      }
      
      // Check handles
      if (isPointNear({ x, y }, point.handleIn, radius)) {
        return true;
      }
      
      if (isPointNear({ x, y }, point.handleOut, radius)) {
        return true;
      }
    }
    
    // If we have at least 2 points, check if point is near the curve
    if (points.length >= 2) {
      // Sample points along the curve and check if the clicked point is near any of them
      const sampleDistance = 5; // Lower means more accuracy but more computation
      
      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        
        const steps = Math.max(
          Math.abs(next.x - current.x),
          Math.abs(next.y - current.y)
        ) / sampleDistance;
        
        for (let t = 0; t <= steps; t++) {
          const normalizedT = t / steps;
          
          const curvePoint = calculateParallelPoint(
            current,
            current.handleOut,
            next.handleIn,
            next,
            normalizedT,
            0 // No offset for the main curve
          );
          
          if (isPointNear({ x, y }, curvePoint, radius + curveConfig.styles[0].width / 2)) {
            return true;
          }
        }
      }
    }
    
    return false;
  };
  
  // Handle mouse interaction on a control point
  const handlePointInteraction = (
    x: number, 
    y: number, 
    radius: number
  ): { found: boolean, pointIndex: number, type: ControlPointType } => {
    // Check if mouse is near any control point
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      // Check main point
      if (isPointNear({ x, y }, point, radius)) {
        return { found: true, pointIndex: i, type: ControlPointType.MAIN };
      }
      
      // Check handle in
      if (isPointNear({ x, y }, point.handleIn, radius)) {
        return { found: true, pointIndex: i, type: ControlPointType.HANDLE_IN };
      }
      
      // Check handle out
      if (isPointNear({ x, y }, point.handleOut, radius)) {
        return { found: true, pointIndex: i, type: ControlPointType.HANDLE_OUT };
      }
    }
    
    return { found: false, pointIndex: -1, type: ControlPointType.MAIN };
  };
  
  // Draw the object in a canvas
  const renderObject = (ctx: CanvasRenderingContext2D) => {
    // Save the context state for transformation
    ctx.save();
    
    // Calculate center point for transformation
    let centerX = 0, centerY = 0;
    
    if (points.length > 0) {
      const sumX = points.reduce((sum, point) => sum + point.x, 0);
      const sumY = points.reduce((sum, point) => sum + point.y, 0);
      centerX = sumX / points.length;
      centerY = sumY / points.length;
    }
    
    // Apply transformations
    ctx.translate(centerX, centerY);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scaleX, transform.scaleY);
    ctx.translate(-centerX, -centerY);
    
    // Draw curves if we have enough points
    if (points.length >= 2) {
      // Draw parallel curves first (behind main curve)
      for (let p = 1; p <= curveConfig.parallelCount; p++) {
        const offset = p * curveConfig.spacing;
        const color = curveConfig.styles[p] ? curveConfig.styles[p].color : curveConfig.styles[0].color;
        const width = curveConfig.styles[p] ? curveConfig.styles[p].width : curveConfig.styles[0].width;
        
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
      const mainStyle = curveConfig.styles[0] || { color: '#000000', width: 5 };
      ctx.strokeStyle = mainStyle.color;
      ctx.lineWidth = mainStyle.width / zoom; // Adjust for zoom
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
    }
    
    // Restore the context state (remove transformation)
    ctx.restore();
    
    // Only draw handles and points if the object is selected
    if (isSelected) {
      // Draw handle lines
      ctx.strokeStyle = HANDLE_LINE_COLOR;
      ctx.lineWidth = 1 / zoom; // Adjust for zoom
      
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        
        // Draw handle lines
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(point.handleIn.x, point.handleIn.y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(point.handleOut.x, point.handleOut.y);
        ctx.stroke();
        
        // Draw handle points
        // Handle In
        ctx.beginPath();
        ctx.arc(point.handleIn.x, point.handleIn.y, HANDLE_RADIUS / zoom, 0, Math.PI * 2);
        if (selectedPoint && 
            selectedPoint.objectId === objectId && 
            selectedPoint.pointIndex === i && 
            selectedPoint.type === ControlPointType.HANDLE_IN) {
          ctx.fillStyle = SELECTED_COLOR;
        } else {
          ctx.fillStyle = CONTROL_POINT_COLOR;
        }
        ctx.fill();
        
        // Handle Out
        ctx.beginPath();
        ctx.arc(point.handleOut.x, point.handleOut.y, HANDLE_RADIUS / zoom, 0, Math.PI * 2);
        if (selectedPoint && 
            selectedPoint.objectId === objectId && 
            selectedPoint.pointIndex === i && 
            selectedPoint.type === ControlPointType.HANDLE_OUT) {
          ctx.fillStyle = SELECTED_COLOR;
        } else {
          ctx.fillStyle = CONTROL_POINT_COLOR;
        }
        ctx.fill();
        
        // Draw main point
        ctx.beginPath();
        ctx.arc(point.x, point.y, POINT_RADIUS / zoom, 0, Math.PI * 2);
        
        // Change color if selected
        if (selectedPoint && 
            selectedPoint.objectId === objectId && 
            selectedPoint.pointIndex === i && 
            selectedPoint.type === ControlPointType.MAIN) {
          ctx.fillStyle = SELECTED_COLOR;
        } else {
          ctx.fillStyle = POINT_COLOR;
        }
        
        ctx.fill();
      }
    } else {
      // When not selected, just highlight with a bounding box
      if (points.length > 0) {
        // Find min/max bounds
        const xValues = points.map(p => p.x);
        const yValues = points.map(p => p.y);
        const minX = Math.min(...xValues);
        const minY = Math.min(...yValues);
        const maxX = Math.max(...xValues);
        const maxY = Math.max(...yValues);
        
        // Add padding
        const padding = 10 / zoom;
        
        // Draw dashed rectangle around object
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.5)';
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([5 / zoom, 3 / zoom]);
        
        ctx.beginPath();
        ctx.rect(
          minX - padding, 
          minY - padding, 
          maxX - minX + padding * 2, 
          maxY - minY + padding * 2
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };
  
  return { isPointInObject, handlePointInteraction, renderObject };
};

export default BezierObject;
