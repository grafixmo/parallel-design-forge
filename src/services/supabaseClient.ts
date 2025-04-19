import { createClient } from '@supabase/supabase-js';
import { SavedDesign } from '@/types/bezier';
import { toast } from '@/components/ui/sonner'; // Asegúrate que la ruta a sonner es correcta

// Log environment variables (without exposing the actual key values)
console.log('Supabase environment check:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'defined' : 'undefined',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'defined' : 'undefined',
  NEXT_PUBLIC_SUPABASE_URL: import.meta.env.NEXT_PUBLIC_SUPABASE_URL ? 'defined' : 'undefined',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'defined' : 'undefined'
});

// Use provided Supabase credentials
let supabaseUrl = 'https://nwrihwenctfimyjcbcal.supabase.co';
let supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cmlod2VuY3RmaW15amNiY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwNzUxNjMsImV4cCI6MjA1NzY1MTE2M30.fXmf6GUUn0OaEmisInMUP2oBlP2oBGhMSBOSx8HYI2k';

// Fallback to environment variables if needed
if (!supabaseUrl || !supabaseKey) {
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL ||
               import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
               'https://your-project-url.supabase.co';

  supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ||
                import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                'your-public-anon-key';
}

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

// Enhanced connection verification function (MODIFIED)
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

    // --- Bloque eliminado ---
    // Se eliminó el try...catch que llamaba a supabase.rpc('get_tables')
    // ya que la comprobación de auth.getSession() es suficiente para
    // verificar la conectividad básica y la clave anon.
    // Las comprobaciones específicas de tablas se hacen por separado.
    // --- Fin del bloque eliminado ---

    // Si llegamos aquí, la API es alcanzable y la clave anon es válida
    console.log('Supabase API connection verified successfully (via auth check)');
    return {
      success: true,
      details: 'Supabase API connection successful'
    };

  } catch (error) {
    // Captura errores inesperados durante la verificación de sesión
    console.error('Connection check - Unexpected API error:', error);
    return {
      success: false,
      error,
      errorType: 'api_error',
      details: 'Could not reach Supabase API or unexpected error during auth check'
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
      .select('id', { count: 'exact', head: true }); // Usar head:true para no traer datos

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
      if (error.code === '42501' || error.message.includes('permission denied')) { // Ajustado el mensaje de error
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

    if (!connectionStatus.success && connectionStatus.errorType !== 'credentials_error') { // No mostrar error si solo son placeholders
      console.error('Supabase connection failed on initialization:', connectionStatus.error || connectionStatus.details);

      // Only show toast in browser environment
      if (typeof window !== 'undefined') {
        toast.error('Database connection issue', {
          description: connectionStatus.details || 'Please check Supabase connection in project settings',
          duration: 5000,
        });
      }
    } else if (connectionStatus.success) {
        // Optionally check specific tables needed on init
        await checkTableAccess('designs');
        await checkTableAccess('templates');
    }
  } catch (error) {
    console.error('Error during initial Supabase connection check:', error);
  }
})();

export interface Template {
  id?: string;
  name: string;
  description?: string;
  design_data: string; // Podría ser JSON string o SVG string
  category?: string;
  thumbnail?: string; // URL o base64
  created_at?: string;
  likes?: number;
  user_id?: string; // Si usas autenticación
  svg_content?: string; // Added missing property
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

// Asumiendo que SavedDesign es similar a Template pero quizás con diferencias
// Asegúrate de tener el tipo SavedDesign definido correctamente
export const saveDesign = async (design: SavedDesign) => {
  // Asegurarse que design_data es string (JSON o SVG)
  if (typeof design.shapes_data !== 'string') {
     try {
       design.shapes_data = JSON.stringify(design.shapes_data);
     } catch (e) {
        console.error("Failed to stringify design data before saving:", e);
        // Decide cómo manejar esto, ¿lanzar error o guardar como está?
        // throw new Error("Invalid design data format");
     }
  }

  if (design.id) {
    // Update existing design
    // Excluir id del objeto de actualización si tu RLS no lo permite
    const { id, ...updateData } = design;
    return await supabase
      .from('designs')
      .update(updateData)
      .eq('id', design.id);
  } else {
    // Insert new design
    // Supabase genera el id si no se proporciona y la columna es PK
    return await supabase
      .from('designs')
      .insert(design);
  }
};


export const updateDesign = async (id: string, updates: Partial<SavedDesign>) => {
   // Asegurarse que shapes_data (si está presente) es string
  if (updates.shapes_data && typeof updates.shapes_data !== 'string') {
     try {
       updates.shapes_data = JSON.stringify(updates.shapes_data);
     } catch (e) {
        console.error("Failed to stringify design data before updating:", e);
        // throw new Error("Invalid design data format for update");
     }
  }
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
  // Asegurarse que design_data es string
  if (typeof template.design_data !== 'string') {
     try {
       template.design_data = JSON.stringify(template.design_data);
     } catch (e) {
       console.error("Failed to stringify template data before saving:", e);
       // throw new Error("Invalid template data format");
     }
  }

  if (template.id) {
    // Update existing template
    const { id, ...updateData } = template;
    return await supabase
      .from('templates')
      .update(updateData)
      .eq('id', template.id);
  } else {
    // Insert new template
    return await supabase
      .from('templates')
      .insert(template);
  }
};


export const updateTemplate = async (id: string, updates: Partial<Template>) => {
  // Asegurarse que design_data (si está presente) es string
  if (updates.design_data && typeof updates.design_data !== 'string') {
     try {
       updates.design_data = JSON.stringify(updates.design_data);
     } catch (e) {
       console.error("Failed to stringify template data before updating:", e);
       // throw new Error("Invalid template data format for update");
     }
  }
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

// Asegúrate que la función RPC 'increment_template_likes' existe en tu BD
export const likeTemplate = async (id: string) => {
  // Verifica que el id no sea undefined o null
  if (!id) {
    console.error("likeTemplate called with invalid id:", id);
    return { data: null, error: new Error("Invalid template ID provided for like operation.") };
  }
  return await supabase.rpc('increment_template_likes', { template_id: id });
};

// Definición del tipo SavedDesign (Asegúrate que coincida con tu definición real)
// Si ya lo tienes en '@/types/bezier', esta definición local no es necesaria
// interface SavedDesign {
//   id?: string;
//   name: string;
//   category?: string;
//   shapes_data: string | object; // O el tipo correcto que uses internamente
//   created_at?: string;
//   user_id?: string;
// }
