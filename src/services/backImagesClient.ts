import { supabase } from './supabaseClient';
import { toast } from './customToast'; // Import the custom toast wrapper

// Interface for BackImage table structure
export interface BackImage {
  id?: string;
  name: string;
  image_data: string; // Base64 encoded image data
  format: string;     // 'jpg', 'png', etc.
  category?: string;  // Exists in the DB 
  width?: number;     // Added to DB
  height?: number;    // Added to DB
  opacity?: number;   // Already exists in DB
  user_id?: string;   // Required for row-level security
  created_at?: string;
  updated_at?: string;
}

// Function to detect image format from data URL
export const detectImageFormat = (dataUrl: string): string => {
  if (!dataUrl.startsWith('data:image/')) {
    return 'unknown';
  }
  
  // Extract format from data URL
  const formatMatch = dataUrl.match(/data:image\/(\w+);base64,/);
  if (formatMatch && formatMatch[1]) {
    // Get the format and normalize it
    let format = formatMatch[1].toLowerCase();
    
    // Ensure format matches expected values in the database constraint
    // Common formats: jpg, jpeg, png, gif, webp, svg
    if (format === 'jpeg') format = 'jpg'; // Normalize jpeg to jpg
    
    // Validate against known acceptable formats
    const validFormats = ['jpg', 'png', 'gif', 'webp', 'svg'];
    if (validFormats.includes(format)) {
      return format;
    }
  }
  
  // Default to jpg if unknown or unsupported format
  return 'jpg';
};

// Function to get image dimensions from data URL
export const getImageDimensions = (dataUrl: string): Promise<{width: number, height: number}> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height
      });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image for dimension detection'));
    };
    img.src = dataUrl;
  });
};

// Function to save background image to BackImages table
export const saveBackgroundImage = async (imageData: string, name?: string): Promise<any> => {
  if (!imageData) {
    toast("No Image Data: There is no image data to save", {
      variant: "destructive"
    });
    return { error: { message: "No image data provided" } };
  }

  try {
    // Make sure we're working with a data URL
    if (!imageData.startsWith('data:image/')) {
      console.error("Image is not in data URL format");
      toast("Format Error: Image is in an unsupported format", {
        variant: "destructive"
      });
      return { error: { message: "Unsupported image format" } };
    }
    
    // Explicitly get the current user session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    // Get user ID if available (but don't throw an error if not available)
    let userId = null;
    if (sessionData?.session?.user) {
      userId = sessionData.session.user.id;
      console.log("Found authenticated user ID:", userId);
    } else {
      console.warn("No authenticated user session found, continuing without user_id");
    }
    
    // Detect image format
    const format = detectImageFormat(imageData);
    console.log("Detected image format:", format);
    
    // Validate the image data to ensure it's properly formatted
    if (!validateImageData(imageData)) {
      console.error("Invalid image data format");
      toast("Format Error: Image data is corrupted or in an invalid format", {
        variant: "destructive"
      });
      return { error: { message: "Invalid image data format" } };
    }
    
    // Get image dimensions
    let dimensions = { width: 0, height: 0 };
    try {
      dimensions = await getImageDimensions(imageData);
      console.log("Image dimensions:", dimensions);
    } catch (error) {
      console.warn("Could not detect image dimensions", error);
    }
    
    // Generate a name if not provided
    if (!name) {
      const date = new Date();
      const formattedDate = date.toISOString().split('T')[0];
      const formattedTime = `${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
      name = `Background_${formattedDate}_${formattedTime}`;
    }
    
    // Create the base object without user_id
    const backImage: BackImage = {
      name,
      image_data: imageData,
      format,
      category: 'background',
      opacity: 1
    };
    
    // Only add user_id if we have one
    if (userId) {
      backImage.user_id = userId;
    }
    
    // Only add width/height if they are valid numbers
    if (dimensions.width > 0) {
      backImage.width = Math.round(dimensions.width);
    }
    
    if (dimensions.height > 0) {
      backImage.height = Math.round(dimensions.height);
    }
    
    // If dimensions couldn't be detected, set default values
    if (!backImage.width || !backImage.height) {
      backImage.width = 800;
      backImage.height = 600;
    }
    
    console.log("Saving background image with fields:", Object.keys(backImage));
    console.log("Format being saved:", format);
    if (userId) {
      console.log("User ID being saved:", userId);
    } else {
      console.log("No user ID available - saving without user_id");
    }
    
    // Save to BackImages table
    const result = await supabase
      .from('back_images')
      .insert(backImage)
      .select();
    
    if (result.error) {
      console.error("Supabase error:", result.error);
      
      // Provide more specific error messages for common issues
      if (result.error.message.includes('back_images_format_check')) {
        toast("Format Error: Image format must be one of: jpg, png, gif, webp, svg", {
          variant: "destructive"
        });
        return { error: { message: "Invalid image format. Supported formats: jpg, png, gif, webp, svg" } };
      }
      
      if (result.error.message.includes('row-level security')) {
        toast("Permission Error: You don't have permission to save images", {
          variant: "destructive"
        });
        return { error: { message: "Row-level security policy violation. Ensure you're properly authenticated." } };
      }
      
      throw new Error(result.error.message);
    }
    
    toast(`Background Saved: Background image saved as "${name}"`);
    
    return result;
  } catch (error) {
    console.error("Error saving background image:", error);
    toast("Save Failed: Failed to save background image", {
      variant: "destructive"
    });
    return { error };
  }
};

// Helper function to validate image data
export const validateImageData = (imageData: string): boolean => {
  if (!imageData) return false;
  
  // Check if it's a valid data URL format
  if (!imageData.startsWith('data:image/')) return false;
  
  // Check if it has a base64 component
  const parts = imageData.split(',');
  if (parts.length !== 2) return false;
  
  // Check if the base64 part is not empty
  const base64Data = parts[1];
  if (!base64Data || base64Data.trim() === '') return false;
  
  return true;
};

// Function to get all background images
export const getBackgroundImages = async () => {
  try {
    console.log('Fetching background images from Supabase...');
    const response = await supabase
      .from('back_images')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (response.error) {
      console.error('Error fetching background images:', response.error);
      return { error: response.error, data: [] };
    }
    
    // Validate the image_data in each record
    if (response.data && Array.isArray(response.data)) {
      console.log(`Successfully fetched ${response.data.length} background images`);
      
      // Check if any images are missing image_data
      const missingImageData = response.data.filter(img => !img.image_data);
      if (missingImageData.length > 0) {
        console.warn(`${missingImageData.length} images are missing image_data`);
      }
      
      // Log the first few characters of image_data for debugging
      if (response.data.length > 0 && response.data[0].image_data) {
        const sample = response.data[0].image_data.substring(0, 50) + '...';
        console.log('Sample image_data:', sample);
      }
    }
    
    return response;
  } catch (error) {
    console.error('Unexpected error in getBackgroundImages:', error);
    return { error: { message: 'Failed to fetch background images' }, data: [] };
  }
};

// Function to delete a background image
export const deleteBackgroundImage = async (id: string) => {
  return await supabase
    .from('back_images')
    .delete()
    .eq('id', id);
};

// Function to update a background image
export const updateBackgroundImage = async (id: string, updates: Partial<BackImage>) => {
  // Filter out any properties that might not exist in the database
  const safeUpdates: Record<string, any> = {};
  
  // Only include properties we know exist
  if ('name' in updates) safeUpdates.name = updates.name;
  if ('format' in updates) safeUpdates.format = updates.format;
  if ('category' in updates) safeUpdates.category = updates.category;
  if ('opacity' in updates) safeUpdates.opacity = updates.opacity;
  if ('image_data' in updates) safeUpdates.image_data = updates.image_data;
  if ('width' in updates) safeUpdates.width = updates.width;
  if ('height' in updates) safeUpdates.height = updates.height;
  
  return await supabase
    .from('back_images')
    .update(safeUpdates)
    .eq('id', id);
};