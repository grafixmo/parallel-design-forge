
import { ControlPoint, CurveConfig, TransformSettings, BezierObject } from '../types/bezier';
import { generatePathData } from './bezierUtils';

/**
 * Creates an SVG string for a complete design with all objects
 * @param objects Array of bezier objects
 * @param width Canvas width
 * @param height Canvas height
 * @returns SVG content as string
 */
export const createDesignSVG = (
  objects: BezierObject[],
  width: number = 800,
  height: number = 600
): string => {
  if (!objects || objects.length === 0) {
    return createEmptySVG(width, height);
  }
  
  // Create the SVG content combining all objects
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  
  // Add background with white fill
  svg += `<rect width="${width}" height="${height}" fill="white"/>`;
  
  // Process each object
  objects.forEach(obj => {
    // Skip objects with insufficient points
    if (!obj.points || obj.points.length < 2) return;
    
    // Calculate the center of points for this object's transformation
    const points = obj.points;
    const sumX = points.reduce((sum: number, point: ControlPoint) => sum + point.x, 0);
    const sumY = points.reduce((sum: number, point: ControlPoint) => sum + point.y, 0);
    const centerX = points.length > 0 ? sumX / points.length : width / 2;
    const centerY = points.length > 0 ? sumY / points.length : height / 2;
    
    // Apply object's transform
    svg += `<g transform="rotate(${obj.transform.rotation} ${centerX} ${centerY}) scale(${obj.transform.scaleX} ${obj.transform.scaleY})">`;
    
    // Draw parallel curves
    for (let i = 1; i <= obj.curveConfig.parallelCount; i++) {
      const offset = i * obj.curveConfig.spacing;
      const style = obj.curveConfig.styles[i] || obj.curveConfig.styles[0];
      
      const pathData = generatePathData(points, offset);
      if (pathData) {
        svg += `<path d="${pathData}" fill="none" stroke="${style.color}" stroke-width="${style.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    }
    
    // Draw main curve
    const mainPathData = generatePathData(points);
    if (mainPathData) {
      const mainStyle = obj.curveConfig.styles[0];
      svg += `<path d="${mainPathData}" fill="none" stroke="${mainStyle.color}" stroke-width="${mainStyle.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    
    // Close the transform group
    svg += '</g>';
  });
  
  // Add a border
  svg += `<rect width="${width}" height="${height}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
  
  svg += '</svg>';
  
  return svg;
};

/**
 * Creates an empty SVG with default dimensions
 */
const createEmptySVG = (width: number = 800, height: number = 600): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="white"/>
  <text x="${width/2}" y="${height/2}" font-family="Arial" font-size="24" fill="#666" text-anchor="middle">No objects to display</text>
</svg>`;
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
  }
};
