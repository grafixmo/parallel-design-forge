
import React, { useRef } from 'react';
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
    screenToCanvas
  } = useCanvasSetup({
    canvasRef,
    wrapperRef,
    width,
    height,
    isDrawingMode,
    backgroundImage,
    backgroundOpacity
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
    setCurrentDrawingObjectId
  });

  // To avoid passive event issues, we'll handle the actual canvas click events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // We need to add passive: false to prevent default behavior for wheel events
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      handleWheel(e as unknown as React.WheelEvent<HTMLCanvasElement>);
    }, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel as any);
    };
  }, [handleWheel]);

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={width || 800}
        height={height || 600}
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
      
      <CanvasStatusInfo width={width} height={height} />
    </div>
  );
};

export default BezierCanvas;
