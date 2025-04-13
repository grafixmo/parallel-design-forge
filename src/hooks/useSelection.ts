
import { useState, useCallback } from 'react';
import { ControlPoint, ControlPointType, Point, SelectionRect, SelectedPoint } from '@/types/bezier';
import { toast } from '@/components/ui/use-toast';
import { findPointsInSelectionRect } from '@/utils/canvas/interactionHelpers';

interface UseSelectionReturn {
  selectedPoint: SelectedPoint | null;
  setSelectedPoint: (point: SelectedPoint | null) => void;
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
  selectedPointsIndices: number[];
  setSelectedPointsIndices: (indices: number[]) => void;
  clearSelections: () => void;
  finalizeSelection: (points: ControlPoint[]) => void;
}

export function useSelection(): UseSelectionReturn {
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isMultiDragging, setIsMultiDragging] = useState<boolean>(false);
  const [lastDragPosition, setLastDragPosition] = useState<Point | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [selectedPointsIndices, setSelectedPointsIndices] = useState<number[]>([]);

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
  const finalizeSelection = useCallback((points: ControlPoint[]) => {
    if (!selectionRect) return;
    
    const selectedIndices = findPointsInSelectionRect(points, selectionRect);
    setSelectedPointsIndices(selectedIndices);
    
    if (selectedIndices.length > 0) {
      toast({
        title: `${selectedIndices.length} points selected`,
        description: "Drag to move points as a group, or press Delete to remove them"
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
    finalizeSelection
  };
}
