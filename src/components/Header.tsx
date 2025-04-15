import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { PenLine, Trash2, Upload, Save, Database, MousePointer, Image, Download } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import TemplateGallery from './TemplateGallery';
import { getTemplateCategories } from '@/utils/thumbnailGenerator';
import { exportAsSVG, downloadSVG } from '@/utils/svgExporter';

interface HeaderProps {
  onClearCanvas: () => void;
  onSaveDesign: (name: string, category: string, description?: string) => void;
  onLoadDesigns: () => void;
  onExportSVG: () => void;
  onLoadTemplate?: (templateData: string, shouldClearCanvas?: boolean) => void;
  isDrawingMode?: boolean;
  onToggleDrawingMode?: () => void;
  objects: any[]; // Added objects prop
  width: number; // Added width prop
  height: number; // Added height prop
}

const Header: React.FC<HeaderProps> = ({
  onClearCanvas,
  onSaveDesign,
  onLoadDesigns,
  onExportSVG,
  onLoadTemplate,
  isDrawingMode = true,
  onToggleDrawingMode,
  objects,
  width,
  height
}) => {
  const [designName, setDesignName] = useState('');
  const [designCategory, setDesignCategory] = useState('Earrings');
  const [designDescription, setDesignDescription] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const categories = getTemplateCategories();
  
  const handleSaveClick = () => {
    setSaveDialogOpen(true);
  };
  
  const handleSaveDesign = () => {
    if (designName.trim().length === 0) return;
    onSaveDesign(designName, designCategory, designDescription);
    setSaveDialogOpen(false);
    setDesignName('');
    setDesignDescription('');
  };

  const handleSelectTemplate = (templateData: string, shouldClearCanvas: boolean) => {
    if (onLoadTemplate) {
      onLoadTemplate(templateData, shouldClearCanvas);
    }
  };

  const handleExportSVG = () => {
    try {
      if (objects.length === 0) {
        toast({
          title: "Export Error",
          description: "No objects to export. Create some shapes first.",
          variant: "destructive"
        });
        return;
      }
      
      // Use exportAsSVG instead of exportSVG
      const svgContent = exportAsSVG(
        objects[0].points, 
        objects[0].curveConfig, 
        objects[0].transform, 
        width, 
        height
      );
      
      downloadSVG(svgContent, 'qordatta-design.svg');
      
      toast({
        title: "SVG Exported",
        description: "Design exported successfully"
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Could not export SVG",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="flex items-center justify-between p-4 border-b bg-white">
      <div className="flex items-center">
        <h1 className="text-xl font-bold mr-6">Qordatta Designer</h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={isDrawingMode ? "default" : "outline"} 
                onClick={onToggleDrawingMode}
                className="mr-2"
              >
                {isDrawingMode ? (
                  <PenLine className="h-4 w-4 mr-2" />
                ) : (
                  <MousePointer className="h-4 w-4 mr-2" />
                )}
                {isDrawingMode ? 'Drawing Mode' : 'Selection Mode'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isDrawingMode ? 'Switch to selection mode to select and move objects' : 'Switch to drawing mode to add points'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={onClearCanvas}
                className="mr-2"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clear canvas and start over</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="flex items-center space-x-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                onClick={() => setGalleryOpen(true)}
              >
                <Image className="h-4 w-4 mr-2" />
                Gallery
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Browse and load templates</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={onLoadDesigns}>
                <Upload className="h-4 w-4 mr-2" />
                Load Reference
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Load a reference design</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleSaveClick}>
              <Save className="h-4 w-4 mr-2" />
              Save Design
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl">Save Design</DialogTitle>
              <DialogDescription>
                Save your design to the database for future use.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  placeholder="My design"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">
                  Category
                </Label>
                <Select 
                  value={designCategory} 
                  onValueChange={setDesignCategory}
                >
                  <SelectTrigger className="col-span-3" id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="description" className="text-right pt-2">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe your design (optional)"
                  value={designDescription}
                  onChange={(e) => setDesignDescription(e.target.value)}
                  className="col-span-3 min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveDesign} disabled={designName.trim().length === 0}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Export SVG Button - Simplified */}
        <Button 
          variant="default" 
          className="bg-indigo-600 hover:bg-indigo-700" 
          onClick={handleExportSVG}
        >
          <Download className="h-4 w-4 mr-2" />
          Export SVG
        </Button>
      </div>
      
      {/* Gallery component */}
      <TemplateGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
};

export default Header;
