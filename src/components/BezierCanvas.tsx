
import React, { useRef, useEffect, useState } from 'react';
import { 
  ControlPoint, 
  Point, 
  ControlPointType, 
  SelectedPoint,
  SelectionRect
} from '../types/bezier';
import { 
  isPointNear, 
  calculateBezierPoint,
  calculateParallelPoint, 
  generateId,
  isPointInSelectionRect
} from '../utils/bezierUtils';
import { toast } from '@/components/ui/use-toast';

interface BezierCanvasProps {
  width: number;
  height: number;
  points: ControlPoint[];
  onPointsChange: (points: ControlPoint[]) => void;
  curveWidth: number;
  curveColor: string;
  parallelCount: number;
  parallelSpacing: number;
  parallelColors: string[];
  parallelWidths: number[];
  rotation: number;
  scaleX: number;
  scaleY: number;
  backgroundImage?: string;
  backgroundOpacity: number;
}

const BezierCanvas: React.FC<BezierCanvasProps> = ({
  width,
  height,
  points,
  onPointsChange,
  curveWidth,
  curveColor,
  parallelCount,
  parallelSpacing,
  parallelColors,
  parallelWidths,
  rotation,
  scaleX,
  scaleY,
  backgroundImage,
  backgroundOpacity
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [selectedPointsIndices, setSelectedPointsIndices] = useState<number[]>([]);
  const [instructionMessage, setInstructionMessage] = useState<string>(
    'Click to place first control point (ESC to cancel)'
  );
  const [backgroundImageObj, setBackgroundImageObj] = useState<HTMLImageElement | null>(null);
  
  const POINT_RADIUS = 8;
  const HANDLE_RADIUS = 6;
  const POINT_COLOR = '#3498db'; // Blue
  const CONTROL_POINT_COLOR = '#2ecc71'; // Green
  const SELECTED_COLOR = '#e74c3c'; // Red
  const HANDLE_LINE_COLOR = 'rgba(52, 152, 219, 0.5)';
  
  // Initialize background image if URL is provided
  useEffect(() => {
    if (backgroundImage) {
      const img = new Image();
      img.src = backgroundImage;
      img.onload = () => {
        setBackgroundImageObj(img);
      };
    } else {
      setBackgroundImageObj(null);
    }
  }, [backgroundImage]);
  
  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background image if available
    if (backgroundImageObj) {
      ctx.globalAlpha = backgroundOpacity;
      
      // Calculate scaling to fit the canvas while maintaining aspect ratio
      const scale = Math.min(
        canvas.width / backgroundImageObj.width,
        canvas.height / backgroundImageObj.height
      );
      
      const scaledWidth = backgroundImageObj.width * scale;
      const scaledHeight = backgroundImageObj.height * scale;
      
      const x = (canvas.width - scaledWidth) / 2;
      const y = (canvas.height - scaledHeight) / 2;
      
      ctx.drawImage(backgroundImageObj, x, y, scaledWidth, scaledHeight);
      ctx.globalAlpha = 1.0;
    }
    
    // Draw grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    const gridSize = 20;
    
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Save the context state for transformation
    ctx.save();
    
    // Calculate center point for transformation
    const sumX = points.reduce((sum, point) => sum + point.x, 0);
    const sumY = points.reduce((sum, point) => sum + point.y, 0);
    const centerX = points.length > 0 ? sumX / points.length : canvas.width / 2;
    const centerY = points.length > 0 ? sumY / points.length : canvas.height / 2;
    
    // Apply transformations
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-centerX, -centerY);
    
    // Draw curves if we have enough points
    if (points.length >= 2) {
      // Draw parallel curves first (behind main curve)
      for (let p = 1; p <= parallelCount; p++) {
        const offset = p * parallelSpacing;
        const color = parallelColors[p - 1] || parallelColors[0] || curveColor;
        const width = parallelWidths[p - 1] || parallelWidths[0] || curveWidth;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
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
      ctx.lineWidth = curveWidth;
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
    
    // Draw handle lines
    ctx.strokeStyle = HANDLE_LINE_COLOR;
    ctx.lineWidth = 1;
    
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
    }
    
    // Restore the context state (remove transformation)
    ctx.restore();
    
    // Draw all control points and handles on top (without transformation)
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      // Draw handle points
      ctx.fillStyle = CONTROL_POINT_COLOR;
      
      // Handle In
      ctx.beginPath();
      ctx.arc(point.handleIn.x, point.handleIn.y, HANDLE_RADIUS, 0, Math.PI * 2);
      if (selectedPoint && selectedPoint.pointIndex === i && selectedPoint.type === ControlPointType.HANDLE_IN) {
        ctx.fillStyle = SELECTED_COLOR;
      } else {
        ctx.fillStyle = CONTROL_POINT_COLOR;
      }
      ctx.fill();
      
      // Handle Out
      ctx.beginPath();
      ctx.arc(point.handleOut.x, point.handleOut.y, HANDLE_RADIUS, 0, Math.PI * 2);
      if (selectedPoint && selectedPoint.pointIndex === i && selectedPoint.type === ControlPointType.HANDLE_OUT) {
        ctx.fillStyle = SELECTED_COLOR;
      } else {
        ctx.fillStyle = CONTROL_POINT_COLOR;
      }
      ctx.fill();
      
      // Draw main point
      ctx.beginPath();
      ctx.arc(point.x, point.y, POINT_RADIUS, 0, Math.PI * 2);
      
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
    
    // Draw selection rectangle if selecting
    if (isSelecting && selectionRect) {
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.8)';
      ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
      ctx.lineWidth = 2;
      
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
    
  }, [
    points, 
    selectedPoint, 
    curveWidth, 
    curveColor, 
    parallelCount, 
    parallelSpacing, 
    parallelColors, 
    parallelWidths,
    rotation,
    scaleX,
    scaleY,
    selectionRect,
    isSelecting,
    selectedPointsIndices,
    backgroundImageObj,
    backgroundOpacity
  ]);
  
  // Handle mouse down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x, y });
    
    // Check if clicking on a control point or handle
    let found = false;
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      // Check main point
      if (isPointNear({ x, y }, point, POINT_RADIUS)) {
        setSelectedPoint({ pointIndex: i, type: ControlPointType.MAIN });
        setIsDragging(true);
        found = true;
        break;
      }
      
      // Check handle in
      if (isPointNear({ x, y }, point.handleIn, HANDLE_RADIUS)) {
        setSelectedPoint({ pointIndex: i, type: ControlPointType.HANDLE_IN });
        setIsDragging(true);
        found = true;
        break;
      }
      
      // Check handle out
      if (isPointNear({ x, y }, point.handleOut, HANDLE_RADIUS)) {
        setSelectedPoint({ pointIndex: i, type: ControlPointType.HANDLE_OUT });
        setIsDragging(true);
        found = true;
        break;
      }
    }
    
    // If not clicking on a point, start selection or add new point
    if (!found) {
      if (e.shiftKey) {
        // Start selection rectangle
        setIsSelecting(true);
        setSelectionRect({
          startX: x,
          startY: y,
          width: 0,
          height: 0
        });
      } else {
        // Add a new point if we're not selecting
        if (selectedPointsIndices.length > 0) {
          // Deselect points if clicking elsewhere
          setSelectedPointsIndices([]);
        } else {
          // Add new point
          const newPoint: ControlPoint = {
            x,
            y,
            handleIn: { x: x - 50, y },
            handleOut: { x: x + 50, y },
            id: generateId()
          };
          
          const updatedPoints = [...points, newPoint];
          onPointsChange(updatedPoints);
          
          setSelectedPoint({ 
            pointIndex: updatedPoints.length - 1, 
            type: ControlPointType.MAIN 
          });
          setIsDragging(true);
          
          // Update instruction message
          if (points.length === 0) {
            setInstructionMessage('Click to add more points, or drag handles to adjust the curve');
          }
        }
      }
    }
  };
  
  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x, y });
    
    if (isDragging && selectedPoint !== null) {
      const { pointIndex, type } = selectedPoint;
      const updatedPoints = [...points];
      
      if (pointIndex >= 0 && pointIndex < updatedPoints.length) {
        const point = { ...updatedPoints[pointIndex] };
        
        if (type === ControlPointType.MAIN) {
          // Move the entire point and its handles
          const deltaX = x - point.x;
          const deltaY = y - point.y;
          
          point.x = x;
          point.y = y;
          point.handleIn.x += deltaX;
          point.handleIn.y += deltaY;
          point.handleOut.x += deltaX;
          point.handleOut.y += deltaY;
        } else if (type === ControlPointType.HANDLE_IN) {
          // Move handle in
          point.handleIn.x = x;
          point.handleIn.y = y;
        } else if (type === ControlPointType.HANDLE_OUT) {
          // Move handle out
          point.handleOut.x = x;
          point.handleOut.y = y;
        }
        
        updatedPoints[pointIndex] = point;
        onPointsChange(updatedPoints);
      }
    } else if (isSelecting && selectionRect) {
      // Update selection rectangle
      setSelectionRect({
        ...selectionRect,
        width: x - selectionRect.startX,
        height: y - selectionRect.startY
      });
    }
  };
  
  // Handle mouse up
  const handleMouseUp = () => {
    if (isSelecting && selectionRect) {
      // Find points inside the selection rectangle
      const selectedIndices = points.reduce((indices: number[], point, index) => {
        if (isPointInSelectionRect(point, selectionRect)) {
          indices.push(index);
        }
        return indices;
      }, []);
      
      setSelectedPointsIndices(selectedIndices);
      setIsSelecting(false);
      
      if (selectedIndices.length > 0) {
        toast({
          title: `${selectedIndices.length} points selected`,
          description: "Press Delete to remove selected points, or drag to move them together"
        });
      }
    }
    
    setIsDragging(false);
    setIsSelecting(false);
  };
  
  // Handle double click to delete a point
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if double-clicking on a control point
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      if (isPointNear({ x, y }, point, POINT_RADIUS)) {
        // Remove the point
        const updatedPoints = points.filter((_, index) => index !== i);
        onPointsChange(updatedPoints);
        
        toast({
          title: "Point removed",
          description: `Point ${i + 1} has been deleted`
        });
        
        break;
      }
    }
  };
  
  // Handle keyboard events for deleting selected points
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected points when Delete or Backspace is pressed
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPointsIndices.length > 0) {
        const updatedPoints = points.filter((_, index) => !selectedPointsIndices.includes(index));
        onPointsChange(updatedPoints);
        setSelectedPointsIndices([]);
        
        toast({
          title: "Points removed",
          description: `${selectedPointsIndices.length} points have been deleted`
        });
      }
      
      // Cancel current operation when Escape is pressed
      if (e.key === 'Escape') {
        setSelectedPoint(null);
        setIsDragging(false);
        setIsSelecting(false);
        setSelectionRect(null);
        setSelectedPointsIndices([]);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [points, selectedPointsIndices, onPointsChange]);
  
  return (
    <div ref={wrapperRef} className="relative w-full h-full overflow-hidden border border-gray-200 rounded-md bg-white">
      <div className="absolute top-4 left-4 text-sm text-gray-600 bg-white bg-opacity-70 px-2 py-1 rounded-md">
        {instructionMessage}
      </div>
      
      <div className="absolute bottom-4 left-4 text-xs text-gray-500">
        Shortcuts: Copy (⌘/Ctrl+C) • Cut (⌘/Ctrl+X) • Delete (Del/Backspace) • Cancel/Deselect (ESC) • Multiple Selection (Shift+Drag) • Zoom (Mouse Wheel)
      </div>
      
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="touch-none cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
};

export default BezierCanvas;
