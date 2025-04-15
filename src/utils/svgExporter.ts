import { ControlPoint, CurveConfig, TransformSettings } from '../types/bezier';
import { generatePathData } from './bezierUtils';

export const exportAsSVG = (
  points: ControlPoint[],
  curveConfig: CurveConfig,
  transform: TransformSettings,
  canvasWidth: number,
  canvasHeight: number
): string => {
  // Create SVG content
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">`;
  
  // Add background with white fill
  svg += `<rect width="${canvasWidth}" height="${canvasHeight}" fill="white"/>`;
  
  // Calculate the center of all points for transformation
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const centerX = points.length > 0 ? sumX / points.length : canvasWidth / 2;
  const centerY = points.length > 0 ? sumY / points.length : canvasHeight / 2;
  
  // Apply transform to the entire group
  svg += `<g transform="rotate(${transform.rotation} ${centerX} ${centerY}) scale(${transform.scaleX} ${transform.scaleY})">`;
  
  // Draw parallel curves behind main curve
  for (let i = 1; i <= curveConfig.parallelCount; i++) {
    const offset = i * curveConfig.spacing;
    const style = curveConfig.styles[i] || curveConfig.styles[0];
    
    // Draw a path for each parallel curve
    const pathData = generatePathData(points, offset);
    if (pathData) {
      svg += `<path d="${pathData}" fill="none" stroke="${style.color}" stroke-width="${style.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }
  
  // Draw main curve on top
  const mainPathData = generatePathData(points);
  if (mainPathData) {
    const mainStyle = curveConfig.styles[0];
    svg += `<path d="${mainPathData}" fill="none" stroke="${mainStyle.color}" stroke-width="${mainStyle.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  
  // Close the transform group
  svg += '</g>';
  
  // Add a border for better visibility in thumbnails
  svg += `<rect width="${canvasWidth}" height="${canvasHeight}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
  
  svg += '</svg>';
  
  return svg;
};

export const downloadSVG = (svgContent: string, fileName: string): void => {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'bezier-design.svg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Updated helper function to create SVG string for a complete design
// Fix: Updated function signature to expect only one argument (objects)
export const createDesignSVG = (
  objects: any[]
): string => {
  // Set default canvas dimensions
  const canvasWidth = 800;
  const canvasHeight = 600;
  
  // Create the SVG content combining all objects
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">`;
  
  // Add background with white fill
  svg += `<rect width="${canvasWidth}" height="${canvasHeight}" fill="white"/>`;
  
  // Process each object
  objects.forEach(obj => {
    // Calculate the center of points for this object's transformation
    const points = obj.points;
    const sumX = points.reduce((sum: number, point: ControlPoint) => sum + point.x, 0);
    const sumY = points.reduce((sum: number, point: ControlPoint) => sum + point.y, 0);
    const centerX = points.length > 0 ? sumX / points.length : canvasWidth / 2;
    const centerY = points.length > 0 ? sumY / points.length : canvasHeight / 2;
    
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
  svg += `<rect width="${canvasWidth}" height="${canvasHeight}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
  
  svg += '</svg>';
  
  return svg;
};
