
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
  
  // Add current state to history - define this function earlier in the file
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
    
    // Don't add to history yet since this is just starting a drawing
    // We'll add to history when the object is completed
    
    return newObject.id;
  }, [objects]);
  
  // Update all objects at once
  const setAllObjects = useCallback((newObjects: BezierObject[]) => {
    setObjects(newObjects);
    
    // Update selected object IDs based on object.isSelected property
    setSelectedObjectIds(
      newObjects
        .filter(obj => obj.isSelected)
        .map(obj => obj.id)
    );
  }, []);
  
  // Select a specific object
  const selectObject = useCallback((objectId: string, multiSelect: boolean = false) => {
    if (objectId === '') {
      // Deselect all
      setObjects(prevObjects => 
        prevObjects.map(obj => ({
          ...obj,
          isSelected: false
        }))
      );
      setSelectedObjectIds([]);
      return;
    }
    
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
  
  // Update objects with new data (primarily for point movement)
  const updateObjects = useCallback((updatedObjects: BezierObject[]) => {
    setObjects(updatedObjects);
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
  }, [objects, addToHistory]);
  
  // Update transform settings with proper point transformation
  const updateObjectTransform = useCallback((objectId: string, transform: TransformSettings) => {
    setObjects(prevObjects => 
      prevObjects.map(obj => {
        if (obj.id !== objectId) return obj;
        
        // Get the center of the object for rotation
        const points = obj.points;
        let centerX = 0;
        let centerY = 0;
        points.forEach(p => {
          centerX += p.x;
          centerY += p.y;
        });
        centerX /= points.length;
        centerY /= points.length;

        // Transform all points and handles
        const transformedPoints = points.map(point => {
          // Scale relative to center
          const scaledX = centerX + (point.x - centerX) * transform.scaleX;
          const scaledY = centerY + (point.y - centerY) * transform.scaleY;
          
          // Rotate around center
          const angle = (transform.rotation * Math.PI) / 180;
          const rotatedX = centerX + (scaledX - centerX) * Math.cos(angle) - (scaledY - centerY) * Math.sin(angle);
          const rotatedY = centerY + (scaledX - centerX) * Math.sin(angle) + (scaledY - centerY) * Math.cos(angle);

          // Apply same transformation to handles
          const handleIn = transformPoint(point.handleIn, centerX, centerY, transform);
          const handleOut = transformPoint(point.handleOut, centerX, centerY, transform);

          return {
            ...point,
            x: rotatedX,
            y: rotatedY,
            handleIn,
            handleOut,
          };
        });

        return {
          ...obj,
          points: transformedPoints,
          transform
        };
      })
    );
    
    // Add to history after transform change
    const updatedObjects = objects.map(obj => 
      obj.id === objectId ? {
        ...obj,
        transform
      } : obj
    );
    addToHistory(updatedObjects);
  }, [objects, addToHistory]);

  // Helper function to transform a single point
  const transformPoint = (point: {x: number, y: number}, centerX: number, centerY: number, transform: TransformSettings) => {
    // Scale
    const scaledX = centerX + (point.x - centerX) * transform.scaleX;
    const scaledY = centerY + (point.y - centerY) * transform.scaleY;
    
    // Rotate
    const angle = (transform.rotation * Math.PI) / 180;
    const rotatedX = centerX + (scaledX - centerX) * Math.cos(angle) - (scaledY - centerY) * Math.sin(angle);
    const rotatedY = centerY + (scaledX - centerX) * Math.sin(angle) + (scaledY - centerY) * Math.cos(angle);
    
    return { x: rotatedX, y: rotatedY };
  };
  
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
    
    toast({
      title: "Object Deleted",
      description: "The selected object has been removed"
    });
  }, [objects, addToHistory]);
  
  // Delete all selected objects
  const deleteSelectedObjects = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    
    setObjects(prevObjects => 
      prevObjects.filter(obj => !selectedObjectIds.includes(obj.id))
    );
    
    // Add to history after deletion
    const updatedObjects = objects.filter(obj => !selectedObjectIds.includes(obj.id));
    addToHistory(updatedObjects);
    
    toast({
      title: `${selectedObjectIds.length} Objects Deleted`,
      description: "Selected objects have been removed"
    });
    
    setSelectedObjectIds([]);
  }, [selectedObjectIds, objects, addToHistory]);
  
  // Rename an object
  const renameObject = useCallback((objectId: string, name: string) => {
    setObjects(prevObjects => 
      prevObjects.map(obj => 
        obj.id === objectId 
          ? { ...obj, name }
          : obj
      )
    );
    
    // Add to history after renaming
    const updatedObjects = objects.map(obj => 
      obj.id === objectId ? { ...obj, name } : obj
    );
    addToHistory(updatedObjects);
  }, [objects, addToHistory]);
  
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
    setAllObjects,
    selectObject,
    deselectAllObjects,
    updateObjects,
    updateObjectCurveConfig,
    updateObjectTransform,
    deleteObject,
    deleteSelectedObjects,
    renameObject,
    undo,
    redo,
    saveCurrentState
  };
}
