
import React from 'react';
import { BezierObject, Point, ControlPoint, ControlPointType } from '@/types/bezier';
import { generatePathData, isPointNear } from '@/utils/bezierUtils';

interface BezierObjectRendererProps {
  object: BezierObject;
  isSelected: boolean;
  zoom: number;
  selectedPoint: { objectId: string; pointIndex: number; type: ControlPointType } | null;
  onPointSelect: (selection: { objectId: string; pointIndex: number; type: ControlPointType } | null) => void;
  onPointMove: (objectId: string, pointIndex: number, type: ControlPointType, newPos: Point) => void;
  onSelect: (objectId: string, multiSelect: boolean) => void;
}

export class BezierObjectRenderer {
  private object: BezierObject;
  private isSelected: boolean;
  private zoom: number;
  private selectedPoint: { objectId: string; pointIndex: number; type: ControlPointType } | null;
  private onPointSelect: (selection: { objectId: string; pointIndex: number; type: ControlPointType } | null) => void;
  private onPointMove: (objectId: string, pointIndex: number, type: ControlPointType, newPos: Point) => void;
  private onSelect: (objectId: string, multiSelect: boolean) => void;

  // Constants
  private CONTROL_POINT_RADIUS = 6;
  private HANDLE_POINT_RADIUS = 4;
  private HANDLE_LINE_WIDTH = 1;
  private SELECTED_CONTROL_POINT_COLOR = '#ff0000';
  private CONTROL_POINT_COLOR = '#0066ff';
  private HANDLE_POINT_COLOR = '#00cc44';

  constructor(props: BezierObjectRendererProps) {
    this.object = props.object;
    this.isSelected = props.isSelected;
    this.zoom = props.zoom;
    this.selectedPoint = props.selectedPoint;
    this.onPointSelect = props.onPointSelect;
    this.onPointMove = props.onPointMove;
    this.onSelect = props.onSelect;
  }

  // Render the bezier object
  renderObject(ctx: CanvasRenderingContext2D): void {
    const { points, curveConfig } = this.object;
    
    if (points.length < 2) return;
    
    // Draw the main curve
    for (const style of curveConfig.styles) {
      ctx.beginPath();
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const pathData = generatePathData(points);
      const path = new Path2D(pathData);
      ctx.stroke(path);
    }
    
    // Draw parallel curves if needed
    if (curveConfig.parallelCount > 0 && curveConfig.spacing > 0) {
      for (let i = 1; i <= curveConfig.parallelCount; i++) {
        const offset = i * curveConfig.spacing;
        
        ctx.beginPath();
        ctx.strokeStyle = curveConfig.styles[0].color;
        ctx.lineWidth = curveConfig.styles[0].width;
        
        const pathData = generatePathData(points, offset);
        const path = new Path2D(pathData);
        ctx.stroke(path);
      }
    }
    
    // Draw handles and control points if selected
    if (this.isSelected) {
      this.drawControlPoints(ctx);
    }
  }
  
  // Draw control points and handles
  private drawControlPoints(ctx: CanvasRenderingContext2D): void {
    const { points } = this.object;
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const isPointSelected = this.selectedPoint && 
                             this.selectedPoint.objectId === this.object.id && 
                             this.selectedPoint.pointIndex === i;
      
      // Draw handle lines
      ctx.beginPath();
      ctx.strokeStyle = this.HANDLE_POINT_COLOR;
      ctx.lineWidth = this.HANDLE_LINE_WIDTH / this.zoom;
      
      ctx.moveTo(point.handleIn.x, point.handleIn.y);
      ctx.lineTo(point.x, point.y);
      ctx.lineTo(point.handleOut.x, point.handleOut.y);
      ctx.stroke();
      
      // Draw handle points
      ctx.beginPath();
      ctx.fillStyle = this.HANDLE_POINT_COLOR;
      ctx.arc(point.handleIn.x, point.handleIn.y, this.HANDLE_POINT_RADIUS / this.zoom, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.fillStyle = this.HANDLE_POINT_COLOR;
      ctx.arc(point.handleOut.x, point.handleOut.y, this.HANDLE_POINT_RADIUS / this.zoom, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw main control point
      ctx.beginPath();
      
      // Determine point color based on selection state
      if (isPointSelected && this.selectedPoint!.type === ControlPointType.MAIN) {
        ctx.fillStyle = this.SELECTED_CONTROL_POINT_COLOR;
      } else {
        ctx.fillStyle = i === 0 || i === points.length - 1 ? 
                        this.SELECTED_CONTROL_POINT_COLOR : this.CONTROL_POINT_COLOR;
      }
      
      ctx.arc(point.x, point.y, this.CONTROL_POINT_RADIUS / this.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Check if a point is in the bezier path
  isPointInObject(x: number, y: number, threshold: number = 5): boolean {
    const { points } = this.object;
    
    if (points.length < 2) return false;
    
    // Create a temporary canvas for hit testing
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const tempCtx = canvas.getContext('2d');
    
    if (!tempCtx) return false;
    
    // Draw the path on this context
    tempCtx.beginPath();
    const pathData = generatePathData(points);
    const path = new Path2D(pathData);
    tempCtx.lineWidth = threshold;
    
    // Check if point is in stroke (allows clicking near the path)
    if (tempCtx.isPointInStroke(path, x, y)) {
      return true;
    }
    
    return false;
  }
  
  // Handle point interaction (returns point under cursor)
  handlePointInteraction(x: number, y: number, radius: number): { 
    found: boolean; 
    pointIndex: number; 
    type: ControlPointType 
  } {
    const { points } = this.object;
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      // Check main control point first
      if (isPointNear({ x, y }, point, radius)) {
        return { 
          found: true, 
          pointIndex: i, 
          type: ControlPointType.MAIN 
        };
      }
      
      // Check handle points
      if (isPointNear({ x, y }, point.handleIn, radius)) {
        return { 
          found: true, 
          pointIndex: i, 
          type: ControlPointType.HANDLE_IN 
        };
      }
      
      if (isPointNear({ x, y }, point.handleOut, radius)) {
        return { 
          found: true, 
          pointIndex: i, 
          type: ControlPointType.HANDLE_OUT 
        };
      }
    }
    
    return { found: false, pointIndex: -1, type: ControlPointType.MAIN };
  }
}
