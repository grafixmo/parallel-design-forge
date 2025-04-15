
import { supabase } from '@/services/supabaseClient';
import { BezierObject } from '@/types/bezier';
import { toast } from '@/hooks/use-toast';
import { importSVG } from './fabricSvgImporter';

/**
 * Fetch SVG content from Supabase storage
 * @param path The path to the SVG file in Supabase storage
 * @returns A promise that resolves to the SVG content
 */
export const fetchSvgFromSupabase = async (path: string): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from('designs')
      .download(path);
      
    if (error) {
      throw error;
    }
    
    if (!data) {
      throw new Error('No data returned from Supabase');
    }
    
    // Convert blob to text
    return await data.text();
  } catch (error) {
    console.error('Error fetching SVG from Supabase:', error);
    toast({
      title: "Supabase Error",
      description: "Failed to fetch SVG from storage.",
      variant: "destructive"
    });
    throw error;
  }
};

/**
 * Import SVG from Supabase storage and convert to bezier objects
 * @param path The path to the SVG file in Supabase storage
 * @param options Optional configuration for import
 * @returns A promise that resolves to an array of bezier objects
 */
export const importSVGFromSupabase = async (
  path: string,
  options?: {
    onProgress?: (progress: number) => void,
    maxObjects?: number
  }
): Promise<BezierObject[]> => {
  try {
    const { onProgress } = options || {};
    
    // Start progress indication
    onProgress?.(5);
    
    // Fetch SVG content from Supabase
    const svgContent = await fetchSvgFromSupabase(path);
    
    onProgress?.(20);
    
    // Use the Fabric.js importer to parse the SVG
    return await importSVG(svgContent, {
      onProgress: (progress) => {
        // Scale progress to 20-100 range (since fetching is 0-20)
        onProgress?.(20 + Math.floor(progress * 0.8));
      },
      ...options
    });
  } catch (error) {
    console.error('Error importing SVG from Supabase:', error);
    toast({
      title: "Import Error",
      description: "Failed to import SVG from Supabase storage.",
      variant: "destructive"
    });
    return [];
  }
};

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
