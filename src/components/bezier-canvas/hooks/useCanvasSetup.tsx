
import { useState, useEffect, RefObject, useCallback, useLayoutEffect } from 'react';
import { Point, BezierObject } from '@/types/bezier';
import { toast } from '@/hooks/use-toast';
import { BezierObjectRenderer } from '@/components/BezierObject';

interface CanvasSetupProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  wrapperRef: RefObject<HTMLDivElement>;
  width: number;
  height: number;
  isDrawingMode: boolean;
  backgroundImage?: string;
  backgroundOpacity: number;
  objects: BezierObject[];
  selectedObjectIds: string[];
}

export const useCanvasSetup = ({
  canvasRef,
  wrapperRef,
  width,
  height,
  isDrawingMode,
  backgroundImage,
  backgroundOpacity,
  objects,
  selectedObjectIds
}: CanvasSetupProps) => {
  // State for canvas setup and configuration
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [instructionMessage, setInstructionMessage] = useState<string>(
    'Click to place first control point (ESC to cancel)'
  );
  const [backgroundImageObj, setBackgroundImageObj] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [currentDrawingObjectId, setCurrentDrawingObjectId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<any | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState<{width: number, height: number}>({
    width: width || 800,
    height: height || 600
  });
  
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

  // Set canvas dimensions only when width/height props or wrapper dimensions change
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    let newWidth = width;
    let newHeight = height;
    
    // If width/height not provided, fallback to container size
    if (!width || !height) {
      const container = wrapperRef.current;
      if (container) {
        newWidth = container.clientWidth || 800;
        newHeight = container.clientHeight || 600;
      } else {
        // Last resort fallback
        newWidth = 800;
        newHeight = 600;
      }
    }
    
    // Only update canvas if dimensions have changed
    if (newWidth !== canvasDimensions.width || newHeight !== canvasDimensions.height) {
      console.log(`Canvas dimensions updated to ${newWidth}x${newHeight}`);
      canvas.width = newWidth;
      canvas.height = newHeight;
      setCanvasDimensions({ width: newWidth, height: newHeight });
    }
  }, [width, height, canvasRef, wrapperRef]);
  
  // Update instruction message based on current state
  useEffect(() => {
    if (isDrawingMode) {
      if (currentDrawingObjectId) {
        // Currently drawing an object
        setInstructionMessage('Click to add more points. Right-click or double-click to finish the object. (ESC to cancel)');
      } else {
        // Ready to start drawing
        setInstructionMessage('Click to place first control point (ESC to cancel)');
      }
    } else {
      setInstructionMessage('Click to select objects or Shift+Drag to select multiple objects');
    }
  }, [isDrawingMode, currentDrawingObjectId]);
  
  // Convert screen coordinates to canvas coordinates (accounting for zoom)
  const screenToCanvas = useCallback((x: number, y: number): Point => {
    return {
      x: (x - panOffset.x) / zoom,
      y: (y - panOffset.y) / zoom
    };
  }, [zoom, panOffset]);
  
  // Optimize the render function with throttling to prevent excessive repaints
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    try {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply zoom and pan transformations
      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(zoom, zoom);
      
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
      
      // Draw grid
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = 1 / zoom; // Adjust line width for zoom
      
      const gridSize = 20;
      const visibleWidth = canvas.width / zoom;
      const visibleHeight = canvas.height / zoom;
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
      
      // Draw all bezier objects
      if (objects.length > 0) {
        for (const object of objects) {
          try {
            const isObjectSelected = selectedObjectIds.includes(object.id);
            const isDrawingObject = object.id === currentDrawingObjectId;
            
            const bezierObject = new BezierObjectRenderer({
              object,
              isSelected: isObjectSelected || isDrawingObject,
              zoom,
              selectedPoint: null, // This will be passed from the handlers
              onPointSelect: () => {}, // This will be handled by the handlers
              onPointMove: () => {}, // This will be handled by the handlers
              onSelect: () => {} // This will be handled by the handlers
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
          } catch (error) {
            console.error('Error rendering object:', error, object);
          }
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
      
      // Draw zoom level indicator
      ctx.restore(); // Restore original context without zoom
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
    } catch (error) {
      console.error('Error during canvas rendering:', error);
    }
  }, [
    canvasRef, 
    zoom, 
    panOffset, 
    backgroundImageObj, 
    backgroundOpacity,
    mousePos,
    isDrawingMode,
    currentDrawingObjectId,
    objects,
    selectedObjectIds,
    isSelecting,
    selectionRect
  ]);
  
  return {
    mousePos,
    setMousePos,
    instructionMessage,
    backgroundImageObj,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    isDrawingMode,
    currentDrawingObjectId,
    setCurrentDrawingObjectId,
    isSelecting,
    setIsSelecting,
    selectionRect,
    setSelectionRect,
    screenToCanvas,
    renderCanvas,
    canvasDimensions
  };
};
