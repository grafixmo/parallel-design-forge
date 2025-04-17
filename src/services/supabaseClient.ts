
import { createClient } from '@supabase/supabase-js';
import { SavedDesign } from '@/types/bezier';
import { toast } from '@/components/ui/sonner';

// Log environment variables (without exposing the actual key values)
console.log('Supabase environment check:', { 
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'defined' : 'undefined',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'defined' : 'undefined',
  NEXT_PUBLIC_SUPABASE_URL: import.meta.env.NEXT_PUBLIC_SUPABASE_URL ? 'defined' : 'undefined',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'defined' : 'undefined'
});

// Check for multiple environment variable naming patterns
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
                 import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
                 'https://your-project-url.supabase.co';

let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                  'your-public-anon-key';

// Try to load from localStorage if available
if (typeof window !== 'undefined') {
  const storedUrl = localStorage.getItem('supabase_manual_url');
  const storedKey = localStorage.getItem('supabase_manual_key');
  
  if (storedUrl && storedKey) {
    console.log('Using manually stored Supabase credentials from localStorage');
    supabaseUrl = storedUrl;
    supabaseKey = storedKey;
  }
}

// Log the actual URL (but not the key for security)
console.log('Initializing Supabase client with URL:', supabaseUrl);
console.log('Using placeholder URL?', supabaseUrl === 'https://your-project-url.supabase.co');

// Function to update Supabase credentials manually
export const setSupabaseCredentials = async (url: string, key: string) => {
  if (!url || !key) {
    throw new Error('URL and key are required');
  }
  
  // Store in localStorage for persistence
  if (typeof window !== 'undefined') {
    localStorage.setItem('supabase_manual_url', url);
    localStorage.setItem('supabase_manual_key', key);
  }
  
  // Update the globals
  supabaseUrl = url;
  supabaseKey = key;
  
  // Recreate the client with new credentials
  reinitializeClient();
  
  console.log('Supabase credentials updated manually');
  console.log('New URL:', url);
  
  // Verify the connection with new credentials
  const result = await verifyConnection();
  if (!result.success) {
    throw new Error('Connection failed with new credentials: ' + (result.details || result.error));
  }
  
  return result;
};

// Initialize Supabase client
export let supabase = createClient(supabaseUrl, supabaseKey);

// Function to reinitialize the client
const reinitializeClient = () => {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Supabase client reinitialized with new credentials');
};

// Reset stored credentials (for troubleshooting)
export const resetStoredCredentials = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('supabase_manual_url');
    localStorage.removeItem('supabase_manual_key');
    console.log('Cleared stored Supabase credentials');
  }
  
  // Reset to environment variables or defaults
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
               import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
               'https://your-project-url.supabase.co';
  
  supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                'your-public-anon-key';
                
  reinitializeClient();
  return true;
};

// Enhanced connection verification function
export const verifyConnection = async () => {
  try {
    console.log('Verifying Supabase connection...');
    
    // Check if we're using default placeholders
    if (supabaseUrl === 'https://your-project-url.supabase.co' || 
        supabaseKey === 'your-public-anon-key') {
      console.warn('Using placeholder Supabase credentials');
      return {
        success: false,
        error: new Error('Using placeholder Supabase credentials'),
        errorType: 'credentials_error',
        details: 'Placeholder credentials detected. Please connect to Supabase in project settings.'
      };
    }
    
    // Test the auth service - a more reliable indication of connection
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('Auth service check failed:', authError);
      return {
        success: false,
        error: authError,
        errorType: 'auth_error',
        details: 'Auth service unavailable. Possible API connection issue.'
      };
    }
    
    // Auth is working, which means the API is reachable
    // Now try to detect available tables
    
    // First try to list tables (only works with sufficient permissions)
    try {
      // This is a Postgres-specific query that will fail with 404 if the REST API works
      // but we don't have permission, which is expected in many cases
      const { error: tablesError } = await supabase.rpc('get_tables');
      
      // If no error, we have full DB access which is rare but great
      if (!tablesError) {
        return {
          success: true,
          details: 'Full database access confirmed'
        };
      }
    } catch (e) {
      // Ignore this error - it's expected with normal permissions
      console.log('Table listing check failed (normal with restricted permissions)');
    }
    
    // API is reachable, but we don't know about tables yet
    // This is still a successful connection
    console.log('Supabase API connection verified successfully');
    return {
      success: true,
      details: 'Supabase API connection successful'
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

// Table access check function - enhanced with better logging
export const checkTableAccess = async (tableName: string) => {
  if (!tableName) return { accessible: false, error: 'No table name provided' };
  
  try {
    console.log(`Checking access to table: ${tableName}`);
    
    // Attempt to query the table
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);
    
    if (error) {
      // Specific error for "table doesn't exist"
      if (error.code === '42P01') {
        console.error(`Table '${tableName}' does not exist`);
        return {
          accessible: false,
          error: `Table '${tableName}' does not exist`,
          details: error,
          errorType: 'missing_table'
        };
      }
      
      // Permission error
      if (error.code === '42501' || error.message.includes('permission')) {
        console.error(`Permission denied for table '${tableName}'`);
        return {
          accessible: false,
          error: `Permission denied for table '${tableName}'`,
          details: error,
          errorType: 'permission'
        };
      }
      
      // General error
      console.error(`Table access check failed for ${tableName}:`, error);
      return {
        accessible: false,
        error: error.message,
        details: error,
        errorType: 'query_error'
      };
    }
    
    console.log(`Access to table ${tableName} verified successfully`);
    return {
      accessible: true,
      details: `Access to ${tableName} successful`
    };
  } catch (error) {
    console.error(`Table access check error for ${tableName}:`, error);
    return {
      accessible: false,
      error: String(error),
      details: error,
      errorType: 'exception'
    };
  }
};

// Get the current Supabase URL (safe for display)
export const getCurrentSupabaseUrl = () => {
  return supabaseUrl;
};

// Test connection immediately to verify client setup
(async () => {
  try {
    const connectionStatus = await verifyConnection();
    console.log('Initial connection check result:', connectionStatus);
    
    if (!connectionStatus.success) {
      console.error('Supabase connection failed on initialization:', connectionStatus.error);
      
      // Only show toast in browser environment
      if (typeof window !== 'undefined') {
        toast.error('Database connection issue', {
          description: 'Please check Supabase connection in project settings',
          duration: 5000,
        });
      }
    }
  } catch (error) {
    console.error('Error during initial Supabase connection check:', error);
  }
})();

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
