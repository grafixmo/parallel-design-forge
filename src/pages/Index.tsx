
import { useState, useEffect, useCallback } from 'react';
import { 
  ControlPoint, 
  DesignData, 
  SavedDesign,
  BezierObject
} from '@/types/bezier';
import BezierCanvas from '@/components/bezier-canvas';
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
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.3);
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>();
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(true);
  
  // Use our hooks for Bezier objects
  const {
    objects,
    selectedObjectIds,
    isLoading,
    createObject,
    setAllObjects,
    loadObjectsFromTemplate,
    selectObject,
    updateObjects,
    updateObjectCurveConfig,
    updateObjectTransform,
    deleteObject,
    deleteSelectedObjects,
    renameObject,
    undo,
    redo,
    saveCurrentState
  } = useBezierObjects();
  
  // For library panel
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [loadedDesign, setLoadedDesign] = useState<DesignData | null>(null);
  
  // Debounced canvas size update to prevent performance issues
  useEffect(() => {
    const handleResize = () => {
      const main = document.querySelector('main');
      if (!main) return;
      
      // Use a smaller fraction of the available space to prevent layout issues
      const availableWidth = main.clientWidth * 0.95;
      const availableHeight = main.clientHeight * 0.8;
      
      setCanvasWidth(availableWidth);
      setCanvasHeight(availableHeight);
    };
    
    // Initial size
    handleResize();
    
    // Add event listener for window resize
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Create a new object with points
  const handleCreateObject = (points: ControlPoint[]) => {
    return createObject(points);
  };
  
  // Toggle drawing mode
  const handleToggleDrawingMode = () => {
    setIsDrawingMode(!isDrawingMode);
  };
  
  // Clear the canvas by removing all objects
  const handleClearCanvas = () => {
    if (objects.length === 0) return;
    
    setAllObjects([]);
    toast({
      title: "Canvas Cleared",
      description: "All objects have been removed"
    });
  };
  
  // Save current design to Supabase
  const handleSaveDesign = async (name: string, category: string, description?: string) => {
    try {
      if (objects.length === 0) {
        toast({
          title: "Cannot Save Empty Design",
          description: "Please create at least one object",
          variant: "destructive"
        });
        return;
      }
      
      // Create SVG for export
      const svg = await createDesignSVG(objects, canvasWidth, canvasHeight);
      const designData = JSON.stringify(objects);
      
      // Generate a thumbnail
      const thumbnail = await generateThumbnailFromSVG(svg, 300, 200);
      
      // Create template object
      const template: Template = {
        name,
        category,
        description,
        svg_content: svg,
        design_data: designData,
        thumbnail
      };
      
      // Save to Supabase
      const { data, error } = await saveTemplate(template);
      
      if (error) {
        throw new Error(error.message);
      }
      
      toast({
        title: "Design Saved",
        description: `"${name}" has been saved to your gallery`
      });
    } catch (error) {
      console.error('Error saving design:', error);
      toast({
        title: "Save Failed",
        description: "There was an error saving your design",
        variant: "destructive"
      });
    }
  };
  
  // Export the current design as SVG
  const handleExportSVG = async () => {
    try {
      if (objects.length === 0) {
        toast({
          title: "Cannot Export Empty Canvas",
          description: "Please create at least one object",
          variant: "destructive"
        });
        return;
      }
      
      const svg = await exportAsSVG(objects, canvasWidth, canvasHeight);
      downloadSVG(svg, 'qordatta-design.svg');
      
      toast({
        title: "SVG Exported",
        description: "Your design has been exported as an SVG file"
      });
    } catch (error) {
      console.error('Error exporting SVG:', error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting your design",
        variant: "destructive"
      });
    }
  };
  
  // Import SVG content
  const handleImportSVG = async (svgContent: string) => {
    try {
      const importedObjects = await parseSVGContent(svgContent);
      
      if (importedObjects.length === 0) {
        toast({
          title: "Import Failed",
          description: "No valid paths found in the SVG",
          variant: "destructive"
        });
        return;
      }
      
      // Add the imported objects to the canvas
      setAllObjects([...objects, ...importedObjects]);
      saveCurrentState();
      
      toast({
        title: "SVG Imported",
        description: `${importedObjects.length} paths imported successfully`
      });
    } catch (error) {
      console.error('Error importing SVG:', error);
      toast({
        title: "Import Failed",
        description: "There was an error processing the SVG",
        variant: "destructive"
      });
    }
  };
  
  // Open the library panel to load designs
  const handleLoadDesigns = () => {
    setIsPanelOpen(true);
  };
  
  // Delete the selected objects with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && 
          selectedObjectIds.length > 0 && 
          !isDrawingMode) {
        deleteSelectedObjects();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectIds, isDrawingMode, deleteSelectedObjects]);
  
  // Optimized Template Loading with error handling
  const handleLoadTemplate = useCallback(async (templateData: string, shouldClearCanvas: boolean = false) => {
    try {
      console.log('Loading template, clear canvas:', shouldClearCanvas);
      
      // Parse the template data
      const parsedData = JSON.parse(templateData);
      
      if (!Array.isArray(parsedData)) {
        throw new Error('Invalid template data format');
      }
      
      // Process and load the objects
      loadObjectsFromTemplate(parsedData, shouldClearCanvas);
      
      toast({
        title: "Template Loaded",
        description: `${parsedData.length} objects loaded from template`
      });
    } catch (error) {
      console.error('Error loading template:', error);
      toast({
        title: "Template Load Failed",
        description: "There was an error loading the template",
        variant: "destructive"
      });
    }
  }, [loadObjectsFromTemplate]);
  
  // Calculate disabled state for certain actions
  const isDeleteDisabled = selectedObjectIds.length === 0 || isDrawingMode;
  
  return (
    <div className="flex flex-col h-screen">
      <Header
        onClearCanvas={handleClearCanvas}
        onSaveDesign={handleSaveDesign}
        onLoadDesigns={handleLoadDesigns}
        onExportSVG={handleExportSVG}
        onImportSVG={handleImportSVG}
        onLoadTemplate={handleLoadTemplate}
        isDrawingMode={isDrawingMode}
        onToggleDrawingMode={handleToggleDrawingMode}
      />
      
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-4 overflow-hidden relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-50">
              <div className="flex flex-col items-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-2"></div>
                <p className="text-primary font-medium">Loading template...</p>
              </div>
            </div>
          )}
          
          <BezierCanvas
            width={canvasWidth}
            height={canvasHeight}
            objects={objects}
            selectedObjectIds={selectedObjectIds}
            onObjectSelect={selectObject}
            onObjectsChange={updateObjects}
            onCreateObject={handleCreateObject}
            onSaveState={saveCurrentState}
            onUndo={undo}
            backgroundImage={backgroundImage}
            backgroundOpacity={backgroundOpacity}
            isDrawingMode={isDrawingMode}
          />
        </div>
        
        {selectedObjectIds.length > 0 && !isDrawingMode && (
          <ObjectControlsPanel
            objects={objects}
            selectedObjectIds={selectedObjectIds}
            onUpdateCurveConfig={updateObjectCurveConfig}
            onUpdateTransform={updateObjectTransform}
            onRenameObject={renameObject}
            onDeleteObject={deleteObject}
            onDeleteSelectedObjects={deleteSelectedObjects}
          />
        )}
      </main>
      
      <LibraryPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onLoadDesign={(design) => {
          setLoadedDesign(design);
          if (design.objects && Array.isArray(design.objects)) {
            loadObjectsFromTemplate(design.objects, true);
          }
          setIsPanelOpen(false);
        }}
        setBackgroundImage={setBackgroundImage}
        setBackgroundOpacity={setBackgroundOpacity}
      />
    </div>
  );
};

export default Index;
