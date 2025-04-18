
import { BezierObject, Point, DesignData } from '@/types/bezier';
import { parseTemplateData } from './svgExporter';
import { generatePathData } from './bezierUtils';

/**
 * Generates a thumbnail preview for a design
 */
export const generateThumbnail = async (designData: string): Promise<string> => {
  try {
    // Try to parse the design data
    let parsedData: any;
    try {
      parsedData = JSON.parse(designData);
    } catch (e) {
      // If not JSON, try SVG
      if (typeof designData === 'string' && (designData.includes('<svg') || designData.startsWith('<?xml'))) {
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
    if (!ctx) return '';

    // Clear canvas with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Extract objects from different possible data structures
    let objects: BezierObject[] = [];
    if (Array.isArray(parsedData)) {
      objects = parsedData;
    } else if (parsedData.objects && Array.isArray(parsedData.objects)) {
      objects = parsedData.objects;
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
    }

    if (objects.length === 0) {
      console.warn('No valid objects found in design data');
      return '';
    }

    // Find the bounds of all objects
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    objects.forEach(obj => {
      if (!obj.points) return;
      obj.points.forEach(point => {
        if (!point) return;
        minX = Math.min(minX, point.x || 0);
        minY = Math.min(minY, point.y || 0);
        maxX = Math.max(maxX, point.x || 0);
        maxY = Math.max(maxY, point.y || 0);
      });
    });

    // If we couldn't determine bounds, use defaults
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      minX = 0;
      minY = 0;
      maxX = width;
      maxY = height;
    }

    // Calculate scale to fit the design within the thumbnail
    const scaleX = (width - padding * 2) / (maxX - minX || 1);
    const scaleY = (height - padding * 2) / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY);

    // Calculate centering offset
    const offsetX = padding + (width - padding * 2 - (maxX - minX) * scale) / 2;
    const offsetY = padding + (height - padding * 2 - (maxY - minY) * scale) / 2;

    // Draw each object
    objects.forEach(obj => {
      if (!obj.points || obj.points.length < 2) return;

      // Draw main curve
      ctx.beginPath();
      const firstPoint = transformPoint(obj.points[0], scale, offsetX - minX * scale, offsetY - minY * scale);
      if (!firstPoint) return;
      
      ctx.moveTo(firstPoint.x, firstPoint.y);

      // Draw bezier curves through all points
      for (let i = 0; i < obj.points.length - 1; i++) {
        const current = obj.points[i];
        const next = obj.points[i + 1];
        if (!current || !next || !current.handleOut || !next.handleIn) continue;

        const cp1 = transformPoint(current.handleOut, scale, offsetX - minX * scale, offsetY - minY * scale);
        const cp2 = transformPoint(next.handleIn, scale, offsetX - minX * scale, offsetY - minY * scale);
        const p = transformPoint(next, scale, offsetX - minX * scale, offsetY - minY * scale);
        
        if (!cp1 || !cp2 || !p) continue;
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
      }

      // Apply style
      const style = obj.curveConfig?.styles?.[0];
      ctx.strokeStyle = style?.color || '#000000';
      ctx.lineWidth = Math.max(1, (style?.width || 2) * scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating thumbnail:', error);
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
