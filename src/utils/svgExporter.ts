import { 
  ControlPoint, 
  CurveConfig, 
  TransformSettings, 
  BezierObject,
  CurveStyle
} from '../types/bezier';
import { generatePathData } from './bezierUtils';

/**
 * Exports multiple BezierObjects to SVG format
 * @param objects Array of BezierObjects to export
 * @param canvasWidth Width of the canvas
 * @param canvasHeight Height of the canvas
 * @param includeBackground Whether to include a white background
 * @returns SVG string representation of the designs
 */
export const exportAsSVG = (
  objects: BezierObject[],
  canvasWidth: number,
  canvasHeight: number,
  includeBackground: boolean = true
): string => {
  try {
    // Create SVG root with namespace, dimensions and viewBox
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" 
      viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns:xlink="http://www.w3.org/1999/xlink">`;
    
    // Add metadata
    svg += `<metadata>Created with Bezier Curve Designer</metadata>`;
    
    // Add background if requested
    if (includeBackground) {
      svg += `<rect width="${canvasWidth}" height="${canvasHeight}" fill="white"/>`;
    }
    
    // Process each object
    objects.forEach((object, index) => {
      // Skip objects without points
      if (!object.points || object.points.length < 2) {
        return;
      }
      
      const { points, transform = defaultTransform(), curveConfig = defaultCurveConfig() } = object;
      
      // Calculate the center of points for this object's transformation
      const centerX = getPointsCenterX(points, canvasWidth);
      const centerY = getPointsCenterY(points, canvasHeight);
      
      // Create a group for this object with ID and metadata
      svg += `<g id="${object.id || `bezier-object-${index}`}" 
        data-name="${object.name || `Object ${index + 1}`}"
        transform="translate(${object.position?.x || 0}, ${object.position?.y || 0}) 
        rotate(${transform.rotation || 0} ${centerX} ${centerY}) 
        scale(${transform.scaleX || 1} ${transform.scaleY || 1})">`;
      
      // Only draw parallel curves if parallelCount is greater than 1
      if (curveConfig.parallelCount > 1) {
        // Draw parallel curves behind main curve
        for (let i = 1; i < curveConfig.parallelCount; i++) {
          const offset = i * (curveConfig.spacing || 5);
          const style = curveConfig.styles?.[i] || curveConfig.styles?.[0] || defaultCurveStyle();
          
          // Draw a path for each parallel curve
          const pathData = generatePathData(points, offset);
          if (pathData) {
            svg += generateSVGPath(pathData, style);
          }
        }
      }
      
      // Draw main curve on top
      const mainPathData = generatePathData(points);
      if (mainPathData) {
        const mainStyle = curveConfig.styles?.[0] || defaultCurveStyle();
        svg += generateSVGPath(mainPathData, mainStyle);
      }
      
      // Add control points as markers if needed (useful for debugging)
      if (object.showControlPoints) {
        points.forEach((point, i) => {
          // Main point
          svg += `<circle cx="${point.x}" cy="${point.y}" r="4" fill="red"/>`;
          // Handle in
          svg += `<circle cx="${point.handleIn.x}" cy="${point.handleIn.y}" r="3" fill="blue"/>`;
          // Handle out
          svg += `<circle cx="${point.handleOut.x}" cy="${point.handleOut.y}" r="3" fill="green"/>`;
          // Connecting lines
          svg += `<line x1="${point.x}" y1="${point.y}" x2="${point.handleIn.x}" y2="${point.handleIn.y}" 
            stroke="rgba(0,0,255,0.5)" stroke-width="1"/>`;
          svg += `<line x1="${point.x}" y1="${point.y}" x2="${point.handleOut.x}" y2="${point.handleOut.y}" 
            stroke="rgba(0,255,0,0.5)" stroke-width="1"/>`;
        });
      }
      
      // Close the group
      svg += '</g>';
    });
    
    // Close SVG tag
    svg += '</svg>';
    
    return svg;
  } catch (error) {
    console.error('Error generating SVG:', error);
    // Return a simple error SVG
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
      <rect width="${canvasWidth}" height="${canvasHeight}" fill="white"/>
      <text x="${canvasWidth/2}" y="${canvasHeight/2}" font-family="sans-serif" font-size="14" text-anchor="middle" fill="red">
        Error generating SVG
      </text>
    </svg>`;
  }
};

/**
 * Generates an SVG path element from path data and style
 */
const generateSVGPath = (pathData: string, style: CurveStyle): string => {
  return `<path 
    d="${pathData}" 
    fill="${style.fill || 'none'}" 
    stroke="${style.color || '#000000'}" 
    stroke-width="${style.width || 2}" 
    stroke-opacity="${style.opacity !== undefined ? style.opacity : 1}" 
    stroke-linecap="${style.lineCap || 'round'}" 
    stroke-linejoin="${style.lineJoin || 'round'}"
    stroke-dasharray="${style.dashArray || ''}"
  />`;
};

/**
 * Gets the center X coordinate of a set of points
 */
const getPointsCenterX = (points: ControlPoint[], defaultWidth: number): number => {
  if (!points || points.length === 0) return defaultWidth / 2;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  return sumX / points.length;
};

/**
 * Gets the center Y coordinate of a set of points
 */
const getPointsCenterY = (points: ControlPoint[], defaultHeight: number): number => {
  if (!points || points.length === 0) return defaultHeight / 2;
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  return sumY / points.length;
};

/**
 * Default transform settings
 */
const defaultTransform = (): TransformSettings => {
  return {
    rotation: 0,
    scaleX: 1,
    scaleY: 1
  };
};

/**
 * Default curve configuration
 */
const defaultCurveConfig = (): CurveConfig => {
  return {
    parallelCount: 1,
    spacing: 5,
    styles: [defaultCurveStyle()]
  };
};

/**
 * Default curve style
 */
const defaultCurveStyle = (): CurveStyle => {
  return {
    color: '#000000',
    width: 2,
    opacity: 1,
    fill: 'none',
    lineCap: 'round',
    lineJoin: 'round'
  };
};

/**
 * Downloads an SVG file to the user's device
 * @param svgContent SVG content to download
 * @param fileName Name for the downloaded file (without extension)
 */
export const downloadSVG = (svgContent: string, fileName: string = 'bezier-design'): void => {
  try {
    // Ensure we have a valid file name
    const sanitizedName = fileName.trim() || 'bezier-design';
    const fileNameWithExt = sanitizedName.endsWith('.svg') ? sanitizedName : `${sanitizedName}.svg`;
    
    // Create blob and download link
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNameWithExt;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Error downloading SVG:', error);
    throw new Error('Failed to download SVG file.');
  }
};

/**
 * Generates a thumbnail from SVG content
 * @param svgString SVG content to create thumbnail from
 * @param width Thumbnail width
 * @param height Thumbnail height
 * @returns Promise that resolves to a data URL of the thumbnail
 */
export const generateThumbnail = async (
  svgString: string, 
  width: number = 200, 
  height: number = 150
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      const svg = new Blob([svgString], {type: 'image/svg+xml'});
      const url = URL.createObjectURL(svg);
      
      img.onload = () => {
        // Create a small canvas for the thumbnail
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Could not get canvas context"));
          return;
        }
        
        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate aspect ratio to fit the image
        const scale = Math.min(
          canvas.width / img.width,
          canvas.height / img.height
        );
        
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        
        // Draw the SVG on the canvas
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        
        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load SVG for thumbnail"));
      };
      
      img.src = url;
    } catch (error) {
      reject(new Error(`Error generating thumbnail: ${error}`));
    }
  });
};

/**
 * Validates that an SVG string is properly formatted
 * @param svgString SVG content to validate
 * @returns Whether the SVG is valid
 */
export const validateSVG = (svgString: string): boolean => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    
    // Check if parsing produced errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      return false;
    }
    
    // Check for required SVG structure
    const svg = doc.querySelector('svg');
    if (!svg) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating SVG:', error);
    return false;
  }
};

/**
 * Converts SVG string to a PNG data URL
 * @param svgString SVG content to convert
 * @param width Width of the PNG
 * @param height Height of the PNG
 * @returns Promise that resolves to a PNG data URL
 */
export const convertSVGtoPNG = async (
  svgString: string,
  width: number,
  height: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      const svg = new Blob([svgString], {type: 'image/svg+xml'});
      const url = URL.createObjectURL(svg);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Could not get canvas context"));
          return;
        }
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        
        // Draw SVG
        ctx.drawImage(img, 0, 0, width, height);
        
        // Get data URL
        const pngDataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(pngDataUrl);
      };
      
      img.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load SVG for PNG conversion: ${error}`));
      };
      
      img.src = url;
    } catch (error) {
      reject(new Error(`Error converting SVG to PNG: ${error}`));
    }
  });
};