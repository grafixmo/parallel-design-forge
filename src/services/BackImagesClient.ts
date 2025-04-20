
import { supabase } from './supabaseClient';

export interface BackgroundImage {
  id: string;
  url: string;
  category?: string;
  created_at: string;
}

export const BackImagesClient = {
  async fetchBackgroundImages(): Promise<BackgroundImage[]> {
    const { data, error } = await supabase
      .from('background_images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch background images');
    }

    return data || [];
  },

  async addBackgroundImage(imageUrl: string, category?: string): Promise<BackgroundImage> {
    const { data, error } = await supabase
      .from('background_images')
      .insert([
        {
          url: imageUrl,
          category,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error('Failed to add background image');
    }

    return data;
  },

  async deleteBackgroundImage(imageId: string): Promise<void> {
    const { error } = await supabase
      .from('background_images')
      .delete()
      .eq('id', imageId);

    if (error) {
      throw new Error('Failed to delete background image');
    }
  },
};
