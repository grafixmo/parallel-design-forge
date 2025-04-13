
import { useState, useCallback } from 'react';
import { ControlPoint, Point } from '@/types/bezier';
import { toast } from '@/components/ui/use-toast';
import { generateId } from '@/utils/bezierUtils';

interface HistoryState {
  points: ControlPoint[];
  timestamp: number;
}

interface UseDrawingReturn {
  history: HistoryState[];
  setHistory: (history: HistoryState[]) => void;
  currentHistoryIndex: number;
  setCurrentHistoryIndex: (index: number) => void;
  clipboard: ControlPoint[];
  setClipboard: (points: ControlPoint[]) => void;
  addPointToCanvas: (x: number, y: number, points: ControlPoint[]) => ControlPoint[];
  handleUndo: (points: ControlPoint[], onPointsChange: (points: ControlPoint[]) => void) => void;
  saveToHistory: (points: ControlPoint[]) => void;
  startNewObject: (onPointsChange: (points: ControlPoint[]) => void) => void;
  isNewObjectMode: boolean;
  setIsNewObjectMode: (isNewObjectMode: boolean) => void;
}

export function useDrawing(): UseDrawingReturn {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const [clipboard, setClipboard] = useState<ControlPoint[]>([]);
  const [isNewObjectMode, setIsNewObjectMode] = useState<boolean>(true);
  const MAX_HISTORY_SIZE = 50;

  // Add a new point to the canvas
  const addPointToCanvas = useCallback((x: number, y: number, points: ControlPoint[]): ControlPoint[] => {
    const newPoint: ControlPoint = {
      x,
      y,
      handleIn: { x: x - 50, y },
      handleOut: { x: x + 50, y },
      id: generateId()
    };
    
    return [...points, newPoint];
  }, []);

  // Undo function
  const handleUndo = useCallback((
    points: ControlPoint[], 
    onPointsChange: (points: ControlPoint[]) => void
  ) => {
    if (currentHistoryIndex > 0) {
      const prevState = history[currentHistoryIndex - 1];
      setCurrentHistoryIndex(currentHistoryIndex - 1);
      onPointsChange(prevState.points);
      
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
  const saveToHistory = useCallback((points: ControlPoint[]) => {
    if (points.length > 0) {
      // Only add to history if this is a new state (not an undo/redo)
      if (currentHistoryIndex === history.length - 1 || currentHistoryIndex === -1) {
        const newHistoryState: HistoryState = {
          points: JSON.parse(JSON.stringify(points)), // Deep clone to avoid reference issues
          timestamp: Date.now()
        };
        
        // Limit history size by removing oldest entries if needed
        const newHistory = [...history, newHistoryState].slice(-MAX_HISTORY_SIZE);
        setHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);
      }
    }
  }, [history, currentHistoryIndex]);

  // Start a new object - this function now explicitly sets new object mode
  const startNewObject = useCallback((onPointsChange: (points: ControlPoint[]) => void) => {
    // We don't actually clear points here, just set the mode to create a new object
    setIsNewObjectMode(true);
    
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
    setIsNewObjectMode
  };
}
