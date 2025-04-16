import { createClient } from '@supabase/supabase-js';
import { SavedDesign } from '../types/bezier';

const supabaseUrl = 'https://nwrihwenctfimyjcbcal.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cmlod2VuY3RmaW15amNiY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwNzUxNjMsImV4cCI6MjA1NzY1MTE2M30.fXmf6GUUn0OaEmisInSUP2oBlP2oBGhMSBOSx8HYI2k';

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to ensure design data is properly formatted
const normalizeDesignData = (design: SavedDesign): SavedDesign => {
  try {
    console.log(`Normalizing design: ${design.name}, shapes_data type: ${typeof design.shapes_data}`);
    
    const normalizedDesign = { ...design };
    
    // Ensure shapes_data is a string
    if (normalizedDesign.shapes_data !== undefined) {
      if (typeof normalizedDesign.shapes_data !== 'string') {
        console.log(`Converting non-string shapes_data to string for design: ${design.name}`);
        // If it's an object, stringify it
        normalizedDesign.shapes_data = JSON.stringify(normalizedDesign.shapes_data);
      } else {
        // If it's already a string, verify it's valid JSON (unless it's SVG)
        const trimmedData = normalizedDesign.shapes_data.trim();
        if (!trimmedData.startsWith('<svg') && !trimmedData.includes('<svg ')) {
          try {
            // Test parse (we don't keep the result, just checking validity)
            JSON.parse(normalizedDesign.shapes_data);
          } catch (parseError) {
            console.error(`Invalid JSON string in shapes_data for design: ${design.name}`, parseError);
            // Replace with empty valid JSON if corrupted
            normalizedDesign.shapes_data = JSON.stringify({ objects: [] });
          }
        }
      }
    } else {
      // If shapes_data is undefined, initialize with empty valid JSON
      normalizedDesign.shapes_data = JSON.stringify({ objects: [] });
    }
    
    return normalizedDesign;
  } catch (error) {
    console.error("Error in normalizeDesignData:", error);
    // Return a safe default if anything goes wrong
    return {
      ...design,
      shapes_data: JSON.stringify({ objects: [] })
    };
  }
};

// Original functions (modified to ensure data consistency)
export const saveDesign = async (design: SavedDesign): Promise<{ data: any; error: any }> => {
  try {
    console.log(`Saving design: ${design.name}, shapes_data type before normalization: ${typeof design.shapes_data}`);
    const normalizedDesign = normalizeDesignData(design);
    console.log(`Design normalized, shapes_data type after normalization: ${typeof normalizedDesign.shapes_data}`);
    
    const { data, error } = await supabase
      .from('designs')
      .insert([normalizedDesign])
      .select();
    
    if (error) {
      console.error("Supabase error when saving design:", error);
    }
    
    return { data, error };
  } catch (error) {
    console.error("Error in saveDesign:", error);
    return { data: null, error };
  }
};

// New function to update an existing design
export const updateDesign = async (id: string, updates: Partial<SavedDesign>): Promise<{ data: any; error: any }> => {
  try {
    console.log(`Updating design with ID: ${id}, shapes_data type before processing: ${typeof updates.shapes_data}`);
    
    // Create a normalized version of the updates
    const normalizedUpdates: Partial<SavedDesign> = { ...updates };
    
    // Make sure shapes_data is a string if present
    if (updates.shapes_data !== undefined) {
      if (typeof updates.shapes_data !== 'string') {
        console.log(`Converting object shapes_data to string for design update ID: ${id}`);
        normalizedUpdates.shapes_data = JSON.stringify(updates.shapes_data);
      } else {
        // Verify it's valid JSON (unless it's SVG)
        const trimmedData = updates.shapes_data.trim();
        if (!trimmedData.startsWith('<svg') && !trimmedData.includes('<svg ')) {
          try {
            // Test parse to verify JSON validity
            JSON.parse(updates.shapes_data);
          } catch (parseError) {
            console.error(`Invalid JSON in shapes_data for design update ID: ${id}`, parseError);
            // Don't update shapes_data if JSON is invalid
            delete normalizedUpdates.shapes_data;
          }
        }
      }
    }
    
    const { data, error } = await supabase
      .from('designs')
      .update(normalizedUpdates)
      .eq('id', id)
      .select();
    
    if (error) {
      console.error("Supabase error when updating design:", error);
    }
    
    return { data, error };
  } catch (error) {
    console.error("Error in updateDesign:", error);
    return { data: null, error };
  }
};

export const getDesigns = async (): Promise<{ data: SavedDesign[] | null; error: any }> => {
  const { data, error } = await supabase
    .from('designs')
    .select('*')
    .order('created_at', { ascending: false });
    
  return { data, error };
};

export const getDesignsByCategory = async (category: string): Promise<{ data: SavedDesign[] | null; error: any }> => {
  const { data, error } = await supabase
    .from('designs')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false });
    
  return { data, error };
};

// New functions for Templates table
export interface Template {
  id?: string;
  name: string;
  category: string;
  design_data: string; // JSON stringified data
  description?: string;
  likes?: number;
  thumbnail?: string;
  created_at?: string;
}

// Normalize template data similar to design data
const normalizeTemplateData = (template: Template): Template => {
  try {
    const normalizedTemplate = { ...template };
    
    // Ensure design_data is a string
    if (normalizedTemplate.design_data !== undefined) {
      if (typeof normalizedTemplate.design_data !== 'string') {
        // If it's an object, stringify it
        normalizedTemplate.design_data = JSON.stringify(normalizedTemplate.design_data);
      } else {
        // If it's already a string, verify it's valid JSON (unless it's SVG)
        const trimmedData = normalizedTemplate.design_data.trim();
        if (!trimmedData.startsWith('<svg') && !trimmedData.includes('<svg ')) {
          try {
            // Test parse (we don't keep the result, just checking validity)
            JSON.parse(normalizedTemplate.design_data);
          } catch (parseError) {
            console.error(`Invalid JSON string in design_data for template: ${template.name}`, parseError);
            // Replace with empty valid JSON if corrupted
            normalizedTemplate.design_data = JSON.stringify({ objects: [] });
          }
        }
      }
    } else {
      // If design_data is undefined, initialize with empty valid JSON
      normalizedTemplate.design_data = JSON.stringify({ objects: [] });
    }
    
    return normalizedTemplate;
  } catch (error) {
    console.error("Error in normalizeTemplateData:", error);
    // Return a safe default if anything goes wrong
    return {
      ...template,
      design_data: JSON.stringify({ objects: [] })
    };
  }
};

// Save a template with normalized data
export const saveTemplate = async (template: Template): Promise<{ data: any; error: any }> => {
  try {
    const normalizedTemplate = normalizeTemplateData(template);
    
    const { data, error } = await supabase
      .from('templates')
      .insert([normalizedTemplate])
      .select();
    
    if (error) {
      console.error("Supabase error when saving template:", error);
    }
    
    return { data, error };
  } catch (error) {
    console.error("Error in saveTemplate:", error);
    return { data: null, error };
  }
};

// Get all templates
export const getTemplates = async (): Promise<{ data: Template[] | null; error: any }> => {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });
    
  return { data, error };
};

// Get templates by category
export const getTemplatesByCategory = async (category: string): Promise<{ data: Template[] | null; error: any }> => {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false });
    
  return { data, error };
};

// Get a specific template by ID
export const getTemplateById = async (id: string): Promise<{ data: Template | null; error: any }> => {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single();
    
  return { data, error };
};

// Update a template
export const updateTemplate = async (id: string, updates: Partial<Template>): Promise<{ data: any; error: any }> => {
  const { data, error } = await supabase
    .from('templates')
    .update(updates)
    .eq('id', id)
    .select();
    
  return { data, error };
};

// Delete a template
export const deleteTemplate = async (id: string): Promise<{ data: any; error: any }> => {
  const { data, error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id);
    
  return { data, error };
};

// Like a template (increment likes)
export const likeTemplate = async (id: string): Promise<{ data: any; error: any }> => {
  const { data: template, error: fetchError } = await supabase
    .from('templates')
    .select('likes')
    .eq('id', id)
    .single();
    
  if (fetchError) return { data: null, error: fetchError };
  
  const currentLikes = template?.likes || 0;
  
  const { data, error } = await supabase
    .from('templates')
    .update({ likes: currentLikes + 1 })
    .eq('id', id)
    .select();
    
  return { data, error };
};
