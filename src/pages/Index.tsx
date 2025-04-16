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
import { exportAsSVG, downloadSVG } from '@/utils/svgExporter';
import { saveDesign, saveTemplate, Template } from '@/services/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useBezierObjects } from '@/hooks/useBezierObjects';
import ObjectControlsPanel from '@/components/ObjectControlsPanel';

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
    updateObjects, // This will be used instead of updateObjectPoints
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
    // This is a simplified version - in a real app you'd need to merge with existing objects
    updateObjects(updatedObjects); // Use updateObjects instead of updateObjectPoints
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
      objects, // Pass the whole objects array instead of flatMap
      canvasWidth,
      canvasHeight
    );
    
    downloadSVG(svgContent, 'soutache-design.svg');
    
    toast({
      title: 'Design Exported',
      description: 'Your design has been exported as an SVG file.'
    });
  };
  
  // Save design to Supabase
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
    
    // Save design to the designs table (legacy)
    const design: SavedDesign = {
      name,
      category,
      shapes_data: JSON.stringify(designData)
    };
    
    try {
      const { data, error } = await saveDesign(design);
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Also save as a template to the new templates table
      const template: Template = {
        name,
        category,
        design_data: JSON.stringify(designData),
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
  
  // Load a design from the library
  const handleSelectDesign = (design: SavedDesign) => {
    try {
      if (!design.shapes_data) {
        throw new Error('Design data is empty');
      }
      
      const parsedData: DesignData = JSON.parse(design.shapes_data);
      
      // Clear current objects
      objects.forEach(obj => deleteObject(obj.id));
      
      // Check if data has objects array (new format) or just points (old format)
      if (parsedData.objects && parsedData.objects.length > 0) {
        // New format with objects
        parsedData.objects.forEach(obj => {
          createObject(obj.points, obj.name);
        });
      } else if (parsedData.points && parsedData.points.length > 0) {
        // Old format with just points, create a single object
        const pointsWithIds = parsedData.points.map(point => ({
          ...point,
          id: point.id || generateId()
        }));
        
        createObject(pointsWithIds, 'Imported Object');
      } else {
        toast({
          title: 'Invalid Design Data',
          description: 'The selected design does not contain valid control points.',
          variant: 'destructive'
        });
        return;
      }
      
      // Set background image if present
      if (parsedData.backgroundImage) {
        setBackgroundImage(parsedData.backgroundImage.url);
        setBackgroundOpacity(parsedData.backgroundImage.opacity);
      }
      
      toast({
        title: 'Design Loaded',
        description: `Design "${design.name}" has been loaded successfully.`
      });
    } catch (err) {
      console.error('Error loading design:', err);
      toast({
        title: 'Load Failed',
        description: 'There was an error loading the design. The format may be invalid.',
        variant: 'destructive'
      });
    }
  };
  
  // Load a template from the gallery
  const handleLoadTemplate = (templateData: string) => {
    try {
      const parsedData: DesignData = JSON.parse(templateData);
      
      // Clear current objects
      objects.forEach(obj => deleteObject(obj.id));
      
      // Check if data has objects array (new format) or just points (old format)
      if (parsedData.objects && parsedData.objects.length > 0) {
        // New format with objects
        parsedData.objects.forEach(obj => {
          createObject(obj.points, obj.name);
        });
      } else if (parsedData.points && parsedData.points.length > 0) {
        // Old format with just points, create a single object
        const pointsWithIds = parsedData.points.map(point => ({
          ...point,
          id: point.id || generateId()
        }));
        
        createObject(pointsWithIds, 'Imported Template');
      } else {
        toast({
          title: 'Invalid Template Data',
          description: 'The selected template does not contain valid control points.',
          variant: 'destructive'
        });
        return;
      }
      
      // Set background image if present
      if (parsedData.backgroundImage) {
        setBackgroundImage(parsedData.backgroundImage.url);
        setBackgroundOpacity(parsedData.backgroundImage.opacity);
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
