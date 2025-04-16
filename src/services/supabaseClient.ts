
import { createClient } from '@supabase/supabase-js';
import { SavedDesign } from '@/types/bezier';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-url.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-public-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Template {
  id?: string;
  name: string;
  description?: string;
  design_data: string;
  category?: string;
  thumbnail?: string;
  created_at?: string;
  likes?: number;
  user_id?: string;
}

// Connection verification functions
export const verifyConnection = async () => {
  try {
    // First, try a simple query to check if we can connect at all
    const { data, error: queryError } = await supabase
      .from('_test_connection')
      .select('*')
      .limit(1)
      .single();
    
    // If we get a PostgreSQL error but not a network error,
    // the API is reachable but the query failed (which is expected if the table doesn't exist)
    if (queryError && queryError.code !== 'PGRST116') {
      console.log('Connection check - Query error:', queryError);
      return {
        success: false,
        error: queryError,
        errorType: 'query_error',
        details: 'Database query failed, but API is reachable'
      };
    }
    
    return {
      success: true,
      details: 'Supabase connection successful'
    };
    
  } catch (error) {
    console.error('Connection check - API error:', error);
    return {
      success: false,
      error,
      errorType: 'api_error',
      details: 'Could not reach Supabase API'
    };
  }
};

// Table access check function
export const checkTableAccess = async (tableName: string) => {
  try {
    // Attempt to query the table
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);
    
    if (error) {
      return {
        accessible: false,
        error: error.message,
        details: error
      };
    }
    
    return {
      accessible: true,
      details: `Access to ${tableName} successful`
    };
  } catch (error) {
    return {
      accessible: false,
      error: String(error),
      details: error
    };
  }
};

// Designs-related functions
export const getDesigns = async () => {
  return await supabase
    .from('designs')
    .select('*')
    .order('created_at', { ascending: false });
};

export const getDesignsByCategory = async (category: string) => {
  return await supabase
    .from('designs')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false });
};

export const saveDesign = async (design: SavedDesign) => {
  if (design.id) {
    // Update existing design
    return await supabase
      .from('designs')
      .update(design)
      .eq('id', design.id);
  } else {
    // Insert new design
    return await supabase
      .from('designs')
      .insert(design);
  }
};

export const updateDesign = async (id: string, updates: Partial<SavedDesign>) => {
  return await supabase
    .from('designs')
    .update(updates)
    .eq('id', id);
};

// Templates-related functions
export const getTemplates = async () => {
  return await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });
};

export const getTemplatesByCategory = async (category: string) => {
  return await supabase
    .from('templates')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false });
};

export const saveTemplate = async (template: Template) => {
  if (template.id) {
    // Update existing template
    return await supabase
      .from('templates')
      .update(template)
      .eq('id', template.id);
  } else {
    // Insert new template
    return await supabase
      .from('templates')
      .insert(template);
  }
};

export const updateTemplate = async (id: string, updates: Partial<Template>) => {
  return await supabase
    .from('templates')
    .update(updates)
    .eq('id', id);
};

export const deleteTemplate = async (id: string) => {
  return await supabase
    .from('templates')
    .delete()
    .eq('id', id);
};

export const likeTemplate = async (id: string) => {
  return await supabase.rpc('increment_template_likes', { template_id: id });
};
