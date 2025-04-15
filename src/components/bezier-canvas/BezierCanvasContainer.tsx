
import React, { useState } from 'react';
import { 
  BezierObject, 
  ControlPoint
} from '@/types/bezier';
import BezierCanvas from './BezierCanvas';
import { toast } from '@/hooks/use-toast';
import { importSVGtoCurves } from '@/utils/curveImporter';
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
  const [isImporting, setIsImporting] = useState(false);

  // Handle SVG import with our improved curve-focused approach
  const handleSVGImport = (svgContent: string) => {
    try {
      console.log('Starting SVG import process with curve-focused importer...');
      setIsImporting(true);
      
      // Use the improved importer with fewer, better quality control points
      const importedObjects = importSVGtoCurves(svgContent);
      
      if (importedObjects.length === 0) {
        toast({
          title: "Import Notice",
          description: "No valid curves could be extracted from the SVG file.",
          variant: "destructive"
        });
        return [];
      }
      
      console.log(`Successfully imported ${importedObjects.length} curves with ${importedObjects.reduce((sum, obj) => sum + obj.points.length, 0)} total points`);
      
      // Return imported objects
      toast({
        title: "SVG Imported",
        description: `Successfully imported ${importedObjects.length} curves.`,
        variant: "default"
      });
      
      return importedObjects;
    } catch (error) {
      console.error("Error importing SVG:", error);
      toast({
        title: "Import Error",
        description: "Failed to import SVG. Try a simpler file.",
        variant: "destructive"
      });
      return [];
    } finally {
      setIsImporting(false);
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
    <div className="relative w-full h-full">
      {isImporting && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-50">
          <div className="flex flex-col items-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-2"></div>
            <p className="text-primary font-medium">Importing SVG...</p>
          </div>
        </div>
      )}
      <BezierCanvas {...props} />
    </div>
  );
};

// Expose functions for external use
export { importSVGtoCurves } from '@/utils/curveImporter';
export { exportSVG, downloadSVG } from '@/utils/simpleSvgExporter';

export default BezierCanvasContainer;
