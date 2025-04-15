import { useState, useCallback, useRef } from 'react';
import { 
  BezierObject, 
  ControlPoint, 
  CurveConfig, 
  TransformSettings 
} from '@/types/bezier';
import { generateId } from '@/utils/bezierUtils';
import { importSVG } from '@/utils/simpleSvgImporter';
import { loadTemplateAsync } from '@/utils/asyncTemplateLoader';
import { toast } from '@/hooks/use-toast';

// Maximum number of undos
const MAX_HISTORY = 30;

interface UseBezierObjectsResult {
  objects: BezierObject[];
  selectedObjectIds: string[];
  isLoading: boolean;
  importProgress: number;
  createObject: (points: ControlPoint[]) => string;
  setAllObjects: (objects: BezierObject[]) => void;
  loadObjectsFromTemplate: (templateData: string | BezierObject[], shouldClearCanvas?: boolean) => void;
  updateObjects: (updatedObjects: BezierObject[]) => void;
  updateObjectCurveConfig: (objectId: string, curveConfig: CurveConfig) => void;
  updateObjectTransform: (objectId: string, transform: TransformSettings) => void;
  deleteObject: (objectId: string) => void;
  deleteSelectedObjects: () => void;
  renameObject: (objectId: string, name: string) => void;
  undo: () => void;
  redo: () => void;
  saveCurrentState: () => void;
  selectObject: (objectId: string, multiSelect?: boolean) => void;
  importSVGToObjects: (svgContent: string) => void;
}

export const useBezierObjects = (): UseBezierObjectsResult => {
  // State for bezier objects
  const [objects, setObjects] = useState<BezierObject[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  
  // History for undo/redo
  const historyRef = useRef<BezierObject[][]>([]);
  const currentIndexRef = useRef<number>(-1);
  
  // Create a new object and return its ID
  const createObject = useCallback((points: ControlPoint[]): string => {
    const id = generateId();
    
    // Create default curve config
    const curveConfig: CurveConfig = {
      styles: [{ color: '#000000', width: 2 }],
      parallelCount: 0,
      spacing: 0
    };
    
    // Create default transform
    const transform: TransformSettings = {
      rotation: 0,
      scaleX: 1.0,
      scaleY: 1.0
    };
    
    // Create the new object
    const newObject: BezierObject = {
      id,
      points,
      curveConfig,
      transform,
      name: `Curve ${objects.length + 1}`,
      isSelected: false
    };
    
    // Add to objects
    setObjects(prevObjects => [...prevObjects, newObject]);
    saveCurrentState([...objects, newObject]);
    
    return id;
  }, [objects]);
  
  // Set all objects at once
  const setAllObjects = useCallback((newObjects: BezierObject[]): void => {
    setObjects(newObjects);
    // Reset selection
    setSelectedObjectIds([]);
    // Save as a new history state
    saveCurrentState(newObjects);
  }, []);
  
  // Load objects from template with async chunking to prevent freezing
  const loadObjectsFromTemplate = useCallback((
    templateData: string | BezierObject[],
    shouldClearCanvas: boolean = true
  ): void => {
    setIsLoading(true);
    setImportProgress(0);
    
    loadTemplateAsync(
      templateData,
      // Progress callback
      (progress) => {
        setImportProgress(progress);
      },
      // Success callback
      (loadedObjects) => {
        if (loadedObjects.length === 0) {
          toast({
            title: "Import Warning",
            description: "No valid objects found in the template.",
            variant: "destructive"
          });
          setIsLoading(false);
          setImportProgress(0);
          return;
        }
        
        setObjects(prevObjects => {
          // Either replace all objects or add to existing
          const newObjects = shouldClearCanvas ? loadedObjects : [...prevObjects, ...loadedObjects];
          // Save to history
          saveCurrentState(newObjects);
          return newObjects;
        });
        
        toast({
          title: "Template Loaded",
          description: `Successfully loaded ${loadedObjects.length} objects.`,
          variant: "default"
        });
        
        // Reset selection
        setSelectedObjectIds([]);
        setIsLoading(false);
        setImportProgress(0);
      },
      // Error callback
      (error) => {
        console.error("Error loading template:", error);
        toast({
          title: "Import Error",
          description: error.message || "Failed to load template data.",
          variant: "destructive"
        });
        setIsLoading(false);
        setImportProgress(0);
      }
    );
  }, []);
  
  // Update multiple objects at once
  const updateObjects = useCallback((updatedObjects: BezierObject[]): void => {
    setObjects(prevObjects => {
      const objectMap = new Map(prevObjects.map(obj => [obj.id, obj]));
      
      // Update each object in the map
      updatedObjects.forEach(updatedObj => {
        objectMap.set(updatedObj.id, updatedObj);
      });
      
      // Convert map back to array
      return Array.from(objectMap.values());
    });
  }, []);
  
  // Update an object's curve config
  const updateObjectCurveConfig = useCallback((objectId: string, curveConfig: CurveConfig): void => {
    setObjects(prevObjects => {
      const updatedObjects = prevObjects.map(obj => 
        obj.id === objectId ? { ...obj, curveConfig } : obj
      );
      
      return updatedObjects;
    });
  }, []);
  
  // Update an object's transform
  const updateObjectTransform = useCallback((objectId: string, transform: TransformSettings): void => {
    setObjects(prevObjects => {
      const updatedObjects = prevObjects.map(obj => 
        obj.id === objectId ? { ...obj, transform } : obj
      );
      
      return updatedObjects;
    });
  }, []);
  
  // Delete an object
  const deleteObject = useCallback((objectId: string): void => {
    setObjects(prevObjects => {
      const updatedObjects = prevObjects.filter(obj => obj.id !== objectId);
      saveCurrentState(updatedObjects);
      return updatedObjects;
    });
    
    // Also remove from selection
    setSelectedObjectIds(prevIds => prevIds.filter(id => id !== objectId));
  }, []);
  
  // Delete all selected objects
  const deleteSelectedObjects = useCallback((): void => {
    if (selectedObjectIds.length === 0) return;
    
    setObjects(prevObjects => {
      const updatedObjects = prevObjects.filter(obj => !selectedObjectIds.includes(obj.id));
      saveCurrentState(updatedObjects);
      return updatedObjects;
    });
    
    // Clear selection
    setSelectedObjectIds([]);
    
    toast({
      title: "Objects Deleted",
      description: `Deleted ${selectedObjectIds.length} object(s).`,
    });
  }, [selectedObjectIds]);
  
  // Rename an object
  const renameObject = useCallback((objectId: string, name: string): void => {
    setObjects(prevObjects => {
      const updatedObjects = prevObjects.map(obj => 
        obj.id === objectId ? { ...obj, name } : obj
      );
      
      return updatedObjects;
    });
  }, []);
  
  // Save current state to history
  const saveCurrentState = useCallback((state: BezierObject[] = objects): void => {
    // Truncate forward history if we're not at the latest state
    if (currentIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, currentIndexRef.current + 1);
    }
    
    // Add the new state
    historyRef.current.push(JSON.parse(JSON.stringify(state)));
    
    // Limit history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current = historyRef.current.slice(historyRef.current.length - MAX_HISTORY);
    }
    
    // Update current index
    currentIndexRef.current = historyRef.current.length - 1;
  }, [objects]);
  
  // Undo
  const undo = useCallback((): void => {
    if (currentIndexRef.current > 0) {
      currentIndexRef.current--;
      const previousState = historyRef.current[currentIndexRef.current];
      setObjects(previousState);
      
      // Clear selection on undo
      setSelectedObjectIds([]);
    }
  }, []);
  
  // Redo
  const redo = useCallback((): void => {
    if (currentIndexRef.current < historyRef.current.length - 1) {
      currentIndexRef.current++;
      const nextState = historyRef.current[currentIndexRef.current];
      setObjects(nextState);
      
      // Clear selection on redo
      setSelectedObjectIds([]);
    }
  }, []);
  
  // Select an object
  const selectObject = useCallback((objectId: string, multiSelect: boolean = false): void => {
    setSelectedObjectIds(prevIds => {
      // If multiSelect is true, add to selection if not already selected, or remove if already selected
      if (multiSelect) {
        return prevIds.includes(objectId)
          ? prevIds.filter(id => id !== objectId)
          : [...prevIds, objectId];
      }
      
      // Otherwise, just select this object
      return [objectId];
    });
    
    // Mark the object as selected
    setObjects(prevObjects => 
      prevObjects.map(obj => ({
        ...obj,
        isSelected: multiSelect 
          ? obj.isSelected || obj.id === objectId
          : obj.id === objectId
      }))
    );
  }, []);
  
  // Import SVG to objects
  const importSVGToObjects = useCallback((svgContent: string): void => {
    try {
      setIsLoading(true);
      setImportProgress(10);
      
      // Use our simplified SVG importer with better error handling
      setTimeout(() => {
        try {
          setImportProgress(50);
          const importedObjects = importSVG(svgContent);
          setImportProgress(90);
          
          if (importedObjects.length === 0) {
            toast({
              title: "Import Warning",
              description: "No valid shapes found in the SVG file.",
              variant: "destructive"
            });
            setIsLoading(false);
            setImportProgress(0);
            return;
          }
          
          setObjects(prevObjects => {
            const newObjects = [...prevObjects, ...importedObjects];
            saveCurrentState(newObjects);
            return newObjects;
          });
          
          toast({
            title: "SVG Imported",
            description: `Successfully imported ${importedObjects.length} shapes.`,
            variant: "default"
          });
          
          setImportProgress(100);
          setTimeout(() => {
            setIsLoading(false);
            setImportProgress(0);
          }, 500);
        } catch (error) {
          console.error("Error in importSVGToObjects:", error);
          toast({
            title: "Import Error",
            description: "Failed to import SVG. The file may be too complex.",
            variant: "destructive"
          });
          setIsLoading(false);
          setImportProgress(0);
        }
      }, 50);
    } catch (error) {
      console.error("Error starting SVG import:", error);
      setIsLoading(false);
      setImportProgress(0);
      toast({
        title: "Import Error",
        description: "Failed to start SVG import process.",
        variant: "destructive"
      });
    }
  }, []);
  
  return {
    objects,
    selectedObjectIds,
    isLoading,
    importProgress,
    createObject,
    setAllObjects,
    loadObjectsFromTemplate,
    updateObjects,
    updateObjectCurveConfig,
    updateObjectTransform,
    deleteObject,
    deleteSelectedObjects,
    renameObject,
    undo,
    redo,
    saveCurrentState,
    selectObject,
    importSVGToObjects
  };
};
