
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
  onClearCanvas?: () => void;
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
  isDrawingMode = true,
  onClearCanvas
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
    finalizeSelection,
    isObjectSelected
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
    updatePanOffset,
    setZoom,
    setPanOffset
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

  // Get clearAllPoints function from keyboard shortcuts
  const { clearAllPoints } = useKeyboardShortcuts({
    pointGroups,
    setPointGroups,
    selectedPointsIndices,
    setSelectedPointsIndices,
    selectedPoint,
    setSelectedPoint,
    clearSelections,
    history,
    currentHistoryIndex,
    setCurrentHistoryIndex,
    clipboard,
    setClipboard,
    isSpacePressed,
    setIsSpacePressed,
    canvasRef,
    isDrawingMode,
    zoom,
    setZoom,
    setPanOffset,
    currentGroupIndex
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
        const selectedGroups = new Set(selectedPointsIndices.map(idx => idx.groupIndex)).size;
        setInstructionMessage(`${selectedGroups} object${selectedGroups > 1 ? 's' : ''} selected. Drag to move ${selectedGroups > 1 ? 'them' : 'it'}, or press DEL to delete.`);
      } else {
        setInstructionMessage('Click to select objects or Shift+Drag to select multiple objects. Press ESC to deselect.');
      }
    }
  }, [isDrawingMode, pointGroups, selectedPointsIndices.length, isNewObjectMode, currentGroupIndex]);

  // Effect to handle drawing mode changes
  useEffect(() => {
    clearSelections();
    
    if (isDrawingMode) {
      // When entering drawing mode, set new object mode to true if there are no groups
      if (pointGroups.length === 0) {
        setIsNewObjectMode(true);
      }
      
      toast({
        title: 'Drawing Mode Activated',
        description: 'Click to add points, drag to adjust curves'
      });
    } else {
      toast({
        title: 'Selection Mode Activated',
        description: 'Select objects to move or delete'
      });
    }
  }, [isDrawingMode, clearSelections, setIsNewObjectMode, pointGroups.length]);

  // Save points to history when they change
  useEffect(() => {
    saveToHistory(pointGroups);
  }, [pointGroups, saveToHistory]);

  // Connect onClearCanvas to clearAllPoints
  useEffect(() => {
    if (onClearCanvas) {
      // This connects the external clear button to our internal clear function
      // by overriding the provided function
      onClearCanvas = clearAllPoints;
    }
  }, [clearAllPoints, onClearCanvas]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas entirely to prevent ghost images
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and pan transformations for the grid and background
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    
    // Draw background image if available
    drawBackgroundImage(ctx, backgroundImageObj, backgroundOpacity, canvas.width, canvas.height, zoom);
    
    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height, zoom, panOffset);
    
    // Reset transformation to ensure clean state before drawing objects
    ctx.restore();
    
    // Draw each object group with different visual treatment
    pointGroups.forEach((group, groupIndex) => {
      const isCurrentGroup = groupIndex === currentGroupIndex;
      const isGroupSelected = isObjectSelected(groupIndex);
      
      // Save context before applying transformations for this group
      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(zoom, zoom);
      
      // Calculate center point for transformation
      let centerX = canvas.width / (2 * zoom);
      let centerY = canvas.height / (2 * zoom);
      
      if (group.points.length > 0) {
        const sumX = group.points.reduce((sum, point) => sum + point.x, 0);
        const sumY = group.points.reduce((sum, point) => sum + point.y, 0);
        centerX = sumX / group.points.length;
        centerY = sumY / group.points.length;
      }
      
      // Apply transformations for this group
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-centerX, -centerY);
      
      // Draw object label
      if (group.points.length > 0) {
        const firstPoint = group.points[0];
        ctx.fillStyle = isGroupSelected
          ? 'rgba(231, 76, 60, 0.9)' // Red when selected
          : isCurrentGroup 
            ? 'rgba(46, 204, 113, 0.9)' // Green when current 
            : 'rgba(52, 152, 219, 0.7)'; // Blue otherwise
        ctx.font = `bold ${14 / zoom}px Arial`;
        ctx.fillText(`Object #${groupIndex + 1}`, firstPoint.x - 20, firstPoint.y - 20);
      }
      
      // Apply reduced opacity for non-current groups in drawing mode, but preserve colors
      if (isDrawingMode && !isCurrentGroup) {
        ctx.globalAlpha = 0.5; // Set reduced opacity for non-current groups
      }
      
      // Draw the curves using provided colors
      drawCurves(
        ctx, 
        group.points, 
        isGroupSelected ? "#e74c3c" : curveColor, // Red when selected
        curveWidth, 
        parallelCount, 
        parallelSpacing, 
        parallelColors, 
        parallelWidths,
        zoom
      );
      
      // Reset opacity
      ctx.globalAlpha = 1.0;
      
      // Draw handle lines
      const isPointInGroup = selectedPoint && selectedPoint.groupIndex === groupIndex;
      const selectedPointIndicesInGroup = selectedPointsIndices
        .filter(idx => idx.groupIndex === groupIndex)
        .map(idx => idx.pointIndex);
      
      // Always show handle lines for the current group in drawing mode or selected groups
      const showHandles = isDrawingMode ? isCurrentGroup : isGroupSelected;
      
      if (showHandles) {
        drawHandleLines(
          ctx, 
          group.points, 
          true, // Always show handle lines for better usability 
          isPointInGroup ? selectedPoint : null, 
          selectedPointIndicesInGroup,
          zoom
        );
      }
      
      // Restore the context state (remove transformation)
      ctx.restore();
      
      // Apply fresh transformation for control points (without rotation/scale)
      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(zoom, zoom);
      
      // Draw control points and handles for this group (without transformation)
      // FIX: Only draw handles for the current group in drawing mode or selected groups in selection mode
      const shouldDrawControls = (isDrawingMode && isCurrentGroup) || (!isDrawingMode && isGroupSelected);
      
      if (shouldDrawControls) {
        drawControlPoints(
          ctx, 
          group.points, 
          true, // Always allow handle interaction for better usability
          isPointInGroup ? selectedPoint : null, 
          selectedPointIndicesInGroup,
          zoom,
          true // Always highlight when drawing controls
        );
      }
      
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
      
      // Draw a highlight around selected groups in selection mode
      if (!isDrawingMode && isGroupSelected && group.points.length > 0) {
        // Find min/max bounds of group points
        const minX = Math.min(...group.points.map(p => p.x));
        const minY = Math.min(...group.points.map(p => p.y));
        const maxX = Math.max(...group.points.map(p => p.x));
        const maxY = Math.max(...group.points.map(p => p.y));
        const padding = 30 / zoom;
        
        // Draw dashed rectangle around selected group
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
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
      
      ctx.restore();
    });
    
    // Use a clean context state for UI elements
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    
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
      
      // Draw multi-selection indicator
      drawMultiSelectionIndicator(ctx, isDrawingMode, selectedPoints, zoom);
    }
    
    ctx.restore();
    
    // Draw UI indicators and info in screen space (no transformations)
    ctx.save();
    
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
    currentGroupIndex,
    isObjectSelected
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
    
    // Fix: Check if clicking on empty space in selection mode to clear selection
    if (!isDrawingMode && !e.shiftKey) {
      // First check if we're clicking on a point or group
      const handled = handlePointSelection(x, y, e.shiftKey);
      
      // If not clicking on a point/group and not starting a selection, clear selection
      if (!handled && !e.shiftKey) {
        clearSelections();
        return;
      }
    }
    
    // Try to handle point selection
    const handled = handlePointSelection(x, y, e.shiftKey);
    
    // If not clicking on a point, start selection or add new point
    if (!handled) {
      if (e.shiftKey && !isDrawingMode) {
        // Start selection rectangle (only in selection mode)
        handleSelectionStart(x, y);
      } else {
        if (isDrawingMode) {
          // Add new point if in drawing mode
          addNewPoint(x, y);
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
      // Fix: Properly handle selection finalization with multiple groups
      finalizeSelection(pointGroups);
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
