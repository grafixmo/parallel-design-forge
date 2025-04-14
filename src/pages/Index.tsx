import { useState, useEffect } from 'react';
import { 
  ControlPoint, 
  DesignData, 
  SavedDesign,
  BezierObject
} from '@/types/bezier';
import BezierCanvas from '@/components/BezierCanvas';
import Header from '@/components/Header';
import LibraryPanel from '@/components/LibraryPanel';
import { generateId } from '@/utils/bezierUtils';
import { exportAsSVG, downloadSVG, createDesignSVG } from '@/utils/svgExporter';
import { parseSVGContent } from '@/utils/svgImporter';
import { saveDesign, saveTemplate, Template } from '@/services/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useBezierObjects } from '@/hooks/useBezierObjects';
import ObjectControlsPanel from '@/components/ObjectControlsPanel';
import { generateThumbnailFromSVG } from '@/utils/thumbnailGenerator';
import React from 'react';
import { convertShapesDataToObjects } from '@/utils/bezierUtils';

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
  const [isImporting, setIsImporting] = useState<boolean>(false);
  
  // Use our custom hook for bezier objects
  const {
    objects,
    selectedObjectIds,
    createObject,
    selectObject,
    deselectAllObjects,
    updateObjects,
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
    
    // Generate SVG content using all objects
    const svgContent = createDesignSVG(objects, canvasWidth, canvasHeight);
    
    downloadSVG(svgContent, 'soutache-design.svg');
    
    toast({
      title: 'Design Exported',
      description: 'Your design has been exported as an SVG file.'
    });
  };
  
  // Import SVG file content
  const handleImportSVG = async (svgContent: string) => {
    try {
      setIsImporting(true);
      
      // Show loading toast
      toast({
        title: 'Importing SVG',
        description: 'Please wait while we process your SVG file...'
      });
      
      // Parse SVG content
      const importResult = parseSVGContent(svgContent);
      
      if (importResult.objects.length === 0) {
        throw new Error('No valid paths found in the SVG');
      }
      
      // Clear current objects if user confirms
      if (objects.length > 0) {
        // In a real app, you might want to ask for confirmation
        objects.forEach(obj => deleteObject(obj.id));
      }
      
      // Add imported objects to the canvas
      importResult.objects.forEach(obj => {
        if (obj.points && obj.points.length > 0) {
          createObject(obj.points, obj.name);
        }
      });
      
      // Save current state for undo/redo
      saveCurrentState();
      
      toast({
        title: 'Import Successful',
        description: `Imported ${importResult.objects.length} objects from SVG`
      });
      
      // Switch to selection mode to interact with imported objects
      setIsDrawingMode(false);
      
    } catch (error) {
      console.error('Error importing SVG:', error);
      toast({
        title: 'Import Failed',
        description: `Error: ${(error as Error).message}`,
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };
  
  // Save design to Supabase
  const handleSaveDesign = async (name: string, category: string, description?: string) => {
    if (objects.length === 0) {
      toast({
        title: 'Cannot Save',
        description: 'Please create at least one object with points.',
        variant: 'destructive'
      });
      return;
    }
    
    // Show loading toast
    toast({
      title: 'Saving Design',
      description: 'Please wait while we process your design...'
    });
    
    const designData: DesignData = {
      objects: objects,
      backgroundImage: backgroundImage ? {
        url: backgroundImage,
        opacity: backgroundOpacity
      } : undefined
    };
    
    // Generate SVG content for thumbnail and storage
    const svgContent = createDesignSVG(objects, canvasWidth, canvasHeight);
    
    // Generate thumbnail from SVG
    let thumbnail;
    try {
      thumbnail = await generateThumbnailFromSVG(svgContent);
      console.log("Thumbnail generated successfully");
    } catch (err) {
      console.error('Error generating thumbnail:', err);
      // Continue without thumbnail if generation fails
    }
    
    try {
      // Save as a template to the templates table
      const template: Template = {
        name,
        category,
        design_data: JSON.stringify(designData),
        description: description || '',
        likes: 0,
        thumbnail: thumbnail || '',
        svg_content: svgContent // Store the raw SVG content
      };
      
      console.log("Saving template with data:", {
        name,
        category,
        description,
        hasDesignData: !!template.design_data,
        hasThumbnail: !!thumbnail,
        hasSvgContent: !!svgContent
      });
      
      const templateResult = await saveTemplate(template);
      
      if (templateResult.error) {
        console.error("Supabase error details:", templateResult.error);
        throw new Error(templateResult.error.message);
      }
      
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
      
      let parsedData;
      
      // First, ensure we're working with a string
      if (typeof design.shapes_data !== 'string') {
        console.log('Design data is not a string:', typeof design.shapes_data);
        // If it's already an object, use it directly
        parsedData = design.shapes_data;
      } else {
        // Parse the string data
        try {
          parsedData = JSON.parse(design.shapes_data);
          console.log('Successfully parsed design data');
        } catch (err) {
          console.error('Failed to parse design data:', err);
          throw new Error('Invalid JSON format in design data');
        }
      }
      
      console.log('Design data format:', typeof parsedData, parsedData);
      
      // Clear current objects
      objects.forEach(obj => deleteObject(obj.id));
      
      // Process the data into bezier objects
      let bezierObjects: BezierObject[] = [];
      
      // Check data format and handle accordingly
      if (Array.isArray(parsedData)) {
        // Array of shapes or objects
        console.log('Processing array data with', parsedData.length, 'items');
        bezierObjects = convertShapesDataToObjects(parsedData);
      } else if (typeof parsedData === 'object' && parsedData !== null) {
        // Object format (could be DesignData or other)
        if (parsedData.objects && Array.isArray(parsedData.objects)) {
          // Standard DesignData format
          console.log('Processing DesignData with objects array');
          bezierObjects = convertShapesDataToObjects(parsedData.objects);
        } else if (parsedData.points && Array.isArray(parsedData.points)) {
          // Legacy format with just points
          console.log('Processing legacy format with points array');
          const pointsWithIds = parsedData.points.map((point: any) => ({
            ...point,
            id: point.id || generateId()
          }));
          
          // Create a single object from the points
          if (pointsWithIds.length > 0) {
            bezierObjects = [{
              id: generateId(),
              points: pointsWithIds,
              curveConfig: {
                styles: [{ color: '#000000', width: 5 }],
                parallelCount: 0,
                spacing: 0
              },
              transform: {
                rotation: 0,
                scaleX: 1.0,
                scaleY: 1.0
              },
              name: 'Imported Object',
              isSelected: false
            }];
          }
        } else {
          // Try to treat the whole object as a single shape
          console.log('Trying to process as a single shape');
          bezierObjects = convertShapesDataToObjects([parsedData]);
        }
      }
      
      // If we have objects to add, create them
      if (bezierObjects.length > 0) {
        console.log(`Creating ${bezierObjects.length} objects`);
        bezierObjects.forEach(obj => {
          if (obj.points && obj.points.length > 0) {
            createObject(obj.points, obj.name);
          } else {
            console.warn('Skipping object with no points:', obj);
          }
        });
        
        // Set background image if present in the data
        if (parsedData.backgroundImage) {
          setBackgroundImage(parsedData.backgroundImage.url);
          setBackgroundOpacity(parsedData.backgroundImage.opacity);
        }
        
        toast({
          title: 'Design Loaded',
          description: `Design "${design.name}" has been loaded with ${bezierObjects.length} objects.`
        });
      } else {
        toast({
          title: 'No Valid Objects',
          description: 'The design could not be loaded because no valid objects were found.',
          variant: 'destructive'
        });
      }
    } catch (err) {
      console.error('Error loading design:', err);
      toast({
        title: 'Load Failed',
        description: `There was an error loading the design: ${(err as Error).message}`,
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
