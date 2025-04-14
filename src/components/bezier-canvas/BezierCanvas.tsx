
import React, { useRef, useEffect, useCallback } from 'react';
import { BezierObject } from '@/types/bezier';
import { useCanvasHandlers } from './hooks/useCanvasHandlers';
import { useCanvasSetup } from './hooks/useCanvasSetup';
import { CanvasToolbar } from './components/CanvasToolbar';
import { CanvasInstructions } from './components/CanvasInstructions';
import { CanvasStatusInfo } from './components/CanvasStatusInfo';

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
    renderCanvas
  });
  
  // Log key props for debugging - limiting to important changes only
  useEffect(() => {
    console.log("BezierCanvas render - objects count:", objects.length);
    console.log("BezierCanvas render - isDrawingMode:", isDrawingMode);
  }, [objects.length, isDrawingMode]);

  // Request animation frame for continuous rendering with performance optimization
  const animate = useCallback(() => {
    renderCanvas();
    animationFrameRef.current = window.requestAnimationFrame(animate);
  }, [renderCanvas]);
  
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
