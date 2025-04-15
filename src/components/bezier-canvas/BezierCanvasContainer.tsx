
import React from 'react';
import { 
  BezierObject, 
  ControlPoint
} from '@/types/bezier';
import BezierCanvas from './BezierCanvas';
import { toast } from '@/hooks/use-toast';
import { createDesignSVG, downloadSVG } from '@/utils/svgExporter';

interface BezierCanvasContainerProps {
  width: number;
  height: number;
  objects: BezierObject[];
  selectedObjectIds: string[];
  onObjectSelect: (objectId: string, multiSelect: boolean) => void;
  onObjectsChange: (objects: BezierObject[]) => void;
  onCreateObject: (points: ControlPoint[]) => string;
  onSaveState: () => void;
  onUndo: () => void;
  backgroundImage?: string;
  backgroundOpacity: number;
  isDrawingMode?: boolean;
}

const BezierCanvasContainer: React.FC<BezierCanvasContainerProps> = (props) => {
  // Handle SVG export with improved error handling
  const handleSVGExport = (fileName: string = "bezier-design.svg") => {
    try {
      if (props.objects.length === 0) {
        toast({
          title: "Export Error",
          description: "No objects to export. Create some shapes first.",
          variant: "destructive"
        });
        return;
      }
      
      // Create SVG content from objects using our consolidated function
      const svgContent = createDesignSVG(props.objects, props.width, props.height);
      
      // Download the SVG file
      downloadSVG(svgContent, fileName);
      
      toast({
        title: "SVG Exported",
        description: `Successfully exported ${props.objects.length} shapes.`,
        variant: "default"
      });
    } catch (error) {
      console.error("Error exporting SVG:", error);
      toast({
        title: "Export Error",
        description: "Failed to export SVG.",
        variant: "destructive"
      });
    }
  };
  
  // Pass through to the main BezierCanvas component
  return (
    <div className="relative w-full h-full">
      <BezierCanvas {...props} />
    </div>
  );
};

export default React.memo(BezierCanvasContainer);
