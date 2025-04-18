import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Trash2, Heart, Edit, Loader2, Search, X, ExternalLink, AlertTriangle, FileJson, FileText } from 'lucide-react';
import { getTemplates, getTemplatesByCategory, updateTemplate, deleteTemplate, likeTemplate, Template } from '@/services/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { parseTemplateData } from '@/utils/svgExporter';
import MergeToggle from './MergeToggle';
import { generateThumbnail } from '@/utils/thumbnailGenerator';

interface TemplateGalleryProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (templateData: string, merge?: boolean) => void;
}

// Define a type for the data format to ensure compatibility
type DataFormat = 'svg' | 'json' | 'invalid';

const TemplateGallery: React.FC<TemplateGalleryProps> = ({ open, onClose, onSelectTemplate }) => {
  // ... keep existing code (useState hooks and other declarations)
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [mergeEnabled, setMergeEnabled] = useState(false);
  const [fixedCount, setFixedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, activeCategory]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);
    setFixedCount(0);
    
    try {
      const response = activeCategory === 'all'
        ? await getTemplates()
        : await getTemplatesByCategory(activeCategory);

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(`Fetched ${response.data?.length || 0} templates`);
      
      const processedTemplates = await Promise.all((response.data || []).map(async (template) => {
        try {
          console.log(`Processing template: ${template.name}, ID: ${template.id || 'unknown'}`);
          
          let normalizedData: string = '';
          let dataFormat: DataFormat = 'invalid';
          let needsUpdate = false;
          
          // Validate and normalize template data
          if (typeof template.design_data === 'string') {
            normalizedData = template.design_data;
            
            if (normalizedData.trim().startsWith('<svg') || normalizedData.includes('<svg ')) {
              console.log(`Template ${template.name} contains SVG data`);
              dataFormat = 'svg';
            } else {
              try {
                JSON.parse(normalizedData);
                dataFormat = 'json';
                console.log(`Template ${template.name} contains valid JSON data`);
              } catch (parseError) {
                console.warn(`Template ${template.name} has invalid JSON data:`, parseError);
                
                normalizedData = JSON.stringify({ objects: [] });
                dataFormat = 'json';
                needsUpdate = true;
              }
            }
          } else if (typeof template.design_data === 'object' && template.design_data !== null) {
            try {
              normalizedData = JSON.stringify(template.design_data);
              dataFormat = 'json';
              needsUpdate = true;
            } catch (stringifyError) {
              console.error(`Error stringifying object for template ${template.name}:`, stringifyError);
              normalizedData = JSON.stringify({ objects: [] });
              dataFormat = 'json';
              needsUpdate = true;
            }
          } else {
            console.warn(`Template ${template.name} has invalid design_data`);
            normalizedData = JSON.stringify({ objects: [] });
            dataFormat = 'json';
            needsUpdate = true;
          }

          // Update template if needed
          if (template.id && needsUpdate) {
            try {
              const updateResult = await updateTemplate(template.id, {
                design_data: normalizedData
              });
              
              if (updateResult.error) {
                console.error(`Failed to fix template ${template.name}:`, updateResult.error);
              } else {
                console.log(`Successfully fixed template ${template.name}`);
                setFixedCount(prev => prev + 1);
              }
            } catch (updateError) {
              console.error(`Error updating template ${template.name}:`, updateError);
            }
          }

          // Generate thumbnail
          let thumbnail = '';
          try {
            if (normalizedData) {
              thumbnail = await generateThumbnail(normalizedData);
            }
          } catch (thumbnailError) {
            console.error(`Error generating thumbnail for template ${template.name}:`, thumbnailError);
          }

          return {
            ...template,
            design_data: normalizedData,
            isSvg: dataFormat === 'svg',
            isJson: dataFormat === 'json',
            isInvalid: dataFormat === 'invalid',
            wasFixed: needsUpdate,
            thumbnail
          };
        } catch (processError) {
          console.error(`Error processing template ${template.name}:`, processError);
          return {
            ...template,
            design_data: JSON.stringify({ objects: [] }),
            hasParseError: true,
            isInvalid: true
          };
        }
      }));

      console.log(`Processed ${processedTemplates.length} templates`);
      setTemplates(processedTemplates);
      
      if (fixedCount > 0) {
        toast({
          title: "Templates Updated",
          description: `Fixed ${fixedCount} templates with incorrect data format`
        });
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
      toast({
        title: "Error",
        description: "Failed to load templates. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ... keep existing code (handleCategoryChange, handleSelectTemplate, etc.)
  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
  };

  const handleSelectTemplate = (template: Template) => {
    try {
      // Parse and normalize the template data before using it
      const normalizedData = parseTemplateData(template.design_data);

      if (!normalizedData) {
        toast({
          title: 'Error',
          description: 'Unable to load template - invalid format',
          variant: 'destructive'
        });
        return;
      }

      // Pass the normalized data and merge flag to the parent component
      onSelectTemplate(JSON.stringify(normalizedData), mergeEnabled);
      onClose();

      toast({
        title: mergeEnabled ? 'Template Merged' : 'Template Loaded',
        description: `"${template.name}" has been ${mergeEnabled ? 'merged with' : 'loaded to'} the canvas`
      });
    } catch (error) {
      console.error('Error loading template:', error);
      toast({
        title: 'Error',
        description: 'Failed to load template data',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const { error } = await deleteTemplate(selectedTemplate.id!);

      if (error) {
        throw new Error(error.message);
      }

      setTemplates((prev) => prev.filter(t => t.id !== selectedTemplate.id));
      toast({
        title: 'Template Deleted',
        description: `"${selectedTemplate.name}" has been removed`
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the template',
        variant: 'destructive'
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
    }
  };

  const handleRenameTemplate = async () => {
    if (!selectedTemplate || !newName.trim()) return;

    try {
      const { error } = await updateTemplate(selectedTemplate.id!, {
        name: newName,
        description: newDescription
      });

      if (error) {
        throw new Error(error.message);
      }

      setTemplates((prev) => prev.map(t =>
        t.id === selectedTemplate.id
          ? { ...t, name: newName, description: newDescription }
          : t
      ));

      toast({
        title: 'Template Updated',
        description: `Template has been renamed to "${newName}"`
      });
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the template',
        variant: 'destructive'
      });
    } finally {
      setRenameDialogOpen(false);
      setSelectedTemplate(null);
      setNewName('');
      setNewDescription('');
    }
  };

  const handleLikeTemplate = async (template: Template, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent template selection

    try {
      const { error } = await likeTemplate(template.id!);

      if (error) {
        throw new Error(error.message);
      }

      setTemplates((prev) => prev.map(t =>
        t.id === template.id
          ? { ...t, likes: (t.likes || 0) + 1 }
          : t
      ));
    } catch (error) {
      console.error('Error liking template:', error);
      toast({
        title: 'Error',
        description: 'Failed to like the template',
        variant: 'destructive'
      });
    }
  };

  const handleOpenDeleteDialog = (template: Template, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent template selection
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleOpenRenameDialog = (template: Template, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent template selection
    setSelectedTemplate(template);
    setNewName(template.name);
    setNewDescription(template.description || '');
    setRenameDialogOpen(true);
  };

  const getPreviewContent = (template: Template) => {
    if ((template as any).thumbnail) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <img 
            src={(template as any).thumbnail} 
            alt={template.name} 
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    }
    
    if ((template as any).isSvg) {
      return (
        <div className="flex items-center justify-center text-blue-300">
          <FileText className="h-8 w-8" />
        </div>
      );
    }
    
    if ((template as any).isJson) {
      return (
        <div className="flex items-center justify-center text-green-300">
          <FileJson className="h-8 w-8" />
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center text-red-300">
        <AlertTriangle className="h-8 w-8" />
      </div>
    );
  };

  const getStatusLabel = (template: Template) => {
    if ((template as any).isSvg) return "SVG";
    if ((template as any).isJson) return "JSON";
    if ((template as any).wasFixed) return "Fixed";
    if ((template as any).hasParseError) return "Error (Fixed)";
    return template.category || "";
  };

  const getStatusBadgeClass = (template: Template) => {
    if ((template as any).wasFixed) return "bg-amber-100 text-amber-800";
    if ((template as any).hasParseError) return "bg-red-100 text-red-800";
    if ((template as any).isSvg) return "bg-blue-100 text-blue-800";
    if ((template as any).isJson) return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-800";
  };

  // Filter templates by search query
  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };

  // ... keep existing code (render method)
  return (
    <>
      <Dialog open={open} onOpenChange={(openState) => !openState && onClose()}>
        {/* Fixed DialogContent with explicit height instead of just max-height */}
        <DialogContent className="w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl">Design Gallery</DialogTitle>
          </DialogHeader>

          {/* Search and controls container */}
          <div className="flex items-center space-x-4 mb-4 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <button
                  className="absolute right-2.5 top-2.5"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <MergeToggle enabled={mergeEnabled} onToggle={setMergeEnabled} />
            <Button variant="outline" onClick={fetchTemplates}>
              Refresh
            </Button>
          </div>

          {/* Added h-full to Tabs to ensure it takes available space */}
          <Tabs 
            value={activeCategory} 
            onValueChange={handleCategoryChange}

            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            <TabsList className="mb-4 flex-shrink-0">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="Earrings">Earrings</TabsTrigger>
              <TabsTrigger value="Rings">Rings</TabsTrigger>
              <TabsTrigger value="Necklaces">Necklaces</TabsTrigger>
              <TabsTrigger value="Prototypes">Prototypes</TabsTrigger>
              <TabsTrigger value="Paper">Paper (JPG)</TabsTrigger>
            </TabsList>

            {/* Added h-full to TabsContent */}
            <TabsContent value={activeCategory} className="flex-1 h-full overflow-hidden">
              {/* Updated ScrollArea to take full height and width */}
              <ScrollArea className="h-full w-full pr-3">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Loading templates...</p>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <p className="text-muted-foreground mb-2">No templates found</p>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {searchQuery
                        ? 'Try a different search term or category'
                        : 'Start by saving designs to your gallery'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                    {filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className="group border rounded-md p-3 hover:shadow-md transition-all cursor-pointer bg-white flex flex-col"
                      >
                        <div className="aspect-video mb-2 bg-gray-100 rounded flex items-center justify-center overflow-hidden relative">
                          {template.thumbnail ? (
                            <img
                              src={template.thumbnail}
                              alt={template.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <ExternalLink className="h-8 w-8 text-gray-300" />
                          )}
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="text-xs font-medium text-white bg-black bg-opacity-70 px-2 py-1 rounded">
                              Click to load
                            </span>
                          </div>
                        </div>

                        <div className="flex-1">
                          <h3 className="font-medium text-sm truncate" title={template.name}>{template.name}</h3>
                          {template.description && (
                            <p className="text-xs text-gray-500 truncate mt-1" title={template.description}>
                              {template.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <button
                              onClick={(e) => handleLikeTemplate(template, e)}
                              className="text-muted-foreground hover:text-red-500 transition-colors"
                              title="Like this template"
                            >
                              <Heart className="h-3.5 w-3.5" fill={template.likes && template.likes > 0 ? "currentColor" : "none"} />
                            </button>
                            <span>{template.likes || 0}</span>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => handleOpenRenameDialog(template, e)}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="Edit template"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleOpenDeleteDialog(template, e)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete template"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(template.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 flex-shrink-0">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedTemplate(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename/edit dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
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
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="description" className="text-right text-sm font-medium">
                Description
              </label>
              <Input
                id="description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="col-span-3"
                placeholder="Add a short description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRenameDialogOpen(false);
              setSelectedTemplate(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleRenameTemplate} disabled={!newName.trim()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TemplateGallery;
