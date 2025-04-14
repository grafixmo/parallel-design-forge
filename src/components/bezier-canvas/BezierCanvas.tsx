
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
    instructionMessage,
    zoom,
    panOffset,
    isDrawingMode: isInDrawingMode,
    currentDrawingObjectId,
    handleZoomIn,
    handleZoomOut,
    handleResetView
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
    handleWheel
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
    isDrawingMode,
    currentDrawingObjectId
  });

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
        onWheel={handleWheel}
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
