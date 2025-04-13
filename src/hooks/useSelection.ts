
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
  finalizeSelection: (points: ControlPoint[]) => void;
}

export function useSelection(): UseSelectionReturn {
  const [selectedPoint, setSelectedPoint] = useState<{ groupIndex: number; pointIndex: number; type: ControlPointType } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isMultiDragging, setIsMultiDragging] = useState<boolean>(false);
  const [lastDragPosition, setLastDragPosition] = useState<Point | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [selectedPointsIndices, setSelectedPointsIndices] = useState<{ groupIndex: number; pointIndex: number }[]>([]);

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
  // Note: This is a compatibility layer to work with old code
  // It assumes all points are in one group (index 0)
  const finalizeSelection = useCallback((points: ControlPoint[]) => {
    if (!selectionRect) return;
    
    const selectedIndices = findPointsInSelectionRect(points, selectionRect);
    
    // Convert to grouped indices format
    setSelectedPointsIndices(selectedIndices.map(index => ({ 
      groupIndex: 0, 
      pointIndex: index 
    })));
    
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
