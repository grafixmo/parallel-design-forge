import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, X, ExternalLink, Heart, Trash2, Edit } from 'lucide-react';
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

// Window size to limit visible templates for performance
const TEMPLATE_WINDOW_SIZE = 12;

const TemplateGallery: React.FC<TemplateGalleryProps> = ({ open, onClose, onSelectTemplate }) => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [displayedTemplates, setDisplayedTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [templateToLoad, setTemplateToLoad] = useState<Template | null>(null);
  
  // Refs for tracking timeouts and cancellation
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loaderCancelRef = useRef<(() => void) | null>(null);
  const templateContainerRef = useRef<HTMLDivElement>(null);
  
  // Debounced search for better performance
  const debouncedSearchRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fetch templates when the gallery is opened or category changes
  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
    
    // Clear all timeouts on unmount or category change
    return () => {
      clearAllTimeouts();
    };
  }, [open, activeCategory]);
  
  // Apply filtering with debouncing for better performance
  useEffect(() => {
    // Clear previous timeout
    if (debouncedSearchRef.current) {
      clearTimeout(debouncedSearchRef.current);
    }
    
    // Set new timeout for debounced search
    debouncedSearchRef.current = setTimeout(() => {
      filterTemplates();
    }, 300);
    
    return () => {
      if (debouncedSearchRef.current) {
        clearTimeout(debouncedSearchRef.current);
      }
    };
  }, [searchQuery, templates]);
  
  // Clean up all timeouts and intervals
  const clearAllTimeouts = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    if (debouncedSearchRef.current) {
      clearTimeout(debouncedSearchRef.current);
      debouncedSearchRef.current = null;
    }
    
    if (loaderCancelRef.current) {
      loaderCancelRef.current();
      loaderCancelRef.current = null;
    }
  };
  
  // Apply filtering logic to templates
  const filterTemplates = useCallback(() => {
    if (!searchQuery.trim()) {
      // No search term - just limit the number displayed for performance
      setDisplayedTemplates(templates.slice(0, TEMPLATE_WINDOW_SIZE));
      return;
    }
    
    const lowercaseQuery = searchQuery.toLowerCase();
    const filtered = templates.filter(template => 
      template.name.toLowerCase().includes(lowercaseQuery) ||
      (template.description && template.description.toLowerCase().includes(lowercaseQuery))
    ).slice(0, TEMPLATE_WINDOW_SIZE);
    
    setDisplayedTemplates(filtered);
  }, [searchQuery, templates]);
  
  // Handle scroll to load more templates on demand
  const handleTemplateScroll = useCallback(() => {
    if (!templateContainerRef.current) return;
    
    const container = templateContainerRef.current;
    const scrollPosition = container.scrollTop + container.clientHeight;
    const threshold = container.scrollHeight - 200;
    
    // Load more when scrolling near the bottom
    if (scrollPosition > threshold && displayedTemplates.length < templates.length) {
      const nextBatch = templates.slice(
        displayedTemplates.length, 
        displayedTemplates.length + TEMPLATE_WINDOW_SIZE
      );
      
      if (nextBatch.length > 0) {
        setDisplayedTemplates(prev => [...prev, ...nextBatch]);
      }
    }
  }, [displayedTemplates.length, templates]);
  
  // Add scroll event listener for template container
  useEffect(() => {
    const container = templateContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleTemplateScroll);
      return () => {
        container.removeEventListener('scroll', handleTemplateScroll);
      };
    }
  }, [handleTemplateScroll]);
  
  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const response = activeCategory === 'all' 
        ? await getTemplates() 
        : await getTemplatesByCategory(activeCategory);
        
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const fetchedTemplates = response.data || [];
      setTemplates(fetchedTemplates);
      
      // Only display the first batch for performance
      setDisplayedTemplates(fetchedTemplates.slice(0, TEMPLATE_WINDOW_SIZE));
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    setSearchQuery('');
  };
  
  const handleSelectTemplate = (template: Template) => {
    setTemplateToLoad(template);
    setLoadDialogOpen(true);
  };
  
  const confirmLoadTemplate = (shouldClearCanvas: boolean) => {
    if (!templateToLoad) return;
    
    try {
      // Clear any existing timeouts
      clearAllTimeouts();
      
      // Set loading state first
      setIsLoadingTemplate(true);
      setLoadingProgress(0);
      
      // Start a safety timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        clearAllTimeouts();
        setIsLoadingTemplate(false);
        setLoadDialogOpen(false);
        onClose();
        toast({
          title: 'Template Loading Timeout',
          description: 'Loading took too long. Try a simpler template.',
          variant: 'destructive'
        });
      }, 12000); // 12 second safety timeout
      
      loadTimeoutRef.current = timeout;
      
      // Fake progress updates for better UX
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          const newProgress = prev + (Math.random() * 3);
          return newProgress < 85 ? newProgress : 85;
        });
      }, 300);
      
      progressIntervalRef.current = progressInterval;
      
      // Add a small delay to allow UI to update before starting the potentially heavy operation
      setTimeout(() => {
        try {
          // Validate the template data - just check if it exists
          if (!templateToLoad.design_data) {
            throw new Error('Template contains no design data');
          }
          
          // Close the loading dialog and hand off to the parent component
          setLoadDialogOpen(false);
          
          // Sanitize design_data - ensure it's a string
          const sanitizedData = typeof templateToLoad.design_data === 'string' 
            ? templateToLoad.design_data
            : JSON.stringify(templateToLoad.design_data);
            
          // Call the parent's onSelectTemplate with the validated data
          onSelectTemplate(sanitizedData, shouldClearCanvas);
          
          // Update loading state
          setLoadingProgress(100);
          
          // Clear timeouts after successful handoff
          clearAllTimeouts();
          
          toast({
            title: 'Template Loaded',
            description: `"${templateToLoad.name}" has been loaded to the canvas`
          });
          
          // Close the gallery after a short delay
          setTimeout(() => {
            setTemplateToLoad(null);
            setIsLoadingTemplate(false);
            onClose();
          }, 500);
        } catch (error) {
          console.error('Error starting template load:', error);
          clearAllTimeouts();
          setIsLoadingTemplate(false);
          setLoadDialogOpen(false);
          
          toast({
            title: 'Error Loading Template',
            description: 'There was a problem with the template data format',
            variant: 'destructive'
          });
        }
      }, 100);
    } catch (error) {
      console.error('Error in confirmLoadTemplate:', error);
      clearAllTimeouts();
      setLoadDialogOpen(false);
      setTemplateToLoad(null);
      setIsLoadingTemplate(false);
      
      toast({
        title: 'Error Loading Template',
        description: 'Unexpected error occurred',
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
      
      // Update both templates lists
      const updatedTemplates = templates.filter(t => t.id !== selectedTemplate.id);
      setTemplates(updatedTemplates);
      setDisplayedTemplates(prev => prev.filter(t => t.id !== selectedTemplate.id));
      
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
      
      // Update both template arrays
      const updatedTemplates = templates.map(t => 
        t.id === selectedTemplate.id 
          ? { ...t, name: newName, description: newDescription } 
          : t
      );
      
      setTemplates(updatedTemplates);
      setDisplayedTemplates(prev => prev.map(t => 
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
      
      // Update both template arrays
      const updatedTemplates = templates.map(t => 
        t.id === template.id 
          ? { ...t, likes: (t.likes || 0) + 1 } 
          : t
      );
      
      setTemplates(updatedTemplates);
      setDisplayedTemplates(prev => prev.map(t => 
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
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  // Memoized template item to prevent unnecessary re-renders
  const TemplateItem = React.memo(({ template }: { template: Template }) => {
    return (
      <div 
        key={template.id}
        onClick={() => isLoadingTemplate ? null : handleSelectTemplate(template)}
        className={`group border rounded-md p-3 hover:shadow-md transition-all ${isLoadingTemplate ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} bg-white flex flex-col`}
      >
        <div className="aspect-video mb-2 bg-gray-100 rounded flex items-center justify-center overflow-hidden relative">
          {template.thumbnail ? (
            <img 
              src={template.thumbnail} 
              alt={template.name}
              className="w-full h-full object-contain"
              loading="lazy"
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
              onClick={(e) => {
                e.stopPropagation();
                if (!isLoadingTemplate) handleLikeTemplate(template, e);
              }}
              className={`text-muted-foreground hover:text-red-500 transition-colors ${isLoadingTemplate ? 'cursor-not-allowed opacity-70' : ''}`}
              title="Like this template"
              disabled={isLoadingTemplate}
            >
              <Heart className="h-3.5 w-3.5" fill={template.likes && template.likes > 0 ? "currentColor" : "none"} />
            </button>
            <span>{template.likes || 0}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (!isLoadingTemplate) handleOpenRenameDialog(template, e);
              }} 
              className={`text-muted-foreground hover:text-primary transition-colors ${isLoadingTemplate ? 'cursor-not-allowed opacity-70' : ''}`}
              title="Edit template"
              disabled={isLoadingTemplate}
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (!isLoadingTemplate) handleOpenDeleteDialog(template, e);
              }}
              className={`text-muted-foreground hover:text-destructive transition-colors ${isLoadingTemplate ? 'cursor-not-allowed opacity-70' : ''}`}
              title="Delete template"
              disabled={isLoadingTemplate}
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
    );
  });
  
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
  
  return (
    <>
      <Dialog open={open} onOpenChange={(open) => !open && !isLoadingTemplate && onClose()}>
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
            
            <div 
              ref={templateContainerRef}
              className="flex-1 overflow-auto"
            >
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-1">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="border rounded-md p-3 flex flex-col">
                      <Skeleton className="aspect-video mb-2 rounded w-full" />
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <div className="mt-auto pt-2 border-t border-gray-100">
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : displayedTemplates.length === 0 ? (
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
                  {displayedTemplates.map((template) => (
                    <TemplateItem key={template.id} template={template} />
                  ))}
                  
                  {/* Loading indicator at the bottom when more templates are available */}
                  {displayedTemplates.length < templates.length && (
                    <div className="col-span-full flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </Tabs>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={onClose} disabled={isLoading || isLoadingTemplate}>
              {isLoading || isLoadingTemplate ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isLoadingTemplate ? 'Loading template...' : 'Loading...'}
                </>
              ) : 'Close'}
            </Button>
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
      
      {/* Load confirmation dialog with improved loading state */}
      <AlertDialog open={loadDialogOpen} onOpenChange={(open) => !isLoadingTemplate && setLoadDialogOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load Template</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to replace the current canvas contents or add this template to the existing canvas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {isLoadingTemplate && (
            <div className="py-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Preparing template data... {Math.round(loadingProgress)}%
              </p>
            </div>
          )}
          
          <AlertDialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row">
            <AlertDialogCancel 
              onClick={() => {
                clearAllTimeouts();
                setLoadDialogOpen(false);
                setTemplateToLoad(null);
                setIsLoadingTemplate(false);
              }}
              disabled={isLoadingTemplate}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => confirmLoadTemplate(true)} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isLoadingTemplate}
            >
              {isLoadingTemplate ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Preparing...
                </>
              ) : 'Replace Canvas'}
            </AlertDialogAction>
            <AlertDialogAction 
              onClick={() => confirmLoadTemplate(false)}
              disabled={isLoadingTemplate}
            >
              {isLoadingTemplate ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Preparing...
                </>
              ) : 'Add to Canvas'}
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

export default React.memo(TemplateGallery);
