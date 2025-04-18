// src/services/supabaseClient.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
// Asegúrate que SavedDesign y Template estén correctamente importados de tus tipos
import { SavedDesign, Template } from '@/types/bezier';
// Eliminé la importación de 'toast' de sonner ya que no se usa en este archivo

// --- Configuración del Cliente Supabase ---

// Log environment variables (sin exponer valores)
console.log('Supabase environment check:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'defined' : 'undefined',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'defined' : 'undefined',
  NEXT_PUBLIC_SUPABASE_URL: import.meta.env.NEXT_PUBLIC_SUPABASE_URL ? 'defined' : 'undefined',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'defined' : 'undefined'
});

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL ||
                 import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ||
                  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let isPlaceholder = false;

// Fallback a valores placeholder si las variables de entorno no están definidas
if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase URL or Key not found in environment variables. Using placeholders. Please configure .env file.");
  supabaseUrl = 'https://your-project-url.supabase.co';
  supabaseKey = 'your-public-anon-key';
  isPlaceholder = true;
} else {
   console.log(`Initializing Supabase client with URL: ${supabaseUrl}`);
}
console.log(`Using placeholder URL? ${isPlaceholder}`);

// Crear cliente Supabase
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Verificar conexión inicial y acceso a tablas (Opcional, pero útil para debug)
export const verifySupabaseConnection = async (): Promise<{ success: boolean; message: string; tableAccess?: { [key: string]: boolean } }> => {
  console.log('Verifying Supabase connection...');
  try {
     // Intenta una operación simple que requiera conexión, como listar funciones RPC (puede fallar si no hay RPCs públicos)
    // O intenta acceder a una tabla específica con un límite de 0 para solo verificar permisos
    const { error: designsError } = await supabase.from('designs').select('id').limit(0);
    const designsAccess = !designsError;
    if(designsError) console.warn("Could not verify access to 'designs' table:", designsError.message);

    const { error: templatesError } = await supabase.from('templates').select('id').limit(0);
    const templatesAccess = !templatesError;
     if(templatesError) console.warn("Could not verify access to 'templates' table:", templatesError.message);


    if (designsAccess && templatesAccess) {
      console.log('✅ Supabase API connection verified successfully');
      return { success: true, message: 'Connection successful.', tableAccess: { designs: designsAccess, templates: templatesAccess } };
    } else {
       throw new Error(`Failed to access required tables. Designs: ${designsAccess}, Templates: ${templatesAccess}`);
    }

  } catch (error: any) {
    console.error('❌ Supabase connection/access verification failed:', error);
    return { success: false, message: error.message || 'Unknown connection error', tableAccess: { designs: false, templates: false } };
  }
};


// --- Funciones relacionadas con Designs ---

// Obtener todos los diseños
export const getDesigns = async (): Promise<SavedDesign[]> => {
  console.log("Fetching all designs from Supabase..."); // Log para depuración
  const { data, error } = await supabase
    .from('designs')
    // --- CAMBIO APLICADO AQUÍ ---
    // Especificar columnas explícitamente, incluyendo 'original_svg'
    .select(`
      id,
      name,
      shapes_data,
      original_svg,
      thumbnail,
      updated_at,
      category,
      user_id
    `)
    // Ordenar por fecha de actualización descendente
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching designs:', error);
    // Devolver array vacío o lanzar error según prefieras
    return [];
  }
  console.log(`Workspaceed ${data?.length || 0} designs.`); // Log para depuración
  // Asegurarse que la data devuelta coincide con el tipo SavedDesign[]
  return data as SavedDesign[] || [];
};

// Obtener diseños por categoría
export const getDesignsByCategory = async (category: string): Promise<SavedDesign[]> => {
  console.log(`Workspaceing designs for category: ${category}`); // Log para depuración
  const { data, error } = await supabase
    .from('designs')
    // --- CAMBIO APLICADO AQUÍ ---
    // Especificar columnas explícitamente, incluyendo 'original_svg'
    .select(`
      id,
      name,
      shapes_data,
      original_svg,
      thumbnail,
      updated_at,
      category,
      user_id
    `)
    .eq('category', category) // Filtrar por categoría
    .order('updated_at', { ascending: false });

  if (error) {
    console.error(`Error fetching designs for category ${category}:`, error);
    return [];
  }
   console.log(`Workspaceed ${data?.length || 0} designs for category ${category}.`); // Log para depuración
  return data as SavedDesign[] || [];
};

// Guardar (Insertar o Actualizar) un diseño
// Acepta Partial<SavedDesign> para permitir pasar solo los campos necesarios
export const saveDesign = async (designData: Partial<SavedDesign>): Promise<SavedDesign | null> => {
  // Extraer ID para determinar si es inserción o actualización
  const { id, ...dataToSave } = designData;

  // Asegurarse de no enviar 'id' en el objeto de datos para inserción/actualización
  // Asegurarse que 'original_svg' no se envíe si no se proporciona explícitamente
  // (Normalmente, al guardar desde la app, solo envías 'name' y 'shapes_data')

  if (id) {
    // --- Actualizar diseño existente ---
    console.log(`Updating design with ID: ${id}`);
    const { data, error } = await supabase
      .from('designs')
      .update(dataToSave) // Pasa solo los campos a actualizar
      .eq('id', id)
      .select() // Devuelve la fila actualizada
      .single(); // Espera un solo resultado

    if (error) {
      console.error('Error updating design:', error);
      throw error; // Lanza el error para manejarlo en el componente
    }
    console.log("Design updated successfully:", data);
    return data as SavedDesign;

  } else {
    // --- Insertar nuevo diseño ---
    // Asegúrate que dataToSave tenga los campos mínimos requeridos por tu tabla (ej: name)
    console.log("Inserting new design:", dataToSave);
    const { data, error } = await supabase
      .from('designs')
      .insert(dataToSave) // Inserta los datos proporcionados
      .select() // Devuelve la fila insertada
      .single(); // Espera un solo resultado

    if (error) {
      console.error('Error inserting design:', error);
      throw error;
    }
    console.log("Design inserted successfully:", data);
    return data as SavedDesign;
  }
};


// Actualizar campos específicos de un diseño (podría fusionarse con saveDesign)
// export const updateDesign = async (id: string, updates: Partial<SavedDesign>) => {
//   console.log(`Patching design ID: ${id} with updates:`, updates);
//   const { data, error } = await supabase
//     .from('designs')
//     .update(updates)
//     .eq('id', id)
//     .select()
//     .single();
//   if (error) {
//     console.error('Error patching design:', error);
//     throw error;
//   }
//   return data;
// };

// Borrar un diseño
export const deleteDesign = async (id: string) => {
   console.log(`Deleting design with ID: ${id}`);
   const { error } = await supabase
     .from('designs')
     .delete()
     .eq('id', id);

   if (error) {
     console.error('Error deleting design:', error);
     throw error;
   }
   console.log("Design deleted successfully.");
   return true; // O devolver algo más si es necesario
};


// --- Funciones relacionadas con Templates ---

// Obtener todas las plantillas
export const getTemplates = async (): Promise<Template[]> => { // Asegúrate que Template esté definido en tipos
  const { data, error } = await supabase
    .from('templates')
    // Especificar columnas es buena práctica también aquí
    .select('id, name, design_data, category, created_at') // Ajusta según tu tipo Template
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
    return [];
  }
  return data as Template[] || [];
};

// Obtener plantillas por categoría
export const getTemplatesByCategory = async (category: string): Promise<Template[]> => {
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, design_data, category, created_at') // Ajusta según tu tipo Template
    .eq('category', category)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching templates for category ${category}:`, error);
    return [];
  }
  return data as Template[] || [];
};

// Guardar (Insertar o Actualizar) una plantilla
export const saveTemplate = async (templateData: Partial<Template>): Promise<Template | null> => {
  const { id, ...dataToSave } = templateData;
  if (id) {
    // Actualizar plantilla existente
    const { data, error } = await supabase
      .from('templates')
      .update(dataToSave)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('Error updating template:', error); throw error; }
    return data as Template;
  } else {
    // Insertar nueva plantilla
     const { data, error } = await supabase
      .from('templates')
      .insert(dataToSave)
      .select()
      .single();
    if (error) { console.error('Error inserting template:', error); throw error; }
    return data as Template;
  }
};

// Actualizar campos específicos de una plantilla (podría fusionarse con saveTemplate)
// export const updateTemplate = async (id: string, updates: Partial<Template>) => { ... };

// Borrar una plantilla
export const deleteTemplate = async (id: string) => {
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id);
  if (error) { console.error('Error deleting template:', error); throw error; }
  return true;
};