
/**
 * Utility functions for generating thumbnails from SVG content
 */

// Generate a thumbnail data URL from SVG content
export const generateThumbnailFromSVG = async (svgContent: string): Promise<string> => {
  return new Promise((resolve) => {
    // Create a Blob from the SVG content
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    // Create an Image to load the SVG
    const img = new Image();
    img.onload = () => {
      // Create a canvas with smaller dimensions for the thumbnail
      const canvas = document.createElement('canvas');
      const aspectRatio = img.width / img.height;
      
      // Set thumbnail dimensions (adjust as needed)
      const thumbWidth = 300;
      const thumbHeight = thumbWidth / aspectRatio;
      
      canvas.width = thumbWidth;
      canvas.height = thumbHeight;
      
      // Draw the SVG on the canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/png');
        
        // Clean up
        URL.revokeObjectURL(url);
        
        resolve(dataUrl);
      } else {
        // Fallback if canvas context is not available
        resolve('');
      }
    };
    
    img.onerror = () => {
      // Clean up and resolve with empty string on error
      URL.revokeObjectURL(url);
      resolve('');
    };
    
    img.src = url;
  });
};

// Get categories for templates
export const getTemplateCategories = (): string[] => {
  return ['Earrings', 'Rings', 'Necklaces', 'Prototypes', 'Paper'];
};
