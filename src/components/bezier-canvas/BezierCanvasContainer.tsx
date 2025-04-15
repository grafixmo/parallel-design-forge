
import React, { useState } from 'react';
import { 
  BezierObject, 
  ControlPoint
} from '@/types/bezier';
import BezierCanvas from './BezierCanvas';
import { toast } from '@/hooks/use-toast';
import { importSVG, readSVGFile } from '@/utils/svg';
import { exportSVG, downloadSVG } from '@/utils/svg';

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
  const [importProgress, setImportProgress] = useState(0);

  // Handle SVG import with improved async handling
  const handleSVGImport = async (svgContent: string) => {
    try {
      console.log('Starting SVG import process with async Fabric.js importer...');
      setIsImporting(true);
      setImportProgress(0);
      
      // Use the improved async importer with progress tracking
      const importedObjects = await importSVG(svgContent, {
        onProgress: setImportProgress
      });
      
      if (importedObjects.length === 0) {
        toast({
          title: "Import Notice",
          description: "No valid shapes could be extracted from the SVG file.",
          variant: "destructive"
        });
        return [];
      }
      
      console.log(`Successfully imported ${importedObjects.length} shapes with ${importedObjects.reduce((sum, obj) => sum + obj.points.length, 0)} total points`);
      
      // Show success message
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
        description: "Failed to import SVG. Try a simpler file.",
        variant: "destructive"
      });
      return [];
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };
  
  // Handle SVG export
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
            <p className="text-primary font-medium">Importing SVG... {importProgress}%</p>
            
            {/* Add progress bar */}
            <div className="w-64 bg-gray-200 rounded-full h-2.5 mt-2">
              <div 
                className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${importProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
      <BezierCanvas {...props} />
    </div>
  );
};

export default BezierCanvasContainer;
