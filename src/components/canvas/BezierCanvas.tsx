import React, { useRef, useEffect, useState } from 'react';
import { ControlPoint, Point, ControlPointType, PointGroup } from '@/types/bezier';
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
import { generateId } from '@/utils/bezierUtils';

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

  // Convert flat points array to point groups structure
  const [pointGroups, setPointGroups] = useState<PointGroup[]>([]);
  
  // Initialize point groups from flat points array on first render
  useEffect(() => {
    if (points.length > 0 && pointGroups.length === 0) {
      // Initially, put all points in one group
      setPointGroups([{
        id: generateId(),
        points: [...points]
      }]);
    }
  }, [points, pointGroups.length]);

  // Update instruction message based on state
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
    setIsNewObjectMode,
    currentGroupIndex,
    setCurrentGroupIndex
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
    pointGroups,
    onPointsChange: setPointGroups,
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
    setIsNewObjectMode,
    currentGroupIndex,
    setCurrentGroupIndex
  });

  // Helper function to convert point groups to flat array (for backward compatibility)
  const pointGroupsToFlatArray = (groups: PointGroup[]): ControlPoint[] => {
    return groups.flatMap(group => group.points);
  };

  // Update the external points array when point groups change
  useEffect(() => {
    if (pointGroups.length > 0) {
      const flatPoints = pointGroupsToFlatArray(pointGroups);
      onPointsChange(flatPoints);
    }
  }, [pointGroups, onPointsChange]);

  // Set up keyboard shortcuts with adapter for old API
  useKeyboardShortcuts({
    points: pointGroupsToFlatArray(pointGroups),
    onPointsChange: (newPoints) => {
      // If all points are deleted, reset point groups
      if (newPoints.length === 0) {
        setPointGroups([]);
      } else {
        // Not handling complex operations here as they're better handled by the new grouped structure
        // This is just a compatibility layer for basic keyboard shortcuts
      }
    },
    selectedPointsIndices: selectedPointsIndices.map(idx => idx.pointIndex), // backward compatibility
    setSelectedPointsIndices: (indices) => {
      // Convert flat indices to grouped indices (simplified)
      setSelectedPointsIndices(indices.map(index => ({
        groupIndex: currentGroupIndex >= 0 ? currentGroupIndex : 0,
        pointIndex: index
      })));
    },
    selectedPoint: selectedPoint ? {
      pointIndex: selectedPoint.pointIndex,
      type: selectedPoint.type
    } : null,
    setSelectedPoint: (point) => {
      if (point) {
        setSelectedPoint({
          groupIndex: currentGroupIndex >= 0 ? currentGroupIndex : 0,
          pointIndex: point.pointIndex,
          type: point.type
        });
      } else {
        setSelectedPoint(null);
      }
    },
    clearSelections,
    handleUndo: () => {
      if (history.length > 0 && currentHistoryIndex > 0) {
        const prevState = history[currentHistoryIndex - 1];
        setCurrentHistoryIndex(currentHistoryIndex - 1);
        setPointGroups(prevState.pointGroups);
      }
    },
    clipboard,
    setClipboard,
    isSpacePressed,
    setIsSpacePressed,
    canvasRef,
    isDrawingMode,
    zoom,
    setZoom: () => {}, // Not used
    setPanOffset: () => {} // Not used
  });

  // Update instruction message based on drawing mode and points
  useEffect(() => {
    const totalPoints = pointGroups.reduce((sum, group) => sum + group.points.length, 0);
    
    if (isDrawingMode) {
      if (isNewObjectMode) {
        setInstructionMessage('Click to place first control point of a new object (ESC to cancel)');
      } else if (totalPoints === 0) {
        setInstructionMessage('Click to place first control point (ESC to cancel)');
      } else {
        const currentObject = currentGroupIndex >= 0 && currentGroupIndex < pointGroups.length 
          ? `object #${currentGroupIndex + 1}` 
          : "current object";
        setInstructionMessage(`Click to add more points to ${currentObject}, or use the "New Object" button to start a new object`);
      }
    } else {
      if (selectedPointsIndices.length > 0) {
        setInstructionMessage('Drag selected points to move them as a group, or press DEL to delete them');
      } else {
        setInstructionMessage('Click to select points or Shift+Drag to select multiple points. Press ESC to deselect.');
      }
    }
  }, [isDrawingMode, pointGroups, selectedPointsIndices.length, isNewObjectMode, currentGroupIndex]);

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
    saveToHistory(pointGroups);
  }, [pointGroups, saveToHistory]);

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
    
    // Reset transformation matrix to identity before drawing each group
    // This ensures we don't have cumulative transformations causing ghost images
    ctx.restore();
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    
    // Draw each object group with different visual treatment
    pointGroups.forEach((group, groupIndex) => {
      const isCurrentGroup = groupIndex === currentGroupIndex;
      
      // Save the context state for transformation
      ctx.save();
      
      // Calculate center point for transformation
      const sumX = group.points.reduce((sum, point) => sum + point.x, 0);
      const sumY = group.points.reduce((sum, point) => sum + point.y, 0);
      const centerX = group.points.length > 0 ? sumX / group.points.length : canvas.width / (2 * zoom);
      const centerY = group.points.length > 0 ? sumY / group.points.length : canvas.height / (2 * zoom);
      
      // Apply transformations
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-centerX, -centerY);
      
      // Draw object label
      if (group.points.length > 0) {
        const firstPoint = group.points[0];
        ctx.fillStyle = isCurrentGroup ? 'rgba(46, 204, 113, 0.9)' : 'rgba(52, 152, 219, 0.7)';
        ctx.font = `bold ${14 / zoom}px Arial`;
        ctx.fillText(`Object #${groupIndex + 1}`, firstPoint.x - 20, firstPoint.y - 20);
      }
      
      // Draw curves with different opacity for non-current groups in drawing mode
      if (isDrawingMode && !isCurrentGroup) {
        ctx.globalAlpha = 0.5; // Set reduced opacity for non-current groups
      }
      
      // Fix the arguments for drawCurves
      drawCurves(
        ctx, 
        group.points, 
        isCurrentGroup ? curveColor : '#999999', 
        curveWidth, 
        parallelCount, 
        parallelSpacing, 
        isCurrentGroup ? parallelColors : parallelColors.map(() => '#999999'), 
        parallelWidths,
        zoom
      );
      
      // Reset opacity
      ctx.globalAlpha = 1.0;
      
      // Fix: Pass indices as an array instead of a boolean
      drawHandleLines(
        ctx, 
        group.points, 
        isDrawingMode, 
        selectedPoint?.groupIndex === groupIndex ? selectedPoint : null, 
        selectedPointsIndices.filter(idx => idx.groupIndex === groupIndex).map(idx => idx.pointIndex),
        zoom
      );
      
      // Restore the context state (remove transformation)
      ctx.restore();
      
      // Draw control points and handles for this group (without transformation)
      drawControlPoints(
        ctx, 
        group.points, 
        isDrawingMode && isCurrentGroup, 
        selectedPoint?.groupIndex === groupIndex ? selectedPoint : null, 
        selectedPointsIndices.filter(idx => idx.groupIndex === groupIndex).map(idx => idx.pointIndex),
        zoom,
        isCurrentGroup
      );
      
      // Draw a highlight around the current group in drawing mode
      if (isDrawingMode && isCurrentGroup && group.points.length > 0) {
        // Find min/max bounds of group points
        const minX = Math.min(...group.points.map(p => p.x));
        const minY = Math.min(...group.points.map(p => p.y));
        const maxX = Math.max(...group.points.map(p => p.x));
        const maxY = Math.max(...group.points.map(p => p.y));
        const padding = 30 / zoom;
        
        // Draw dashed rectangle around current group
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.8)';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([5 / zoom, 3 / zoom]);
        
        ctx.beginPath();
        ctx.rect(
          minX - padding, 
          minY - padding, 
          maxX - minX + (padding * 2), 
          maxY - minY + (padding * 2)
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
    
    // Draw selection rectangle if selecting
    drawSelectionRect(ctx, isSelecting, selectionRect, zoom);
    
    // Draw multi-selection indicator (fixing the arguments)
    if (selectedPointsIndices.length > 0) {
      // Get the actual selected points from different groups
      const selectedPoints = selectedPointsIndices.map(({ groupIndex, pointIndex }) => 
        groupIndex >= 0 && groupIndex < pointGroups.length && 
        pointIndex >= 0 && pointIndex < pointGroups[groupIndex].points.length ? 
          pointGroups[groupIndex].points[pointIndex] : null
      ).filter(Boolean) as ControlPoint[];
      
      // Fix: Update arguments to match the updated function signature
      drawMultiSelectionIndicator(ctx, isDrawingMode, selectedPoints, zoom);
    }
    
    // Draw UI indicators
    drawUIIndicators(
      ctx, 
      zoom, 
      isDrawingMode, 
      isMultiDragging, 
      selectedPointsIndices.map(idx => idx.pointIndex), // backward compatibility 
      mousePos, 
      isSpacePressed, 
      isCanvasDragging,
      isNewObjectMode
    );
    
    // Draw visual indicator for new object mode
    if (isDrawingMode && isNewObjectMode) {
      ctx.fillStyle = 'rgba(46, 204, 113, 0.6)';
      ctx.font = `${14 / zoom}px Arial`;
      const newObjectText = 'New Object Mode';
      ctx.fillText(newObjectText, 10 / zoom, 80 / zoom);
      
      // Draw a highlight around the plus button
      const plusButtonRect = {
        x: canvas.width - (70 / zoom),
        y: 10 / zoom,
        width: 30 / zoom,
        height: 30 / zoom
      };
      
      ctx.strokeStyle = 'rgba(46, 204, 113, 0.8)';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 3 / zoom]);
      ctx.strokeRect(plusButtonRect.x, plusButtonRect.y, plusButtonRect.width, plusButtonRect.height);
      ctx.setLineDash([]);
    }
    
    // Draw current object indicator
    if (isDrawingMode && !isNewObjectMode && currentGroupIndex >= 0) {
      ctx.fillStyle = 'rgba(46, 204, 113, 0.6)';
      ctx.font = `${14 / zoom}px Arial`;
      const currentObjectText = `Editing Object #${currentGroupIndex + 1}`;
      ctx.fillText(currentObjectText, 10 / zoom, 100 / zoom);
    }
    
    ctx.restore();
  }, [
    pointGroups, 
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
    isNewObjectMode,
    currentGroupIndex
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
      // For backward compatibility, adapt the finalizeSelection function
      finalizeSelection(pointGroups.flatMap(group => group.points));
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
        {isDrawingMode && (
          <button
            className={`p-2 rounded transition-colors flex items-center justify-center ${
              isNewObjectMode 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'bg-white bg-opacity-70 hover:bg-opacity-100'
            }`}
            onClick={() => startNewObject(pointGroups, setPointGroups)}
            title="Start New Object"
          >
            <Plus size={16} />
            <span className="ml-1 text-xs">New Object</span>
          </button>
        )}
        <button
          className="p-1 bg-white bg-opacity-70 rounded hover:bg-opacity-100 transition-colors"
          onClick={() => handleUndoAction(pointGroups, setPointGroups)}
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
