import { useState, useEffect } from 'react';
import { 
  ControlPoint, 
  CurveStyle, 
  DesignData, 
  TransformSettings,
  SavedDesign,
  CurveConfig,
  PointGroup
} from '@/types/bezier';
import { BezierCanvas } from '@/components/canvas';
import ControlsPanel from '@/components/ControlsPanel';
import Header from '@/components/Header';
import LibraryPanel from '@/components/LibraryPanel';
import { generateId, svgPathToBezierPoints } from '@/utils/bezierUtils';
import { exportAsSVG, downloadSVG } from '@/utils/svgExporter';
import { saveDesign } from '@/services/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useToast } from '@/components/ui/use-toast';

const Index = () => {
  const { toast } = useToast();
  
  // Canvas state
  const [canvasWidth, setCanvasWidth] = useState<number>(800);
  const [canvasHeight, setCanvasHeight] = useState<number>(600);
  
  // Control points
  const [points, setPoints] = useState<ControlPoint[]>([]);
  
  // Curve styles
  const [curveColor, setCurveColor] = useState<string>('#000000');
  const [curveWidth, setCurveWidth] = useState<number>(5);
  
  // Parallel curve settings
  const [parallelCount, setParallelCount] = useState<number>(2);
  const [parallelSpacing, setParallelSpacing] = useState<number>(8);
  const [parallelStyles, setParallelStyles] = useState<CurveStyle[]>([
    { color: '#ff0000', width: 5 },
    { color: '#0000ff', width: 5 },
    { color: '#00ff00', width: 5 },
    { color: '#ffff00', width: 5 }
  ]);
  
  // Transformation settings
  const [rotation, setRotation] = useState<number>(0);
  const [scaleX, setScaleX] = useState<number>(1.0);
  const [scaleY, setScaleY] = useState<number>(1.0);
  
  // Background image
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>(undefined);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(0.3);
  
  // UI state
  const [showLibrary, setShowLibrary] = useState<boolean>(false);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(true);
  
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
  
  // Handle parallel style change
  const handleParallelStyleChange = (index: number, style: CurveStyle) => {
    const newStyles = [...parallelStyles];
    newStyles[index] = style;
    setParallelStyles(newStyles);
  };
  
  // Reset everything to default
  const handleReset = () => {
    setPoints([]);
    setCurveColor('#000000');
    setCurveWidth(5);
    setParallelCount(2);
    setParallelSpacing(8);
    setParallelStyles([
      { color: '#ff0000', width: 5 },
      { color: '#0000ff', width: 5 },
      { color: '#00ff00', width: 5 },
      { color: '#ffff00', width: 5 }
    ]);
    setRotation(0);
    setScaleX(1.0);
    setScaleY(1.0);
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
  
  // Export design as SVG
  const handleExportSVG = () => {
    if (points.length < 2) {
      toast({
        title: 'Cannot Export',
        description: 'Please create a curve with at least 2 control points.',
        variant: 'destructive'
      });
      return;
    }
    
    const curveConfig: CurveConfig = {
      styles: [
        { color: curveColor, width: curveWidth },
        ...parallelStyles
      ],
      parallelCount,
      spacing: parallelSpacing
    };
    
    const transform: TransformSettings = {
      rotation,
      scaleX,
      scaleY
    };
    
    const svgContent = exportAsSVG(points, curveConfig, transform, canvasWidth, canvasHeight);
    downloadSVG(svgContent, 'soutache-design.svg');
    
    toast({
      title: 'Design Exported',
      description: 'Your design has been exported as an SVG file.'
    });
  };
  
  // Helper function to convert flat points array to point groups structure
  const pointsToPointGroup = (points: ControlPoint[]): PointGroup[] => {
    if (points.length === 0) return [];
    
    return [{
      id: generateId(),
      points: [...points]
    }];
  };
  
  // Save design to Supabase
  const handleSaveDesign = async (name: string, category: string) => {
    if (points.length < 2) {
      toast({
        title: 'Cannot Save',
        description: 'Please create a curve with at least 2 control points.',
        variant: 'destructive'
      });
      return;
    }
    
    const designData: DesignData = {
      pointGroups: pointsToPointGroup(points),
      curveConfig: {
        styles: [
          { color: curveColor, width: curveWidth },
          ...parallelStyles
        ],
        parallelCount,
        spacing: parallelSpacing
      },
      transform: {
        rotation,
        scaleX,
        scaleY
      }
    };
    
    if (backgroundImage) {
      designData.backgroundImage = {
        url: backgroundImage,
        opacity: backgroundOpacity
      };
    }
    
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
      
      // Check if data contains pointGroups (new format) or not
      if (!parsedData.pointGroups || parsedData.pointGroups.length === 0) {
        toast({
          title: 'Invalid Design Data',
          description: 'The selected design does not contain valid control points.',
          variant: 'destructive'
        });
        return;
      }
      
      // Extract points from the first group for backward compatibility
      const pointsWithIds = parsedData.pointGroups[0].points.map(point => ({
        ...point,
        id: point.id || generateId()
      }));
      
      setPoints(pointsWithIds);
      
      if (parsedData.curveConfig) {
        if (parsedData.curveConfig.styles && parsedData.curveConfig.styles.length > 0) {
          setCurveColor(parsedData.curveConfig.styles[0].color);
          setCurveWidth(parsedData.curveConfig.styles[0].width);
          
          if (parsedData.curveConfig.styles.length > 1) {
            const newStyles = parsedData.curveConfig.styles.slice(1).map(style => ({
              color: style.color,
              width: style.width
            }));
            setParallelStyles(newStyles);
          }
        }
        
        setParallelCount(parsedData.curveConfig.parallelCount);
        setParallelSpacing(parsedData.curveConfig.spacing);
      }
      
      if (parsedData.transform) {
        setRotation(parsedData.transform.rotation);
        setScaleX(parsedData.transform.scaleX);
        setScaleY(parsedData.transform.scaleY);
      }
      
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
  
  return (
    <div className="flex flex-col h-screen">
      <Header
        onClearCanvas={handleReset}
        onSaveDesign={handleSaveDesign}
        onLoadDesigns={() => setShowLibrary(true)}
        onExportSVG={handleExportSVG}
        isDrawingMode={isDrawingMode}
        onToggleDrawingMode={handleToggleDrawingMode}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <div id="canvas-container" className="flex-1 bg-gray-50 p-4 overflow-hidden">
          <BezierCanvas
            width={canvasWidth}
            height={canvasHeight}
            points={points}
            onPointsChange={setPoints}
            curveWidth={curveWidth}
            curveColor={curveColor}
            parallelCount={parallelCount}
            parallelSpacing={parallelSpacing}
            parallelColors={parallelStyles.map(style => style.color)}
            parallelWidths={parallelStyles.map(style => style.width)}
            rotation={rotation}
            scaleX={scaleX}
            scaleY={scaleY}
            backgroundImage={backgroundImage}
            backgroundOpacity={backgroundOpacity}
            isDrawingMode={isDrawingMode}
          />
        </div>
        
        <div className="w-80 border-l overflow-y-auto">
          <ControlsPanel
            curveColor={curveColor}
            onCurveColorChange={setCurveColor}
            curveWidth={curveWidth}
            onCurveWidthChange={setCurveWidth}
            parallelCount={parallelCount}
            onParallelCountChange={setParallelCount}
            parallelSpacing={parallelSpacing}
            onParallelSpacingChange={setParallelSpacing}
            parallelStyles={parallelStyles}
            onParallelStyleChange={handleParallelStyleChange}
            rotation={rotation}
            onRotationChange={setRotation}
            scaleX={scaleX}
            onScaleXChange={setScaleX}
            scaleY={scaleY}
            onScaleYChange={setScaleY}
            onReset={handleReset}
            onUploadImage={handleUploadImage}
            onRemoveImage={handleRemoveImage}
            hasBackgroundImage={!!backgroundImage}
            backgroundOpacity={backgroundOpacity}
            onBackgroundOpacityChange={setBackgroundOpacity}
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
