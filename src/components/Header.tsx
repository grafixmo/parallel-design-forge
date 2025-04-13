
import React from 'react';
import { Button } from '@/components/ui/button';
import { PenLine, Trash2, Upload, Save, Database, MousePointer, Move } from 'lucide-react';
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
import { SavedDesign } from '@/types/bezier';

interface HeaderProps {
  onClearCanvas: () => void;
  onSaveDesign: (name: string, category: string) => void;
  onLoadDesigns: () => void;
  onExportSVG: () => void;
  isDrawingMode?: boolean; // New prop to control drawing mode
  onToggleDrawingMode?: () => void; // New prop to toggle drawing mode
}

const Header: React.FC<HeaderProps> = ({
  onClearCanvas,
  onSaveDesign,
  onLoadDesigns,
  onExportSVG,
  isDrawingMode = true,
  onToggleDrawingMode
}) => {
  const [designName, setDesignName] = React.useState('');
  const [designCategory, setDesignCategory] = React.useState('Collares');
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false);
  
  const handleSaveClick = () => {
    setSaveDialogOpen(true);
  };
  
  const handleSaveDesign = () => {
    if (designName.trim().length === 0) return;
    onSaveDesign(designName, designCategory);
    setSaveDialogOpen(false);
    setDesignName('');
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
            <Button>
              <Save className="h-4 w-4 mr-2" />
              Save Design
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Save Design</DialogTitle>
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
                    <SelectItem value="Collares">Collares</SelectItem>
                    <SelectItem value="Anillos">Anillos</SelectItem>
                    <SelectItem value="Pendientes">Pendientes</SelectItem>
                    <SelectItem value="Prototipos">Prototipos</SelectItem>
                  </SelectContent>
                </Select>
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
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="default" 
                onClick={onExportSVG}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Database className="h-4 w-4 mr-2" />
                Export SVG
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export design as SVG file</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default Header;
