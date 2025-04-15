import React, { useState, useEffect, useCallback } from 'react';
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
import { exportAsSVG, createDesignSVG } from '@/utils/svgExporter';
import { parseSVGContent } from '@/utils/svgImporter';
import { saveDesign, saveTemplate, Template } from '@/services/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useBezierObjects } from '@/hooks/useBezierObjects';
import ObjectControlsPanel from '@/components/ObjectControlsPanel';
import { generateThumbnailFromSVG } from '@/utils/thumbnailGenerator';
import { convertShapesDataToObjects } from '@/utils/bezierUtils';
import { importSVG } from '@/utils/simpleSvgImporter';
import { exportSVG, downloadSVG } from '@/utils/simpleSvgExporter';

const Index = () => {
  const { toast } = useToast();
  
  // Canvas state
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.3);
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>();
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false); 
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  
  // Use our hooks for Bezier objects
  const {
    objects,
    selectedObjectIds,
    isLoading: objectsLoading,
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
  
  // Handle background image upload
  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        if (loadEvent.target && loadEvent.target.result) {
          setBackgroundImage(loadEvent.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Remove background image
  const handleRemoveBackgroundImage = () => {
    setBackgroundImage(undefined);
  };
  
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
      
      // Fix: only pass objects to createDesignSVG
      const svg = createDesignSVG(objects);
      const designData = JSON.stringify(objects);
      
      // Generate a thumbnail
      const thumbnail = await generateThumbnailFromSVG(svg);
      
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
  const handleExportSVG = () => {
    try {
      if (objects.length === 0) {
        toast({
          title: "Cannot Export Empty Canvas",
          description: "Please create at least one object",
          variant: "destructive"
        });
        return;
      }
      
      // Use our improved SVG exporter
      const svg = exportSVG(objects, canvasWidth, canvasHeight);
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
  
  // Optimized, async template loading with progress tracking
  const handleLoadTemplate = useCallback(async (templateData: string, shouldClearCanvas: boolean) => {
    try {
      // Use the hook's loading state and progress
      loadObjectsFromTemplate(templateData, shouldClearCanvas);
    } catch (error) {
      console.error('Error in handleLoadTemplate:', error);
      toast({
        title: "Template Load Error",
        description: "Failed to process template data",
        variant: "destructive"
      });
    }
  }, [loadObjectsFromTemplate]);
  
  // Import SVG content with improved error handling and async processing
  const handleImportSVG = async (svgContent: string) => {
    try {
      // Use the hook's SVG import function which handles async processing
      importSVGToObjects(svgContent);
    } catch (error) {
      console.error('Error importing SVG:', error);
      toast({
        title: "Import Failed",
        description: "There was an error processing the SVG. Try a simpler file.",
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
  
  // Calculate disabled state for certain actions
  const isDeleteDisabled = selectedObjectIds.length === 0 || isDrawingMode;
  
  // Handle loading a design from the library
  const handleLoadDesign = (design: DesignData) => {
    if (design.objects && Array.isArray(design.objects)) {
      // Directly pass the objects array, not as a string
      loadObjectsFromTemplate(design.objects);
      setLoadedDesign(design);
      setIsPanelOpen(false);
    }
  };
  
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
          {(isLoading || objectsLoading) && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-50">
              <div className="flex flex-col items-center max-w-md w-full px-4">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-2"></div>
                <p className="text-primary font-medium text-center mb-2">
                  {loadingProgress > 0 ? 'Processing template data...' : 'Loading...'}
                </p>
                
                {(loadingProgress > 0 || importProgress > 0) && (
                  <>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                      <div 
                        className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(loadingProgress, importProgress)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {Math.round(Math.max(loadingProgress, importProgress))}% complete
                    </p>
                  </>
                )}
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
            // Add the missing props
            backgroundImage={backgroundImage}
            backgroundOpacity={backgroundOpacity}
            onRemoveImage={handleRemoveBackgroundImage}
            onUploadImage={handleBackgroundImageUpload}
            onBackgroundOpacityChange={setBackgroundOpacity}
          />
        )}
      </main>
      
      <LibraryPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onLoadDesign={handleLoadDesign}
        setBackgroundImage={setBackgroundImage}
        setBackgroundOpacity={setBackgroundOpacity}
      />
    </div>
  );
};

export default Index;
