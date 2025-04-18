// src/services/supabaseClient.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
// Asegúrate que los tipos estén actualizados en tu archivo de tipos
import { SavedDesign, Template } from '@/types/bezier'; // Ajusta la ruta si es necesario

// --- Configuración del Cliente Supabase ---
console.log('Supabase environment check:', { VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'defined' : 'undefined', VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'defined' : 'undefined', /* ...otros... */ });
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let isPlaceholder = false;
if (!supabaseUrl || !supabaseKey) { /* ... placeholders ... */ console.warn("Using placeholders."); } else { console.log(`Initializing Supabase client...`); }
export const supabase: SupabaseClient = createClient(supabaseUrl!, supabaseKey!);


// --- Funciones de Verificación (Opcional) ---
export const verifySupabaseConnection = async (): Promise<{ success: boolean; message: string; tableAccess?: { [key: string]: boolean } }> => {
  // ... (código de verificación igual) ...
  console.log('Verifying Supabase connection...');
  try {
    const { error: designsError } = await supabase.from('designs').select('id').limit(0);
    const designsAccess = !designsError;
    if(designsError) console.warn("Could not verify access to 'designs' table:", designsError.message);
    const { error: templatesError } = await supabase.from('templates').select('id').limit(0);
    const templatesAccess = !templatesError;
     if(templatesError) console.warn("Could not verify access to 'templates' table:", templatesError.message);
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

// Obtener todos los diseños
export const getDesigns = async (): Promise<SavedDesign[]> => {
  console.log("Fetching all designs from Supabase...");
  const { data, error } = await supabase
    .from('designs')
    .select(`id, name, shapes_data, original_svg, thumbnail, updated_at, category, user_id`) // Incluye original_svg
    .order('updated_at', { ascending: false });
  if (error) { console.error('Error fetching designs:', error); return []; }
  console.log(`Workspaceed ${data?.length || 0} designs.`);
  return data as SavedDesign[] || [];
};

// Obtener diseños por categoría
export const getDesignsByCategory = async (category: string): Promise<SavedDesign[]> => {
  console.log(`Workspaceing designs for category: ${category}`);
  const { data, error } = await supabase
    .from('designs')
    .select(`id, name, shapes_data, original_svg, thumbnail, updated_at, category, user_id`) // Incluye original_svg
    .eq('category', category)
    .order('updated_at', { ascending: false });
  if (error) { console.error(`Error fetching designs for category ${category}:`, error); return []; }
   console.log(`Workspaceed ${data?.length || 0} designs for category ${category}.`);
  return data as SavedDesign[] || [];
};

// Guardar (Insertar o Actualizar) un diseño
// Maneja ambos casos basado en si designData.id existe
export const saveDesign = async (designData: Partial<SavedDesign>): Promise<SavedDesign | null> => {
  const { id, ...dataToSave } = designData; // Separa el ID del resto de los datos
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

// La función updateDesign está comentada/eliminada
// /* export const updateDesign = ... */

// Borrar un diseño
export const deleteDesign = async (id: string) => {
   console.log(`Deleting design with ID: ${id}`);
   const { error } = await supabase.from('designs').delete().eq('id', id);
   if (error) { console.error('Error deleting design:', error); throw error; }
   console.log("Design deleted successfully.");
   return true;
};


// --- Funciones relacionadas con Templates ---
// ... (getTemplates, getTemplatesByCategory, saveTemplate, deleteTemplate, likeTemplate SIN CAMBIOS) ...
export const getTemplates = async (): Promise<Template[]> => {
  console.log("Fetching all templates...");
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, design_data, category, created_at, description, thumbnail, is_liked') // Incluye is_liked
    .order('created_at', { ascending: false });
  if (error) { console.error('Error fetching templates:', error); return []; }
  console.log(`Workspaceed ${data?.length || 0} templates.`);
  return data as Template[] || [];
};
export const getTemplatesByCategory = async (category: string): Promise<Template[]> => {
  console.log(`Workspaceing templates for category: ${category}`);
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, design_data, category, created_at, description, thumbnail, is_liked') // Incluye is_liked
    .eq('category', category)
    .order('created_at', { ascending: false });
  if (error) { console.error(`Error fetching templates for category ${category}:`, error); return []; }
  console.log(`Workspaceed ${data?.length || 0} templates for category ${category}.`);
  return data as Template[] || [];
};
export const saveTemplate = async (templateData: Partial<Template>): Promise<Template | null> => {
  const { id, ...dataToSave } = templateData;
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
export const deleteTemplate = async (id: string) => {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) { console.error('Error deleting template:', error); throw error; }
  return true;
};
export const likeTemplate = async (templateId: string): Promise<{ success: boolean; newState: boolean | null }> => {
  if (!templateId) { console.error("likeTemplate: templateId is required."); return { success: false, newState: null }; }
  console.log(`Attempting to toggle like for template ${templateId}`);
  try {
    const { data: currentTemplate, error: fetchError } = await supabase.from('templates').select('is_liked').eq('id', templateId).single();
    if (fetchError || !currentTemplate) throw fetchError || new Error('Template not found');
    const newStatus = !(currentTemplate.is_liked ?? false);
    const { error: updateError } = await supabase.from('templates').update({ is_liked: newStatus }).eq('id', templateId);
    if (updateError) throw updateError;
    console.log(`Toggled like for template ${templateId} successfully. New state: ${newStatus}`);
    return { success: true, newState: newStatus };
  } catch (error) {
    console.error("An error occurred in likeTemplate function:", error);
    return { success: false, newState: null };
  }
};