
import React, { useEffect } from 'react';
import { Point, BezierObject, SelectionRect, SelectedPoint } from '@/types/bezier';
import { useCanvasSetup } from './hooks/useCanvasSetup';
import { useCanvasHandlers } from './hooks/useCanvasHandlers';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import { useResizeObserver } from '@/hooks/useResizeObserver';

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
  isDrawingMode = false
}) => {
  // Canvas setup
  const {
    canvasRef,
    containerRef,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    mousePos,
    setMousePos,
    screenToCanvas
  } = useCanvasSetup({
    width,
    height,
    isDrawingMode
  });
  
  // Get actual container dimensions
  const { width: containerWidth, height: containerHeight } = useResizeObserver(containerRef);
  
  // Current drawing object state
  const [currentDrawingObjectId, setCurrentDrawingObjectId] = React.useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = React.useState<SelectedPoint | null>(null);
  const [isSelecting, setIsSelecting] = React.useState<boolean>(false);
  const [selectionRect, setSelectionRect] = React.useState<SelectionRect | null>(null);
  const [backgroundImageObj, setBackgroundImageObj] = React.useState<HTMLImageElement | null>(null);
  
  // Load background image if provided
  useEffect(() => {
    if (backgroundImage) {
      const img = new Image();
      img.src = backgroundImage;
      img.onload = () => {
        setBackgroundImageObj(img);
        console.log("Background image loaded");
      };
    } else {
      setBackgroundImageObj(null);
    }
  }, [backgroundImage]);
  
  // Canvas rendering hook
  const renderCanvas = useCanvasRenderer({
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
  });
  
  // Canvas interaction handlers
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
    setZoom,
    setPanOffset,
    isDrawingMode,
    currentDrawingObjectId,
    setCurrentDrawingObjectId,
    setMousePos,
    screenToCanvas,
    renderCanvas
  });
  
  // Force an initial render
  useEffect(() => {
    console.log("Initial canvas render, dimensions:", width, "x", height);
    renderCanvas();
  }, [renderCanvas]);
  
  // Re-render when objects or selections change
  useEffect(() => {
    renderCanvas();
  }, [objects, selectedObjectIds, renderCanvas]);
  
  console.log("BezierCanvas rendering with width:", width, "height:", height, "objects:", objects.length);
  
  return (
    <div 
      ref={containerRef} 
      className="bezier-canvas-container w-full h-full overflow-hidden relative"
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: '100%',
          height: '100%',
          cursor: isDrawingMode ? 'crosshair' : 'default'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
      
      {/* Canvas controls overlay */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button 
          className="bg-white p-2 rounded-full shadow-lg hover:bg-gray-100"
          onClick={() => setZoom(Math.min(5, zoom * 1.2))}
          title="Zoom In"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
        
        <button 
          className="bg-white p-2 rounded-full shadow-lg hover:bg-gray-100"
          onClick={() => setZoom(Math.max(0.1, zoom * 0.8))}
          title="Zoom Out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
        
        <button 
          className="bg-white p-2 rounded-full shadow-lg hover:bg-gray-100"
          onClick={() => {
            setZoom(1);
            setPanOffset({ x: 0, y: 0 });
          }}
          title="Reset View"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
          </svg>
        </button>
      </div>
      
      {/* Mode indicator */}
      <div className="absolute top-4 left-4 bg-white px-3 py-1 rounded-md shadow-md">
        <span className="font-medium">
          Mode: {isDrawingMode ? 'Drawing' : 'Selection'}
        </span>
      </div>
      
      {/* Zoom level indicator */}
      <div className="absolute bottom-4 left-4 bg-white px-3 py-1 rounded-md shadow-md">
        <span className="font-medium">
          Zoom: {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
};

export default BezierCanvas;
