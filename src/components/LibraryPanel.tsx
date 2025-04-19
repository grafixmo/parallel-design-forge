import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { SavedDesign } from '@/types/bezier';
import { getDesigns, getDesignsByCategory, updateDesign, supabase } from '@/services/supabaseClient';
import { X, AlertTriangle, FileJson, FileText, Trash2, Edit } from 'lucide-react';
import { importSVGFromString } from '@/utils/svgExporter';
import { useToast } from '@/hooks/use-toast';
import MergeToggle from './MergeToggle';
import { generateThumbnail } from '@/utils/thumbnailGenerator';

interface LibraryPanelProps {
  onClose: () => void;
  onSelectDesign: (design: SavedDesign, merge: boolean) => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({ onClose, onSelectDesign }) => {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fixedCount, setFixedCount] = useState<number>(0);
  const { toast } = useToast();
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<SavedDesign | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchDesigns();
  }, [selectedCategory]);

  const fetchDesigns = async () => {
    setIsLoading(true);
    setError(null);
    setFixedCount(0);
    
    try {
      let response;
      
      if (selectedCategory === 'all') {
        response = await getDesigns();
      } else {
        response = await getDesignsByCategory(selectedCategory);
      }
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      console.log(`Fetched ${response.data?.length || 0} designs`);
      
      // Validate and normalize each design
      const processedDesigns = await Promise.all((response.data || []).map(async (design) => {
        try {
          console.log(`Processing design: ${design.name}, ID: ${design.id || 'unknown'}`);
          
          // Store original data type for debugging
          const originalDataType = typeof design.shapes_data;
          console.log(`Design ${design.name} - shapes_data original type: ${originalDataType}`);
          
          // Ensure shapes_data is a string
          let normalizedData: string;
          let dataFormat: 'json' | 'svg' | 'invalid' = 'invalid';
          let needsUpdate = false;
          
          if (typeof design.shapes_data === 'string') {
            normalizedData = design.shapes_data;
            
            // Check if it's an SVG
            if (normalizedData.trim().startsWith('<svg') || normalizedData.includes('<svg ')) {
              console.log(`Design ${design.name} contains SVG data`);
              dataFormat = 'svg';
            } else {
              // Try to parse as JSON to validate
              try {
                JSON.parse(normalizedData);
                dataFormat = 'json';
                console.log(`Design ${design.name} contains valid JSON data`);
              } catch (parseError) {
                console.warn(`Design ${design.name} has invalid JSON data:`, parseError);
                
                // Attempt auto-fix for invalid JSON
                try {
                  // Try to create a new valid JSON with empty objects array
                  normalizedData = JSON.stringify({ objects: [] });
                  dataFormat = 'json';
                  needsUpdate = true;
                  console.log(`Auto-fixed invalid JSON for design ${design.name}`);
                } catch (fixError) {
                  console.error(`Failed to auto-fix design ${design.name}:`, fixError);
                }
              }
            }
          } else if (typeof design.shapes_data === 'object' && design.shapes_data !== null) {
            // Convert object to string for consistency
            console.log(`Design ${design.name} has object data, converting to string`);
            try {
              normalizedData = JSON.stringify(design.shapes_data);
              dataFormat = 'json';
              needsUpdate = true;
            } catch (stringifyError) {
              console.error(`Error stringifying object for design ${design.name}:`, stringifyError);
              normalizedData = JSON.stringify({ objects: [] });
              dataFormat = 'json';
              needsUpdate = true;
            }
          } else {
            // Unknown data type, set as empty string to prevent errors
            console.warn(`Design ${design.name} has invalid shapes_data of type ${typeof design.shapes_data}`);
            normalizedData = JSON.stringify({ objects: [] });
            dataFormat = 'json';
            needsUpdate = true;
          }
          
          // Auto-fix: update the design in the database with stringified data
          if (design.id && needsUpdate) {
            try {
              console.log(`Fixing design ${design.name} with ID ${design.id} - converting to proper format`);
              const updateResult = await updateDesign(design.id, { 
                shapes_data: normalizedData 
              });
              
              if (updateResult.error) {
                console.error(`Failed to fix design ${design.name}:`, updateResult.error);
              } else {
                console.log(`Successfully fixed design ${design.name}`);
                setFixedCount(prev => prev + 1);
              }
            } catch (updateError) {
              console.error(`Error updating design ${design.name}:`, updateError);
            }
          }

          // Generate thumbnail for the design if possible
          let thumbnail = '';
          try {
            if (normalizedData) {
              thumbnail = await generateThumbnail(normalizedData);
            }
          } catch (thumbnailError) {
            console.error(`Error generating thumbnail for design ${design.name}:`, thumbnailError);
          }
          
          return {
            ...design,
            shapes_data: normalizedData,
            originalDataType,
            isSvg: dataFormat === 'svg',
            isJson: dataFormat === 'json',
            isInvalid: dataFormat === 'invalid',
            wasFixed: needsUpdate,
            thumbnail
          };
        } catch (processError) {
          console.error(`Error processing design ${design.name}:`, processError);
          return {
            ...design,
            shapes_data: JSON.stringify({ objects: [] }),
            hasParseError: true,
            isInvalid: true
          };
        }
      }));
      
      const fixedDesignsCount = processedDesigns.filter(d => (d as any).wasFixed).length;
      if (fixedDesignsCount > 0) {
        toast({
          title: "Database Cleanup",
          description: `Fixed ${fixedDesignsCount} designs with incorrect data format`,
        });
      }
      
      console.log(`Processed ${processedDesigns.length} designs, fixed ${fixedDesignsCount}`);
      setDesigns(processedDesigns);
    } catch (err) {
      setError('Failed to load designs. Please try again.');
      console.error('Error fetching designs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const handleSelectDesign = (design: SavedDesign) => {
    // Add diagnostic log
    console.log(`Selected design: ${design.name}, isSVG: ${(design as any).isSvg}, data type: ${typeof design.shapes_data}`);
    
    if ((design as any).hasParseError) {
      console.warn(`Note: Design ${design.name} had parsing errors but was auto-fixed`);
    }
    
    if ((design as any).wasFixed) {
      console.log(`Note: Design ${design.name} was auto-fixed during loading`);
    }
    
    onSelectDesign(design, mergeMode);
    onClose();
  };

  // Check if a string looks like SVG
  const isSvgContent = (content: any): boolean => {
    if (!content || typeof content !== 'string') return false;
    return content.trim().startsWith('<svg') || content.includes('<svg ');
  };

  // Render SVG preview safely
  const renderSvgPreview = (svgContent: string) => {
    try {
      // Create a safe version for display
      const cleanSvg = svgContent
        .replace(/script/gi, 'removed-script') // Remove potential script tags
        .replace(/on\w+=/gi, 'removed-event='); // Remove event handlers
        
      return (
        <div 
          className="w-full h-full flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: cleanSvg }}
        />
      );
    } catch (error) {
      console.error("Error rendering SVG preview:", error);
      return <div className="text-blue-300 flex items-center justify-center">
        <FileText className="h-8 w-8" />
      </div>;
    }
  };

  // Get preview content for a design
  const getPreviewContent = (design: SavedDesign) => {
    // If we have a thumbnail, use it
    if ((design as any).thumbnail) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <img 
            src={(design as any).thumbnail} 
            alt={design.name} 
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    }
    
    if ((design as any).isSvg) {
      return isSvgContent(design.shapes_data) ? 
        renderSvgPreview(design.shapes_data as string) : 
        <div className="flex items-center justify-center text-blue-300">
          <FileText className="h-8 w-8" />
        </div>;
    } 
    
    if ((design as any).isJson) {
      return <div className="flex items-center justify-center text-green-300">
        <FileJson className="h-8 w-8" />
      </div>;
    }
    
    if ((design as any).hasParseError || (design as any).isInvalid) {
      return <div className="flex items-center justify-center text-red-300">
        <AlertTriangle className="h-8 w-8" />
      </div>;
    }
    
    return <div className="flex items-center justify-center text-gray-300">
      <AlertTriangle className="h-8 w-8" />
    </div>;
  };

  // Get status label for design
  const getStatusLabel = (design: SavedDesign) => {
    if ((design as any).isSvg) return "SVG";
    if ((design as any).isJson) return "JSON";
    if ((design as any).wasFixed) return "Fixed";
    if ((design as any).hasParseError) return "Error (Fixed)";
    return design.category || "";
  };

  // Get badge styling based on data status
  const getStatusBadgeClass = (design: SavedDesign) => {
    if ((design as any).wasFixed) return "bg-amber-100 text-amber-800";
    if ((design as any).hasParseError) return "bg-red-100 text-red-800";
    if ((design as any).isSvg) return "bg-blue-100 text-blue-800";
    if ((design as any).isJson) return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-800";
  };

  const handleOpenDeleteDialog = (design: SavedDesign, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent design selection
    setSelectedDesign(design);
    setDeleteDialogOpen(true);
  };

  const handleOpenRenameDialog = (design: SavedDesign, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent design selection
    setSelectedDesign(design);
    setNewName(design.name);
    setRenameDialogOpen(true);
  };

  const handleDeleteDesign = async () => {
    if (!selectedDesign || !selectedDesign.id) return;

    try {
      const { error } = await supabase
        .from('designs')
        .delete()
        .eq('id', selectedDesign.id);

      if (error) {
        throw new Error(error.message);
      }

      setDesigns((prev) => prev.filter(d => d.id !== selectedDesign.id));
      toast({
        title: 'Design Deleted',
        description: `"${selectedDesign.name}" has been removed`
      });
    } catch (error) {
      console.error('Error deleting design:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the design',
        variant: 'destructive'
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedDesign(null);
    }
  };

  const handleRenameDesign = async () => {
    if (!selectedDesign || !selectedDesign.id || !newName.trim()) return;

    try {
      const { error } = await updateDesign(selectedDesign.id, {
        name: newName
      });

      if (error) {
        throw new Error(error.message);
      }

      setDesigns((prev) => prev.map(d =>
        d.id === selectedDesign.id
          ? { ...d, name: newName }
          : d
      ));

      toast({
        title: 'Design Updated',
        description: `Design has been renamed to "${newName}"`
      });
    } catch (error) {
      console.error('Error updating design:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the design',
        variant: 'destructive'
      });
    } finally {
      setRenameDialogOpen(false);
      setSelectedDesign(null);
      setNewName('');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
        <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold">Design Library</h2>
            <div className="flex items-center space-x-4">
              <MergeToggle enabled={mergeMode} onToggle={setMergeMode} />
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="p-4 border-b">
            <div className="flex items-center space-x-4">
              <div className="w-40">
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Collares">Collares</SelectItem>
                    <SelectItem value="Anillos">Anillos</SelectItem>
                    <SelectItem value="Pendientes">Pendientes</SelectItem>
                    <SelectItem value="Prototipos">Prototipos</SelectItem>
                    <SelectItem value="Paper(JPG)">Paper (JPG)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button variant="outline" size="sm" onClick={fetchDesigns}>
                Refresh
              </Button>
              
              {fixedCount > 0 && (
                <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  Auto-fixed {fixedCount} designs
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="mt-2 text-gray-500">Loading designs...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                <p>{error}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={fetchDesigns}>
                  Try Again
                </Button>
              </div>
            ) : designs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No designs found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {designs.map((design) => (
                  <Card
                    key={design.id}
                    className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleSelectDesign(design)}
                  >
                    <div className="aspect-square mb-2 border rounded flex items-center justify-center bg-gray-50 overflow-hidden">
                      {getPreviewContent(design)}
                    </div>
                    <h3 className="font-medium text-sm truncate">{design.name}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadgeClass(design)}`}>
                        {getStatusLabel(design)}
                      </span>
                      {(design as any).wasFixed && (
                        <span className="ml-1 text-xs text-amber-600">
                          (Auto-Fixed)
                        </span>
                      )}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => handleOpenRenameDialog(design, e)}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Edit design"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleOpenDeleteDialog(design, e)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete design"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Design</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDesign?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedDesign(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDesign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Design</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="name" className="text-right text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRenameDialogOpen(false);
              setSelectedDesign(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleRenameDesign} disabled={!newName.trim()}>
              Save changes
            </Button>
          </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
};

export default LibraryPanel;
