
import { useState, useCallback } from 'react';
import { ControlPoint, ControlPointType, Point, SelectionRect, PointGroup } from '@/types/bezier';
import { toast } from '@/components/ui/use-toast';
import { findPointsInSelectionRect } from '@/utils/canvas/interactionHelpers';

interface UseSelectionReturn {
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
  selectionRect: SelectionRect | null;
  setSelectionRect: (rect: SelectionRect | null) => void;
  selectedPointsIndices: { groupIndex: number; pointIndex: number }[];
  setSelectedPointsIndices: (indices: { groupIndex: number; pointIndex: number }[]) => void;
  clearSelections: () => void;
  finalizeSelection: (pointGroups: PointGroup[]) => void;
  isObjectSelected: (groupIndex: number) => boolean;
}

export function useSelection(): UseSelectionReturn {
  const [selectedPoint, setSelectedPoint] = useState<{ groupIndex: number; pointIndex: number; type: ControlPointType } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isMultiDragging, setIsMultiDragging] = useState<boolean>(false);
  const [lastDragPosition, setLastDragPosition] = useState<Point | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [selectedPointsIndices, setSelectedPointsIndices] = useState<{ groupIndex: number; pointIndex: number }[]>([]);

  // Check if an object (group) is selected
  const isObjectSelected = useCallback((groupIndex: number) => {
    return selectedPointsIndices.some(index => index.groupIndex === groupIndex);
  }, [selectedPointsIndices]);

  // Clear all selections and reset states
  const clearSelections = useCallback(() => {
    setSelectedPoint(null);
    setIsDragging(false);
    setIsMultiDragging(false);
    setIsSelecting(false);
    setSelectionRect(null);
    setSelectedPointsIndices([]);
    setLastDragPosition(null);
  }, []);

  // Finalize selection after drawing rectangle
  const finalizeSelection = useCallback((pointGroups: PointGroup[]) => {
    if (!selectionRect) return;
    
    const selectedIndices: { groupIndex: number; pointIndex: number }[] = [];
    
    // Check points from all groups
    pointGroups.forEach((group, groupIndex) => {
      const pointIndices = findPointsInSelectionRect(group.points, selectionRect);
      
      // If any point in the group is selected, add all points in the group
      if (pointIndices.length > 0) {
        // For better UX, select the entire object (group) when any point is in selection
        const groupIndices = group.points.map((_, pointIndex) => ({
          groupIndex,
          pointIndex
        }));
        selectedIndices.push(...groupIndices);
      }
    });
    
    // Update selection with unique indices
    const uniqueIndices = selectedIndices.filter((item, index, self) =>
      index === self.findIndex((t) => (
        t.groupIndex === item.groupIndex && t.pointIndex === item.pointIndex
      ))
    );
    
    setSelectedPointsIndices(uniqueIndices);
    
    if (uniqueIndices.length > 0) {
      // Count the number of selected objects (groups)
      const selectedGroups = new Set(uniqueIndices.map(idx => idx.groupIndex));
      
      toast({
        title: `${selectedGroups.size} object${selectedGroups.size > 1 ? 's' : ''} selected`,
        description: "Drag to move objects, or press Delete to remove them"
      });
    }
    
    setIsSelecting(false);
    setSelectionRect(null);
  }, [selectionRect]);

  return {
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
  };
}
