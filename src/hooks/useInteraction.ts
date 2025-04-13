
import { useCallback } from 'react';
import { ControlPoint, ControlPointType, Point } from '@/types/bezier';
import { toast } from '@/components/ui/use-toast';
import { 
  findPointNearCoordinates, 
  isClickWithinSelectedPointsBounds,
  updatePointDuringDrag, 
  updateMultiplePointsDuringDrag,
  createNewControlPoint
} from '@/utils/canvas/interactionHelpers';

interface UseInteractionProps {
  points: ControlPoint[];
  onPointsChange: (points: ControlPoint[]) => void;
  isDrawingMode: boolean;
  selectedPointsIndices: number[];
  setSelectedPointsIndices: (indices: number[]) => void;
  selectedPoint: { pointIndex: number; type: ControlPointType } | null;
  setSelectedPoint: (point: { pointIndex: number; type: ControlPointType } | null) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  isMultiDragging: boolean;
  setIsMultiDragging: (dragging: boolean) => void;
  lastDragPosition: Point | null;
  setLastDragPosition: (position: Point | null) => void;
  isSelecting: boolean;
  setIsSelecting: (selecting: boolean) => void;
  selectionRect: { startX: number; startY: number; width: number; height: number } | null;
  setSelectionRect: (rect: { startX: number; startY: number; width: number; height: number } | null) => void;
  clearSelections: () => void;
  zoom: number;
  isNewObjectMode: boolean;
  setIsNewObjectMode: (isNewObjectMode: boolean) => void;
}

interface UseInteractionReturn {
  handlePointSelection: (x: number, y: number, shiftKey: boolean) => boolean;
  handlePointDrag: (x: number, y: number) => void;
  handleMultiPointDrag: (x: number, y: number) => void;
  handleSelectionStart: (x: number, y: number) => void;
  handleSelectionUpdate: (x: number, y: number) => void;
  addNewPoint: (x: number, y: number) => void;
  handleDoubleClick: (x: number, y: number) => void;
}

export function useInteraction({
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
}: UseInteractionProps): UseInteractionReturn {
  const POINT_RADIUS = 8;
  const HANDLE_RADIUS = 6;

  // Check if we should handle point selection
  const handlePointSelection = useCallback((x: number, y: number, shiftKey: boolean): boolean => {
    // Check if clicking within the bounds of selected points
    if (!isDrawingMode && selectedPointsIndices.length > 0) {
      const selectedPoints = selectedPointsIndices.map(index => points[index]);
      
      if (isClickWithinSelectedPointsBounds(x, y, selectedPoints, 20 / zoom)) {
        setIsMultiDragging(true);
        setLastDragPosition({ x, y });
        return true;
      }
    }
    
    // In drawing mode, if we're in new object mode, we shouldn't select existing points
    if (isDrawingMode && isNewObjectMode) {
      return false;
    }
    
    // Check if clicking on a control point or handle
    const result = findPointNearCoordinates(
      x, y, points, POINT_RADIUS, HANDLE_RADIUS, zoom, isDrawingMode, selectedPointsIndices
    );
    
    if (result && result.found) {
      // When we select a point in drawing mode, we're no longer in new object mode
      if (isDrawingMode) {
        setIsNewObjectMode(false);
      }
      
      if (!isDrawingMode && !shiftKey && !selectedPointsIndices.includes(result.pointIndex)) {
        // In selection mode, clicking on a point selects just that point
        setSelectedPointsIndices([result.pointIndex]);
      } else if (!isDrawingMode && shiftKey) {
        // Add/remove from selection with shift
        if (selectedPointsIndices.includes(result.pointIndex)) {
          setSelectedPointsIndices(selectedPointsIndices.filter(idx => idx !== result.pointIndex));
        } else {
          setSelectedPointsIndices([...selectedPointsIndices, result.pointIndex]);
        }
      } else {
        setSelectedPoint({ pointIndex: result.pointIndex, type: result.type });
      }
      
      setIsDragging(true);
      setLastDragPosition({ x, y });
      return true;
    }
    
    return false;
  }, [
    points, 
    isDrawingMode, 
    selectedPointsIndices, 
    zoom,
    setSelectedPointsIndices,
    setSelectedPoint,
    setIsDragging,
    setIsMultiDragging,
    setLastDragPosition,
    isNewObjectMode,
    setIsNewObjectMode
  ]);

  // Handle dragging a single point or handle
  const handlePointDrag = useCallback((x: number, y: number) => {
    if (!isDragging || !selectedPoint || !lastDragPosition) return;
    
    const { pointIndex, type } = selectedPoint;
    const updatedPoints = updatePointDuringDrag(
      points, 
      pointIndex, 
      type, 
      x, y, 
      lastDragPosition.x, 
      lastDragPosition.y
    );
    
    onPointsChange(updatedPoints);
    setLastDragPosition({ x, y });
  }, [
    isDragging, 
    selectedPoint, 
    lastDragPosition, 
    points, 
    onPointsChange, 
    setLastDragPosition
  ]);

  // Handle dragging multiple points
  const handleMultiPointDrag = useCallback((x: number, y: number) => {
    if (!isMultiDragging || !lastDragPosition || selectedPointsIndices.length === 0) return;
    
    const deltaX = x - lastDragPosition.x;
    const deltaY = y - lastDragPosition.y;
    
    const updatedPoints = updateMultiplePointsDuringDrag(
      points, 
      selectedPointsIndices, 
      deltaX, 
      deltaY
    );
    
    onPointsChange(updatedPoints);
    setLastDragPosition({ x, y });
  }, [
    isMultiDragging, 
    lastDragPosition, 
    selectedPointsIndices, 
    points, 
    onPointsChange, 
    setLastDragPosition
  ]);

  // Start selection rectangle
  const handleSelectionStart = useCallback((x: number, y: number) => {
    setIsSelecting(true);
    setSelectionRect({
      startX: x,
      startY: y,
      width: 0,
      height: 0
    });
  }, [setIsSelecting, setSelectionRect]);

  // Update selection rectangle during mouse move
  const handleSelectionUpdate = useCallback((x: number, y: number) => {
    if (!isSelecting || !selectionRect) return;
    
    setSelectionRect({
      ...selectionRect,
      width: x - selectionRect.startX,
      height: y - selectionRect.startY
    });
  }, [isSelecting, selectionRect, setSelectionRect]);

  // Add new point to canvas
  const addNewPoint = useCallback((x: number, y: number) => {
    if (!isDrawingMode) return;
    
    const newPoint = createNewControlPoint(x, y);
    const updatedPoints = [...points, newPoint];
    onPointsChange(updatedPoints);
    
    // After adding the first point of a new object, we're no longer in new object mode
    setIsNewObjectMode(false);
    
    setSelectedPoint({ 
      pointIndex: updatedPoints.length - 1, 
      type: ControlPointType.MAIN 
    });
    setIsDragging(true);
    setLastDragPosition({ x, y });
  }, [
    isDrawingMode, 
    points, 
    onPointsChange, 
    setSelectedPoint, 
    setIsDragging, 
    setLastDragPosition,
    setIsNewObjectMode
  ]);

  // Handle double click to delete a point
  const handleDoubleClick = useCallback((x: number, y: number) => {
    if (!isDrawingMode) return;
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      if (Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)) <= POINT_RADIUS / zoom) {
        // Remove the point
        const updatedPoints = points.filter((_, index) => index !== i);
        onPointsChange(updatedPoints);
        
        toast({
          title: "Point removed",
          description: `Point ${i + 1} has been deleted`
        });
        
        break;
      }
    }
  }, [isDrawingMode, points, zoom, onPointsChange]);

  return {
    handlePointSelection,
    handlePointDrag,
    handleMultiPointDrag,
    handleSelectionStart,
    handleSelectionUpdate,
    addNewPoint,
    handleDoubleClick
  };
}
