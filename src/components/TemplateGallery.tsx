// src/components/TemplateGallery.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Trash2, Heart, Edit, Loader2, Search, X, ExternalLink, Eye } from 'lucide-react'; // Añadido Eye
import {
  getTemplates,
  getTemplatesByCategory,
  // updateTemplate, // Parece no usarse aquí directamente (se usa en handleRename)
  deleteTemplate,
  likeTemplate, // La función que interactúa con la columna is_liked
  saveTemplate, // Necesario para renombrar/actualizar
  Template // El tipo actualizado con is_liked
} from '@/services/supabaseClient'; // Asegúrate que la ruta sea correcta
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns'; // formatDistanceToNow es útil
import { parseTemplateData } from '@/utils/svgExporter'; // Para previsualización o selección
// import { useAuth } from '@clerk/clerk-react'; // Eliminado ya que no hay usuarios

interface TemplateGalleryProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (templateData: string) => void; // Cambiado para pasar design_data directamente
}

const TemplateGallery: React.FC<TemplateGalleryProps> = ({ open, onClose, onSelectTemplate }) => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [newName, setNewName] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [isLiking, setIsLiking] = useState<Record<string, boolean>>({}); // Para feedback visual de carga en el botón like
  const [likedTemplates, setLikedTemplates] = useState<Record<string, boolean>>({}); // Estado local para UI de likes

  // Eliminado: No necesitamos user si es app personal
  // const { userId } = useAuth(); // O tu hook de autenticación

  // --- Función para Cargar Plantillas ---
  const fetchTemplates = useCallback(async (category = 'All') => {
    setIsLoading(true);
    try {
      let fetchedTemplates: Template[];
      if (category === 'All') {
        fetchedTemplates = await getTemplates();
      } else {
        fetchedTemplates = await getTemplatesByCategory(category);
      }
      setTemplates(fetchedTemplates);

      // --- CAMBIO AQUÍ: Inicializar estado likedTemplates ---
      const initialLikedState: Record<string, boolean> = {};
      const uniqueCategories = new Set<string>(['All']);
      fetchedTemplates.forEach(template => {
        // Usar el valor de la BD (o false si es null/undefined)
        initialLikedState[template.id] = template.is_liked ?? false;
        if (template.category) {
          uniqueCategories.add(template.category);
        }
      });
      setLikedTemplates(initialLikedState);
      // --- FIN CAMBIO ---

      // Actualizar categorías solo si estamos cargando 'All' para evitar bucles
      if (category === 'All') {
        setCategories(Array.from(uniqueCategories));
      }

    } catch (error: any) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Error Loading Templates",
        description: error.message || "Could not fetch templates from the database.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]); // Dependencia del toast

  // Cargar plantillas al montar y cuando cambia la categoría seleccionada
  useEffect(() => {
    if (open) { // Solo cargar si el diálogo está abierto
      fetchTemplates(selectedCategory);
    }
  }, [open, selectedCategory, fetchTemplates]); // fetchTemplates como dependencia

  // Filtrar plantillas según el término de búsqueda
  const filteredTemplates = useMemo(() => {
    if (!searchTerm) {
      return templates;
    }
    return templates.filter(template =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [templates, searchTerm]);

  // --- Manejadores de Acciones ---

  // Seleccionar una plantilla para usarla
  const handleSelect = (template: Template) => {
    console.log("Selected template:", template.name);
    // Pasamos directamente design_data que es el JSON stringified
    onSelectTemplate(template.design_data);
    onClose(); // Cerrar galería después de seleccionar
  };

  // Abrir diálogo de confirmación para borrar
  const openDeleteDialog = (template: Template) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
  };

  // Borrar plantilla
  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    setIsLoading(true); // Indicar carga durante borrado
    try {
      await deleteTemplate(selectedTemplate.id);
      toast({
        title: "Template Deleted",
        description: `"${selectedTemplate.name}" was successfully deleted.`,
      });
      // Volver a cargar plantillas de la categoría actual
      fetchTemplates(selectedCategory);
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast({
        title: "Error Deleting Template",
        description: error.message || "Could not delete the template.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
      setIsLoading(false);
    }
  };

  // Abrir diálogo para renombrar/editar
  const openRenameDialog = (template: Template) => {
    setSelectedTemplate(template);
    setNewName(template.name);
    setNewDescription(template.description || '');
    setRenameDialogOpen(true);
  };

  // Renombrar/Actualizar descripción de plantilla
  const handleRenameTemplate = async () => {
    if (!selectedTemplate || !newName.trim()) return;
    setIsLoading(true);
    try {
      // Llama a saveTemplate que maneja la actualización si el ID existe
      await saveTemplate({
        id: selectedTemplate.id,
        name: newName.trim(),
        description: newDescription.trim() || null, // Guardar null si está vacío
      });
      toast({
        title: "Template Updated",
        description: `Template "${newName}" updated successfully.`,
      });
      fetchTemplates(selectedCategory); // Recargar
    } catch (error: any) {
      console.error("Error updating template:", error);
      toast({
        title: "Error Updating Template",
        description: error.message || "Could not update the template.",
        variant: "destructive",
      });
    } finally {
      setRenameDialogOpen(false);
      setSelectedTemplate(null);
       setIsLoading(false);
    }
  };

  // Marcar/Desmarcar como "like" (MODIFICADO)
  const handleLike = async (template: Template) => {
    const templateId = template.id;
    setIsLiking(prev => ({ ...prev, [templateId]: true })); // Feedback visual

    // Estado previo para revertir si falla
    const previousLikedState = likedTemplates[templateId];
    // Actualización optimista de la UI
    setLikedTemplates(prev => ({ ...prev, [templateId]: !prev[templateId] }));

    try {
      // --- CAMBIO AQUÍ: Llamar a likeTemplate solo con templateId ---
      const result = await likeTemplate(templateId);
      // --- FIN CAMBIO ---

      if (!result.success) {
        // Si falla, revertir el estado local y mostrar error
        toast({
          title: "Error",
          description: "Could not update like status.",
          variant: "destructive",
        });
        setLikedTemplates(prev => ({ ...prev, [templateId]: previousLikedState }));
      } else {
        // --- CAMBIO AQUÍ: Usar newState para confirmar el estado ---
        // Si tiene éxito, confirma el estado local con el valor devuelto por la API
        console.log(`Like status for ${templateId} updated to ${result.newState}`);
        setLikedTemplates(prev => ({ ...prev, [templateId]: result.newState ?? false }));
        // Opcional: Mostrar toast de éxito
         toast({
           title: result.newState ? "Template Liked" : "Template Unliked",
           description: `"${template.name}" ${result.newState ? 'added to' : 'removed from'} favorites.`,
         });
        // --- FIN CAMBIO ---
      }
    } catch (error: any) {
      console.error("Error liking template:", error);
      // Revertir en caso de error inesperado
      setLikedTemplates(prev => ({ ...prev, [templateId]: previousLikedState }));
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLiking(prev => ({ ...prev, [templateId]: false })); // Quitar feedback visual
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>Template Gallery</DialogTitle>
          </DialogHeader>

          <div className="flex items-center px-6 py-4 border-b">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
              {searchTerm && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7" onClick={() => setSearchTerm('')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar de Categorías */}
            <aside className="w-48 border-r overflow-y-auto p-4">
              <h3 className="text-sm font-semibold mb-3 px-2">Categories</h3>
              <nav className="flex flex-col space-y-1">
                {categories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "secondary" : "ghost"}
                    className={`w-full justify-start text-sm h-8 ${selectedCategory === category ? 'font-semibold' : ''}`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </nav>
            </aside>

            {/* Grid de Plantillas */}
            <main className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  No templates found {searchTerm ? 'matching your search' : `in the "${selectedCategory}" category`}.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredTemplates.map((template) => (
                    <div key={template.id} className="border rounded-lg overflow-hidden group relative flex flex-col bg-card text-card-foreground shadow-sm">
                      {/* Imagen o Previsualización */}
                      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                         {template.thumbnail ? (
                            <img src={template.thumbnail} alt={template.name} className="object-contain h-full w-full" />
                         ) : (
                           <Eye className="h-12 w-12 text-muted-foreground opacity-50" /> // Icono placeholder
                         )}
                      </div>
                       {/* Contenido de Texto */}
                      <div className="p-3 flex flex-col flex-grow">
                        <h4 className="font-semibold text-sm truncate mb-1">{template.name}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2 flex-grow">{template.description || 'No description'}</p>
                        <p className="text-xs text-muted-foreground">
                          Updated {formatDistanceToNow(new Date(template.created_at || Date.now()), { addSuffix: true })}
                        </p>
                      </div>
                      {/* Acciones Hover */}
                       <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-4 space-y-2">
                         <Button size="sm" className="w-full" onClick={() => handleSelect(template)}>
                           Use Template
                         </Button>
                         <div className="flex w-full justify-center space-x-2">
                           <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => openRenameDialog(template)} title="Edit Name/Description">
                             <Edit className="h-4 w-4" />
                           </Button>
                           <Button
                             variant="secondary"
                             size="icon"
                             className="h-8 w-8"
                             onClick={() => handleLike(template)}
                             disabled={isLiking[template.id]}
                             title={likedTemplates[template.id] ? "Unlike" : "Like"} // --- CAMBIO AQUÍ: Usar estado likedTemplates ---
                           >
                             {isLiking[template.id] ? (
                               <Loader2 className="h-4 w-4 animate-spin" />
                             ) : (
                               <Heart
                                 className="h-4 w-4"
                                 // --- CAMBIO AQUÍ: Usar estado likedTemplates ---
                                 fill={likedTemplates[template.id] ? 'currentColor' : 'none'}
                                 stroke={likedTemplates[template.id] ? 'currentColor' : 'currentColor'}
                               />
                             )}
                           </Button>
                           <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => openDeleteDialog(template)} title="Delete Template">
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </main>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación para Borrar */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the template
              "{selectedTemplate?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedTemplate(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo para Renombrar/Editar */}
       <Dialog open={renameDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) { setRenameDialogOpen(false); setSelectedTemplate(null); } }}>
        <DialogContent>
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
                maxLength={50} // Limitar longitud del nombre
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
                placeholder="Add a short description (optional)"
                maxLength={100} // Limitar longitud descripción
              />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="category" className="text-right text-sm font-medium">
                Category
              </label>
              {/* Aquí podrías poner un <Select> si tienes categorías predefinidas */}
               <Input
                id="category"
                value={selectedTemplate?.category || ''}
                className="col-span-3"
                disabled // Por ahora no editable aquí, se podría añadir si se requiere
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
            <Button onClick={handleRenameTemplate} disabled={!newName.trim() || isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TemplateGallery;