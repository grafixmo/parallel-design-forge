
import { createClient } from '@supabase/supabase-js';
import { SavedDesign } from '../types/bezier';

const supabaseUrl = 'https://nwrihwenctfimyjcbcal.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cmlod2VuY3RmaW15amNiY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwNzUxNjMsImV4cCI6MjA1NzY1MTE2M30.fXmf6GUUn0OaEmisInMUP2oBlP2oBGhMSBOSx8HYI2k';

const supabase = createClient(supabaseUrl, supabaseKey);

// Original functions
export const saveDesign = async (design: SavedDesign): Promise<{ data: any; error: any }> => {
  const { data, error } = await supabase
    .from('designs')
    .insert([design])
    .select();
    
  return { data, error };
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

// Save a template
export const saveTemplate = async (template: Template): Promise<{ data: any; error: any }> => {
  const { data, error } = await supabase
    .from('templates')
    .insert([template])
    .select();
    
  return { data, error };
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

export default supabase;
