// src/components/LibraryPanel.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Importar Input para renombrar
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog, // Importar Dialog para renombrar
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose // Importar DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog, // Importar AlertDialog para borrar
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Tabs no se usa aquí
import { SavedDesign } from '@/types/bezier'; // Asegúrate que este tipo esté actualizado
// --- CAMBIO AQUÍ: Importar saveDesign y deleteDesign, eliminar updateDesign ---
import { getDesigns, getDesignsByCategory, saveDesign, deleteDesign } from '@/services/supabaseClient';
import { X, AlertTriangle, FileJson, FileText, Loader2, Edit, Trash2 } from 'lucide-react'; // Añadir iconos Edit, Trash2
// import { importSVGFromString } from '@/utils/svgExporter'; // No se usa aquí
import { useToast } from '@/hooks/use-toast';

interface LibraryPanelProps {
  onClose: () => void;
  onSelectDesign: (design: SavedDesign) => void; // Pasa el objeto completo al seleccionar
}

// Función auxiliar para determinar el tipo de contenido para el badge
const getDataType = (design: SavedDesign): 'SVG' | 'JSON' | 'Unknown' => {
    if (design.original_svg && design.original_svg.trim() !== '') return 'SVG';
    if (design.shapes_data) {
        try { JSON.parse(design.shapes_data); return 'JSON'; }
        catch (e) {
            if (design.shapes_data.includes('<svg') || design.shapes_data.startsWith('<?xml')) return 'SVG';
            return 'Unknown';
        }
    }
    return 'Unknown';
};
// Función auxiliar para obtener el texto del badge de estado
const getStatusLabel = (design: SavedDesign): string => { /* ... (igual que antes) ... */
    const type = getDataType(design);
    if (type === 'SVG') return 'SVG Source';
    if (type === 'JSON') return 'App Data';
    return 'Unknown Format';
};
// Función auxiliar para obtener la clase CSS del badge
const getStatusBadgeClass = (design: SavedDesign): string => { /* ... (igual que antes) ... */
    const type = getDataType(design);
    if (type === 'SVG') return 'bg-blue-100 text-blue-800';
    if (type === 'JSON') return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
};

const LibraryPanel: React.FC<LibraryPanelProps> = ({ onClose, onSelectDesign }) => {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true); // Para carga inicial
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false); // Para acciones (rename/delete)
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // --- Añadido: Estado para diálogos y diseño seleccionado ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState<boolean>(false);
  const [selectedDesign, setSelectedDesign] = useState<SavedDesign | null>(null);
  const [newName, setNewName] = useState<string>('');
  // --- Fin Estado Añadido ---

  const fetchDesigns = useCallback(async () => {
    console.log(`Workspaceing designs for category: ${selectedCategory}`);
    setIsLoading(true); // Usar isLoading para la carga inicial
    setError(null);
    try {
      const fetchedDesigns = selectedCategory === 'all'
        ? await getDesigns()
        : await getDesignsByCategory(selectedCategory);
      setDesigns(fetchedDesigns);
      if (selectedCategory === 'all') {
         const uniqueCategories = new Set<string>(['all']);
         fetchedDesigns.forEach(d => { if (d.category) uniqueCategories.add(d.category); });
         setCategories(Array.from(uniqueCategories));
      }
    } catch (err: any) {
      console.error("Error fetching designs:", err);
      setError(err.message || "Failed to load designs.");
      toast({ title: "Error", description: "Could not fetch designs.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, toast]);

  useEffect(() => {
    fetchDesigns();
  }, [fetchDesigns]);

  const handleSelectDesign = (design: SavedDesign) => {
    console.log(`Panel selected: ${design.name}`);
    onSelectDesign(design);
  };

  // --- Añadido: Funciones para abrir diálogos ---
  const openDeleteDialog = (design: SavedDesign, event: React.MouseEvent) => {
    event.stopPropagation(); // Evitar que el clic seleccione el diseño
    setSelectedDesign(design);
    setDeleteDialogOpen(true);
  };

  const openRenameDialog = (design: SavedDesign, event: React.MouseEvent) => {
    event.stopPropagation(); // Evitar que el clic seleccione el diseño
    setSelectedDesign(design);
    setNewName(design.name); // Pre-rellenar con nombre actual
    setRenameDialogOpen(true);
  };
  // --- Fin Funciones para abrir diálogos ---

  // --- Añadido: Función para borrar diseño ---
  const handleDeleteDesign = async () => {
    if (!selectedDesign || !selectedDesign.id) return;
    setIsProcessingAction(true); // Indicar acción en progreso
    try {
      await deleteDesign(selectedDesign.id);
      toast({
        title: "Design Deleted",
        description: `"${selectedDesign.name}" was successfully deleted.`,
      });
      fetchDesigns(); // Recargar la lista
    } catch (error: any) {
      console.error("Error deleting design:", error);
      toast({
        title: "Error Deleting Design",
        description: error.message || "Could not delete the design.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedDesign(null);
      setIsProcessingAction(false); // Finalizar acción
    }
  };
  // --- Fin Función para borrar diseño ---

  // --- Añadido: Función para renombrar diseño ---
  const handleRenameDesign = async () => {
    if (!selectedDesign || !selectedDesign.id || !newName.trim()) return;
    setIsProcessingAction(true); // Indicar acción en progreso
    try {
      // Llamar a saveDesign CON el ID para actualizar
      await saveDesign({ id: selectedDesign.id, name: newName.trim() });
      toast({
        title: "Design Renamed",
        description: `Design updated to "${newName.trim()}" successfully.`,
      });
      fetchDesigns(); // Recargar la lista
    } catch (error: any) {
      console.error("Error renaming design:", error);
      toast({
        title: "Error Renaming Design",
        description: error.message || "Could not rename the design.",
        variant: "destructive",
      });
    } finally {
      setRenameDialogOpen(false);
      setSelectedDesign(null);
      setNewName('');
      setIsProcessingAction(false); // Finalizar acción
    }
  };
  // --- Fin Función para renombrar diseño ---


  const getPreviewContent = (design: SavedDesign): React.ReactNode => { /* ... (igual que antes) ... */
    const type = getDataType(design);
    if (type === 'SVG') return <FileText className="w-10 h-10 text-gray-400" />;
    if (type === 'JSON') return <FileJson className="w-10 h-10 text-gray-400" />;
     return <AlertTriangle className="w-10 h-10 text-gray-400" />;
   };


  return (
    <> {/* Necesitamos Fragment para los diálogos fuera del div principal */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <Card className="w-full max-w-4xl h-[80vh] bg-white rounded-lg shadow-xl flex flex-col">
          {/* Encabezado */}
          <div className="flex justify-between items-center p-4 border-b shrink-0">
            <h2 className="text-lg font-semibold">Designs Library</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Filtro */}
          <div className="p-4 border-b shrink-0">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contenido Principal */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2">Loading designs...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">
                {/* ... (manejo de error igual) ... */}
                 <AlertTriangle className="w-10 h-10 mx-auto mb-2" />
                 <p>Error loading designs:</p>
                 <p className="text-sm text-red-500">{error}</p>
                 <Button onClick={fetchDesigns} className="mt-4">
                   Try Again
                 </Button>
              </div>
            ) : designs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                 {/* ... (mensaje no encontrado igual) ... */}
                 <p>No designs found {selectedCategory !== 'all' ? `in the "${selectedCategory}" category` : ''}.</p>
              </div>
            ) : (
              // Grid de diseños
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {designs.map((design) => (
                  <Card
                    key={design.id}
                    className="overflow-hidden hover:shadow-lg transition-shadow group flex flex-col"
                    // Quitado el onClick global para permitir click en botones
                  >
                    {/* Previsualización */}
                    <div
                      className="aspect-square border-b rounded-t flex items-center justify-center bg-gray-100 overflow-hidden relative cursor-pointer"
                      onClick={() => handleSelectDesign(design)} // Seleccionar al hacer clic en la imagen
                      title={`Load "${design.name}"`}
                    >
                      {getPreviewContent(design)}
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-white text-sm font-medium">Load</span>
                      </div>
                    </div>
                    {/* Detalles */}
                    <div className='p-2 flex-grow'>
                      <h3 className="font-medium text-sm truncate mb-1" title={design.name}>{design.name}</h3>
                      <div className="flex items-center mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${getStatusBadgeClass(design)}`}>
                          {getStatusLabel(design)}
                        </span>
                      </div>
                    </div>
                     {/* --- Añadido: Botones de Acción --- */}
                     <div className="p-1 border-t mt-auto flex justify-end space-x-1 opacity-50 group-hover:opacity-100 transition-opacity">
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Rename Design" onClick={(e) => openRenameDialog(design, e)}>
                           <Edit className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="Delete Design" onClick={(e) => openDeleteDialog(design, e)}>
                           <Trash2 className="h-4 w-4" />
                       </Button>
                     </div>
                     {/* --- Fin Botones de Acción --- */}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* --- Añadido: Diálogos de Confirmación/Edición --- */}

      {/* Diálogo de Confirmación para Borrar */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the design
              "{selectedDesign?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedDesign(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDesign} disabled={isProcessingAction}>
              {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo para Renombrar */}
      <Dialog open={renameDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) { setRenameDialogOpen(false); setSelectedDesign(null); setNewName(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Design</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="design-name" className="text-right text-sm font-medium">
                New Name
              </label>
              <Input
                id="design-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="col-span-3"
                maxLength={50} // Limitar longitud del nombre
                placeholder={selectedDesign?.name}
              />
            </div>
            {/* Podrías añadir inputs para otros campos como 'category' si quisieras editarlos aquí */}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleRenameDesign} disabled={!newName.trim() || isProcessingAction}>
              {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* --- Fin Diálogos Añadidos --- */}
    </>
  );
};

export default LibraryPanel;