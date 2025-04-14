
import { useCallback, RefObject } from 'react';
import { 
  Point, 
  BezierObject, 
  SelectedPoint, 
  SelectionRect 
} from '@/types/bezier';
import { BezierObjectRenderer } from '@/components/BezierObject';

interface CanvasRendererProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  objects: BezierObject[];
  selectedObjectIds: string[];
  selectedPoint: SelectedPoint | null;
  mousePos: Point;
  zoom: number;
  panOffset: Point;
  isSelecting: boolean;
  selectionRect: SelectionRect | null;
  backgroundImageObj: HTMLImageElement | null;
  backgroundOpacity: number;
  isDrawingMode: boolean;
  currentDrawingObjectId: string | null;
  onObjectSelect: (objectId: string, multiSelect: boolean) => void;
}

export const useCanvasRenderer = (props: CanvasRendererProps) => {
  const {
    canvasRef,
    objects,
    selectedObjectIds,
    selectedPoint,
    mousePos,
    zoom,
    panOffset,
    isSelecting,
    selectionRect,
    backgroundImageObj,
    backgroundOpacity,
    isDrawingMode,
    currentDrawingObjectId,
    onObjectSelect
  } = props;
  
  // Main render function
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    console.log("Rendering canvas...", {
      objectsCount: objects.length,
      selectedIds: selectedObjectIds,
      mode: isDrawingMode ? 'Drawing' : 'Selection'
    });
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and pan transformations
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    
    // Draw background (grid)
    drawGrid(ctx, canvas.width, canvas.height, zoom, panOffset);
    
    // Draw background image if available
    if (backgroundImageObj) {
      ctx.globalAlpha = backgroundOpacity;
      
      // Calculate scaling to fit the canvas while maintaining aspect ratio
      const scale = Math.min(
        canvas.width / backgroundImageObj.width,
        canvas.height / backgroundImageObj.height
      ) / zoom; // Adjust for zoom
      
      const scaledWidth = backgroundImageObj.width * scale;
      const scaledHeight = backgroundImageObj.height * scale;
      
      const x = (canvas.width / zoom - scaledWidth) / 2;
      const y = (canvas.height / zoom - scaledHeight) / 2;
      
      ctx.drawImage(backgroundImageObj, x, y, scaledWidth, scaledHeight);
      ctx.globalAlpha = 1.0;
    }
    
    // Draw all bezier objects
    for (const object of objects) {
      const isObjectSelected = selectedObjectIds.includes(object.id);
      const isDrawingObject = object.id === currentDrawingObjectId;
      
      const bezierObject = new BezierObjectRenderer({
        object,
        isSelected: isObjectSelected || isDrawingObject,
        zoom,
        selectedPoint,
        onPointSelect: () => {}, // This is handled by the interaction hooks
        onPointMove: () => {}, // This is handled by the parent component
        onSelect: onObjectSelect
      });
      
      bezierObject.renderObject(ctx);
      
      // Add special visual indicator for the object being drawn
      if (isDrawingObject && object.points.length > 0) {
        // Draw a hint line from the last point to the mouse position
        const lastPoint = object.points[object.points.length - 1];
        
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([5 / zoom, 5 / zoom]);
        
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Text hint to show number of points in the drawing
        ctx.fillStyle = 'rgba(46, 204, 113, 0.8)';
        ctx.font = `${12 / zoom}px Arial`;
        ctx.fillText(
          `Drawing: ${object.points.length} point${object.points.length === 1 ? '' : 's'} (need at least 2)`, 
          lastPoint.x + 10 / zoom, 
          lastPoint.y - 10 / zoom
        );
      }
    }
    
    // Draw selection rectangle if selecting
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
    
    // Restore original context (removes zoom and pan)
    ctx.restore();
    
    // Draw UI overlays (in screen space)
    // Draw zoom level indicator
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = '12px Arial';
    ctx.fillText(`Zoom: ${Math.round(zoom * 100)}%`, 10, 20);
    
    // Show current mode indicator
    ctx.fillStyle = isDrawingMode ? 'rgba(46, 204, 113, 0.6)' : 'rgba(231, 76, 60, 0.6)';
    ctx.font = '12px Arial';
    ctx.fillText(`Mode: ${isDrawingMode ? 'Drawing' : 'Selection'}`, 10, 40);
    
    // Show drawing status if applicable
    if (currentDrawingObjectId) {
      const drawingObject = objects.find(obj => obj.id === currentDrawingObjectId);
      if (drawingObject) {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.6)';
        ctx.font = '12px Arial';
        ctx.fillText(
          `Drawing object: ${drawingObject.points.length} point${drawingObject.points.length === 1 ? '' : 's'}`, 
          10, 60
        );
      }
    }
    
    // Debug coordinates
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = '12px Arial';
    ctx.fillText(`Mouse: ${Math.round(mousePos.x)},${Math.round(mousePos.y)}`, 10, canvas.height - 10);
    
  }, [
    canvasRef,
    objects,
    selectedObjectIds,
    selectedPoint,
    mousePos,
    zoom,
    panOffset,
    isSelecting,
    selectionRect,
    backgroundImageObj,
    backgroundOpacity,
    isDrawingMode,
    currentDrawingObjectId,
    onObjectSelect
  ]);
  
  // Helper function to draw grid
  const drawGrid = (
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
  
  return renderCanvas;
};
