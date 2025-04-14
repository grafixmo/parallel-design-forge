
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
import { Trash2, Heart, Edit, Loader2, Search, X, ExternalLink, AlertTriangle } from 'lucide-react';
import { 
  getTemplates, 
  getTemplatesByCategory, 
  updateTemplate, 
  deleteTemplate,
  likeTemplate,
  Template 
} from '@/services/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface TemplateGalleryProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (templateData: string, shouldClearCanvas: boolean) => void;
}

const TemplateGallery: React.FC<TemplateGalleryProps> = ({ open, onClose, onSelectTemplate }) => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [templateToLoad, setTemplateToLoad] = useState<Template | null>(null);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  
  // Fetch templates when the gallery is opened or category changes
  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, activeCategory]);
  
  // Cleanup effect when gallery is closed
  useEffect(() => {
    if (!open) {
      // Reset state to avoid memory leaks and stale data
      setSelectedTemplate(null);
      setLoadDialogOpen(false);
      setDeleteDialogOpen(false);
      setRenameDialogOpen(false);
      setTemplateToLoad(null);
      setTemplateLoadError(null);
      setLoadingTemplate(false);
    }
  }, [open]);
  
  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const response = activeCategory === 'all' 
        ? await getTemplates() 
        : await getTemplatesByCategory(activeCategory);
        
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      // Process templates - ensure they have valid thumbnails and other required properties
      const validTemplates = (response.data || []).map(template => ({
        ...template,
        // Ensure the thumbnail exists, otherwise use a placeholder
        thumbnail: template.thumbnail || 'placeholder.svg',
        // Ensure likes property is defined
        likes: template.likes || 0
      }));
      
      setTemplates(validTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load templates. Please try again.',
        variant: 'destructive'
      });
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
  };
  
  const handleSelectTemplate = (template: Template) => {
    // Clear any previous errors
    setTemplateLoadError(null);
    setTemplateToLoad(template);
    setLoadDialogOpen(true);
  };
  
  const confirmLoadTemplate = async (shouldClearCanvas: boolean) => {
    if (!templateToLoad) return;
    
    try {
      setLoadingTemplate(true);
      
      // Validate the design data before passing it to onSelectTemplate
      if (!templateToLoad.design_data) {
        throw new Error("Template has no design data");
      }
      
      // Simple validation check
      const parsedData = JSON.parse(templateToLoad.design_data);
      if (!Array.isArray(parsedData)) {
        throw new Error("Invalid template format");
      }
      
      onSelectTemplate(templateToLoad.design_data, shouldClearCanvas);
      onClose();
      
      toast({
        title: 'Template Loaded',
        description: `"${templateToLoad.name}" has been loaded to the canvas`
      });
    } catch (error) {
      console.error('Error loading template:', error);
      setTemplateLoadError(error instanceof Error ? error.message : 'Unknown error loading template');
      
      toast({
        title: 'Error Loading Template',
        description: 'There was a problem processing the template data',
        variant: 'destructive'
      });
    } finally {
      setLoadingTemplate(false);
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
  
  return (
    <>
      <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-full max-w-5xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">Design Gallery</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center space-x-4 mb-4">
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
            <Button variant="outline" onClick={fetchTemplates}>
              Refresh
            </Button>
          </div>
          
          <Tabs value={activeCategory} onValueChange={handleCategoryChange} className="flex-1 flex flex-col">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="Earrings">Earrings</TabsTrigger>
              <TabsTrigger value="Rings">Rings</TabsTrigger>
              <TabsTrigger value="Necklaces">Necklaces</TabsTrigger>
              <TabsTrigger value="Prototypes">Prototypes</TabsTrigger>
              <TabsTrigger value="Paper">Paper (JPG)</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-auto">
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-1">
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
                            onError={(e) => {
                              // Fallback for broken image links
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
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
            </div>
          </Tabs>
          
          <DialogFooter className="mt-4">
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
      
      {/* Load confirmation dialog */}
      <AlertDialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load Template</AlertDialogTitle>
            <AlertDialogDescription>
              {templateLoadError ? (
                <div className="text-destructive flex items-start space-x-2 my-2">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span>{templateLoadError}</span>
                </div>
              ) : (
                <>
                  Do you want to replace the current canvas contents or add this template to the existing canvas?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row">
            <AlertDialogCancel onClick={() => {
              setLoadDialogOpen(false);
              setTemplateToLoad(null);
              setTemplateLoadError(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => confirmLoadTemplate(true)} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!templateLoadError || loadingTemplate}
            >
              {loadingTemplate ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Replace Canvas'
              )}
            </AlertDialogAction>
            <AlertDialogAction 
              onClick={() => confirmLoadTemplate(false)}
              disabled={!!templateLoadError || loadingTemplate}
            >
              {loadingTemplate ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Add to Canvas'
              )}
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
