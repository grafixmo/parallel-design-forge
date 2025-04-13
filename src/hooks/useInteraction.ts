
import { useCallback } from 'react';
import { ControlPoint, ControlPointType, Point, PointGroup } from '@/types/bezier';
import { toast } from '@/components/ui/use-toast';
import { 
  findPointNearCoordinates, 
  isClickWithinSelectedPointsBounds,
  updatePointDuringDrag, 
  updateMultiplePointsDuringDrag,
  createNewControlPoint
} from '@/utils/canvas/interactionHelpers';

interface UseInteractionProps {
  pointGroups: PointGroup[];
  onPointsChange: (pointGroups: PointGroup[]) => void;
  isDrawingMode: boolean;
  selectedPointsIndices: { groupIndex: number; pointIndex: number }[];
  setSelectedPointsIndices: (indices: { groupIndex: number; pointIndex: number }[]) => void;
  selectedPoint: { groupIndex: number; pointIndex: number; type: ControlPointType } | null;
  setSelectedPoint: (point: { groupIndex: number; pointIndex: number; type: ControlPointType } | null) => void;
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
  currentGroupIndex: number;
  setCurrentGroupIndex: (index: number) => void;
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
  pointGroups,
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
  setIsNewObjectMode,
  currentGroupIndex,
  setCurrentGroupIndex
}: UseInteractionProps): UseInteractionReturn {
  const POINT_RADIUS = 8;
  const HANDLE_RADIUS = 6;

  // Check if we should handle point selection
  const handlePointSelection = useCallback((x: number, y: number, shiftKey: boolean): boolean => {
    // Check if clicking within the bounds of selected points
    if (!isDrawingMode && selectedPointsIndices.length > 0) {
      const selectedPoints = selectedPointsIndices.map(({ groupIndex, pointIndex }) => 
        pointGroups[groupIndex]?.points[pointIndex]
      ).filter(Boolean);
      
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
    
    // Check if clicking on a control point or handle in any group
    for (let groupIndex = 0; groupIndex < pointGroups.length; groupIndex++) {
      const group = pointGroups[groupIndex];
      
      // Skip empty groups
      if (!group || !group.points || group.points.length === 0) continue;
      
      const result = findPointNearCoordinates(
        x, y, group.points, POINT_RADIUS, HANDLE_RADIUS, zoom, isDrawingMode, 
        selectedPointsIndices.filter(idx => idx.groupIndex === groupIndex).map(idx => idx.pointIndex)
      );
      
      if (result && result.found) {
        // When we select a point in drawing mode, we're no longer in new object mode
        if (isDrawingMode) {
          setIsNewObjectMode(false);
          setCurrentGroupIndex(groupIndex);
        }
        
        if (!isDrawingMode && !shiftKey) {
          // In selection mode, clicking on a point selects just that point
          const alreadySelected = selectedPointsIndices.some(
            idx => idx.groupIndex === groupIndex && idx.pointIndex === result.pointIndex
          );
          
          if (!alreadySelected) {
            setSelectedPointsIndices([{ groupIndex, pointIndex: result.pointIndex }]);
          }
        } else if (!isDrawingMode && shiftKey) {
          // Add/remove from selection with shift
          const existingIndex = selectedPointsIndices.findIndex(
            idx => idx.groupIndex === groupIndex && idx.pointIndex === result.pointIndex
          );
          
          if (existingIndex >= 0) {
            // Remove from selection
            setSelectedPointsIndices(selectedPointsIndices.filter((_, i) => i !== existingIndex));
          } else {
            // Add to selection
            setSelectedPointsIndices([...selectedPointsIndices, { groupIndex, pointIndex: result.pointIndex }]);
          }
        } else {
          setSelectedPoint({ groupIndex, pointIndex: result.pointIndex, type: result.type });
        }
        
        setIsDragging(true);
        setLastDragPosition({ x, y });
        return true;
      }
    }
    
    return false;
  }, [
    pointGroups, 
    isDrawingMode, 
    selectedPointsIndices, 
    zoom,
    setSelectedPointsIndices,
    setSelectedPoint,
    setIsDragging,
    setIsMultiDragging,
    setLastDragPosition,
    isNewObjectMode,
    setIsNewObjectMode,
    currentGroupIndex,
    setCurrentGroupIndex
  ]);

  // Handle dragging a single point or handle
  const handlePointDrag = useCallback((x: number, y: number) => {
    if (!isDragging || !selectedPoint || !lastDragPosition) return;
    
    const { groupIndex, pointIndex, type } = selectedPoint;
    
    // Make sure the group and point exist
    if (groupIndex < 0 || groupIndex >= pointGroups.length) return;
    
    const group = pointGroups[groupIndex];
    if (!group || pointIndex < 0 || pointIndex >= group.points.length) return;
    
    // Update the point
    const updatedGroups = [...pointGroups];
    const updatedPoints = updatePointDuringDrag(
      group.points,
      pointIndex,
      type,
      x, y,
      lastDragPosition.x,
      lastDragPosition.y
    );
    
    updatedGroups[groupIndex] = {
      ...group,
      points: updatedPoints
    };
    
    onPointsChange(updatedGroups);
    setLastDragPosition({ x, y });
  }, [
    isDragging,
    selectedPoint,
    lastDragPosition,
    pointGroups,
    onPointsChange,
    setLastDragPosition
  ]);

  // Handle dragging multiple points
  const handleMultiPointDrag = useCallback((x: number, y: number) => {
    if (!isMultiDragging || !lastDragPosition || selectedPointsIndices.length === 0) return;
    
    const deltaX = x - lastDragPosition.x;
    const deltaY = y - lastDragPosition.y;
    
    // Group the selected points by their group index
    const groupedSelection: Record<number, number[]> = {};
    
    selectedPointsIndices.forEach(({ groupIndex, pointIndex }) => {
      if (!groupedSelection[groupIndex]) {
        groupedSelection[groupIndex] = [];
      }
      groupedSelection[groupIndex].push(pointIndex);
    });
    
    // Create a copy of point groups
    const updatedGroups = [...pointGroups];
    
    // Update each group separately
    Object.entries(groupedSelection).forEach(([groupIdxStr, pointIndices]) => {
      const groupIdx = parseInt(groupIdxStr);
      
      if (groupIdx < 0 || groupIdx >= updatedGroups.length) return;
      
      const group = updatedGroups[groupIdx];
      if (!group) return;
      
      const updatedPoints = updateMultiplePointsDuringDrag(
        group.points,
        pointIndices,
        deltaX,
        deltaY
      );
      
      updatedGroups[groupIdx] = {
        ...group,
        points: updatedPoints
      };
    });
    
    onPointsChange(updatedGroups);
    setLastDragPosition({ x, y });
  }, [
    isMultiDragging,
    lastDragPosition,
    selectedPointsIndices,
    pointGroups,
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
    
    // Create a new point with the createNewControlPoint helper
    const newPoint = createNewControlPoint(x, y);
    
    // Create a copy of the pointGroups
    let updatedPointGroups = [...pointGroups];
    
    // If we're in new object mode, create a new group
    if (isNewObjectMode) {
      // Create a new point group
      const newGroup: PointGroup = {
        id: generateId(),
        points: [newPoint]
      };
      
      updatedPointGroups.push(newGroup);
      // Update current group index to point to the new group
      setCurrentGroupIndex(updatedPointGroups.length - 1);
      
      // After adding the first point of a new object, we're no longer in new object mode
      setIsNewObjectMode(false);
      
      toast({
        title: 'New Object Started',
        description: 'First point of new object added. Continue adding points to this object.'
      });
    } else {
      // Add to existing group
      if (currentGroupIndex >= 0 && currentGroupIndex < updatedPointGroups.length) {
        const currentGroup = updatedPointGroups[currentGroupIndex];
        const updatedPoints = [...currentGroup.points, newPoint];
        
        updatedPointGroups[currentGroupIndex] = {
          ...currentGroup,
          points: updatedPoints
        };
        
        toast({
          title: 'Point Added',
          description: `Added point to object #${currentGroupIndex + 1}`
        });
      } else {
        // Fall back to creating a new group if current index is invalid
        const newGroup: PointGroup = {
          id: generateId(),
          points: [newPoint]
        };
        
        updatedPointGroups.push(newGroup);
        setCurrentGroupIndex(updatedPointGroups.length - 1);
        
        toast({
          title: 'New Object Created',
          description: 'First point added to a new object'
        });
      }
    }
    
    onPointsChange(updatedPointGroups);
    
    // Set selected point to the newly added point
    const groupIndex = currentGroupIndex >= 0 ? currentGroupIndex : updatedPointGroups.length - 1;
    const pointIndex = updatedPointGroups[groupIndex].points.length - 1;
    
    setSelectedPoint({ 
      groupIndex,
      pointIndex, 
      type: ControlPointType.MAIN 
    });
    
    setIsDragging(true);
    setLastDragPosition({ x, y });
  }, [
    isDrawingMode,
    pointGroups,
    onPointsChange,
    setSelectedPoint,
    setIsDragging,
    setLastDragPosition,
    isNewObjectMode,
    setIsNewObjectMode,
    currentGroupIndex,
    setCurrentGroupIndex
  ]);

  // Handle double click to delete a point
  const handleDoubleClick = useCallback((x: number, y: number) => {
    if (!isDrawingMode) return;
    
    for (let groupIndex = 0; groupIndex < pointGroups.length; groupIndex++) {
      const group = pointGroups[groupIndex];
      if (!group) continue;
      
      for (let pointIndex = 0; pointIndex < group.points.length; pointIndex++) {
        const point = group.points[pointIndex];
        
        if (Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)) <= POINT_RADIUS / zoom) {
          // Create a copy of the pointGroups
          const updatedPointGroups = [...pointGroups];
          
          // Remove the point
          const updatedPoints = group.points.filter((_, idx) => idx !== pointIndex);
          
          if (updatedPoints.length > 0) {
            // Update the group with remaining points
            updatedPointGroups[groupIndex] = {
              ...group,
              points: updatedPoints
            };
          } else {
            // If the group is now empty, remove it
            updatedPointGroups.splice(groupIndex, 1);
            
            // Update current group index if needed
            if (currentGroupIndex === groupIndex) {
              setCurrentGroupIndex(-1);
            } else if (currentGroupIndex > groupIndex) {
              setCurrentGroupIndex(currentGroupIndex - 1);
            }
          }
          
          onPointsChange(updatedPointGroups);
          
          toast({
            title: "Point removed",
            description: `Point ${pointIndex + 1} has been deleted from object ${groupIndex + 1}`
          });
          
          return;
        }
      }
    }
  }, [
    isDrawingMode, 
    pointGroups, 
    zoom, 
    onPointsChange, 
    currentGroupIndex, 
    setCurrentGroupIndex
  ]);

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
