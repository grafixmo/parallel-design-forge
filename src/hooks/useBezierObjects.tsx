import { useState, useCallback, useRef } from 'react';
import { 
  BezierObject, 
  ControlPoint, 
  HistoryState,
  CurveConfig,
  TransformSettings
} from '@/types/bezier';
import { generateId } from '@/utils/bezierUtils';
import { toast } from '@/hooks/use-toast';
import { importSVG } from '@/utils/simpleSvgImporter';
import { createDesignSVG, downloadSVG } from '@/utils/svgExporter';
import { loadTemplateAsync } from '@/utils/optimizedTemplateLoader';

const DEFAULT_CURVE_CONFIG: CurveConfig = {
  styles: [
    { color: '#000000', width: 2 }
  ],
  parallelCount: 0,
  spacing: 0
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  
  // Use ref for tracking active loader cancellation
  const activeLoaderCancelRef = useRef<(() => void) | null>(null);
  
  // Define addToHistory function first so it can be used by other functions
  const addToHistory = useCallback((updatedObjects: BezierObject[]) => {
    try {
      const newHistoryState: HistoryState = {
        objects: JSON.parse(JSON.stringify(updatedObjects)),
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
    } catch (error) {
      console.error('Error adding to history:', error);
    }
  }, [history, currentHistoryIndex]);
  
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
    
    return newObject.id;
  }, []);
  
  // Update all objects at once
  const setAllObjects = useCallback((newObjects: BezierObject[]) => {
    console.log('Setting all objects:', newObjects.length);
    setObjects(newObjects);
    
    // Update selected object IDs based on object.isSelected property
    setSelectedObjectIds(
      newObjects
        .filter(obj => obj.isSelected)
        .map(obj => obj.id)
    );
  }, []);
  
  // Import SVG and convert to objects using our simplified approach
  const importSVGToObjects = useCallback((svgContent: string) => {
    try {
      setIsLoading(true);
      console.log('Importing SVG content using simplified approach');
      
      // Import SVG using our simplified importer
      const importedObjects = importSVG(svgContent);
      
      if (importedObjects.length === 0) {
        toast({
          title: "Import Notice",
          description: "No valid shapes could be extracted from the SVG.",
          variant: "destructive"
        });
        setIsLoading(false);
        return [];
      }
      
      // Add objects to canvas
      setObjects(prevObjects => [...prevObjects, ...importedObjects]);
      
      // Add to history
      const updatedObjects = [...objects, ...importedObjects];
      addToHistory(updatedObjects);
      
      toast({
        title: "SVG Imported",
        description: `Successfully imported ${importedObjects.length} shapes.`,
        variant: "default"
      });
      
      setIsLoading(false);
      return importedObjects;
    } catch (error) {
      console.error('Error importing SVG:', error);
      toast({
        title: "Import Failed",
        description: "The SVG file couldn't be imported. Try a simpler file.",
        variant: "destructive"
      });
      setIsLoading(false);
      return [];
    }
  }, [objects, addToHistory]);
  
  // Export objects to SVG
  const exportObjectsToSVG = useCallback((fileName: string = "bezier-design.svg") => {
    try {
      if (objects.length === 0) {
        toast({
          title: "Export Warning",
          description: "No objects to export. Create some shapes first.",
          variant: "destructive"
        });
        return;
      }
      
      // Create SVG content using our consolidated function
      const svgContent = createDesignSVG(objects);
      
      // Download SVG file
      downloadSVG(svgContent, fileName);
      
      toast({
        title: "SVG Exported",
        description: `Successfully exported ${objects.length} shapes.`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error exporting SVG:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export SVG.",
        variant: "destructive"
      });
    }
  }, [objects]);
  
  // Improved template loading with proper cancellation and memory management
  const loadObjectsFromTemplate = useCallback((templateData: BezierObject[] | string, clearExisting: boolean = false) => {
    // Cancel any active loader first to prevent competing operations
    if (activeLoaderCancelRef.current) {
      activeLoaderCancelRef.current();
      activeLoaderCancelRef.current = null;
    }
    
    setIsLoading(true);
    setImportProgress(0);
    
    try {
      console.log('Loading template with improved memory management, clearExisting:', clearExisting);
      
      // Use our optimized template loader with proper cancellation
      const cancelLoader = loadTemplateAsync(templateData, {
        onProgress: (progress) => {
          setImportProgress(progress);
        },
        onComplete: (processedObjects) => {
          // Update state based on clearExisting flag
          if (clearExisting) {
            setObjects(processedObjects);
            setSelectedObjectIds([]);
          } else {
            // Reasonable object limit
            const maxObjectsToAdd = 10;
            const limitedObjects = processedObjects.slice(0, maxObjectsToAdd);
            
            if (processedObjects.length > maxObjectsToAdd) {
              console.warn(`Limiting imported objects from ${processedObjects.length} to ${maxObjectsToAdd}`);
              toast({
                title: 'Import Notice',
                description: `Limited to ${maxObjectsToAdd} objects to prevent performance issues`,
                variant: 'default'
              });
            }
            
            setObjects(prevObjects => [...prevObjects, ...limitedObjects]);
          }
          
          // Add to history
          const updatedObjects = clearExisting 
            ? processedObjects 
            : [...objects, ...processedObjects.slice(0, 10)];
            
          addToHistory(updatedObjects);
          
          toast({
            title: 'Template Loaded',
            description: `Loaded ${processedObjects.length} objects successfully`,
            variant: 'default'
          });
          
          activeLoaderCancelRef.current = null;
          setIsLoading(false);
          setImportProgress(0);
        },
        onError: (error) => {
          console.error('Error loading template:', error);
          toast({
            title: 'Error Loading Template',
            description: error.message || 'Failed to load template',
            variant: 'destructive'
          });
          activeLoaderCancelRef.current = null;
          setIsLoading(false);
          setImportProgress(0);
        },
        batchSize: 3,  // Process 3 objects at a time for smoother UI
        maxObjects: 20 // Reasonable limit that won't freeze UI
      });
      
      // Store the cancellation function
      activeLoaderCancelRef.current = cancelLoader;
      
      // Set a safety timeout to cancel if it takes too long
      setTimeout(() => {
        if (activeLoaderCancelRef.current === cancelLoader) {
          console.warn('Template loading timeout - cancelling operation');
          cancelLoader();
          activeLoaderCancelRef.current = null;
          setIsLoading(false);
          setImportProgress(0);
          toast({
            title: 'Loading Timeout',
            description: 'Template loading took too long and was cancelled',
            variant: 'destructive'
          });
        }
      }, 15000); // 15-second safety timeout
      
    } catch (error) {
      console.error('Error in loadObjectsFromTemplate:', error);
      toast({
        title: 'Error Loading Template',
        description: 'There was a problem loading the template',
        variant: 'destructive'
      });
      setIsLoading(false);
      setImportProgress(0);
    }
  }, [objects, addToHistory]);

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
  
  const deselectAllObjects = useCallback(() => {
    setObjects(prevObjects => prevObjects.map(obj => ({ ...obj, isSelected: false })));
    setSelectedObjectIds([]);
  }, []);
  
  const updateObjects = useCallback((updatedObjects: BezierObject[]) => {
    setObjects(updatedObjects);
  }, []);
  
  const updateObjectCurveConfig = useCallback((objectId: string, curveConfig: CurveConfig) => {
    setObjects(prevObjects => 
      prevObjects.map(obj => obj.id === objectId ? { ...obj, curveConfig } : obj)
    );
    
    // Add to history
    const updatedObjects = objects.map(obj => 
      obj.id === objectId ? { ...obj, curveConfig } : obj
    );
    addToHistory(updatedObjects);
  }, [objects, addToHistory]);
  
  const updateObjectTransform = useCallback((objectId: string, transform: TransformSettings) => {
    setObjects(prevObjects => 
      prevObjects.map(obj => obj.id === objectId ? { ...obj, transform } : obj)
    );
    
    // Add to history
    const updatedObjects = objects.map(obj => 
      obj.id === objectId ? { ...obj, transform } : obj
    );
    addToHistory(updatedObjects);
  }, [objects, addToHistory]);
  
  const deleteObject = useCallback((objectId: string) => {
    setObjects(prevObjects => prevObjects.filter(obj => obj.id !== objectId));
    setSelectedObjectIds(prevIds => prevIds.filter(id => id !== objectId));
    
    // Add to history
    const updatedObjects = objects.filter(obj => obj.id !== objectId);
    addToHistory(updatedObjects);
    
    toast({
      title: "Object Deleted",
      description: "The selected object has been removed"
    });
  }, [objects, addToHistory]);
  
  const deleteSelectedObjects = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    
    setObjects(prevObjects => prevObjects.filter(obj => !selectedObjectIds.includes(obj.id)));
    
    // Add to history
    const updatedObjects = objects.filter(obj => !selectedObjectIds.includes(obj.id));
    addToHistory(updatedObjects);
    
    toast({
      title: `${selectedObjectIds.length} Objects Deleted`,
      description: "Selected objects have been removed"
    });
    
    setSelectedObjectIds([]);
  }, [selectedObjectIds, objects, addToHistory]);
  
  const renameObject = useCallback((objectId: string, name: string) => {
    setObjects(prevObjects => 
      prevObjects.map(obj => obj.id === objectId ? { ...obj, name } : obj)
    );
    
    // Add to history
    const updatedObjects = objects.map(obj => 
      obj.id === objectId ? { ...obj, name } : obj
    );
    addToHistory(updatedObjects);
  }, [objects, addToHistory]);
  
  const undo = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const prevState = history[currentHistoryIndex - 1];
      setCurrentHistoryIndex(currentHistoryIndex - 1);
        
      if (prevState && prevState.objects) {
        setObjects(prevState.objects);
        setSelectedObjectIds(
          prevState.objects.filter(obj => obj.isSelected).map(obj => obj.id)
        );
          
        toast({
          title: 'Undo',
          description: 'Previous action undone'
        });
      }
    } else {
      toast({
        title: 'Cannot Undo',
        description: 'No more actions to undo',
        variant: 'destructive'
      });
    }
  }, [currentHistoryIndex, history]);
  
  const redo = useCallback(() => {
    if (currentHistoryIndex < history.length - 1) {
      const nextState = history[currentHistoryIndex + 1];
      setCurrentHistoryIndex(currentHistoryIndex + 1);
        
      if (nextState && nextState.objects) {
        setObjects(nextState.objects);
        setSelectedObjectIds(
          nextState.objects.filter(obj => obj.isSelected).map(obj => obj.id)
        );
          
        toast({
          title: 'Redo',
          description: 'Action redone'
        });
      }
    } else {
      toast({
        title: 'Cannot Redo',
        description: 'No more actions to redo',
        variant: 'destructive'
      });
    }
  }, [currentHistoryIndex, history]);
  
  const saveCurrentState = useCallback(() => {
    if (objects.length > 0) {
      addToHistory(objects);
    }
  }, [objects, addToHistory]);
  
  return {
    objects,
    selectedObjectIds,
    isLoading,
    importProgress,
    createObject,
    setAllObjects,
    loadObjectsFromTemplate,
    importSVGToObjects,
    exportObjectsToSVG,
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
