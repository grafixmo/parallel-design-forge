
import React from 'react';
import { 
  BezierObject, 
  ControlPoint, 
  Point, 
  ControlPointType,
  SelectedPoint
} from '@/types/bezier';
import { 
  calculateBezierPoint, 
  calculateDistance, 
  generatePathData,
  isPointNear
} from '@/utils/bezierUtils';

interface BezierObjectRendererProps {
  object: BezierObject;
  isSelected: boolean;
  zoom: number;
  selectedPoint: SelectedPoint | null;
  onPointSelect: (point: SelectedPoint | null) => void;
  onPointMove: (objectId: string, pointIndex: number, type: ControlPointType, position: Point) => void;
  onSelect: (objectId: string, multiSelect: boolean) => void;
}

export class BezierObjectRenderer {
  private object: BezierObject;
  private isSelected: boolean;
  private zoom: number;
  private selectedPoint: SelectedPoint | null;
  private onPointSelect: (point: SelectedPoint | null) => void;
  private onPointMove: (objectId: string, pointIndex: number, type: ControlPointType, position: Point) => void;
  private onSelect: (objectId: string, multiSelect: boolean) => void;

  constructor({
    object,
    isSelected,
    zoom,
    selectedPoint,
    onPointSelect,
    onPointMove,
    onSelect
  }: BezierObjectRendererProps) {
    this.object = object;
    this.isSelected = isSelected;
    this.zoom = zoom;
    this.selectedPoint = selectedPoint;
    this.onPointSelect = onPointSelect;
    this.onPointMove = onPointMove;
    this.onSelect = onSelect;
  }

  // Render the object to the canvas
  renderObject(ctx: CanvasRenderingContext2D): void {
    const { object, isSelected } = this;
    
    if (object.points.length < 2) {
      // Render just the points if not enough to form a curve
      this.renderPoints(ctx);
      return;
    }
    
    const { curveConfig, transform } = object;
    
    // Apply transformation
    ctx.save();
    
    // Calculate object center for transformations
    const center = this.calculateObjectCenter();
    
    // Translate to center, apply transforms, then translate back
    ctx.translate(center.x, center.y);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scaleX, transform.scaleY);
    ctx.translate(-center.x, -center.y);
    
    // Draw the main curve with all its styles
    curveConfig.styles.forEach((style, styleIndex) => {
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.width / this.zoom;
      
      if (curveConfig.parallelCount === 0) {
        // Draw a single path
        ctx.beginPath();
        this.drawBezierPath(ctx, 0);
        ctx.stroke();
      } else {
        // Draw parallel paths
        const parallelCount = curveConfig.parallelCount;
        const spacing = curveConfig.spacing;
        
        for (let i = -Math.floor(parallelCount / 2); i <= Math.floor(parallelCount / 2); i++) {
          ctx.beginPath();
          this.drawBezierPath(ctx, i * spacing);
          ctx.stroke();
        }
      }
    });
    
    // Draw object label if selected
    if (isSelected) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.font = `${12 / this.zoom}px Arial`;
      ctx.fillText(object.name, center.x, center.y - 20 / this.zoom);
    }
    
    // Draw the control points and handles if selected
    if (isSelected) {
      this.renderPoints(ctx);
    }
    
    ctx.restore();
  }
  
  // Draw the bezier path
  private drawBezierPath(ctx: CanvasRenderingContext2D, offset: number): void {
    const { points } = this.object;
    if (points.length < 2) return;
    
    // Move to first point
    ctx.moveTo(points[0].x, points[0].y);
    
    // Draw curve segments
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      
      ctx.bezierCurveTo(
        current.handleOut.x,
        current.handleOut.y,
        next.handleIn.x,
        next.handleIn.y,
        next.x,
        next.y
      );
    }
  }
  
  // Render control points and handles
  private renderPoints(ctx: CanvasRenderingContext2D): void {
    const { points } = this.object;
    const { selectedPoint } = this;
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      // Draw handle lines
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
      ctx.lineWidth = 1 / this.zoom;
      ctx.moveTo(point.handleIn.x, point.handleIn.y);
      ctx.lineTo(point.x, point.y);
      ctx.lineTo(point.handleOut.x, point.handleOut.y);
      ctx.stroke();
      
      // Draw main point
      const isThisPointSelected = selectedPoint && 
                                selectedPoint.objectId === this.object.id && 
                                selectedPoint.pointIndex === i &&
                                selectedPoint.type === ControlPointType.MAIN;
      
      ctx.beginPath();
      ctx.fillStyle = isThisPointSelected ? 'rgba(231, 76, 60, 0.8)' : 'rgba(52, 152, 219, 0.8)';
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5 / this.zoom;
      ctx.arc(point.x, point.y, 6 / this.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Draw point number
      ctx.fillStyle = 'white';
      ctx.font = `${10 / this.zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((i + 1).toString(), point.x, point.y);
      
      // Draw handle in
      const isHandleInSelected = selectedPoint && 
                                selectedPoint.objectId === this.object.id && 
                                selectedPoint.pointIndex === i &&
                                selectedPoint.type === ControlPointType.HANDLE_IN;
      
      ctx.beginPath();
      ctx.fillStyle = isHandleInSelected ? 'rgba(231, 76, 60, 0.8)' : 'rgba(46, 204, 113, 0.8)';
      ctx.arc(point.handleIn.x, point.handleIn.y, 4 / this.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Draw handle out
      const isHandleOutSelected = selectedPoint && 
                                selectedPoint.objectId === this.object.id && 
                                selectedPoint.pointIndex === i &&
                                selectedPoint.type === ControlPointType.HANDLE_OUT;
      
      ctx.beginPath();
      ctx.fillStyle = isHandleOutSelected ? 'rgba(231, 76, 60, 0.8)' : 'rgba(46, 204, 113, 0.8)';
      ctx.arc(point.handleOut.x, point.handleOut.y, 4 / this.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  
  // Calculate the center of the object (average of all points)
  calculateObjectCenter(): Point {
    const { points } = this.object;
    if (points.length === 0) return { x: 0, y: 0 };
    
    let sumX = 0;
    let sumY = 0;
    
    for (const point of points) {
      sumX += point.x;
      sumY += point.y;
    }
    
    return {
      x: sumX / points.length,
      y: sumY / points.length
    };
  }
  
  // Check if a point is inside or near the object
  isPointInObject(x: number, y: number, threshold: number): boolean {
    const { points } = this.object;
    if (points.length < 2) return false;
    
    // For each curve segment
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = { x: p0.handleOut.x, y: p0.handleOut.y };
      const p2 = { x: points[i + 1].handleIn.x, y: points[i + 1].handleIn.y };
      const p3 = points[i + 1];
      
      // Test multiple points along the curve
      const steps = 20;
      for (let t = 0; t <= steps; t++) {
        const pt = calculateBezierPoint(p0, p1, p2, p3, t / steps);
        const dist = calculateDistance(pt, { x, y });
        
        if (dist <= threshold) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  // Handle interactions with points and return info about what was clicked
  handlePointInteraction(
    x: number, 
    y: number, 
    threshold: number
  ): { found: boolean, pointIndex: number, type: ControlPointType } {
    const { points } = this.object;
    
    // Check main points first
    for (let i = 0; i < points.length; i++) {
      if (isPointNear({ x, y }, points[i], threshold)) {
        return { found: true, pointIndex: i, type: ControlPointType.MAIN };
      }
    }
    
    // Then check handle points
    for (let i = 0; i < points.length; i++) {
      if (isPointNear({ x, y }, points[i].handleIn, threshold)) {
        return { found: true, pointIndex: i, type: ControlPointType.HANDLE_IN };
      }
      
      if (isPointNear({ x, y }, points[i].handleOut, threshold)) {
        return { found: true, pointIndex: i, type: ControlPointType.HANDLE_OUT };
      }
    }
    
    return { found: false, pointIndex: -1, type: ControlPointType.MAIN };
  }
}
