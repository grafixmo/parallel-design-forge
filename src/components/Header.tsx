import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { PenLine, Trash2, Upload, Save, Database, MousePointer, Image, FileUp, Download, Copy, Clipboard } from 'lucide-react';
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
import { SVGImportOptions } from '@/types/bezier';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onClearCanvas: () => void;
  onSaveDesign: (name: string, category: string, description?: string) => void;
  onLoadDesigns: () => void;
  onExportSVG: () => void;
  onImportSVG?: (svgContent: string, options?: SVGImportOptions, onProgress?: (progress: number) => void) => void;
  onLoadTemplate?: (templateData: string) => void;
  onCopyObjects?: () => void;
  onPasteObjects?: () => void;
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
  onCopyObjects,
  onPasteObjects,
  isDrawingMode = true,
  onToggleDrawingMode
}) => {
  const [designName, setDesignName] = useState('');
  const [designCategory, setDesignCategory] = useState('Earrings');
  const [designDescription, setDesignDescription] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [importOptions, setImportOptions] = useState<SVGImportOptions>({
    replaceExisting: true,
    importStyle: true,
    simplifyPaths: false,
    preserveViewBox: true
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
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

  const handleSelectTemplate = (templateData: string) => {
    if (onLoadTemplate) {
      onLoadTemplate(templateData);
    }
  };

  const handleImportClick = () => {
    setImportDialogOpen(true);
    setImportProgress(0);
    setIsImporting(false);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    
    setSelectedFile(file);
    setImportProgress(0);
  };
  
  const handleImportCancel = () => {
    setIsImporting(false);
    setImportDialogOpen(false);
    setSelectedFile(null);
    setImportProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleImportConfirm = async () => {
    if (!selectedFile || !onImportSVG) {
      toast({
        title: "No File Selected",
        description: "Please select an SVG file first.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Show loading toast
      toast({
        title: "Importing SVG",
        description: "Please wait while we process your file..."
      });
      
      setIsImporting(true);
      setImportProgress(0);
      
      // Read file content
      const fileReader = new FileReader();
      
      fileReader.onload = async (event) => {
        try {
          const svgContent = event.target?.result as string;
          if (!svgContent) throw new Error("Failed to read SVG file");
          
          // Quick size validation
          if (svgContent.length > 5000000) { // 5MB limit
            throw new Error("SVG file is too large to process");
          }
          
          // Track progress using the callback
          const updateProgress = (progress: number) => {
            setImportProgress(progress * 100);
          };
          
          // Import the SVG with options and progress tracking
          await onImportSVG(svgContent, importOptions, updateProgress);
          
          // Close dialog and reset state
          setImportDialogOpen(false);
          setSelectedFile(null);
          setIsImporting(false);
          setImportProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
          
          toast({
            title: "Import Successful",
            description: "SVG file imported successfully."
          });
        } catch (error) {
          console.error('Error importing SVG:', error);
          toast({
            title: "Import Failed",
            description: `Failed to import the SVG file: ${(error as Error).message}`,
            variant: "destructive"
          });
          setIsImporting(false);
        }
      };
      
      fileReader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 30;
          setImportProgress(progress);
        }
      };
      
      fileReader.onerror = () => {
        toast({
          title: "File Read Error",
          description: "Failed to read the SVG file.",
          variant: "destructive"
        });
        setIsImporting(false);
      };
      
      fileReader.readAsText(selectedFile);
    } catch (error) {
      console.error('Error importing SVG:', error);
      toast({
        title: "Import Failed",
        description: `Failed to import the SVG file: ${(error as Error).message}`,
        variant: "destructive"
      });
      setIsImporting(false);
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
        
        {onCopyObjects && onPasteObjects && (
          <div className="flex space-x-2 ml-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    onClick={onCopyObjects}
                    size="sm"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy selected objects</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    onClick={onPasteObjects}
                    size="sm"
                  >
                    <Clipboard className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Paste objects</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
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
        
        {/* SVG Import Dialog with Progress Indicator */}
        <Dialog open={importDialogOpen} onOpenChange={(open) => {
          if (!isImporting) setImportDialogOpen(open); 
          // Prevent closing dialog while import is in progress
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl">Import SVG</DialogTitle>
              <DialogDescription>
                Upload an SVG file to import into your design.
              </DialogDescription>
            </DialogHeader>
            
            <div className="my-6 space-y-4">
              {isImporting ? (
                <div className="space-y-2">
                  <p className="text-center font-medium text-sm">Processing SVG file...</p>
                  <Progress value={importProgress} className="h-2 w-full" />
                  <p className="text-xs text-center text-gray-500">
                    {importProgress < 100 ? 'Please wait while we process your file...' : 'Almost done!'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6 bg-gray-50">
                  {selectedFile ? (
                    <div className="text-center">
                      <p className="text-green-600 font-medium mb-2">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">{Math.round(selectedFile.size / 1024)} KB</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={handleFileSelect}
                      >
                        Change file
                      </Button>
                    </div>
                  ) : (
                    <>
                      <FileUp className="h-10 w-10 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500 mb-2">Click to select an SVG file</p>
                      <Button variant="outline" onClick={handleFileSelect}>
                        Select File
                      </Button>
                    </>
                  )}
                </div>
              )}
              
              {!isImporting && (
                <div className="space-y-4 border p-4 rounded-md bg-gray-50">
                  <h3 className="font-medium">Import Options</h3>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="replace-existing" 
                      checked={importOptions.replaceExisting}
                      onCheckedChange={(checked) => 
                        setImportOptions({
                          ...importOptions,
                          replaceExisting: checked === true
                        })
                      }
                      disabled={isImporting}
                    />
                    <Label htmlFor="replace-existing">Replace existing objects</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="import-style" 
                      checked={importOptions.importStyle}
                      onCheckedChange={(checked) => 
                        setImportOptions({
                          ...importOptions,
                          importStyle: checked === true
                        })
                      }
                      disabled={isImporting}
                    />
                    <Label htmlFor="import-style">Import SVG style attributes</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="preserve-viewbox" 
                      checked={importOptions.preserveViewBox}
                      onCheckedChange={(checked) => 
                        setImportOptions({
                          ...importOptions,
                          preserveViewBox: checked === true
                        })
                      }
                      disabled={isImporting}
                    />
                    <Label htmlFor="preserve-viewbox">Preserve original SVG positioning</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="simplify-paths" 
                      checked={importOptions.simplifyPaths}
                      onCheckedChange={(checked) => 
                        setImportOptions({
                          ...importOptions,
                          simplifyPaths: checked === true
                        })
                      }
                      disabled={isImporting}
                    />
                    <Label htmlFor="simplify-paths">Simplify complex paths (reduces points)</Label>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={handleImportCancel}
                disabled={isImporting && importProgress < 95}
              >
                {isImporting ? "Cancel" : "Close"}
              </Button>
              <Button 
                onClick={handleImportConfirm}
                disabled={!selectedFile || isImporting}
              >
                Import SVG
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* SVG Import/Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" className="bg-indigo-600 hover:bg-indigo-700">
              <Database className="h-4 w-4 mr-2" />
              SVG Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onExportSVG} className="cursor-pointer">
              <Download className="h-4 w-4 mr-2" />
              Export SVG
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleImportClick} className="cursor-pointer">
              <FileUp className="h-4 w-4 mr-2" />
              Import SVG...
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
