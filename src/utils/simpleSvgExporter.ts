
import { BezierObject, ControlPoint } from '@/types/bezier';
import { generatePathData } from './bezierUtils';

/**
 * Simple SVG exporter that converts BezierObjects to SVG format
 */

// Export objects as SVG string
export const exportSVG = (
  objects: BezierObject[],
  width: number = 800,
  height: number = 600,
  includeBorder: boolean = true
): string => {
  try {
    // Create SVG content
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    
    // Add background with white fill
    svg += `<rect width="${width}" height="${height}" fill="white"/>`;
    
    // Process each object
    objects.forEach(obj => {
      // Apply transform if needed
      if (obj.transform.rotation !== 0 || obj.transform.scaleX !== 1 || obj.transform.scaleY !== 1) {
        // Calculate the center of points for transformation
        const sumX = obj.points.reduce((sum, point) => sum + point.x, 0);
        const sumY = obj.points.reduce((sum, point) => sum + point.y, 0);
        const centerX = obj.points.length > 0 ? sumX / obj.points.length : width / 2;
        const centerY = obj.points.length > 0 ? sumY / obj.points.length : height / 2;
        
        // Apply transform to the group
        svg += `<g transform="rotate(${obj.transform.rotation} ${centerX} ${centerY}) scale(${obj.transform.scaleX} ${obj.transform.scaleY})">`;
      }
      
      // Draw parallel curves if specified
      for (let i = 1; i <= obj.curveConfig.parallelCount; i++) {
        const offset = i * obj.curveConfig.spacing;
        const style = obj.curveConfig.styles[i] || obj.curveConfig.styles[0];
        
        // Draw a path for each parallel curve
        const pathData = generatePathData(obj.points, offset);
        if (pathData) {
          svg += `<path d="${pathData}" fill="none" stroke="${style.color}" stroke-width="${style.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
        }
      }
      
      // Draw main curve
      const mainPathData = generatePathData(obj.points);
      if (mainPathData) {
        const mainStyle = obj.curveConfig.styles[0];
        svg += `<path d="${mainPathData}" fill="none" stroke="${mainStyle.color}" stroke-width="${mainStyle.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      
      // Close transform group if needed
      if (obj.transform.rotation !== 0 || obj.transform.scaleX !== 1 || obj.transform.scaleY !== 1) {
        svg += '</g>';
      }
    });
    
    // Add a border for better visibility if requested
    if (includeBorder) {
      svg += `<rect width="${width}" height="${height}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
    }
    
    svg += '</svg>';
    
    return svg;
  } catch (error) {
    console.error('Error creating SVG:', error);
    throw new Error('Failed to create SVG');
  }
};

// Download SVG file
export const downloadSVG = (svgContent: string, fileName: string = 'bezier-design.svg'): void => {
  try {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading SVG:', error);
    throw new Error('Failed to download SVG');
  }
};
