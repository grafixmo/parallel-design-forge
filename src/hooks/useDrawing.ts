
import { useState, useCallback } from 'react';
import { ControlPoint, Point, PointGroup, HistoryState } from '@/types/bezier';
import { toast } from '@/components/ui/use-toast';
import { generateId } from '@/utils/bezierUtils';

interface UseDrawingReturn {
  history: HistoryState[];
  setHistory: (history: HistoryState[]) => void;
  currentHistoryIndex: number;
  setCurrentHistoryIndex: (index: number) => void;
  clipboard: ControlPoint[];
  setClipboard: (points: ControlPoint[]) => void;
  addPointToCanvas: (x: number, y: number, pointGroups: PointGroup[], currentGroupIndex: number) => PointGroup[];
  handleUndo: (pointGroups: PointGroup[], onPointsChange: (pointGroups: PointGroup[]) => void) => void;
  saveToHistory: (pointGroups: PointGroup[]) => void;
  startNewObject: (pointGroups: PointGroup[], onPointsChange: (pointGroups: PointGroup[]) => void) => void;
  isNewObjectMode: boolean;
  setIsNewObjectMode: (isNewObjectMode: boolean) => void;
  currentGroupIndex: number;
  setCurrentGroupIndex: (index: number) => void;
}

export function useDrawing(): UseDrawingReturn {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const [clipboard, setClipboard] = useState<ControlPoint[]>([]);
  const [isNewObjectMode, setIsNewObjectMode] = useState<boolean>(true);
  const [currentGroupIndex, setCurrentGroupIndex] = useState<number>(-1);
  const MAX_HISTORY_SIZE = 50;

  // Add a new point to the canvas
  const addPointToCanvas = useCallback((
    x: number, 
    y: number, 
    pointGroups: PointGroup[], 
    currentGroupIndex: number
  ): PointGroup[] => {
    const newPoint: ControlPoint = {
      x,
      y,
      handleIn: { x: x - 50, y },
      handleOut: { x: x + 50, y },
      id: generateId()
    };
    
    // Create a copy of the pointGroups
    const updatedPointGroups = [...pointGroups];
    
    // If we have a valid group index, add to that group
    if (currentGroupIndex >= 0 && currentGroupIndex < updatedPointGroups.length) {
      const updatedGroup = { 
        ...updatedPointGroups[currentGroupIndex],
        points: [...updatedPointGroups[currentGroupIndex].points, newPoint]
      };
      updatedPointGroups[currentGroupIndex] = updatedGroup;
    } else {
      // If no valid group index, create a new group
      const newGroup: PointGroup = {
        id: generateId(),
        points: [newPoint]
      };
      updatedPointGroups.push(newGroup);
      // Update current group index to point to the new group
      setCurrentGroupIndex(updatedPointGroups.length - 1);
    }
    
    return updatedPointGroups;
  }, []);

  // Undo function
  const handleUndo = useCallback((
    pointGroups: PointGroup[], 
    onPointsChange: (pointGroups: PointGroup[]) => void
  ) => {
    if (currentHistoryIndex > 0) {
      const prevState = history[currentHistoryIndex - 1];
      setCurrentHistoryIndex(currentHistoryIndex - 1);
      onPointsChange(prevState.pointGroups);
      
      toast({
        title: 'Undo',
        description: 'Previous action undone'
      });
    } else {
      toast({
        title: 'Cannot Undo',
        description: 'No more actions to undo',
        variant: 'destructive'
      });
    }
  }, [history, currentHistoryIndex]);

  // Save points to history
  const saveToHistory = useCallback((pointGroups: PointGroup[]) => {
    if (pointGroups.length > 0) {
      // Only add to history if this is a new state (not an undo/redo)
      if (currentHistoryIndex === history.length - 1 || currentHistoryIndex === -1) {
        const newHistoryState: HistoryState = {
          pointGroups: JSON.parse(JSON.stringify(pointGroups)), // Deep clone to avoid reference issues
          timestamp: Date.now()
        };
        
        // Limit history size by removing oldest entries if needed
        const newHistory = [...history, newHistoryState].slice(-MAX_HISTORY_SIZE);
        setHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);
      }
    }
  }, [history, currentHistoryIndex]);

  // Start a new object - create a new group and set it as current
  const startNewObject = useCallback((
    pointGroups: PointGroup[],
    onPointsChange: (pointGroups: PointGroup[]) => void
  ) => {
    // Set new object mode
    setIsNewObjectMode(true);
    
    // When creating a new object, we'll actually add the new group when the first point is added
    // This ensures we don't create empty groups
    
    toast({
      title: 'New Object Mode',
      description: 'Click to start creating a new object'
    });
  }, []);

  return {
    history,
    setHistory,
    currentHistoryIndex,
    setCurrentHistoryIndex,
    clipboard,
    setClipboard,
    addPointToCanvas,
    handleUndo,
    saveToHistory,
    startNewObject,
    isNewObjectMode,
    setIsNewObjectMode,
    currentGroupIndex,
    setCurrentGroupIndex
  };
}
