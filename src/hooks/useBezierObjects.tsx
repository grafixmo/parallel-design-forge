
import { useState, useCallback } from 'react';
import { 
  BezierObject, 
  ControlPoint, 
  HistoryState,
  CurveStyle,
  CurveConfig,
  TransformSettings
} from '@/types/bezier';
import { generateId } from '@/utils/bezierUtils';
import { toast } from '@/hooks/use-toast';

const DEFAULT_CURVE_CONFIG: CurveConfig = {
  styles: [
    { color: '#000000', width: 5 },
    { color: '#ff0000', width: 5 },
    { color: '#0000ff', width: 5 },
    { color: '#00ff00', width: 5 }
  ],
  parallelCount: 2,
  spacing: 8
};

const DEFAULT_TRANSFORM: TransformSettings = {
  rotation: 0,
  scaleX: 1.0,
  scaleY: 1.0
};

export function useBezierObjects() {
  const [objects, setObjects] = useState<BezierObject[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  
  // Create a new bezier object
  const createObject = useCallback((points: ControlPoint[] = [], name: string = 'Untitled Object') => {
    const newObject: BezierObject = {
      id: generateId(),
      points,
      curveConfig: { ...DEFAULT_CURVE_CONFIG },
      transform: { ...DEFAULT_TRANSFORM },
      name,
      isSelected: true
    };
    
    // Deselect all other objects
    setObjects(prevObjects => 
      prevObjects.map(obj => ({ ...obj, isSelected: false })).concat(newObject)
    );
    
    setSelectedObjectIds([newObject.id]);
    
    // Add to history
    addToHistory([...objects, newObject]);
    
    return newObject.id;
  }, [objects]);
  
  // Select a specific object
  const selectObject = useCallback((objectId: string, multiSelect: boolean = false) => {
    setObjects(prevObjects => 
      prevObjects.map(obj => ({
        ...obj,
        isSelected: multiSelect 
          ? (obj.id === objectId ? !obj.isSelected : obj.isSelected)
          : obj.id === objectId
      }))
    );
    
    setSelectedObjectIds(prevIds => {
      if (multiSelect) {
        return prevIds.includes(objectId)
          ? prevIds.filter(id => id !== objectId)
          : [...prevIds, objectId];
      } else {
        return [objectId];
      }
    });
  }, []);
  
  // Deselect all objects
  const deselectAllObjects = useCallback(() => {
    setObjects(prevObjects => 
      prevObjects.map(obj => ({
        ...obj,
        isSelected: false
      }))
    );
    setSelectedObjectIds([]);
  }, []);
  
  // Update points for a specific object
  const updateObjectPoints = useCallback((objectId: string, points: ControlPoint[]) => {
    setObjects(prevObjects => 
      prevObjects.map(obj => 
        obj.id === objectId 
          ? { ...obj, points }
          : obj
      )
    );
    
    // Don't add to history on every point movement, that would be too many entries
  }, []);
  
  // Update curve config for a specific object
  const updateObjectCurveConfig = useCallback((objectId: string, curveConfig: CurveConfig) => {
    setObjects(prevObjects => 
      prevObjects.map(obj => 
        obj.id === objectId 
          ? { ...obj, curveConfig }
          : obj
      )
    );
    
    // Add to history after curve config change
    const updatedObjects = objects.map(obj => 
      obj.id === objectId ? { ...obj, curveConfig } : obj
    );
    addToHistory(updatedObjects);
  }, [objects]);
  
  // Update transform settings for a specific object
  const updateObjectTransform = useCallback((objectId: string, transform: TransformSettings) => {
    setObjects(prevObjects => 
      prevObjects.map(obj => 
        obj.id === objectId 
          ? { ...obj, transform }
          : obj
      )
    );
    
    // Add to history after transform change
    const updatedObjects = objects.map(obj => 
      obj.id === objectId ? { ...obj, transform } : obj
    );
    addToHistory(updatedObjects);
  }, [objects]);
  
  // Delete an object
  const deleteObject = useCallback((objectId: string) => {
    setObjects(prevObjects => 
      prevObjects.filter(obj => obj.id !== objectId)
    );
    
    setSelectedObjectIds(prevIds => 
      prevIds.filter(id => id !== objectId)
    );
    
    // Add to history after deletion
    const updatedObjects = objects.filter(obj => obj.id !== objectId);
    addToHistory(updatedObjects);
  }, [objects]);
  
  // Rename an object
  const renameObject = useCallback((objectId: string, name: string) => {
    setObjects(prevObjects => 
      prevObjects.map(obj => 
        obj.id === objectId 
          ? { ...obj, name }
          : obj
      )
    );
  }, []);
  
  // Add current state to history
  const addToHistory = useCallback((updatedObjects: BezierObject[]) => {
    const newHistoryState: HistoryState = {
      objects: JSON.parse(JSON.stringify(updatedObjects)), // Deep clone
      timestamp: Date.now()
    };
    
    // If we're not at the end of history, truncate it
    const newHistory = currentHistoryIndex === history.length - 1 || currentHistoryIndex === -1
      ? [...history, newHistoryState]
      : [...history.slice(0, currentHistoryIndex + 1), newHistoryState];
    
    // Limit history size to 50 entries
    const limitedHistory = newHistory.slice(-50);
    
    setHistory(limitedHistory);
    setCurrentHistoryIndex(limitedHistory.length - 1);
  }, [history, currentHistoryIndex]);
  
  // Undo the last action
  const undo = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const prevState = history[currentHistoryIndex - 1];
      setCurrentHistoryIndex(currentHistoryIndex - 1);
      setObjects(prevState.objects);
      
      // Update selected object IDs based on object.isSelected property
      setSelectedObjectIds(
        prevState.objects
          .filter(obj => obj.isSelected)
          .map(obj => obj.id)
      );
      
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
  }, [currentHistoryIndex, history]);
  
  // Redo the last undone action
  const redo = useCallback(() => {
    if (currentHistoryIndex < history.length - 1) {
      const nextState = history[currentHistoryIndex + 1];
      setCurrentHistoryIndex(currentHistoryIndex + 1);
      setObjects(nextState.objects);
      
      // Update selected object IDs based on object.isSelected property
      setSelectedObjectIds(
        nextState.objects
          .filter(obj => obj.isSelected)
          .map(obj => obj.id)
      );
      
      toast({
        title: 'Redo',
        description: 'Action redone'
      });
    } else {
      toast({
        title: 'Cannot Redo',
        description: 'No more actions to redo',
        variant: 'destructive'
      });
    }
  }, [currentHistoryIndex, history]);
  
  // Save the current state after actions like dragging points
  const saveCurrentState = useCallback(() => {
    if (objects.length > 0) {
      addToHistory(objects);
    }
  }, [objects, addToHistory]);
  
  return {
    objects,
    selectedObjectIds,
    createObject,
    selectObject,
    deselectAllObjects,
    updateObjectPoints,
    updateObjectCurveConfig,
    updateObjectTransform,
    deleteObject,
    renameObject,
    undo,
    redo,
    saveCurrentState
  };
}
