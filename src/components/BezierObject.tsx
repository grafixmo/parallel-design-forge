import React, { useRef, useEffect } from 'react';
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

// Create a utility class that can be used by the component
export class BezierObjectRenderer {
  object: BezierObjectType;
  isSelected: boolean;
  zoom: number;
  selectedPoint: SelectedPoint | null;
  onPointSelect: (point: SelectedPoint) => void;
  onPointMove: (objectId: string, points: ControlPoint[]) => void;
  onSelect: (objectId: string, multiSelect: boolean) => void;
  
  POINT_RADIUS = 8;
  HANDLE_RADIUS = 6;
  POINT_COLOR = '#3498db'; // Blue
  CONTROL_POINT_COLOR = '#2ecc71'; // Green
  SELECTED_COLOR = '#e74c3c'; // Red
  HANDLE_LINE_COLOR = 'rgba(52, 152, 219, 0.5)';
  
  constructor(props: BezierObjectProps) {
    this.object = props.object;
    this.isSelected = props.isSelected;
    this.zoom = props.zoom;
    this.selectedPoint = props.selectedPoint;
    this.onPointSelect = props.onPointSelect;
    this.onPointMove = props.onPointMove;
    this.onSelect = props.onSelect;
  }
  
  // Check if point is within object to know if we should select
  isPointInObject(x: number, y: number, radius: number): boolean {
    const points = this.object.points;
    
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
          
          if (isPointNear({ x, y }, curvePoint, radius + this.object.curveConfig.styles[0].width / 2)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  // Handle mouse interaction on a control point
  handlePointInteraction(
    x: number, 
    y: number, 
    radius: number
  ): { found: boolean, pointIndex: number, type: ControlPointType } {
    const points = this.object.points;
    
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
  }
  
  // Draw the object in a canvas
  renderObject(ctx: CanvasRenderingContext2D) {
    const points = this.object.points;
    const curveConfig = this.object.curveConfig;
    const transform = this.object.transform;
    const objectId = this.object.id;
    
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
      // Only draw parallel curves if parallelCount is greater than 1
      if (curveConfig.parallelCount > 1) {
        // Draw parallel curves first (behind main curve)
        for (let p = 1; p <= curveConfig.parallelCount; p++) {
          const offset = p * curveConfig.spacing;
          const color = curveConfig.styles[p] ? curveConfig.styles[p].color : curveConfig.styles[0].color;
          const width = curveConfig.styles[p] ? curveConfig.styles[p].width : curveConfig.styles[0].width;
          
          ctx.strokeStyle = color;
          ctx.lineWidth = width / this.zoom; // Adjust for zoom
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
      }
      
      // Draw main curve
      const mainStyle = curveConfig.styles[0] || { color: '#000000', width: 5 };
      ctx.strokeStyle = mainStyle.color;
      ctx.lineWidth = mainStyle.width / this.zoom; // Adjust for zoom
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
    if (this.isSelected) {
      // Draw handle lines
      ctx.strokeStyle = this.HANDLE_LINE_COLOR;
      ctx.lineWidth = 1 / this.zoom; // Adjust for zoom
      
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
        ctx.arc(point.handleIn.x, point.handleIn.y, this.HANDLE_RADIUS / this.zoom, 0, Math.PI * 2);
        if (this.selectedPoint && 
            this.selectedPoint.objectId === objectId && 
            this.selectedPoint.pointIndex === i && 
            this.selectedPoint.type === ControlPointType.HANDLE_IN) {
          ctx.fillStyle = this.SELECTED_COLOR;
        } else {
          ctx.fillStyle = this.CONTROL_POINT_COLOR;
        }
        ctx.fill();
        
        // Handle Out
        ctx.beginPath();
        ctx.arc(point.handleOut.x, point.handleOut.y, this.HANDLE_RADIUS / this.zoom, 0, Math.PI * 2);
        if (this.selectedPoint && 
            this.selectedPoint.objectId === objectId && 
            this.selectedPoint.pointIndex === i && 
            this.selectedPoint.type === ControlPointType.HANDLE_OUT) {
          ctx.fillStyle = this.SELECTED_COLOR;
        } else {
          ctx.fillStyle = this.CONTROL_POINT_COLOR;
        }
        ctx.fill();
        
        // Draw main point
        ctx.beginPath();
        ctx.arc(point.x, point.y, this.POINT_RADIUS / this.zoom, 0, Math.PI * 2);
        
        // Change color if selected
        if (this.selectedPoint && 
            this.selectedPoint.objectId === objectId && 
            this.selectedPoint.pointIndex === i && 
            this.selectedPoint.type === ControlPointType.MAIN) {
          ctx.fillStyle = this.SELECTED_COLOR;
        } else {
          ctx.fillStyle = this.POINT_COLOR;
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
        const padding = 10 / this.zoom;
        
        // Draw dashed rectangle around object
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.5)';
        ctx.lineWidth = 1 / this.zoom;
        ctx.setLineDash([5 / this.zoom, 3 / this.zoom]);
        
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
  }
  
  // Handle mouse interaction on a control point
  
}

// The actual React component that now properly returns JSX
const BezierObject: React.FC<BezierObjectProps> = (props) => {
  // This component doesn't actually render anything visible
  // It's a utility component that provides methods for the canvas
  return null;
};

export default BezierObject;
