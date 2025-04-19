
import { supabase } from './supabaseClient';
import { BackgroundImage } from '@/types/bezier';
import { toast } from '@/hooks/use-toast';

export interface SavedBackImage {
  id?: string;
  url: string;
  name: string;
  format: 'jpg' | 'png' | 'svg';
  opacity: number;
  created_at?: string;
}

// Save background image to back_images table
export const saveBackgroundImage = async (image: BackgroundImage, name: string): Promise<SavedBackImage | null> => {
  try {
    const { data, error } = await supabase
      .from('back_images')
      .insert({
        url: image.url,
        name: name,
        format: image.format || detectImageFormat(image.url),
        opacity: image.opacity
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving background image:', error);
    return null;
  }
};

// Get all background images
export const getBackgroundImages = async (): Promise<SavedBackImage[]> => {
  try {
    const { data, error } = await supabase
      .from('back_images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching background images:', error);
    return [];
  }
};

// Delete a background image
export const deleteBackgroundImage = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('back_images')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting background image:', error);
    return false;
  }
};

// Utility function to detect image format from URL or data URL
const detectImageFormat = (url: string): 'jpg' | 'png' | 'svg' => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('image/svg')) return 'svg';
  if (lowerUrl.includes('image/png')) return 'png';
  return 'jpg';
};
