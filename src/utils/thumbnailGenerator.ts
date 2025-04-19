import { BezierObject, Point, DesignData } from '@/types/bezier';
import { parseTemplateData } from './svgExporter';
import { generatePathData } from './bezierUtils';

/**
 * Generates a thumbnail preview for a design
 */
export const generateThumbnail = async (designData: string): Promise<string> => {
  try {
    console.log('Starting thumbnail generation...');
    
    // Try to parse the design data
    let parsedData: any;
    try {
      parsedData = JSON.parse(designData);
      console.log('Successfully parsed JSON data');
    } catch (e) {
      // If not JSON, check if it's SVG
      if (typeof designData === 'string' && (designData.includes('<svg') || designData.startsWith('<?xml'))) {
        console.log('Template appears to be SVG format, attempting SVG render');
        return renderSVGThumbnail(designData, 200, 150);
      }
      console.error('Failed to parse design data:', e);
      return '';
    }

    // Set up thumbnail dimensions
    const width = 200;
    const height = 150;
    const padding = 20;

    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return '';
    }

    // Clear canvas with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Extract objects from different possible data structures
    let objects: BezierObject[] = [];
    
    try {
      if (Array.isArray(parsedData)) {
        objects = parsedData;
        console.log('Parsed data is array of objects');
      } else if (parsedData.objects && Array.isArray(parsedData.objects)) {
        objects = parsedData.objects;
        console.log('Parsed data contains objects array');
      } else if (parsedData.points && Array.isArray(parsedData.points)) {
        // Legacy format with single object
        objects = [{
          id: 'legacy',
          points: parsedData.points,
          curveConfig: parsedData.curveConfig || {
            styles: [{ color: '#000000', width: 2 }],
            parallelCount: 1,
            spacing: 5
          },
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1
          },
          name: 'Legacy Object',
          isSelected: false
        }];
        console.log('Parsed legacy format with single object');
      }
    } catch (error) {
      console.error('Error extracting objects:', error);
      return '';
    }

    if (objects.length === 0) {
      console.warn('No valid objects found in design data');
      return '';
    }

    // Validate objects and their points
    objects = objects.filter(obj => {
      return obj && Array.isArray(obj.points) && obj.points.length >= 2;
    });

    if (objects.length === 0) {
      console.warn('No valid objects after filtering');
      return '';
    }

    // Find the bounds of all objects with validation
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let validPointsFound = false;

    objects.forEach(obj => {
      if (!obj.points) return;
      obj.points.forEach(point => {
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return;
        
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
        validPointsFound = true;
      });
    });

    // If we couldn't determine valid bounds, use defaults
    if (!validPointsFound || !isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      console.log('Using default bounds due to invalid points');
      minX = 0;
      minY = 0;
      maxX = width;
      maxY = height;
    }

    // Calculate scale with boundary protection
    const scaleX = (width - padding * 2) / (Math.max(0.1, maxX - minX));
    const scaleY = (height - padding * 2) / (Math.max(0.1, maxY - minY));
    const scale = Math.min(scaleX, scaleY);

    // Calculate centering offset
    const offsetX = padding + (width - padding * 2 - (maxX - minX) * scale) / 2;
    const offsetY = padding + (height - padding * 2 - (maxY - minY) * scale) / 2;

    console.log('Rendering objects with scale:', scale, 'offset:', offsetX, offsetY);

    // Draw each object with error handling
    objects.forEach((obj, index) => {
      try {
        if (!obj.points || obj.points.length < 2) return;

        // Draw main curve
        ctx.beginPath();
        const firstPoint = transformPoint(obj.points[0], scale, offsetX - minX * scale, offsetY - minY * scale);
        if (!firstPoint) return;
        
        ctx.moveTo(firstPoint.x, firstPoint.y);

        // Draw bezier curves through all points with validation
        for (let i = 0; i < obj.points.length - 1; i++) {
          const current = obj.points[i];
          const next = obj.points[i + 1];
          
          if (!current || !next || !current.handleOut || !next.handleIn) {
            console.warn(`Invalid point or handles at index ${i}`);
            continue;
          }

          const cp1 = transformPoint(current.handleOut, scale, offsetX - minX * scale, offsetY - minY * scale);
          const cp2 = transformPoint(next.handleIn, scale, offsetX - minX * scale, offsetY - minY * scale);
          const p = transformPoint(next, scale, offsetX - minX * scale, offsetY - minY * scale);
          
          if (!cp1 || !cp2 || !p) {
            console.warn(`Invalid transformed points at index ${i}`);
            continue;
          }

          ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
        }

        // Apply style with fallbacks
        const style = obj.curveConfig?.styles?.[0] || { color: '#000000', width: 2 };
        
        // Ensure we properly apply color and width properties
        ctx.strokeStyle = style.color || '#000000';
        ctx.lineWidth = Math.max(1, (style.width || 2) * Math.min(scale, 1.5));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // If we have multiple styles (parallel lines), draw them all
        if (obj.curveConfig?.styles && obj.curveConfig.styles.length > 1 && obj.curveConfig.parallelCount > 1) {
          // Draw the main path first
          ctx.stroke();
          
          // Draw additional parallel paths if specified
          const parallelCount = obj.curveConfig.parallelCount || 1;
          const spacing = (obj.curveConfig.spacing || 5) * scale;
          
          // Draw additional paths with their respective styles
          for (let i = 1; i < Math.min(parallelCount, obj.curveConfig.styles.length); i++) {
            const parallelStyle = obj.curveConfig.styles[i];
            if (!parallelStyle) continue;
            
            ctx.beginPath();
            const offset = i * spacing;
            
            // Redraw the path with offset
            const firstPoint = transformPoint(obj.points[0], scale, offsetX - minX * scale + offset, offsetY - minY * scale);
            if (!firstPoint) continue;
            
            ctx.moveTo(firstPoint.x, firstPoint.y);
            
            for (let j = 0; j < obj.points.length - 1; j++) {
              const current = obj.points[j];
              const next = obj.points[j + 1];
              
              if (!current || !next || !current.handleOut || !next.handleIn) continue;
              
              const cp1 = transformPoint(current.handleOut, scale, offsetX - minX * scale + offset, offsetY - minY * scale);
              const cp2 = transformPoint(next.handleIn, scale, offsetX - minX * scale + offset, offsetY - minY * scale);
              const p = transformPoint(next, scale, offsetX - minX * scale + offset, offsetY - minY * scale);
              
              if (!cp1 || !cp2 || !p) continue;
              
              ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
            }
            
            ctx.strokeStyle = parallelStyle.color || '#000000';
            ctx.lineWidth = Math.max(1, (parallelStyle.width || 2) * Math.min(scale, 1.5));
            ctx.stroke();
          }
        } else {
          // Just draw the single path
          ctx.stroke();
        }
      } catch (error) {
        console.error(`Error drawing object ${index}:`, error);
      }
    });

    console.log('Thumbnail generation completed successfully');
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Critical error in thumbnail generation:', error);
    return '';
  }
};

const transformPoint = (point: Point | null | undefined, scale: number, offsetX: number, offsetY: number): Point | null => {
  if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
    return null;
  }
  return {
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY
  };
};

const renderSVGThumbnail = (svgString: string, width: number, height: number): Promise<string> => {
  return new Promise<string>((resolve) => {
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve('');
        return;
      }

      // Clear canvas with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);

      // Calculate scaling to fit while maintaining aspect ratio
      const scale = Math.min(
        width / img.width,
        height / img.height
      );

      // Calculate positioning to center the image
      const x = (width - img.width * scale) / 2;
      const y = (height - img.height * scale) / 2;

      // Draw the scaled image
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };

    img.src = url;
  });
};
