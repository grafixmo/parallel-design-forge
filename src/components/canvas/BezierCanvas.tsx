
import React, { useRef, useEffect, useState } from 'react';
import { ControlPoint, Point, ControlPointType } from '@/types/bezier';
import { toast } from '@/components/ui/use-toast';
import { Undo, ZoomIn, ZoomOut, Plus } from 'lucide-react';

// Import custom hooks
import { useCanvasSetup } from '@/hooks/useCanvasSetup';
import { useSelection } from '@/hooks/useSelection';
import { useDrawing } from '@/hooks/useDrawing';
import { useZoomPan } from '@/hooks/useZoomPan';
import { useInteraction } from '@/hooks/useInteraction';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// Import helper functions
import {
  drawGrid,
  drawBackgroundImage,
  drawCurves,
  drawHandleLines,
  drawControlPoints,
  drawSelectionRect,
  drawMultiSelectionIndicator,
  drawUIIndicators
} from '@/utils/canvas/drawHelpers';

import { screenToCanvas } from '@/utils/canvas/interactionHelpers';

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
  isDrawingMode?: boolean;
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
  backgroundOpacity,
  isDrawingMode = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [instructionMessage, setInstructionMessage] = useState<string>(
    'Click to place first control point (ESC to cancel)'
  );

  // Initialize hooks
  const {
    canvasWidth,
    canvasHeight,
    mousePos,
    setMousePos,
    backgroundImageObj
  } = useCanvasSetup(width, height, backgroundImage, canvasRef);

  const {
    selectedPoint,
    setSelectedPoint,
    isDragging,
    setIsDragging,
    isMultiDragging,
    setIsMultiDragging,
    lastDragPosition,
    setLastDragPosition,
    isSelecting,
    setIsSelecting,
    selectionRect,
    setSelectionRect,
    selectedPointsIndices,
    setSelectedPointsIndices,
    clearSelections,
    finalizeSelection
  } = useSelection();

  const {
    history,
    setHistory,
    currentHistoryIndex,
    setCurrentHistoryIndex,
    clipboard,
    setClipboard,
    addPointToCanvas,
    handleUndo: handleUndoAction,
    saveToHistory,
    startNewObject,
    isNewObjectMode,
    setIsNewObjectMode
  } = useDrawing();

  const {
    zoom,
    panOffset,
    isSpacePressed,
    isCanvasDragging,
    dragStart,
    screenToCanvas: convertScreenToCanvas,
    canvasToScreen: convertCanvasToScreen,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleWheel,
    setIsSpacePressed,
    setIsCanvasDragging,
    setDragStart,
    updatePanOffset
  } = useZoomPan();

  const {
    handlePointSelection,
    handlePointDrag,
    handleMultiPointDrag,
    handleSelectionStart,
    handleSelectionUpdate,
    addNewPoint,
    handleDoubleClick
  } = useInteraction({
    points,
    onPointsChange,
    isDrawingMode,
    selectedPointsIndices,
    setSelectedPointsIndices,
    selectedPoint,
    setSelectedPoint,
    isDragging,
    setIsDragging,
    isMultiDragging,
    setIsMultiDragging,
    lastDragPosition,
    setLastDragPosition,
    isSelecting,
    setIsSelecting,
    selectionRect,
    setSelectionRect,
    clearSelections,
    zoom,
    isNewObjectMode,
    setIsNewObjectMode
  });

  // Set up keyboard shortcuts
  useKeyboardShortcuts({
    points,
    onPointsChange,
    selectedPointsIndices,
    setSelectedPointsIndices,
    selectedPoint,
    setSelectedPoint,
    clearSelections,
    handleUndo: () => handleUndoAction(points, onPointsChange),
    clipboard,
    setClipboard,
    isSpacePressed,
    setIsSpacePressed,
    canvasRef,
    isDrawingMode,
    zoom,
    setZoom: (newZoom) => {},
    setPanOffset: (newOffset) => {}
  });

  // Update instruction message based on drawing mode and points
  useEffect(() => {
    if (isDrawingMode) {
      if (isNewObjectMode) {
        setInstructionMessage('Click to place first control point of a new object (ESC to cancel)');
      } else if (points.length === 0) {
        setInstructionMessage('Click to place first control point (ESC to cancel)');
      } else {
        setInstructionMessage('Click to add more points, or drag handles to adjust the curve (ESC to exit drawing mode)');
      }
    } else {
      if (selectedPointsIndices.length > 0) {
        setInstructionMessage('Drag selected points to move them as a group, or press DEL to delete them');
      } else {
        setInstructionMessage('Click to select points or Shift+Drag to select multiple points. Press ESC to deselect.');
      }
    }
  }, [isDrawingMode, points.length, selectedPointsIndices.length, isNewObjectMode]);

  // Effect to handle drawing mode changes
  useEffect(() => {
    clearSelections();
    
    if (isDrawingMode) {
      // When entering drawing mode, set new object mode to true
      setIsNewObjectMode(true);
      
      toast({
        title: 'Drawing Mode Activated',
        description: 'Click to add points, drag to adjust curves'
      });
    } else {
      toast({
        title: 'Selection Mode Activated',
        description: 'Select points to move or delete'
      });
    }
  }, [isDrawingMode, clearSelections, setIsNewObjectMode]);

  // Save points to history when they change
  useEffect(() => {
    saveToHistory(points);
  }, [points, saveToHistory]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and pan transformations
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    
    // Draw background image if available
    drawBackgroundImage(ctx, backgroundImageObj, backgroundOpacity, canvas.width, canvas.height, zoom);
    
    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height, zoom, panOffset);
    
    // Save the context state for transformation
    ctx.save();
    
    // Calculate center point for transformation
    const sumX = points.reduce((sum, point) => sum + point.x, 0);
    const sumY = points.reduce((sum, point) => sum + point.y, 0);
    const centerX = points.length > 0 ? sumX / points.length : canvas.width / (2 * zoom);
    const centerY = points.length > 0 ? sumY / points.length : canvas.height / (2 * zoom);
    
    // Apply transformations
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-centerX, -centerY);
    
    // Draw curves
    drawCurves(ctx, points, curveColor, curveWidth, parallelCount, parallelSpacing, parallelColors, parallelWidths, zoom);
    
    // Draw handle lines
    drawHandleLines(ctx, points, isDrawingMode, selectedPoint, selectedPointsIndices, zoom);
    
    // Restore the context state (remove transformation)
    ctx.restore();
    
    // Draw control points and handles
    drawControlPoints(ctx, points, isDrawingMode, selectedPoint, selectedPointsIndices, zoom);
    
    // Draw selection rectangle if selecting
    drawSelectionRect(ctx, isSelecting, selectionRect, zoom);
    
    // Draw multi-selection indicator
    drawMultiSelectionIndicator(ctx, isDrawingMode, selectedPointsIndices, points, zoom);
    
    // Draw UI indicators
    drawUIIndicators(
      ctx, 
      zoom, 
      isDrawingMode, 
      isMultiDragging, 
      selectedPointsIndices, 
      mousePos, 
      isSpacePressed, 
      isCanvasDragging,
      isNewObjectMode
    );
    
    ctx.restore();
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
    backgroundOpacity,
    zoom,
    panOffset,
    isSpacePressed,
    isCanvasDragging,
    mousePos,
    isDrawingMode,
    isMultiDragging,
    isNewObjectMode
  ]);

  // Handle mouse down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // Convert to canvas coordinates
    const canvasCoords = convertScreenToCanvas(screenX, screenY);
    const x = canvasCoords.x;
    const y = canvasCoords.y;
    
    setMousePos({ x, y });
    
    // Handle canvas dragging with middle mouse button or when space is pressed
    if (e.button === 1 || isSpacePressed) {
      setIsCanvasDragging(true);
      setDragStart({ x: screenX, y: screenY });
      return;
    }
    
    // Try to handle point selection
    const handled = handlePointSelection(x, y, e.shiftKey);
    
    // If not clicking on a point, start selection or add new point
    if (!handled) {
      if (e.shiftKey) {
        // Start selection rectangle
        handleSelectionStart(x, y);
      } else {
        if (isDrawingMode) {
          // Add new point if in drawing mode
          addNewPoint(x, y);
        } else {
          // In selection mode, clear selection when clicking on empty space
          clearSelections();
        }
      }
    }
  };

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // Convert to canvas coordinates
    const canvasCoords = convertScreenToCanvas(screenX, screenY);
    const x = canvasCoords.x;
    const y = canvasCoords.y;
    
    setMousePos({ x: screenX, y: screenY }); // Use screen coordinates for cursor
    
    // Handle canvas dragging
    if (isCanvasDragging) {
      const deltaX = screenX - dragStart.x;
      const deltaY = screenY - dragStart.y;
      
      updatePanOffset(deltaX, deltaY);
      setDragStart({ x: screenX, y: screenY });
      return;
    }
    
    // Handle multi-point dragging
    handleMultiPointDrag(x, y);
    
    // Handle single point dragging
    handlePointDrag(x, y);
    
    // Handle selection rectangle update
    handleSelectionUpdate(x, y);
    
    // Update cursor based on context
    if (canvas) {
      if (isSpacePressed || isCanvasDragging) {
        canvas.style.cursor = 'grab';
      } else if (isDrawingMode) {
        canvas.style.cursor = 'crosshair';
      } else if (isMultiDragging || (selectedPointsIndices.length > 0 && !isSelecting)) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'default';
      }
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    // Handle canvas dragging
    if (isCanvasDragging) {
      setIsCanvasDragging(false);
      return;
    }
    
    if (isSelecting && selectionRect) {
      finalizeSelection(points);
    }
    
    setIsDragging(false);
    setIsMultiDragging(false);
    setIsSelecting(false);
    setSelectionRect(null);
    setLastDragPosition(null);
  };

  return (
    <div ref={wrapperRef} className="relative w-full h-full overflow-hidden border border-gray-200 rounded-md bg-white">
      <div className="absolute top-4 left-4 text-sm text-gray-600 bg-white bg-opacity-70 px-2 py-1 rounded-md">
        {instructionMessage}
      </div>
      
      <div className="absolute bottom-4 left-4 text-xs text-gray-500">
        Shortcuts: Copy (⌘/Ctrl+C) • Cut (⌘/Ctrl+X) • Paste (⌘/Ctrl+V) • Undo (⌘/Ctrl+Z) • Delete (Del/Backspace) • Cancel/Deselect (ESC) • Multiple Selection (Shift+Drag) • Zoom (Mouse Wheel) • Pan Canvas (Space+Drag or Middle Mouse Button)
      </div>
      
      <div className="absolute top-4 right-4 flex space-x-2">
        {isDrawingMode && !isNewObjectMode && (
          <button
            className="p-1 bg-white bg-opacity-70 rounded hover:bg-opacity-100 transition-colors"
            onClick={() => startNewObject(onPointsChange)}
            title="Start New Object"
          >
            <Plus size={16} />
          </button>
        )}
        <button
          className="p-1 bg-white bg-opacity-70 rounded hover:bg-opacity-100 transition-colors"
          onClick={() => handleUndoAction(points, onPointsChange)}
          title="Undo (Ctrl+Z)"
        >
          <Undo size={16} />
        </button>
        <button
          className="p-1 bg-white bg-opacity-70 rounded hover:bg-opacity-100 transition-colors"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="p-1 bg-white bg-opacity-70 rounded hover:bg-opacity-100 transition-colors"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          className="p-1 bg-white bg-opacity-70 rounded hover:bg-opacity-100 transition-colors"
          onClick={handleZoomReset}
          title="Reset Zoom"
        >
          100%
        </button>
      </div>
      
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className={`touch-none ${
          isSpacePressed || isCanvasDragging 
            ? 'cursor-grab' 
            : isMultiDragging || (selectedPointsIndices.length > 0 && !isDrawingMode) 
              ? 'cursor-move' 
              : isDrawingMode 
                ? 'cursor-crosshair' 
                : 'cursor-default'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          
          const canvasCoords = convertScreenToCanvas(screenX, screenY);
          handleDoubleClick(canvasCoords.x, canvasCoords.y);
        }}
        onWheel={handleWheel}
      />
    </div>
  );
};

export default BezierCanvas;
