import { useState, useEffect } from 'react';
import { 
  ControlPoint, 
  CurveStyle, 
  DesignData, 
  TransformSettings,
  SavedDesign,
  CurveConfig,
  BezierObject
} from '@/types/bezier';
import BezierCanvas from '@/components/BezierCanvas';
import Header from '@/components/Header';
import LibraryPanel from '@/components/LibraryPanel';
import { generateId } from '@/utils/bezierUtils';
import { exportAsSVG, downloadSVG, importSVGFromString, parseTemplateData } from '@/utils/svgExporter';
import { saveDesign, saveTemplate, Template } from '@/services/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useBezierObjects } from '@/hooks/useBezierObjects';
import ObjectControlsPanel from '@/components/ObjectControlsPanel';
import { convertToValidSVG } from '@/utils/svgConverter';

// Helper function to safely normalize design data
const normalizeDesignData = (data: any): string => {
  if (typeof data === 'string') {
    return data;
  } else if (typeof data === 'object' && data !== null) {
    try {
      return JSON.stringify(data);
    } catch (err) {
      console.error('Error stringifying object:', err);
      return '';
    }
  }
  return '';
};

const Index = () => {
  const { toast } = useToast();
  
  // Canvas state
  const [canvasWidth, setCanvasWidth] = useState<number>(800);
  const [canvasHeight, setCanvasHeight] = useState<number>(600);
  
  // Background image
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>(undefined);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(0.3);
  
  // UI state
  const [showLibrary, setShowLibrary] = useState<boolean>(false);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(true);
  
  // Use our custom hook for bezier objects
  const {
    objects,
    selectedObjectIds,
    createObject,
    selectObject,
    deselectAllObjects,
    updateObjects,
    setAllObjects,
    updateObjectCurveConfig,
    updateObjectTransform,
    deleteObject,
    renameObject,
    undo,
    redo,
    saveCurrentState
  } = useBezierObjects();
  
  // Get selected objects
  const selectedObjects = objects.filter(obj => selectedObjectIds.includes(obj.id));
  
  // Resize canvas based on window size
  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById('canvas-container');
      if (container) {
        const padding = 40; // account for container padding
        setCanvasWidth(container.clientWidth - padding);
        setCanvasHeight(container.clientHeight - padding);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    console.info(`Canvas dimensions set to ${canvasWidth}x${canvasHeight}`);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Reset everything to default
  const handleReset = () => {
    // Clear all objects
    objects.forEach(obj => deleteObject(obj.id));
    setBackgroundImage(undefined);
    setBackgroundOpacity(0.3);
    
    toast({
      title: 'Canvas Reset',
      description: 'All design elements have been reset to default.'
    });
  };
  
  // Handle background image upload
  const handleUploadImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBackgroundImage(e.target?.result as string);
        toast({
          title: 'Image Uploaded',
          description: 'Background reference image has been added.'
        });
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Remove background image
  const handleRemoveImage = () => {
    setBackgroundImage(undefined);
    toast({
      title: 'Image Removed',
      description: 'Background reference image has been removed.'
    });
  };
  
  // Toggle drawing mode
  const handleToggleDrawingMode = () => {
    setIsDrawingMode(!isDrawingMode);
    toast({
      title: `${!isDrawingMode ? 'Drawing' : 'Selection'} Mode Activated`,
      description: !isDrawingMode 
        ? 'You can now add and modify curve points.' 
        : 'You can now select and move existing points.'
    });
  };
  
  // Handler for creating new objects from the canvas
  const handleCreateObject = (points: ControlPoint[]) => {
    const objectName = `Object ${objects.length + 1}`;
    return createObject(points, objectName);
  };
  
  // Handler for object selection
  const handleSelectObject = (objectId: string, multiSelect: boolean = false) => {
    if (objectId === '') {
      deselectAllObjects();
    } else {
      selectObject(objectId, multiSelect);
    }
  };
  
  // Handler for updating all objects
  const handleObjectsChange = (updatedObjects: BezierObject[]) => {
    updateObjects(updatedObjects);
  };
  
  // Export design as SVG
  const handleExportSVG = () => {
    if (objects.length === 0) {
      toast({
        title: 'Cannot Export',
        description: 'Please create at least one object with points.',
        variant: 'destructive'
      });
      return;
    }
    
    // Generate SVG content
    const svgContent = exportAsSVG(
      objects,
      canvasWidth,
      canvasHeight
    );
    
    downloadSVG(svgContent, 'soutache-design.svg');
    
    toast({
      title: 'Design Exported',
      description: 'Your design has been exported as an SVG file.'
    });
  };

  // Updated handleSelectDesign function to support merging
  const handleSelectDesign = (design: SavedDesign, merge: boolean = false) => {
    try {
      if (!design.shapes_data) {
        throw new Error('Design data is empty');
      }
      
      // Log information about the data type and merge mode
      const dataType = typeof design.shapes_data;
      console.log(`Loading design: ${design.name}, data type: ${dataType}, merge: ${merge}`);
      
      // Normalize the data to ensure it's a string
      let shapesDataString = normalizeDesignData(design.shapes_data);
      
      // Check if it's an SVG file - SVG takes priority
      if (shapesDataString.trim().startsWith('<svg') || shapesDataString.includes('<svg ')) {
        console.log('Processing as SVG data');
        handleImportSVG(shapesDataString, merge);
        return;
      }
      
      // Try to convert to valid SVG
      const svgData = convertToValidSVG(shapesDataString);
      if (svgData) {
        console.log('Successfully converted data to SVG');
        handleImportSVG(svgData, merge);
        return;
      }
      
      // If not SVG or conversion failed, try to parse as JSON
      try {
        const parsedData = JSON.parse(shapesDataString);
        console.log('Successfully parsed JSON data');
        
        if (!merge) {
          // Clear current objects if not in merge mode
          objects.forEach(obj => deleteObject(obj.id));
        }
        
        // Add new objects
        if (parsedData.objects && Array.isArray(parsedData.objects)) {
          const newObjects = parsedData.objects.map((obj: BezierObject) => ({
            ...obj,
            id: generateId() // Generate new IDs to avoid conflicts
          }));
          setAllObjects(merge ? [...objects, ...newObjects] : newObjects);
        } else if (parsedData.points && Array.isArray(parsedData.points)) {
          createObject(parsedData.points, design.name || 'Imported Object');
        }
        
        saveCurrentState();
        
        toast({
          title: merge ? 'Design Merged' : 'Design Loaded',
          description: `Design "${design.name}" has been ${merge ? 'merged' : 'loaded'} successfully.`
        });
      } catch (parseError) {
        console.error('Error parsing design JSON:', parseError);
        throw new Error(`Failed to parse design data: ${parseError?.message || 'Unknown format'}`);
      }
    } catch (error: any) {
      console.error('Error loading design:', error);
      toast({
        title: 'Load Failed',
        description: error instanceof Error ? error.message : 'There was an error loading the design.',
        variant: 'destructive'
      });
    }
  };

  // Update handleImportSVG to support merging
  const handleImportSVG = (svgString: string, merge: boolean = false) => {
    try {
      if (!svgString || typeof svgString !== 'string') {
        throw new Error('Invalid SVG: Empty or not a string');
      }
      
      console.log('Importing SVG string (first 100 chars):', svgString.substring(0, 100) + '...');
      
      // Import SVG and convert to BezierObjects
      const importedObjects = importSVGFromString(svgString);
      
      if (!importedObjects || importedObjects.length === 0) {
        throw new Error('No valid objects found in the SVG file');
      }
      
      console.log(`Successfully imported ${importedObjects.length} objects with ${importedObjects.reduce((sum, obj) => sum + obj.points.length, 0)} points`);
      
      if (!merge) {
        // Clear existing objects if not in merge mode
        objects.forEach(obj => deleteObject(obj.id));
      }
      
      // Add imported objects with new IDs
      const newObjects = importedObjects.map(obj => ({
        ...obj,
        id: generateId() // Generate new IDs to avoid conflicts
      }));
      
      setAllObjects(merge ? [...objects, ...newObjects] : newObjects);
      
      // Save the new state
      saveCurrentState();
      
      toast({
        title: merge ? 'SVG Merged' : 'SVG Imported',
        description: `${merge ? 'Merged' : 'Imported'} ${importedObjects.length} object(s) from SVG file.`
      });
    } catch (error: any) {
      console.error('Error importing SVG:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import SVG file',
        variant: 'destructive'
      });
    }
  };
  
  // Save design to Supabase - ensure data is properly stringified
  const handleSaveDesign = async (name: string, category: string) => {
    if (objects.length === 0) {
      toast({
        title: 'Cannot Save',
        description: 'Please create at least one object with points.',
        variant: 'destructive'
      });
      return;
    }
    
    const designData: DesignData = {
      objects: objects,
      backgroundImage: backgroundImage ? {
        url: backgroundImage,
        opacity: backgroundOpacity
      } : undefined
    };
    
    // Ensure data is properly stringified
    const stringifiedData = JSON.stringify(designData);
    
    // Save design to the designs table (legacy)
    const svg_content = exportAsSVG(objects, canvasWidth, canvasHeight);

const design: SavedDesign = {
      name,
      category,
      shapes_data: stringifiedData,
      svg_content
    };
    
    try {
      console.log('🧩 Saving design with:', design);
      const { data, error } = await saveDesign(design);
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Also save as a template to the new templates table

      const template: Template = {
        name,
        category,
        design_data: stringifiedData,
        svg_content,
        likes: 0
      };
      
      await saveTemplate(template);
      
      toast({
        title: 'Design Saved',
        description: `Your design "${name}" has been saved to the database.`
      });
    } catch (err) {
      console.error('Error saving design:', err);
      toast({
        title: 'Save Failed',
        description: 'There was an error saving your design. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  // Load a template from the gallery
  const handleLoadTemplate = (templateData: string) => {
    try {
      console.log('Loading template data:', templateData);
      
      // Try to parse data, could be a stringified DesignData or DesignData.objects array
      let parsedData: DesignData | null = null;
      
      try {
        // Attempt to parse as regular JSON
        const parsed = JSON.parse(templateData);
        
        // Check what kind of data we got
        if (parsed.objects) {
          // It's a DesignData object with objects array
          parsedData = parsed as DesignData;
        } else if (Array.isArray(parsed)) {
          // It's just an array of objects
          parsedData = { objects: parsed };
        } else {
          // Unknown format
          throw new Error('Template data is in an unknown format');
        }
      } catch (parseError) {
        console.error('Error parsing template JSON:', parseError);
        
        // If it's not valid JSON, try using it as SVG
        const importedObjects = importSVGFromString(templateData);
        if (importedObjects && importedObjects.length > 0) {
          parsedData = { objects: importedObjects };
        } else {
          throw new Error('Template data is neither valid JSON nor SVG');
        }
      }
      
      if (!parsedData) {
        throw new Error('Failed to parse template data');
      }
      
      // Clear current objects
      objects.forEach(obj => deleteObject(obj.id));
      
      // Add objects from template
      if (parsedData.objects && parsedData.objects.length > 0) {
        // Format with objects array
        parsedData.objects.forEach(obj => {
          // Make sure each object has the required properties
          const validObject = {
            ...obj,
            curveConfig: obj.curveConfig || {
              styles: [{ color: '#000000', width: 2 }],
              parallelCount: 1,
              spacing: 5
            },
            transform: obj.transform || {
              rotation: 0,
              scaleX: 1,
              scaleY: 1
            }
          };
          createObject(validObject.points, validObject.name);
        });
        
        // Set background image if present
        if (parsedData.backgroundImage) {
          setBackgroundImage(parsedData.backgroundImage.url);
          setBackgroundOpacity(parsedData.backgroundImage.opacity);
        }
        
        toast({
          title: 'Template Loaded',
          description: 'Template has been loaded successfully.'
        });
      } else {
        toast({
          title: 'Invalid Template Data',
          description: 'The selected template does not contain valid objects.',
          variant: 'destructive'
        });
      }
    } catch (err) {
      console.error('Error loading template:', err);
      toast({
        title: 'Load Failed',
        description: 'There was an error loading the template. The format may be invalid.',
        variant: 'destructive'
      });
    }
  };
  
  // Handle object deletion
  const handleDeleteObject = (objectId: string) => {
    deleteObject(objectId);
    toast({
      title: 'Object Deleted',
      description: 'The selected object has been removed.'
    });
  };
  
  return (
    <div className="flex flex-col h-screen">
      <Header
        onClearCanvas={handleReset}
        onSaveDesign={handleSaveDesign}
        onLoadDesigns={() => setShowLibrary(true)}
        onExportSVG={handleExportSVG}
        onImportSVG={handleImportSVG}
        onLoadTemplate={handleLoadTemplate}
        isDrawingMode={isDrawingMode}
        onToggleDrawingMode={handleToggleDrawingMode}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <div id="canvas-container" className="flex-1 bg-gray-50 p-4 overflow-hidden">
          <BezierCanvas
            width={canvasWidth}
            height={canvasHeight}
            objects={objects}
            selectedObjectIds={selectedObjectIds}
            onObjectSelect={handleSelectObject}
            onObjectsChange={handleObjectsChange}
            onCreateObject={handleCreateObject}
            onSaveState={saveCurrentState}
            onUndo={undo}
            backgroundImage={backgroundImage}
            backgroundOpacity={backgroundOpacity}
            isDrawingMode={isDrawingMode}
          />
        </div>
        
        <div className="w-80 border-l overflow-y-auto">
          <ObjectControlsPanel
            selectedObjects={selectedObjects}
            allObjects={objects}
            selectedObjectIds={selectedObjectIds}
            onCreateObject={() => handleCreateObject([])}
            onSelectObject={handleSelectObject}
            onDeleteObject={handleDeleteObject}
            onRenameObject={renameObject}
            onUpdateCurveConfig={updateObjectCurveConfig}
            onUpdateTransform={updateObjectTransform}
            backgroundImage={backgroundImage}
            backgroundOpacity={backgroundOpacity}
            onBackgroundOpacityChange={setBackgroundOpacity}
            onUploadImage={handleUploadImage}
            onRemoveImage={handleRemoveImage}
          />
        </div>
      </div>
      
      {showLibrary && (
        <LibraryPanel
          onClose={() => setShowLibrary(false)}
          onSelectDesign={handleSelectDesign}
        />
      )}
    </div>
  );
};

export default Index;
