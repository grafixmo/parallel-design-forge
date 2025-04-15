
import supabase from '@/services/supabaseClient';
import { toast } from '@/hooks/use-toast';

/**
 * Upload SVG content to Supabase storage
 * @param svgContent The SVG content to upload
 * @param fileName The name to give the file
 * @param folderPath Optional folder path within the storage bucket
 * @returns A promise that resolves to the file path in storage
 */
export const uploadSvgToSupabase = async (
  svgContent: string,
  fileName: string,
  folderPath: string = 'svg'
): Promise<string> => {
  try {
    // Generate a unique file name if not provided
    const finalFileName = fileName || `svg-${Date.now()}.svg`;
    const filePath = `${folderPath}/${finalFileName}`;
    
    // Convert string to Blob
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    
    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from('designs')
      .upload(filePath, blob, {
        upsert: true,
        contentType: 'image/svg+xml'
      });
    
    if (error) throw error;
    
    if (!data || !data.path) {
      throw new Error('No path returned from Supabase');
    }
    
    toast({
      title: "SVG Uploaded",
      description: "Successfully uploaded SVG to Supabase.",
      variant: "default"
    });
    
    return data.path;
  } catch (error) {
    console.error('Error uploading SVG to Supabase:', error);
    toast({
      title: "Upload Error",
      description: "Failed to upload SVG to Supabase storage.",
      variant: "destructive"
    });
    throw error;
  }
};
