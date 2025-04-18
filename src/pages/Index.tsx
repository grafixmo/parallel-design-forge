import { useState, useEffect, useCallback } from 'react'; // Añadido useCallback si se usa
import {
  BezierObject,
  SavedDesign,
  DesignData,
  BackgroundImage, // Asegúrate que esté definido en bezier.ts
  // ...otros tipos necesarios de bezier.ts
} from '@/types/bezier'; // Ajusta la ruta si es necesario
import BezierCanvas from '@/components/BezierCanvas';
import Header from '@/components/Header';
import LibraryPanel from '@/components/LibraryPanel';
import ObjectControlsPanel from '@/components/ObjectControlsPanel';
import { useBezierObjects } from '@/hooks/useBezierObjects'; // Hook principal para manejar objetos
import { useToast } from '@/hooks/use-toast'; // Hook para notificaciones
import { saveDesign, saveTemplate, Template } from '@/services/supabaseClient'; // Servicios de Supabase
import { exportAsSVG, downloadSVG, importSVGFromString, parseTemplateData } from '@/utils/svgExporter'; // Utilidades SVG
// Importa helpers necesarios para cargar/validar objetos
import { generateId, validateAndRepairPoint, defaultCurveConfig, defaultTransform } from '@/utils/bezierUtils'; // Ajusta ruta si es necesario

// ELIMINADO: normalizeDesignData ya no es necesario con la nueva lógica de handleSelectDesign
// const normalizeDesignData = (data: any): string => { ... };

// ELIMINADO: convertToValidSVG ya no se usa en la lógica de carga de handleSelectDesign
// import { convertToValidSVG } from '@/utils/svgConverter';


const Index = () => {
  const { toast } = useToast();

  // --- State Hooks ---
  const [canvasWidth, setCanvasWidth] = useState<number>(800);
  const [canvasHeight, setCanvasHeight] = useState<number>(600);
  const [backgroundImage, setBackgroundImage] = useState<BackgroundImage | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(1); // Opacidad del fondo
  const [showLibrary, setShowLibrary] = useState<boolean>(false);
  const [currentDesignId, setCurrentDesignId] = useState<string | null>(null); // ID del diseño actual
  const [loading, setLoading] = useState<boolean>(false); // Estado de carga general
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(true); // Modo dibujo vs selección

  // Hook personalizado para manejar la lógica de los objetos Bézier (estado, historial, etc.)
  const {
    objects,
    setObjects,
    selectedObjectIds,
    setSelectedObjectIds,
    selectedObjects,
    handleCreateObject,
    handleSelectObject,
    handleObjectsChange, // Para actualizar puntos/manejadores desde BezierCanvas
    updateObjectCurveConfig,
    updateObjectTransform,
    deleteObjects: handleDeleteObject, // Renombrado para claridad si es necesario
    renameObject,
    resetHistory,
    saveCurrentState,
    undo,
    redo,
    canUndo,
    canRedo
  } = useBezierObjects(); // Inicialización del hook

  // --- Effects ---

  // Efecto para ajustar dimensiones del canvas al tamaño de la ventana (opcional)
  useEffect(() => {
    const handleResize = () => {
      // Ajusta esto si quieres que el canvas sea dinámico
      // setCanvasWidth(window.innerWidth);
      // setCanvasHeight(window.innerHeight - 50); // Ejemplo: altura ventana menos altura header
      console.log(`Canvas dimensions set to ${window.innerWidth}x${window.innerHeight}`); // O usa tus dimensiones fijas
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Llamada inicial
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Handlers ---

  // Guardar Diseño Actual en Supabase
  const handleSaveDesign = async (designName: string) => {
    if (!objects || objects.length === 0) {
      toast({ title: "Cannot Save", description: "Canvas is empty.", variant: "destructive" });
      return;
    }
    setLoading(true);
    console.log(`Saving design: ${designName}, ID: ${currentDesignId || '(new)'}`);

    // 1. Crear el objeto con la estructura interna de la app { objects: [...], backgroundImage: ... }
    const designData: DesignData = {
      objects: objects, // El array actual de BezierObjects del estado
      backgroundImage: backgroundImage // Incluir info de imagen de fondo
    };

    // 2. Convertir a cadena JSON para guardar en 'shapes_data'
    const shapesDataString = JSON.stringify(designData);

    // 3. Llamar al servicio para guardar en Supabase
    try {
      const dataToSave: Partial<SavedDesign> = {
        name: designName,
        shapes_data: shapesDataString,
        // 'original_svg' NO se establece aquí, se deja NULL/sin definir.
        // El ID se pasa solo si estamos actualizando un diseño existente
        ...(currentDesignId && { id: currentDesignId }),
      };

      console.log("Data being sent to saveDesign:", dataToSave);
      const saved = await saveDesign(dataToSave); // saveDesign debe aceptar Partial<SavedDesign>

      if (saved && saved.id) {
        setCurrentDesignId(saved.id); // Actualizar ID si era un diseño nuevo
        toast({ title: "Design Saved", description: `"${designName}" saved successfully.` });
        console.log("Design saved successfully with ID:", saved.id);
      } else {
          throw new Error('Failed to save design to database or received invalid response.');
      }
    } catch (error: any) {
      console.error("Error saving design:", error);
      toast({ title: "Save Failed", description: error.message || "Could not save design.", variant: "destructive" });
    } finally {
       setLoading(false);
    }
  };

  // Exportar Diseño Actual como SVG
  const handleExportSVG = () => {
    console.log("Exporting as SVG...");
    if (objects.length === 0) {
      toast({ title: "Cannot Export", description: "Canvas is empty.", variant: "destructive" });
      return;
    }
    try {
      // Usar dimensiones actuales del canvas para viewBox y tamaño
      const svgContent = exportAsSVG(objects, canvasWidth, canvasHeight, !!backgroundImage); // Decide si incluir fondo blanco
      downloadSVG(svgContent, 'my-bezier-design'); // Inicia la descarga
      toast({ title: "Exporting SVG", description: "Download should start shortly." });
    } catch (error: any) {
      console.error("Error exporting SVG:", error);
      toast({ title: "Export Failed", description: error.message || "Could not export SVG.", variant: "destructive" });
    }
  };

  // Cargar Diseño desde la Librería (FUNCIÓN MODIFICADA)
  const handleSelectDesign = async (design: SavedDesign) => {
    // Log inicial para depuración
    // Asegúrate que 'design' incluye 'original_svg' y 'shapes_data' del fetch
    console.log(`Selected design: ${design.name} (ID: ${design.id}), has original_svg: ${!!design.original_svg}, has shapes_data: ${!!design.shapes_data}`);
    setLoading(true); // Activar indicador de carga

    try {
      let loadedObjects: BezierObject[] = [];
      let loadedBackgroundImage: BackgroundImage | null = null;
      let source: string = ''; // Para saber de dónde se cargó

      // --- LÓGICA DE CARGA PRIORIZANDO original_svg ---
      if (design.original_svg && design.original_svg.trim() !== '') {
        // ===== Prioridad 1: Cargar desde la columna original_svg =====
        source = 'original_svg';
        console.log(`Loading design '${design.name}' from original_svg...`);
        // Llama a la función que parsea la cadena SVG a objetos BezierObject
        loadedObjects = importSVGFromString(design.original_svg);

        if (!loadedObjects || loadedObjects.length === 0) {
          // Error si importSVGFromString no devuelve objetos válidos
          throw new Error('Failed to import any objects from original_svg content.');
        }
        // Al importar desde SVG, normalmente no hay info de imagen de fondo guardada explícitamente
        loadedBackgroundImage = null;
        console.log(`Successfully imported ${loadedObjects.length} objects from original_svg.`);

      } else if (design.shapes_data) {
        // ===== Prioridad 2: Cargar desde shapes_data (esperando JSON) =====
        source = 'shapes_data (JSON)';
        console.log(`Loading design '${design.name}' from shapes_data (expecting JSON)...`);
        let parsedData: any;

        try {
          // Intenta parsear la cadena shapes_data como JSON
          parsedData = JSON.parse(design.shapes_data);
          console.log('Successfully parsed shapes_data as JSON.');
        } catch (e) {
          console.error(`Failed to parse shapes_data as JSON for design '${design.name}'. Content:`, design.shapes_data, e);
           throw new Error('Could not parse shapes_data as JSON.'); // Lanzar error si falla el parseo JSON
        }

        // Una vez parseado, busca la estructura { objects: [...] }
        if (parsedData && parsedData.objects && Array.isArray(parsedData.objects)) {
          source += ' - {objects} format';
          console.log('Found "objects" array in parsed shapes_data.');
          // Mapea los objetos cargados, validando/reparando puntos y aplicando defaults si faltan
          loadedObjects = parsedData.objects.map((obj: any) => ({
            ...obj, // Copia propiedades existentes
            id: obj.id || generateId(), // Asegura ID
            // Valida/repara cada punto en el array de puntos del objeto
            points: Array.isArray(obj.points) ? obj.points.map((p: any) => validateAndRepairPoint(p)) : [],
            curveConfig: obj.curveConfig || defaultCurveConfig(), // Aplica config por defecto si falta
            transform: obj.transform || defaultTransform(), // Aplica transform por defecto si falta
            isSelected: false // Asegura que no esté seleccionado al cargar
          })).filter((obj: BezierObject) => obj.points.length > 0); // Filtra objetos que queden sin puntos válidos

          // Carga la imagen de fondo si existe en los datos JSON
          loadedBackgroundImage = parsedData.backgroundImage || null;
          console.log(`Loaded ${loadedObjects.length} objects from shapes_data {objects} format. Background image ${loadedBackgroundImage ? 'found' : 'not found'}.`);

        }
        // Fallback para estructura antigua { points: [...] } (si aún quieres soportarla)
        else if (parsedData && parsedData.points && Array.isArray(parsedData.points)) {
           source += ' - legacy {points} format';
           console.warn('Found legacy format { points: [...] } in parsed shapes_data. Wrapping into a single object.');
           // Crea un único objeto BezierObject a partir de los puntos legacy
           const singleObject: BezierObject = {
               id: parsedData.id || generateId(), // Usa ID si existe, sino genera uno
               name: design.name || 'Imported Legacy Object', // Usa nombre del diseño
               points: parsedData.points.map((p: any) => validateAndRepairPoint(p)), // Valida los puntos
               curveConfig: parsedData.curveConfig || defaultCurveConfig(), // Aplica defaults
               transform: parsedData.transform || defaultTransform(), // Aplica defaults
               isSelected: false // No seleccionado
           };
           loadedObjects = [singleObject]; // El diseño cargado es este único objeto
           // Asumimos que este formato antiguo no guardaba imagen de fondo
           loadedBackgroundImage = null;
           console.log(`Loaded 1 object wrapped from legacy {points} format.`);

        } else {
          // El JSON parseado no tiene ninguna estructura reconocida
          console.error('Parsed shapes_data JSON does not contain "objects" array or recognizable legacy format. Parsed data:', parsedData);
          throw new Error('Invalid JSON structure in shapes_data.');
        }

      } else {
        // ===== Caso Error: No hay datos para cargar =====
        console.error(`Design '${design.name}' has no original_svg and no shapes_data.`);
        throw new Error('No data available to load this design.');
      }
      // --- FIN LÓGICA DE CARGA ---

      // --- Actualizar Estado de la Aplicación ---
      setObjects(loadedObjects); // Actualiza los objetos en el canvas
      setBackgroundImage(loadedBackgroundImage); // Actualiza la imagen de fondo
      setCurrentDesignId(design.id); // Guarda el ID del diseño actualmente cargado
      setSelectedObjectIds([]); // Limpia la selección al cargar un nuevo diseño
      resetHistory(); // Limpia el historial de deshacer/rehacer
      saveCurrentState(); // Guarda este estado inicial cargado como primer paso en el historial

      // Notificación de éxito
      toast({
        title: "Design Loaded",
        description: `Successfully loaded "${design.name}" from ${source}.`,
      });

    } catch (error: any) {
      // --- Manejo de Errores ---
      console.error(`Error loading design '${design.name}':`, error);
      toast({
        title: "Error Loading Design",
        description: error.message || `Failed to load "${design.name}".`,
        variant: "destructive",
      });
    } finally {
      // --- Finalizar Carga ---
      setLoading(false); // Desactivar indicador de carga
      setShowLibrary(false); // Ocultar el panel de la librería (si está abierto)
    }
  };


  // Cargar Plantilla (ejemplo, puede necesitar ajustes similares a handleSelectDesign)
  const handleLoadTemplate = async (template: Template) => {
     console.log("Loading template:", template.name);
     setLoading(true);
     try {
       // parseTemplateData intenta manejar JSON o SVG string
       const parsedTemplate = parseTemplateData(template.design_data);

       if (parsedTemplate && parsedTemplate.objects) {
         // Asume que parseTemplateData devuelve { objects: [...] }
         // Necesitaría validar/reparar puntos como en handleSelectDesign
         const validatedObjects = parsedTemplate.objects.map((obj: any) => ({
            ...obj,
            id: generateId(), // Generar nuevos IDs para objetos de plantilla
            points: Array.isArray(obj.points) ? obj.points.map((p: any) => validateAndRepairPoint(p)) : [],
            curveConfig: obj.curveConfig || defaultCurveConfig(),
            transform: obj.transform || defaultTransform(),
            isSelected: false,
         })).filter((obj: BezierObject) => obj.points.length > 0);

         setObjects(validatedObjects); // Reemplaza objetos actuales con los de la plantilla
         setBackgroundImage(parsedTemplate.backgroundImage || null); // Carga fondo si existe
         setCurrentDesignId(null); // Es un diseño nuevo basado en plantilla, sin ID guardado
         setSelectedObjectIds([]);
         resetHistory();
         saveCurrentState();
         toast({ title: "Template Loaded", description: `Loaded template "${template.name}".` });
       } else {
         throw new Error("Failed to parse or process template data.");
       }
     } catch (error: any) {
       console.error("Error loading template:", error);
       toast({ title: "Template Load Failed", description: error.message || "Could not load template.", variant: "destructive" });
     } finally {
       setLoading(false);
     }
  };

  // Guardar como Plantilla
  const handleSaveAsTemplate = async (templateName: string) => {
    if (!objects || objects.length === 0) {
      toast({ title: "Cannot Save", description: "Canvas is empty.", variant: "destructive" });
      return;
    }
     setLoading(true);
     try {
       const designData: DesignData = { objects: objects, backgroundImage: backgroundImage };
       const designDataString = JSON.stringify(designData);
       await saveTemplate({ name: templateName, design_data: designDataString });
       toast({ title: "Template Saved", description: `"${templateName}" saved successfully.` });
     } catch (error: any) {
       console.error("Error saving template:", error);
       toast({ title: "Template Save Failed", description: error.message || "Could not save template.", variant: "destructive" });
     } finally {
        setLoading(false);
     }
  };

  // Manejador para subida de imagen de fondo
   const handleUploadImage = (file: File) => {
     if (!file) return;
     const reader = new FileReader();
     reader.onload = (e) => {
       setBackgroundImage({ url: e.target?.result as string, opacity: backgroundOpacity, name: file.name });
       saveCurrentState(); // Guarda estado después de cambiar fondo
     };
     reader.readAsDataURL(file);
     toast({ title: "Background Image", description: `Set background to ${file.name}` });
   };

   // Manejador para quitar imagen de fondo
   const handleRemoveImage = () => {
     setBackgroundImage(null);
     saveCurrentState();
     toast({ title: "Background Image", description: "Background image removed." });
   };

   // Crear objeto vacío
   const handleCreateEmptyObject = () => {
     // Define puntos iniciales para un objeto simple (ej. una línea corta)
     const startX = canvasWidth / 2 - 50;
     const startY = canvasHeight / 2;
     const initialPoints: ControlPoint[] = [
       // Necesitas createControlPoint o definir la estructura completa
       { x: startX, y: startY, handleIn: { x: startX - 30, y: startY }, handleOut: { x: startX + 30, y: startY }, id: generateId() },
       { x: startX + 100, y: startY, handleIn: { x: startX + 100 - 30, y: startY }, handleOut: { x: startX + 100 + 30, y: startY }, id: generateId() }
     ];
     handleCreateObject(initialPoints); // Llama a la función del hook
     toast({ title: "Object Created", description: "Added a new empty object." });
   };


  // --- Renderizado del Componente ---
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Header
        onSave={handleSaveDesign}
        onExportSVG={handleExportSVG}
        onLoadDesign={() => setShowLibrary(true)} // Abre el panel de librería
        onLoadTemplate={handleLoadTemplate} // Asumiendo que Header tiene un botón para plantillas
        onSaveAsTemplate={handleSaveAsTemplate} // Asumiendo que Header tiene botón para guardar plantilla
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        isDrawingMode={isDrawingMode}
        onToggleDrawingMode={() => setIsDrawingMode(!isDrawingMode)}
        onCreateObject={handleCreateEmptyObject} // Botón para añadir objeto nuevo
        isLoading={loading} // Pasar estado de carga al Header
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Principal */}
        <div className="flex-1 relative bg-white">
          {loading && (
            <div className="absolute inset-0 bg-gray-400 bg-opacity-50 flex items-center justify-center z-50">
              <p className="text-white text-lg">Loading...</p> {/* Indicador de carga simple */}
            </div>
          )}
          <BezierCanvas
            width={canvasWidth}
            height={canvasHeight}
            objects={objects}
            selectedObjectIds={selectedObjectIds}
            onObjectSelect={handleSelectObject} // Permite seleccionar haciendo clic en el canvas
            onObjectsChange={handleObjectsChange} // Permite mover puntos/manejadores
            onCreateObject={(points) => handleCreateObject(points)} // Permite crear al dibujar (si aplica)
            onSaveState={saveCurrentState} // Guarda estado después de cambios en canvas
            backgroundImage={backgroundImage}
            backgroundOpacity={backgroundOpacity}
            isDrawingMode={isDrawingMode}
            // Pasar undo/redo aquí si el canvas los maneja directamente
            // onUndo={undo}
            // onRedo={redo}
          />
        </div>

        {/* Panel de Controles Laterales */}
        <div className="w-80 border-l overflow-y-auto bg-gray-50 p-4"> {/* Ancho fijo y estilos */}
          <ObjectControlsPanel
            selectedObjects={selectedObjects} // Objetos seleccionados para editar
            // allObjects={objects} // No siempre necesario pasar todos los objetos aquí
            // selectedObjectIds={selectedObjectIds} // Ya se derivan los selectedObjects
            onCreateObject={handleCreateEmptyObject} // Botón para crear objeto
            onSelectObject={handleSelectObject} // Para seleccionar desde el panel (si aplica)
            onDeleteObject={handleDeleteObject} // Botón para borrar selección
            onRenameObject={renameObject} // Para renombrar objeto seleccionado
            onUpdateCurveConfig={updateObjectCurveConfig} // Para cambiar estilos, paralelas, etc.
            onUpdateTransform={updateObjectTransform} // Para cambiar rotación, escala
            backgroundImage={backgroundImage}
            backgroundOpacity={backgroundOpacity}
            onBackgroundOpacityChange={setBackgroundOpacity} // Slider de opacidad
            onUploadImage={handleUploadImage} // Botón para subir imagen
            onRemoveImage={handleRemoveImage} // Botón para quitar imagen
          />
        </div>
      </div>

      {/* Panel Modal de Librería */}
      {showLibrary && (
        <LibraryPanel
          onClose={() => setShowLibrary(false)}
          onSelectDesign={handleSelectDesign} // Pasa la función de carga modificada
        />
      )}
    </div>
  );
};

export default Index;