import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { PenLine, Trash2, Upload, Save, Database, MousePointer, Image, FileUp, Download } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Import new SVG utilities
import { readSVGFile, importSVG } from '@/utils/simpleSvgImporter';
import { exportSVG, downloadSVG } from '@/utils/simpleSvgExporter';

interface HeaderProps {
  onClearCanvas: () => void;
  onSaveDesign: (name: string, category: string, description?: string) => void;
  onLoadDesigns: () => void;
  onExportSVG: () => void;
  onImportSVG?: (svgContent: string) => void;
  onLoadTemplate?: (templateData: string, shouldClearCanvas?: boolean) => void;
  isDrawingMode?: boolean;
  onToggleDrawingMode?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onClearCanvas,
  onSaveDesign,
  onLoadDesigns,
  onExportSVG,
  onImportSVG,
  onLoadTemplate,
  isDrawingMode = true,
  onToggleDrawingMode
}) => {
  const [designName, setDesignName] = useState('');
  const [designCategory, setDesignCategory] = useState('Earrings');
  const [designDescription, setDesignDescription] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  
  // Updated SVG import flow with more robust error handling
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check if it's an SVG file
    if (!file.name.toLowerCase().endsWith('.svg')) {
      toast({
        title: "Invalid File Type",
        description: "Please select an SVG file.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Show importing toast
      setIsImporting(true);
      toast({
        title: "Importing SVG",
        description: "Processing your file...",
      });
      
      // Read file content
      const svgContent = await readSVGFile(file);
      
      // Validate the SVG is parseable (but don't actually use these objects)
      // This is just a quick validation step
      try {
        const testObjects = importSVG(svgContent);
        
        if (testObjects.length === 0) {
          toast({
            title: "Import Warning",
            description: "No shapes found in the SVG. The file may be too simple or complex.",
            variant: "destructive"
          });
          setIsImporting(false);
          return;
        }
      } catch (validationError) {
        console.error('SVG validation error:', validationError);
        toast({
          title: "Invalid SVG",
          description: "The file could not be parsed as an SVG.",
          variant: "destructive"
        });
        setIsImporting(false);
        return;
      }
      
      // Call the parent component's import handler with the SVG content
      if (onImportSVG) {
        onImportSVG(svgContent);
      }
      
      toast({
        title: "SVG Processing",
        description: "Converting SVG to bezier curves...",
        variant: "default"
      });
    } catch (error) {
      console.error('Error importing SVG:', error);
      toast({
        title: "Import Failed",
        description: "The SVG file couldn't be imported. Please try a simpler file.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      
      // Reset the input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
        
        {/* SVG Import/Export Dropdown - Now with improved error handling */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="default" 
              className="bg-indigo-600 hover:bg-indigo-700" 
              disabled={isImporting}
            >
              <Database className="h-4 w-4 mr-2" />
              {isImporting ? 'Importing...' : 'SVG Actions'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onExportSVG} className="cursor-pointer">
              <Download className="h-4 w-4 mr-2" />
              Export SVG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportClick} className="cursor-pointer" disabled={isImporting}>
              <FileUp className="h-4 w-4 mr-2" />
              Import SVG
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Hidden file input for SVG import */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".svg"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
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
