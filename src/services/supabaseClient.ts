// src/services/supabaseClient.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
// Asegúrate que SavedDesign y Template estén correctamente importados de tus tipos
// ¡NECESITARÁS AÑADIR is_liked A LA INTERFAZ Template!
import { SavedDesign, Template } from '@/types/bezier';

// --- Configuración del Cliente Supabase ---
// ... (código de configuración igual que antes) ...
console.log('Supabase environment check:', { /* ... */ });
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let isPlaceholder = false;
if (!supabaseUrl || !supabaseKey) { /* ... placeholders ... */ } else { /* ... log ... */ }
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// --- Funciones de Verificación (Opcional) ---
export const verifySupabaseConnection = async (): Promise<{ success: boolean; message: string; tableAccess?: { [key: string]: boolean } }> => {
  // ... (puedes quitar el chequeo de template_likes si no existe) ...
  console.log('Verifying Supabase connection...');
  try {
    const { error: designsError } = await supabase.from('designs').select('id').limit(0);
    const designsAccess = !designsError;
    if(designsError) console.warn("Could not verify access to 'designs' table:", designsError.message);

    const { error: templatesError } = await supabase.from('templates').select('id').limit(0);
    const templatesAccess = !templatesError;
     if(templatesError) console.warn("Could not verify access to 'templates' table:", templatesError.message);

    // Quitado chequeo de template_likes

    if (designsAccess && templatesAccess) {
      console.log('✅ Supabase API connection verified successfully (designs, templates)');
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
// ... (getDesigns, getDesignsByCategory, saveDesign, deleteDesign SIN CAMBIOS, igual que la versión anterior) ...
export const getDesigns = async (): Promise<SavedDesign[]> => {
  console.log("Fetching all designs from Supabase...");
  const { data, error } = await supabase
    .from('designs')
    .select(`
      id, name, shapes_data, original_svg, thumbnail, updated_at, category, user_id
    `)
    .order('updated_at', { ascending: false });
  if (error) { console.error('Error fetching designs:', error); return []; }
  console.log(`Workspaceed ${data?.length || 0} designs.`);
  return data as SavedDesign[] || [];
};
export const getDesignsByCategory = async (category: string): Promise<SavedDesign[]> => {
  console.log(`Workspaceing designs for category: ${category}`);
  const { data, error } = await supabase
    .from('designs')
    .select(`
      id, name, shapes_data, original_svg, thumbnail, updated_at, category, user_id
    `)
    .eq('category', category)
    .order('updated_at', { ascending: false });
  if (error) { console.error(`Error fetching designs for category ${category}:`, error); return []; }
   console.log(`Workspaceed ${data?.length || 0} designs for category ${category}.`);
  return data as SavedDesign[] || [];
};
export const saveDesign = async (designData: Partial<SavedDesign>): Promise<SavedDesign | null> => {
  const { id, ...dataToSave } = designData;
  if (id) {
    console.log(`Updating design with ID: ${id}`);
    const { data, error } = await supabase.from('designs').update(dataToSave).eq('id', id).select().single();
    if (error) { console.error('Error updating design:', error); throw error; }
    console.log("Design updated successfully:", data);
    return data as SavedDesign;
  } else {
    console.log("Inserting new design:", dataToSave);
    const { data, error } = await supabase.from('designs').insert(dataToSave).select().single();
    if (error) { console.error('Error inserting design:', error); throw error; }
    console.log("Design inserted successfully:", data);
    return data as SavedDesign;
  }
};
export const deleteDesign = async (id: string) => {
   console.log(`Deleting design with ID: ${id}`);
   const { error } = await supabase.from('designs').delete().eq('id', id);
   if (error) { console.error('Error deleting design:', error); throw error; }
   console.log("Design deleted successfully.");
   return true;
};


// --- Funciones relacionadas con Templates ---

// Obtener todas las plantillas (¡Ahora selecciona is_liked!)
export const getTemplates = async (): Promise<Template[]> => {
  console.log("Fetching all templates...");
  const { data, error } = await supabase
    .from('templates')
    // --- CAMBIO AQUÍ: Añadir 'is_liked' ---
    .select('id, name, design_data, category, created_at, description, thumbnail, is_liked')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
    return [];
  }
  console.log(`Workspaceed ${data?.length || 0} templates.`);
  return data as Template[] || [];
};

// Obtener plantillas por categoría (¡Ahora selecciona is_liked!)
export const getTemplatesByCategory = async (category: string): Promise<Template[]> => {
  console.log(`Workspaceing templates for category: ${category}`);
  const { data, error } = await supabase
    .from('templates')
     // --- CAMBIO AQUÍ: Añadir 'is_liked' ---
    .select('id, name, design_data, category, created_at, description, thumbnail, is_liked')
    .eq('category', category)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching templates for category ${category}:`, error);
    return [];
  }
  console.log(`Workspaceed ${data?.length || 0} templates for category ${category}.`);
  return data as Template[] || [];
};

// Guardar (Insertar o Actualizar) una plantilla
// (No necesita cambios para 'is_liked', se maneja al insertar/actualizar explícitamente si es necesario
// o por el valor por defecto 'false' al insertar)
export const saveTemplate = async (templateData: Partial<Template>): Promise<Template | null> => {
  const { id, ...dataToSave } = templateData;
  // is_liked no se pasa normalmente aquí, se establece por defecto o se actualiza con likeTemplate
  if (id) {
    const { data, error } = await supabase.from('templates').update(dataToSave).eq('id', id).select().single();
    if (error) { console.error('Error updating template:', error); throw error; }
    return data as Template;
  } else {
     const { data, error } = await supabase.from('templates').insert(dataToSave).select().single();
    if (error) { console.error('Error inserting template:', error); throw error; }
    return data as Template;
  }
};

// Borrar una plantilla (Sin cambios)
export const deleteTemplate = async (id: string) => {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) { console.error('Error deleting template:', error); throw error; }
  return true;
};


// --- NUEVA FUNCIÓN 'likeTemplate' (Versión Simplificada) ---

/**
 * Cambia el estado 'is_liked' de una plantilla.
 * Obtiene el estado actual y lo actualiza al valor opuesto.
 * @param templateId El ID de la plantilla a marcar/desmarcar.
 * @returns Un objeto indicando si la operación fue exitosa y el nuevo estado de 'is_liked'.
 */
export const likeTemplate = async (templateId: string): Promise<{ success: boolean; newState: boolean | null }> => {
  if (!templateId) {
     console.error("likeTemplate: templateId is required.");
     return { success: false, newState: null };
  }

  console.log(`Attempting to toggle like for template ${templateId}`);

  try {
    // 1. Obtener el estado actual de 'is_liked'
    const { data: currentTemplate, error: fetchError } = await supabase
      .from('templates')
      .select('is_liked') // Solo necesitamos saber el estado actual
      .eq('id', templateId)
      .single(); // Esperamos encontrar la plantilla

    if (fetchError) {
      console.error("Error fetching current like status:", fetchError);
      throw fetchError;
    }
    if (!currentTemplate) {
        console.error(`Template with ID ${templateId} not found.`);
        throw new Error('Template not found');
    }

    // Determinar el estado actual y el nuevo estado (opuesto)
    const currentStatus = currentTemplate.is_liked ?? false; // Si es NULL, tratar como false
    const newStatus = !currentStatus;

    // 2. Actualizar la columna 'is_liked' al nuevo estado
    console.log(`Updating template ${templateId} is_liked status to ${newStatus}`);
    const { error: updateError } = await supabase
      .from('templates')
      .update({ is_liked: newStatus }) // Establece el nuevo valor booleano
      .eq('id', templateId);

    if (updateError) {
      console.error("Error updating like status:", updateError);
      throw updateError;
    }

    console.log(`Toggled like for template ${templateId} successfully. New state: ${newStatus}`);
    // Devolver éxito y el nuevo estado para que la UI pueda actualizarse
    return { success: true, newState: newStatus };

  } catch (error) {
    console.error("An error occurred in likeTemplate function:", error);
    return { success: false, newState: null }; // Indicar fallo general
  }
};

// --- FIN NUEVA FUNCIÓN ---