
import { createClient } from '@supabase/supabase-js';
import { SavedDesign } from '../types/bezier';

const supabaseUrl = 'https://nwrihwenctfimyjcbcal.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cmlod2VuY3RmaW15amNiY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwNzUxNjMsImV4cCI6MjA1NzY1MTE2M30.fXmf6GUUn0OaEmisInMUP2oBlP2oBGhMSBOSx8HYI2k';

const supabase = createClient(supabaseUrl, supabaseKey);

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

export default supabase;
