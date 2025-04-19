
import { useState, useEffect, useRef } from 'react';
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

// Improved debounce function with immediate option and better typing
function debounce<F extends (...args: any[]) => any>(
  func: F, 
  wait: number, 
  options: { leading?: boolean; trailing?: boolean } = {}
): (...args: Parameters<F>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<F> | null = null;
  let lastCallTime: number = 0;
  const leading = options.leading !== false;
  const trailing = options.trailing !== false;
  
  return function(...args: Parameters<F>) {
    const now = Date.now();
    const isFirstCall = !lastCallTime && leading;
    
    lastArgs = args;
    lastCallTime = now;
    
    // Execute immediately for leading edge
    if (isFirstCall) {
      func(...args);
    }
    
    // Clear any existing timeout
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    
    // Set a new timeout for trailing edge
    if (trailing) {
      timeout = setTimeout(() => {
        // Only execute if we have args and enough time has passed
        if (lastArgs && (Date.now() - lastCallTime >= wait)) {
          func(...lastArgs);
          lastArgs = null;
          lastCallTime = 0;
        }
        timeout = null;
      }, wait);
    }
  };
}

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
  
  // Export state - track if we are currently in middle of exporting
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const lastExportTime = useRef<number>(0);
  const exportLock = useRef<boolean>(false); // New lock to prevent concurrent exports
  
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
  
  // Completely redesigned export function with proper locking mechanism
  const handleExportSVG = debounce(() => {
    // Skip if already exporting or locked
    if (isExporting || exportLock.current) {
      console.log('Export already in progress or locked, skipping');
      return;
    }
    
    // Check for objects
    if (objects.length === 0) {
      toast({
        title: 'Cannot Export',
        description: 'Please create at least one object with points.',
        variant: 'destructive'
      });
      return;
    }
    
    // Set export lock
    exportLock.current = true;
    setIsExporting(true);
    lastExportTime.current = Date.now();
    
    try {
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
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'There was an error exporting your design.',
        variant: 'destructive'
      });
    } finally {
      // Release lock after a short delay to prevent rapid consecutive calls
      setTimeout(() => {
        exportLock.current = false;
        setIsExporting(false);
      }, 1000);
    }
  }, 500, { leading: true, trailing: false });

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

  // Completely rewritten handleImportSVG with better error handling and preprocessing
  const handleImportSVG = (svgString: string, merge: boolean = false) => {
    try {
      if (!svgString || typeof svgString !== 'string') {
        throw new Error('Invalid SVG: Empty or not a string');
      }
      
      console.log('Importing SVG string (first 100 chars):', svgString.substring(0, 100) + '...');
      
      // Apply preprocessing to enhance SVG before import
      const enhancedSvg = preprocessSVG(svgString);
      
      // Import SVG and convert to BezierObjects
      const importedObjects = importSVGFromString(enhancedSvg);
      
      if (!importedObjects || importedObjects.length === 0) {
        throw new Error('No valid objects found in the SVG file');
      }
      
      console.log(`Successfully imported ${importedObjects.length} objects with ${importedObjects.reduce((sum, obj) => sum + obj.points.length, 0)} points`);
      
      if (!merge) {
        // Clear existing objects if not in merge mode
        objects.forEach(obj => deleteObject(obj.id));
      }
      
      // Apply additional scaling and centering for imported objects
      const scaledObjects = scaleAndCenterObjects(importedObjects, canvasWidth, canvasHeight);
      
      // Add imported objects with new IDs
      const newObjects = scaledObjects.map(obj => ({
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
  
  // Function to preprocess SVG before import
  const preprocessSVG = (svgString: string): string => {
    // First convert using the utility function
    let enhancedSvg = convertToValidSVG(svgString);
    
    if (!enhancedSvg) {
      console.warn('SVG conversion failed, using original SVG');
      enhancedSvg = svgString;
    }
    
    return enhancedSvg;
  };
  
  // Improved scaleAndCenterObjects function with better handling of complex SVGs
  const scaleAndCenterObjects = (objects: BezierObject[], targetWidth: number, targetHeight: number): BezierObject[] => {
    if (objects.length === 0) return [];
    
    // Calculate the bounding box of all objects
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    // Find min/max coordinates across all objects
    objects.forEach(obj => {
      if (!obj.points || obj.points.length === 0) return;
      
      obj.points.forEach(point => {
        if (!point) return;
        
        // Check main point coordinates
        if (isFinite(point.x) && isFinite(point.y)) {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        }
        
        // Check handle points if they exist
        if (point.handleIn && isFinite(point.handleIn.x) && isFinite(point.handleIn.y)) {
          minX = Math.min(minX, point.handleIn.x);
          minY = Math.min(minY, point.handleIn.y);
          maxX = Math.max(maxX, point.handleIn.x);
          maxY = Math.max(maxY, point.handleIn.y);
        }
        
        if (point.handleOut && isFinite(point.handleOut.x) && isFinite(point.handleOut.y)) {
          minX = Math.min(minX, point.handleOut.x);
          minY = Math.min(minY, point.handleOut.y);
          maxX = Math.max(maxX, point.handleOut.x);
          maxY = Math.max(maxY, point.handleOut.y);
        }
      });
    });
    
    // Default values if we couldn't determine bounds
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      console.warn('Could not determine SVG bounds, using defaults');
      minX = 0;
      minY = 0;
      maxX = 100;
      maxY = 100;
    }
    
    // Calculate content dimensions
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Skip if dimensions are invalid
    if (contentWidth <= 0 || contentHeight <= 0) {
      console.warn('Invalid content dimensions, skipping scaling');
      return objects;
    }
    
    // Calculate scaling factor - aim to use 75% of canvas size
    const targetArea = targetWidth * targetHeight * 0.75;
    const contentArea = contentWidth * contentHeight;
    
    // Calculate scaling to fit in target area while preserving aspect ratio
    // Use square root to calculate scale factor from areas
    let scaleFactor = Math.sqrt(targetArea / contentArea);
    
    // Limit scaling to reasonable bounds to prevent extreme distortion
    scaleFactor = Math.min(Math.max(scaleFactor, 0.1), 10);
    
    // Calculate centering offsets
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    const targetCenterX = targetWidth / 2;
    const targetCenterY = targetHeight / 2;
    
    console.log(`Scaling imported objects by ${scaleFactor.toFixed(2)}, centering at (${targetCenterX}, ${targetCenterY})`);
    
    // Apply scaling and centering transformations to all objects
    return objects.map(obj => {
      // Skip objects without points
      if (!obj.points || obj.points.length === 0) return obj;
      
      // Deep clone the object to avoid mutations
      const clonedObj = JSON.parse(JSON.stringify(obj));
      
      // Apply transformations to all points
      clonedObj.points = clonedObj.points.map((point: ControlPoint) => {
        if (!point) return point;
        
        // Ensure all values are valid numbers
        const ensureValidCoords = (p: {x: number, y: number}): {x: number, y: number} => {
          return {
            x: isFinite(p.x) ? p.x : 0,
            y: isFinite(p.y) ? p.y : 0
          };
        };
        
        // Get safe coordinates
        const safePoint = ensureValidCoords(point);
        const safeHandleIn = point.handleIn ? ensureValidCoords(point.handleIn) : {x: safePoint.x - 50, y: safePoint.y};
        const safeHandleOut = point.handleOut ? ensureValidCoords(point.handleOut) : {x: safePoint.x + 50, y: safePoint.y};
        
        // Calculate scaled and centered coordinates
        const scaledX = (safePoint.x - contentCenterX) * scaleFactor + targetCenterX;
        const scaledY = (safePoint.y - contentCenterY) * scaleFactor + targetCenterY;
        
        // Update handle coordinates with the same transformation
        const scaledHandleInX = (safeHandleIn.x - contentCenterX) * scaleFactor + targetCenterX;
        const scaledHandleInY = (safeHandleIn.y - contentCenterY) * scaleFactor + targetCenterY;
        const scaledHandleOutX = (safeHandleOut.x - contentCenterX) * scaleFactor + targetCenterX;
        const scaledHandleOutY = (safeHandleOut.y - contentCenterY) * scaleFactor + targetCenterY;
        
        return {
          ...point,
          x: scaledX,
          y: scaledY,
          handleIn: {
            x: scaledHandleInX,
            y: scaledHandleInY
          },
          handleOut: {
            x: scaledHandleOutX,
            y: scaledHandleOutY
          }
        };
      });
      
      return clonedObj;
    });
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
  const handleLoadTemplate = (templateData: string, merge: boolean = false) => {
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
      
      if (!merge) {
        // Clear current objects if not in merge mode
        objects.forEach(obj => deleteObject(obj.id));
      }
      
      // Add objects from template
      if (parsedData.objects && parsedData.objects.length > 0) {
        // Format with objects array
        const newObjects = parsedData.objects.map(obj => ({
          ...obj,
          id: generateId(), // Generate new IDs to avoid conflicts
          isSelected: false // Make sure new objects are not selected
        }));

        if (merge) {
          // In merge mode, add new objects to existing ones
          setAllObjects([...objects, ...newObjects]);
        } else {
          // In replace mode, just set the new objects
          setAllObjects(newObjects);
        }
        
        // Set background image if present and not in merge mode
        if (!merge && parsedData.backgroundImage) {
          setBackgroundImage(parsedData.backgroundImage.url);
          setBackgroundOpacity(parsedData.backgroundImage.opacity);
        }
        
        toast({
          title: merge ? 'Template Merged' : 'Template Loaded',
          description: `Template has been ${merge ? 'merged with existing design' : 'loaded'} successfully.`
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
        onLoadTemplate={(templateData, merge) => handleLoadTemplate(templateData, merge)}
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
            onUpdateTransform={updateObjectTransform}
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
