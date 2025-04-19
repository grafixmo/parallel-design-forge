import { BezierObject, Point, DesignData } from '@/types/bezier';
import { parseTemplateData, unescapeSvgContent, fixSvgAttributes, isValidPoint, isValidHandle } from './svgUtils';
import { generatePathData } from './bezierUtils';

/**
 * Generates a thumbnail preview for a design
 */
export const generateThumbnail = async (designData: string): Promise<string> => {
  try {
    console.log('Starting thumbnail generation...');
    
    if (!designData) {
      console.error('Empty design data provided to generateThumbnail');
      return '';
    }
    
    // Try to parse the design data
    let parsedData: any;
    try {
      // Parse the JSON data
      parsedData = JSON.parse(designData);
      console.log('Successfully parsed JSON data');
      
      // Check if this is a background image design
      if (parsedData.backgroundImage?.url) {
        console.log('Found background image URL, generating direct thumbnail');
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 150;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              console.error('Could not get canvas context');
              resolve(createFallbackThumbnail());
              return;
            }
            
            // Clear with white background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Calculate scaling to fit while maintaining aspect ratio
            const scale = Math.min(
              canvas.width / img.width,
              canvas.height / img.height
            );
            
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (canvas.width - scaledWidth) / 2;
            const y = (canvas.height - scaledHeight) / 2;
            
            // Draw the scaled image
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
            
            resolve(canvas.toDataURL('image/png'));
          };
          
          img.onerror = () => {
            console.error('Error loading background image');
            resolve(createFallbackThumbnail());
          };
          
          img.src = parsedData.backgroundImage.url;
        });
      }
      
    } catch (e) {
      console.error('Failed to parse design data:', e);
      return createFallbackThumbnail();
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
      return createFallbackThumbnail();
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
      return createFallbackThumbnail();
    }
    
    if (!objects || objects.length === 0) {
      console.warn('No valid objects found in design data');
      return createFallbackThumbnail();
    }

    // Validate objects and their points
    objects = objects.filter(obj => {
      return obj && Array.isArray(obj.points) && obj.points.length >= 2;
    });

    if (objects.length === 0) {
      console.warn('No valid objects after filtering');
      return createFallbackThumbnail();
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
        if (!isValidPoint(point)) return;
        
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
    const scaleX = (width - padding * 2) / (Math.max(1, maxX - minX));
    const scaleY = (height - padding * 2) / (Math.max(1, maxY - minY));
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
          
          if (!isValidPoint(current) || !isValidPoint(next) || 
              !isValidHandle(current.handleOut) || !isValidHandle(next.handleIn)) {
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
        
        // Draw the curve
        ctx.stroke();
        
        // If we have multiple styles (parallel lines), draw them all
        if (obj.curveConfig?.styles && obj.curveConfig.styles.length > 1 && obj.curveConfig.parallelCount > 1) {
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
              
              if (!isValidPoint(current) || !isValidPoint(next) || 
                  !isValidHandle(current.handleOut) || !isValidHandle(next.handleIn)) {
                continue;
              }
              
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
        }
      } catch (error) {
        console.error(`Error drawing object ${index}:`, error);
      }
    });

    console.log('Thumbnail generation completed successfully');
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Critical error in thumbnail generation:', error);
    return createFallbackThumbnail();
  }
};
const transformPoint = (point: Point | null | undefined, scale: number, offsetX: number, offsetY: number): Point | null => {
  if (!isValidPoint(point)) {
    return null;
  }
  
  try {
    return {
      x: (point as Point).x * scale + offsetX,
      y: (point as Point).y * scale + offsetY
    };
  } catch (e) {
    console.error('Error transforming point:', e);
    return null;
  }
};

const renderSVGThumbnail = (svgString: string, width: number, height: number): Promise<string> => {
  return new Promise<string>((resolve) => {
    try {
      if (!svgString) {
        console.error('Empty SVG string provided to renderSVGThumbnail');
        resolve(createFallbackThumbnail());
        return;
      }
      
      // Ensure SVG string is properly formatted - unescaping and fixing attributes
      const unescapedSvg = unescapeSvgContent(svgString);
      const normalizedSvg = fixSvgAttributes(unescapedSvg);
      
      // Create a data URL for the SVG
      const blob = new Blob([normalizedSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      const img = new Image();
      
      // Set timeout to prevent hanging on broken SVGs
      const timeout = setTimeout(() => {
        console.warn('SVG loading timed out');
        URL.revokeObjectURL(url);
        resolve(createFallbackThumbnail());
      }, 5000);
      
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(createFallbackThumbnail());
            return;
          }

          // Clear canvas with white background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);

          // Calculate scaling to fit while maintaining aspect ratio
          const scale = Math.min(
            width / Math.max(1, img.width),
            height / Math.max(1, img.height)
          ) * 0.9; // 90% to add some padding

          // Calculate positioning to center the image
          const x = (width - img.width * scale) / 2;
          const y = (height - img.height * scale) / 2;

          // Draw the scaled image
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        } catch (drawError) {
          console.error('Error drawing SVG to canvas:', drawError);
          URL.revokeObjectURL(url);
          resolve(createFallbackThumbnail());
        }
      };

      img.onerror = (error) => {
        clearTimeout(timeout);
        console.error('Error loading SVG image:', error);
        URL.revokeObjectURL(url);
        
        // Try a simpler version of the SVG as fallback
        resolve(createFallbackThumbnail());
      };

      img.src = url;
    } catch (error) {
      console.error('Error in SVG thumbnail rendering:', error);
      resolve(createFallbackThumbnail());
    }
  });
};

// Create a fallback thumbnail when rendering fails
const createFallbackThumbnail = (): string => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    // Clear with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 200, 150);
    
    // Draw error indicator
    ctx.strokeStyle = '#f44336';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 40, 100, 70);
    
    // Add text
    ctx.font = '12px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText('Preview Error', 100, 85);
    
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Error creating fallback thumbnail:', e);
    return '';
  }
};
