
import { BezierObject } from '@/types/bezier';

/**
 * Export bezier objects as SVG content
 */
export const exportSVG = (objects: BezierObject[], width: number = 800, height: number = 600): string => {
  try {
    // Create SVG container
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    
    // Convert each bezier object to path
    objects.forEach(object => {
      // Skip objects with too few points
      if (object.points.length < 2) return;
      
      // Create path data string
      let pathData = '';
      object.points.forEach((point, index) => {
        if (index === 0) {
          // Move to first point
          pathData += `M ${point.x},${point.y} `;
        } else {
          // Previous point's handle out and current point's handle in form the curve
          const prevPoint = object.points[index - 1];
          pathData += `C ${prevPoint.handleOut.x},${prevPoint.handleOut.y} ${point.handleIn.x},${point.handleIn.y} ${point.x},${point.y} `;
        }
      });
      
      // If we have 3+ points, close the curve by connecting last to first
      if (object.points.length >= 3) {
        const lastPoint = object.points[object.points.length - 1];
        const firstPoint = object.points[0];
        pathData += `C ${lastPoint.handleOut.x},${lastPoint.handleOut.y} ${firstPoint.handleIn.x},${firstPoint.handleIn.y} ${firstPoint.x},${firstPoint.y} Z`;
      }
      
      // Get style from the object's config
      const style = object.curveConfig.styles[0] || { color: '#000000', width: 2 };
      
      // Add transformation if needed
      let transform = '';
      if (object.transform) {
        const tx = width / 2;
        const ty = height / 2;
        transform = `transform="translate(${tx} ${ty}) rotate(${object.transform.rotation}) scale(${object.transform.scaleX} ${object.transform.scaleY}) translate(-${tx} -${ty})"`;
      }
      
      // Add path to SVG
      svg += `<path d="${pathData}" stroke="${style.color}" stroke-width="${style.width}" fill="none" ${transform}/>`;
    });
    
    // Close SVG
    svg += '</svg>';
    
    return svg;
  } catch (error) {
    console.error('Error exporting SVG:', error);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="10" y="50">Export Error</text></svg>';
  }
};

/**
 * Download SVG content as a file
 */
export const downloadSVG = (svgContent: string, fileName: string): void => {
  try {
    // Create blob from SVG content
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    
    // Trigger download
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
