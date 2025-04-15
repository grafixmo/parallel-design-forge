
import React from 'react';
import { 
  BezierObject, 
  ControlPoint
} from '@/types/bezier';
import BezierCanvas from './BezierCanvas';
import { toast } from '@/hooks/use-toast';
import { importSVG } from '@/utils/simpleSvgImporter';
import { exportSVG, downloadSVG } from '@/utils/simpleSvgExporter';

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
  // Handle SVG import with simplified approach
  const handleSVGImport = (svgContent: string) => {
    try {
      console.log('Starting SVG import process...');
      
      // Import SVG with our simplified approach
      const importedObjects = importSVG(svgContent);
      
      if (importedObjects.length === 0) {
        toast({
          title: "Import Error",
          description: "No valid paths found in the SVG file.",
          variant: "destructive"
        });
        return [];
      }
      
      console.log(`Successfully imported ${importedObjects.length} shapes with ${importedObjects.reduce((sum, obj) => sum + obj.points.length, 0)} total points`);
      
      // Return imported objects
      toast({
        title: "SVG Imported",
        description: `Successfully imported ${importedObjects.length} shapes.`,
        variant: "default"
      });
      
      return importedObjects;
    } catch (error) {
      console.error("Error importing SVG:", error);
      toast({
        title: "Import Error",
        description: "Failed to import SVG. Please try a simpler file.",
        variant: "destructive"
      });
      return [];
    }
  };
  
  // Handle SVG export (for reference, handled at Header component level)
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
      
      // Create SVG content from objects
      const svgContent = exportSVG(props.objects, props.width, props.height);
      
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
    <BezierCanvas {...props} />
  );
};

// Expose functions for external use
export { importSVG } from '@/utils/simpleSvgImporter';
export { exportSVG, downloadSVG } from '@/utils/simpleSvgExporter';

export default BezierCanvasContainer;
