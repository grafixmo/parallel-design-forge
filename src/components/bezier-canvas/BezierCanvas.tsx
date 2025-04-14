
import React, { useRef, useEffect, useCallback } from 'react';
import { BezierObject } from '@/types/bezier';
import { useCanvasHandlers } from './hooks/useCanvasHandlers';
import { useCanvasSetup } from './hooks/useCanvasSetup';
import { CanvasToolbar } from './components/CanvasToolbar';
import { CanvasInstructions } from './components/CanvasInstructions';
import { CanvasStatusInfo } from './components/CanvasStatusInfo';
import { BezierObjectRenderer } from '@/components/BezierObject';

interface BezierCanvasProps {
  width: number;
  height: number;
  objects: BezierObject[];
  selectedObjectIds: string[];
  onObjectSelect: (objectId: string, multiSelect: boolean) => void;
  onObjectsChange: (objects: BezierObject[]) => void;
  onCreateObject: (points: any[]) => string;
  onSaveState: () => void;
  onUndo: () => void;
  backgroundImage?: string;
  backgroundOpacity: number;
  isDrawingMode?: boolean;
}

const BezierCanvas: React.FC<BezierCanvasProps> = ({
  width,
  height,
  objects,
  selectedObjectIds,
  onObjectSelect,
  onObjectsChange,
  onCreateObject,
  onSaveState,
  onUndo,
  backgroundImage,
  backgroundOpacity,
  isDrawingMode = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  
  // Use our custom hooks for canvas functionality
  const {
    mousePos,
    setMousePos,
    instructionMessage,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    isDrawingMode: isInDrawingMode,
    currentDrawingObjectId,
    setCurrentDrawingObjectId,
    backgroundImageObj,
    screenToCanvas,
    canvasToScreen,
    renderCanvas,
    canvasDimensions
  } = useCanvasSetup({
    canvasRef,
    wrapperRef,
    width,
    height,
    isDrawingMode,
    backgroundImage,
    backgroundOpacity,
    objects,
    selectedObjectIds
  });
  
  // Draw all bezier objects on the canvas
  const renderObjects = useCallback((ctx: CanvasRenderingContext2D) => {
    // Adjust for high DPI screens
    const dpr = window.devicePixelRatio || 1;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Apply zoom and pan transformations
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    
    // Draw all bezier objects
    for (const object of objects) {
      const isObjectSelected = selectedObjectIds.includes(object.id);
      const isDrawingObject = object.id === currentDrawingObjectId;
      
      const bezierObject = new BezierObjectRenderer({
        object,
        isSelected: isObjectSelected || isDrawingObject,
        zoom,
        selectedPoint: null, // We'll handle this in the handlers
        onPointSelect: () => {}, // We'll handle this in the handlers
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
    
    ctx.restore();
  }, [objects, selectedObjectIds, currentDrawingObjectId, mousePos, zoom, panOffset, onObjectSelect]);
  
  // Enhanced render method with object rendering included
  const renderCanvasWithObjects = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // First render the basic canvas (grid, background, etc.)
    renderCanvas();
    
    // Then render the objects on top
    renderObjects(ctx);
    
  }, [renderCanvas, renderObjects]);
  
  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    handleDoubleClick,
    handleWheel,
    handleZoomIn,
    handleZoomOut,
    handleResetView
  } = useCanvasHandlers({
    canvasRef,
    objects,
    selectedObjectIds,
    onObjectSelect,
    onObjectsChange,
    onCreateObject,
    onSaveState,
    onUndo,
    zoom,
    panOffset,
    setZoom,
    setPanOffset,
    isDrawingMode,
    currentDrawingObjectId,
    setCurrentDrawingObjectId,
    setMousePos,
    screenToCanvas,
    renderCanvas: renderCanvasWithObjects  // Use enhanced render method
  });
  
  // Log key props for debugging - limiting to important changes only
  useEffect(() => {
    console.log("BezierCanvas render - objects count:", objects.length);
    console.log("BezierCanvas render - isDrawingMode:", isDrawingMode);
  }, [objects.length, isDrawingMode]);

  // Request animation frame for continuous rendering with performance optimization
  const animate = useCallback(() => {
    renderCanvasWithObjects();
    animationFrameRef.current = window.requestAnimationFrame(animate);
  }, [renderCanvasWithObjects]);
  
  useEffect(() => {
    // Start the animation loop
    animate();
    
    return () => {
      // Clean up animation frame on unmount
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate]);

  // To avoid passive event issues, we'll handle the actual canvas click events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // We need to add passive: false to prevent default behavior for wheel events
    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      handleWheel(e as unknown as React.WheelEvent<HTMLCanvasElement>);
    };
    
    canvas.addEventListener('wheel', wheelHandler, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', wheelHandler);
    };
  }, [handleWheel]);

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={canvasDimensions.width}
        height={canvasDimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        className="border border-gray-300 w-full h-full"
        style={{ minWidth: "400px", minHeight: "300px" }}
      />

      <CanvasToolbar 
        onZoomIn={handleZoomIn} 
        onZoomOut={handleZoomOut} 
        onResetView={handleResetView} 
        onUndo={onUndo} 
      />

      <CanvasInstructions message={instructionMessage} />
      
      <CanvasStatusInfo 
        width={canvasDimensions.width} 
        height={canvasDimensions.height} 
        zoom={zoom} 
        isDrawingMode={isDrawingMode}
        objectsCount={objects.length}
      />
    </div>
  );
};

export default BezierCanvas;
