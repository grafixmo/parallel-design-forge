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
import { ScrollArea } from '@/components/ui/scroll-area'; // Importado
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
// Popover no se usa actualmente, pero lo dejamos por si acaso
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Trash2, Heart, Edit, Loader2, Search, X, ExternalLink } from 'lucide-react';
import {
  getTemplates,
  getTemplatesByCategory,
  updateTemplate,
  deleteTemplate,
  likeTemplate,
  Template
} from '@/services/supabaseClient'; // Asegúrate que la ruta es correcta
import { useToast } from '@/hooks/use-toast'; // Asegúrate que la ruta es correcta
import { format } from 'date-fns';
import { parseTemplateData } from '@/utils/svgExporter'; // Asegúrate que la ruta es correcta

interface TemplateGalleryProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (templateData: string) => void;
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
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Fetch templates when the gallery is opened or category changes
  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, activeCategory]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const response = activeCategory === 'all'
        ? await getTemplates()
        : await getTemplatesByCategory(activeCategory);

      if (response.error) {
        throw new Error(response.error.message);
      }

      setTemplates(response.data || []);
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
  };

  const handleSelectTemplate = (template: Template) => {
    try {
      const normalizedData = parseTemplateData(template.design_data);

      if (!normalizedData) {
        toast({
          title: 'Error',
          description: 'Unable to load template - invalid format',
          variant: 'destructive'
        });
        return;
      }

      onSelectTemplate(JSON.stringify(normalizedData));
      onClose();

      toast({
        title: 'Template Loaded',
        description: `"${template.name}" has been loaded to the canvas`
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
    e.stopPropagation();
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleOpenRenameDialog = (template: Template, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTemplate(template);
    setNewName(template.name);
    setNewDescription(template.description || '');
    setRenameDialogOpen(true);
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    try {
      return format(new Date(dateString), 'MMM d, yyyy'); // Formato de fecha ajustado
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return 'Invalid date';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(openState) => !openState && onClose()}>
        {/* Contenedor principal del diálogo con flex y altura máxima */}
        <DialogContent className="w-full max-w-5xl max-h-[80vh] flex flex-col">

          {/* Header: no se encoge */}
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl">Design Gallery</DialogTitle>
          </DialogHeader>

          {/* Controles (búsqueda, refresco): no se encogen */}
          <div className="flex items-center space-x-4 mb-4 flex-shrink-0 px-6 pt-4"> {/* Añadido padding similar a DialogHeader/Footer */}
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
                  className="absolute right-2.5 top-2.5 p-0.5" // Añadido padding pequeño al botón X
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <Button variant="outline" onClick={fetchTemplates}>
              Refresh
            </Button>
          </div>

          {/* Componente Tabs: ocupa espacio restante, flex column, oculta overflow */}
          <Tabs value={activeCategory} onValueChange={handleCategoryChange} className="flex-1 flex flex-col overflow-hidden px-6"> {/* Añadido padding horizontal */}

            {/* Lista de Tabs: no se encoge */}
            <TabsList className="mb-4 flex-shrink-0">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="Earrings">Earrings</TabsTrigger>
              <TabsTrigger value="Rings">Rings</TabsTrigger>
              <TabsTrigger value="Necklaces">Necklaces</TabsTrigger>
              <TabsTrigger value="Prototypes">Prototypes</TabsTrigger>
              <TabsTrigger value="Paper">Paper (JPG)</TabsTrigger>
            </TabsList>

            {/* Contenido de la Tab activa: ocupa espacio restante, oculta overflow */}
            <TabsContent value={activeCategory} className="flex-1 overflow-hidden">
               {/* Área de Scroll: ocupa toda la altura disponible */}
              <ScrollArea className="h-full pr-3"> {/* pr-3 para espacio barra scroll */}
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full py-10"> {/* Usar h-full y padding */}
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Loading templates...</p>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-10 text-center"> {/* Usar h-full y padding */}
                    <p className="text-muted-foreground mb-2">No templates found</p>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {searchQuery
                        ? 'Try a different search term or category.'
                        : 'Start by saving designs to your gallery.'}
                    </p>
                  </div>
                ) : (
                  // Grid dentro del ScrollArea
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4"> {/* Añadido padding bottom */}
                    {filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className="group border rounded-md p-3 hover:shadow-md transition-all cursor-pointer bg-card flex flex-col" // Usar bg-card
                      >
                        {/* Contenedor de la miniatura */}
                        <div className="aspect-video mb-2 bg-muted rounded flex items-center justify-center overflow-hidden relative"> {/* Usar bg-muted */}
                          {template.thumbnail ? (
                            <img
                              src={template.thumbnail}
                              alt={template.name}
                              className="w-full h-full object-contain"
                              loading="lazy" // Carga diferida para imágenes
                            />
                          ) : (
                            <ExternalLink className="h-8 w-8 text-muted-foreground" /> // Usar text-muted-foreground
                          )}
                          {/* Overlay al hacer hover */}
                          <div className="absolute inset-0 bg-black/60 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="text-xs font-medium text-white px-2 py-1 rounded">
                              Click to load
                            </span>
                          </div>
                        </div>

                        {/* Información del template */}
                        <div className="flex-1 space-y-1"> {/* Añadido space-y-1 */}
                          <h3 className="font-medium text-sm truncate" title={template.name}>{template.name}</h3>
                          {template.description && (
                            <p className="text-xs text-muted-foreground truncate" title={template.description}>
                              {template.description}
                            </p>
                          )}
                        </div>

                        {/* Acciones y metadatos */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t"> {/* Quitado border-gray-100, hereda de card */}
                          {/* Likes */}
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <button
                              onClick={(e) => handleLikeTemplate(template, e)}
                              className="text-muted-foreground hover:text-red-500 transition-colors p-1 -m-1" // Aumentar área de click
                              title="Like this template"
                            >
                              <Heart className="h-3.5 w-3.5" fill={template.likes && template.likes > 0 ? "currentColor" : "none"} />
                            </button>
                            <span className="tabular-nums">{template.likes || 0}</span> {/* Usar tabular-nums para números */}
                          </div>

                          {/* Botones de acción */}
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => handleOpenRenameDialog(template, e)}
                              className="text-muted-foreground hover:text-primary transition-colors p-1 -m-1" // Aumentar área de click
                              title="Edit template"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleOpenDeleteDialog(template, e)}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1 -m-1" // Aumentar área de click
                              title="Delete template"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Fecha */}
                        <div className="mt-1.5"> {/* Ajustado margen */}
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

          {/* Footer: no se encoge */}
          <DialogFooter className="mt-auto flex-shrink-0 pt-4 px-6 pb-6 border-t"> {/* Añadido padding y border */}
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Diálogos Modales (sin cambios) --- */}
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
                required // Campo requerido
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
                placeholder="(Optional)" // Placeholder más claro
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
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TemplateGallery;