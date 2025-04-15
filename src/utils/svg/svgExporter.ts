
import { BezierObject } from '@/types/bezier';
import { toast } from '@/hooks/use-toast';

/**
 * Generate SVG content from bezier objects
 * @param objects Array of bezier objects to export
 * @param width Optional width of the SVG viewport
 * @param height Optional height of the SVG viewport
 * @returns SVG content as string
 */
export const exportSVG = (
  objects: BezierObject[], 
  width: number = 800, 
  height: number = 600
): string => {
  try {
    // Create SVG document
    let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Add each object as a path
    objects.forEach(obj => {
      const pathData = convertBezierObjectToSVGPath(obj);
      const style = obj.curveConfig.styles[0] || { color: '#000000', width: 2 };
      
      svg += `
  <path d="${pathData}" fill="none" stroke="${style.color}" stroke-width="${style.width}" />`;
    });
    
    // Close SVG document
    svg += `
</svg>`;
    
    return svg;
  } catch (error) {
    console.error('Error exporting SVG:', error);
    toast({
      title: "Export Error",
      description: "Failed to generate SVG content.",
      variant: "destructive"
    });
    return '';
  }
};

/**
 * Convert a bezier object to an SVG path data string
 * @param object The bezier object to convert
 * @returns SVG path data string
 */
const convertBezierObjectToSVGPath = (object: BezierObject): string => {
  if (!object.points || object.points.length < 2) {
    return '';
  }
  
  const { points } = object;
  let pathData = '';
  
  // Start at the first point
  pathData += `M ${points[0].x},${points[0].y} `;
  
  // Add cubic bezier curves for each subsequent point
  for (let i = 1; i < points.length; i++) {
    const prevPoint = points[i - 1];
    const currentPoint = points[i];
    
    pathData += `C ${prevPoint.handleOut.x},${prevPoint.handleOut.y} ${currentPoint.handleIn.x},${currentPoint.handleIn.y} ${currentPoint.x},${currentPoint.y} `;
  }
  
  // Close the path if needed (connect last point to first)
  if (points.length > 2) {
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    
    // Only close path if start and end points are different
    if (Math.abs(lastPoint.x - firstPoint.x) > 0.01 || Math.abs(lastPoint.y - firstPoint.y) > 0.01) {
      pathData += `C ${lastPoint.handleOut.x},${lastPoint.handleOut.y} ${firstPoint.handleIn.x},${firstPoint.handleIn.y} ${firstPoint.x},${firstPoint.y} `;
    }
    
    // Add explicit close command
    pathData += 'Z';
  }
  
  return pathData;
};

/**
 * Download SVG content as a file
 * @param svgContent The SVG content to download
 * @param fileName The name of the downloaded file
 */
export const downloadSVG = (svgContent: string, fileName: string = 'design.svg'): void => {
  try {
    if (!svgContent) {
      throw new Error('No SVG content to download');
    }
    
    // Create a blob from the SVG content
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Error downloading SVG:', error);
    toast({
      title: "Download Error",
      description: "Failed to download SVG file.",
      variant: "destructive"
    });
  }
};
