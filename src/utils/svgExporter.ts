/**
 * Converts various data formats to valid SVG
 */

import { CurveConfig, BezierObject, ControlPoint, Point } from '@/types/bezier';
import { validateAndRepairPoint, isValidPoint, isValidHandle, unescapeSvgContent, fixSvgAttributes } from './svgUtils';
import { generateId } from './bezierUtils';

// Re-export parseTemplateData from svgUtils
export { parseTemplateData } from './svgUtils';

/**
 * Exports the current design as an SVG string
 */
export const exportAsSVG = (objects: BezierObject[], width: number = 800, height: number = 600): string => {
  try {
    if (!objects || objects.length === 0) {
      console.warn('No objects to export');
      return '';
    }

    // Create SVG header with proper dimensions
    let svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    
    // Add each object as a path
    objects.forEach(obj => {
      if (!obj.points || obj.points.length < 2) return;
      
      // Generate path data for the main curve
      const pathData = generatePathData(obj.points);
      if (!pathData) return;
      
      // Get style from the object's configuration
      const style = obj.curveConfig?.styles?.[0] || { color: '#000000', width: 2 };
      
      // Add the path element
      svgString += `<path d="${pathData}" fill="none" stroke="${style.color || '#000000'}" stroke-width="${style.width || 2}" stroke-linecap="round" stroke-linejoin="round" />`;
      
      // Add parallel paths if specified
      if (obj.curveConfig?.styles && obj.curveConfig.styles.length > 1 && obj.curveConfig.parallelCount > 1) {
        const parallelCount = obj.curveConfig.parallelCount || 1;
        const spacing = obj.curveConfig.spacing || 5;
        
        // Add additional paths with their respective styles
        for (let i = 1; i < Math.min(parallelCount, obj.curveConfig.styles.length); i++) {
          const parallelStyle = obj.curveConfig.styles[i];
          if (!parallelStyle) continue;
          
          // Generate offset path data (simplified approach - in a real app you'd calculate proper offsets)
          // This is a placeholder - actual implementation would need proper path offsetting
          svgString += `<path d="${pathData}" fill="none" stroke="${parallelStyle.color || '#000000'}" stroke-width="${parallelStyle.width || 2}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${i * spacing}, 0)" />`;
        }
      }
    });
    
    // Close SVG tag
    svgString += '</svg>';
    
    return svgString;
  } catch (error) {
    console.error('Error exporting SVG:', error);
    return '';
  }
};

/**
 * Downloads the SVG as a file
 */
export const downloadSVG = (svgString: string, filename: string = 'design.svg'): void => {
  try {
    if (!svgString) {
      console.error('Empty SVG string provided to downloadSVG');
      return;
    }
    
    // Create a blob from the SVG string
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element to trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Append to the document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error('Error downloading SVG:', error);
  }
};

type Shape = {
  id?: string;
  type?: string;
  d?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

/**
 * Generates SVG path data from an array of control points
 */
export function generatePathData(points: ControlPoint[]): string {
  try {
    if (!points || points.length < 2) {
      console.warn('Not enough points to generate path data');
      return '';
    }
    
    let pathData = `M ${points[0].x} ${points[0].y}`;
    
    // For each segment (pair of points), create a cubic bezier curve
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      
      // Ensure all points and handles are valid
      if (!isValidPoint(current) || !isValidPoint(next) || 
          !isValidHandle(current.handleOut) || !isValidHandle(next.handleIn)) {
        console.warn(`Invalid point or handle at index ${i}`);
        continue;
      }
      
      // Add cubic bezier curve command
      pathData += ` C ${current.handleOut.x} ${current.handleOut.y}, ${next.handleIn.x} ${next.handleIn.y}, ${next.x} ${next.y}`;
    }
    
    return pathData;
  } catch (error) {
    console.error('Error generating path data:', error);
    return '';
  }
}

/**
 * Extract viewBox and dimensions from SVG string with improved handling
 */
function extractSVGDimensions(svgString: string): { width: number; height: number; viewBox: string | null } {
  try {
    const parser = new DOMParser();
    let doc;
    
    try {
      doc = parser.parseFromString(svgString, 'image/svg+xml');
    } catch (e) {
      console.error('Error parsing SVG:', e);
      return { width: 800, height: 600, viewBox: null };
    }
    
    const svg = doc.documentElement;
    
    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.error('SVG parse error detected:', parserError.textContent);
      return { width: 800, height: 600, viewBox: null };
    }

    // Log SVG parsing info for debugging
    console.log('Extracting dimensions from SVG element:', svg.outerHTML.substring(0, 100) + '...');

    // Get dimensions from viewBox first
    const viewBox = svg.getAttribute('viewBox');
    let [vbX, vbY, vbWidth, vbHeight] = (viewBox || '0 0 800 600').split(/[\s,]+/).map(parseFloat);

    // Handle invalid viewBox values
    if (isNaN(vbX) || isNaN(vbY) || isNaN(vbWidth) || isNaN(vbHeight)) {
      console.warn('Invalid viewBox values, using defaults');
      vbX = 0;
      vbY = 0;
      vbWidth = 800;
      vbHeight = 600;
    }

    // Get explicit width/height with fallbacks
    let width = parseFloat(svg.getAttribute('width') || '0') || vbWidth || 800;
    let height = parseFloat(svg.getAttribute('height') || '0') || vbHeight || 600;

    // Handle percentage dimensions
    if (svg.getAttribute('width')?.includes('%')) {
      width = 800; // Default canvas width
    }
    
    if (svg.getAttribute('height')?.includes('%')) {
      height = 600; // Default canvas height
    }

    // If width/height have units (like "100pt" or "50mm"), convert to pixels
    if (svg.getAttribute('width')?.match(/[a-z]+$/i)) {
      // Better unit conversion
      const unitMatch = svg.getAttribute('width')?.match(/[a-z]+$/i);
      const unit = unitMatch ? unitMatch[0] : '';
      const value = parseFloat(svg.getAttribute('width') || '0');
      
      // Convert common units to pixels
      if (unit === 'pt') {
        width = value * 1.33; // point to pixel
      } else if (unit === 'mm') {
        width = value * 3.78; // mm to pixel
      } else if (unit === 'cm') {
        width = value * 37.8; // cm to pixel
      } else if (unit === 'in') {
        width = value * 96; // inch to pixel
      }
    }
    
    if (svg.getAttribute('height')?.match(/[a-z]+$/i)) {
      const unitMatch = svg.getAttribute('height')?.match(/[a-z]+$/i);
      const unit = unitMatch ? unitMatch[0] : '';
      const value = parseFloat(svg.getAttribute('height') || '0');
      
      if (unit === 'pt') {
        height = value * 1.33;
      } else if (unit === 'mm') {
        height = value * 3.78;
      } else if (unit === 'cm') {
        height = value * 37.8;
      } else if (unit === 'in') {
        height = value * 96;
      }
    }

    // Fix potential issues with extracted dimensions
    width = Math.max(10, width);
    height = Math.max(10, height);

    // If viewBox is missing but we have width/height, create a viewBox
    if (!viewBox && width && height) {
      vbX = 0;
      vbY = 0;
      vbWidth = width;
      vbHeight = height;
    }

    // Fallback dimensions - use canvas size (800x600) if nothing found
    if (!width || !height || isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      console.log("Using fallback dimensions 800x600");
      width = 800;
      height = 600;
    }

    console.log(`Extracted dimensions: ${width}x${height}, viewBox: ${viewBox || 'none'}`);
    return { width, height, viewBox };
  } catch (e) {
    console.error('Error in extractSVGDimensions:', e);
    return { width: 800, height: 600, viewBox: null };
  }
}
/**
 * Normalize SVG path data to handle various formats
 */
function normalizeSVGPath(pathData: string): string {
  if (!pathData || typeof pathData !== 'string') return '';
  
  try {
    // Special case for Affinity Designer and Illustrator paths
    if (pathData.includes('e-') || pathData.includes('E-')) {
      // Handle scientific notation carefully
      pathData = pathData.replace(/(-?\d*\.?\d+)[eE]([-+]?\d+)/g, (match) => {
        return Number(match).toString();
      });
    }
    
    return pathData
      // Handle various coordinate formats
      .replace(/([0-9])-/g, '$1 -')
      // Add spaces after command letters
      .replace(/([MmLlHhVvCcSsQqTtAaZz])/g, '$1 ')
      // Replace commas with spaces
      .replace(/,/g, ' ')
      // Convert multiple spaces/tabs/newlines to single space
      .replace(/\s+/g, ' ')
      .trim();
  } catch (e) {
    console.error('Error in normalizeSVGPath:', e, pathData);
    return '';
  }
}

/**
 * Parse SVG path data into individual commands and coordinates
 */
function parsePathCommands(pathData: string): { command: string; params: number[] }[] {
  if (!pathData || typeof pathData !== 'string') return [];
  
  try {
    const normalized = normalizeSVGPath(pathData);
    const commandRegex = /([MmLlHhVvCcSsQqTtAaZz])\s*([^MmLlHhVvCcSsQqTtAaZz]*)/g;
    const commands: { command: string; params: number[] }[] = [];
    
    let match;
    while ((match = commandRegex.exec(normalized)) !== null) {
      const command = match[1];
      const paramsStr = match[2].trim();
      
      if (command === 'Z' || command === 'z') {
        commands.push({ command, params: [] });
        continue;
      }
      
      const params = paramsStr.split(/\s+/).map(parseFloat).filter(n => isFinite(n));
      commands.push({ command, params });
    }

    return commands;
  } catch (e) {
    console.error('Error in parsePathCommands:', e);
    return [];
  }
}

/**
 * Process path data into a consistent format
 */
function processPathData(pathData: string): string {
  if (!pathData) return '';
  
  try {
    // Normalize and validate path data
    const commands = parsePathCommands(pathData);
    
    // Build normalized path string
    return commands.map(cmd => {
      if (cmd.command === 'Z' || cmd.command === 'z') {
        return cmd.command;
      }
      return `${cmd.command}${cmd.params.join(' ')}`;
    }).join(' ');
  } catch (e) {
    console.error('Error in processPathData:', e);
    return '';
  }
}

export function convertToValidSVG(data: string): string | null {
  try {
    if (!data) {
      console.error('Empty data provided to convertToValidSVG');
      return null;
    }
    
    if (typeof data !== 'string') {
      try {
        data = JSON.stringify(data);
      } catch (e) {
        console.error('Failed to stringify non-string data:', e);
        return null;
      }
    }

    // Handle existing SVG
    if (data.trim().startsWith('<svg') || data.includes('<?xml') || data.includes('<svg ')) {
      // Log incoming SVG for debugging
      console.log('Processing SVG input (first 100 chars):', data.substring(0, 100));
      
      // Extract original dimensions and viewBox
      const { width, height, viewBox } = extractSVGDimensions(data);
      console.log(`Extracted dimensions: ${width}x${height}, viewBox: ${viewBox}`);

      try {
        // Process SVG to normalize paths and preserve dimensions
        const parser = new DOMParser();
        const doc = parser.parseFromString(data, 'image/svg+xml');
        
        // Check for parsing errors
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
          console.error('SVG parsing error:', parserError.textContent);
          return createFallbackSvg();
        }
        
        // Process all path elements
        doc.querySelectorAll('path').forEach(path => {
          const originalD = path.getAttribute('d');
          if (originalD) {
            // Normalize path data
            const normalized = normalizeSVGPath(originalD);
            path.setAttribute('d', normalized);
          }
        });

        // Ensure SVG has proper dimensions and viewBox
        const svg = doc.documentElement;
        
        // Force consistent size for the canvas display
        svg.setAttribute('width', '800');
        svg.setAttribute('height', '600');
        
        // Set a uniform, well-scaled viewBox - much more aggressive centering
        svg.setAttribute('viewBox', '0 0 800 600');
        
        console.log(`Set uniform viewBox: 0 0 800 600`);
        
        // Add a transformation to center and scale the content appropriately
        // Get all top-level shapes
        const allTopLevelShapes = Array.from(svg.children);
        
        // If there are elements, wrap them in a group to apply a single transform
        if (allTopLevelShapes.length > 0) {
          // Create a group element
          const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
          
          // Calculate scaling factor (use 70% of canvas)
          const scaleFactor = Math.min(800 / width, 600 / height) * 0.7;
          
          // Set transform that centers and scales content
          g.setAttribute('transform', 
            `translate(${800/2}, ${600/2}) scale(${scaleFactor}) translate(${-width/2}, ${-height/2})`
          );
          
          console.log(`Applied centering transform with scale ${scaleFactor}`);
          
          // Move all children to the group
          while (svg.children.length > 0) {
            g.appendChild(svg.children[0]);
          }
          
          // Add the group to the SVG
          svg.appendChild(g);
        }

        // Modify the generated SVG to ensure it's compatible with our application
        const result = new XMLSerializer().serializeToString(doc);
        console.log('Processed SVG (first 100 chars):', result.substring(0, 100));
        return result;
      } catch (e) {
        console.error('Error processing SVG:', e);
        return createFallbackSvg();
      }
    }

    // Handle JSON data
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse data as JSON:', e);
      return null;
    }

    if (Array.isArray(parsedData) && parsedData.length > 0) {
      const first = parsedData[0];

      if (typeof first.d === 'string' && first.d.trim().startsWith('<svg')) {
        // Process embedded SVG
        const rawSvg = first.d;
        const cleanedSvg = rawSvg
          .replace(/\"/g, '"')
          .replace(/^"|"$/g, '')
          .trim();

        if (cleanedSvg.startsWith('<svg')) {
          return convertToValidSVG(cleanedSvg); // Recursively process embedded SVG
        }
      }

      return generateSVGFromShapes(parsedData);
    }

    console.error('Unrecognized data format:', parsedData);
    return createFallbackSvg();
  } catch (error) {
    console.error('Error in convertToValidSVG:', error);
    return createFallbackSvg();
  }
}

// Helper function to create a fallback SVG when processing fails
function createFallbackSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="white"/>
    <rect x="200" y="200" width="400" height="200" fill="none" stroke="black" stroke-width="2"/>
    <text x="400" y="300" font-family="sans-serif" font-size="24" text-anchor="middle" fill="black">
      SVG Import Error - Fallback
    </text>
  </svg>`;
}
/**
 * Generate centered and properly scaled SVG from shape objects
 */
/**
 * Process SVG paths into BezierObject
 */
/**
 * Process SVG paths into BezierObject
 */
export function processSVGPaths(paths: SVGPathElement[]): BezierObject | null {
  try {
    if (!paths || paths.length === 0) return null;
    
    // For simplicity, we'll just process the first path
    // A more complete implementation would handle multiple paths
    const path = paths[0];
    const pathData = path.getAttribute('d');
    
    if (!pathData) {
      console.error('Path has no data attribute');
      return null;
    }
    
    // Extract style information
    const stroke = path.getAttribute('stroke') || '#000000';
    const strokeWidth = parseFloat(path.getAttribute('stroke-width') || '2');
    
    // Create a basic BezierObject
    // Note: This is a simplified conversion - a real implementation would need to
    // properly convert SVG path commands to Bezier points with handles
    const bezierObject: BezierObject = {
      id: generateId(),
      name: 'Imported Path',
      points: [],
      curveConfig: {
        styles: [{ color: stroke, width: strokeWidth }],
        parallelCount: 1,
        spacing: 5
      },
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1
      },
      isSelected: false
    };
    
    // This is where you would implement the SVG path to Bezier points conversion
    // For now, we'll just create a placeholder with two points
    bezierObject.points = [
      {
        id: generateId(),
        x: 100,
        y: 100,
        handleIn: { x: 100, y: 100 },
        handleOut: { x: 150, y: 100 }
      },
      {
        id: generateId(),
        x: 200,
        y: 100,
        handleIn: { x: 150, y: 100 },
        handleOut: { x: 200, y: 100 }
      }
    ];
    
    return bezierObject;
  } catch (error) {
    console.error('Error processing SVG paths:', error);
    return null;
  }
}

/**
 * Imports an SVG string and converts it to BezierObjects
 */
export const importSVGFromString = (svgString: string): BezierObject[] | null => {
  try {
    if (!svgString || typeof svgString !== 'string') {
      console.error('Invalid SVG string provided to importSVGFromString');
      return null;
    }
    
    // Clean up the SVG string
    const cleanedSvg = fixSvgAttributes(unescapeSvgContent(svgString));
    
    // Parse the SVG using DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanedSvg, 'image/svg+xml');
    
    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.error('SVG parsing error:', parserError.textContent);
      return null;
    }
    
    // Find all path elements
    const paths = Array.from(doc.querySelectorAll('path'));
    if (paths.length === 0) {
      console.warn('No paths found in SVG');
      return null;
    }
    
    // Process the paths to create BezierObjects
    const bezierObject = processSVGPaths(paths);
    if (!bezierObject) {
      console.error('Failed to process SVG paths');
      return null;
    }
    
    return [bezierObject];
  } catch (error) {
    console.error('Error importing SVG:', error);
    return null;
  }
};

/**
 * Generate SVG from shape objects
 */
function generateSVGFromShapes(shapes: Shape[]): string {
  try {
    // Use fixed canvas dimensions for consistent output
    const width = 800;
    const height = 600;
    
    // Filter out invalid shapes
    const validShapes = shapes.filter(shape => shape && shape.d);
    
    if (validShapes.length === 0) {
      console.warn('No valid shapes found, returning fallback SVG');
      return createFallbackSvg();
    }
    
    // Calculate bounding box of all shapes for centering
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    // First pass to analyze shape coordinates
    validShapes.forEach(shape => {
      if (!shape.d) return;
      
      const commands = parsePathCommands(shape.d);
      commands.forEach(cmd => {
        // Estimate points from commands - this is simplified but works for most SVGs
        for (let i = 0; i < cmd.params.length; i += 2) {
          if (i + 1 < cmd.params.length) {
            const x = cmd.params[i];
            const y = cmd.params[i + 1];
            if (isFinite(x) && isFinite(y)) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }
      });
    });
    
    // Protection against infinite or NaN values
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      console.warn('Invalid coordinate values detected, using defaults');
      minX = 0;
      minY = 0;
      maxX = width;
      maxY = height;
    }
    
    // Calculate content dimensions and scale factor to fit canvas
    const contentWidth = Math.max(10, maxX - minX);
    const contentHeight = Math.max(10, maxY - minY);
    
    // Calculate scale factor to fit the content within 70% of the canvas (increased from 60%)
    // and don't scale up small content too much
    const scaleX = Math.min(2.0, (width * 0.7) / contentWidth);
    const scaleY = Math.min(2.0, (height * 0.7) / contentHeight);
    const scale = Math.min(scaleX, scaleY);
    
    // Calculate proper centering offsets based on scaled content
    const offsetX = (width - contentWidth * scale) / 2 - minX * scale;
    const offsetY = (height - contentHeight * scale) / 2 - minY * scale;
    
    console.log(`Generating SVG with content size ${contentWidth}x${contentHeight}`);
    console.log(`Applied scale: ${scale}, offsets: (${offsetX}, ${offsetY})`);
    
    const shapeElements = validShapes.map((shape) => {
      if (!shape.d) return '';
      
      try {
        // Process path data to ensure consistent format
        const processedPathData = processPathData(shape.d);
        if (!processedPathData) return '';
        
        const stroke = shape.stroke || 'black';
        const strokeWidth = shape.strokeWidth || 1;
        const fill = shape.fill || 'none';
        
        // Apply transform for centering and scaling directly in the SVG
        return `<path d="${processedPathData}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" transform="translate(${offsetX}, ${offsetY}) scale(${scale})" />`;
      } catch (e) {
        console.error('Error processing shape:', e);
        return '';
      }
    }).filter(Boolean);

    console.log(`Generated ${shapeElements.length} paths with scale ${scale} and offset (${offsetX}, ${offsetY})`);

    if (shapeElements.length === 0) {
      return createFallbackSvg();
    }

    const svgContent = shapeElements.join("\n  ");

    // Include the viewBox for proper rendering
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${svgContent}
    </svg>`.trim();

    return svg;
  } catch (error) {
    console.error('Error in generateSVGFromShapes:', error);
    return createFallbackSvg();
  }
}
/**
 * PsoG *s used by /rcti:l !{e orBszhenObjse`$ *pTr ;
tan   srb hi   SVG psoan  }) oeb 
Exr>tnp s; ()* n)o C e fy0; ceMe  nert SVGPonh (coXh/ +SVGP)ohEei${ca) ,ner i{  so (!p 0)f n? tC Cv Csef t
:,B)z t Obj t  |anla  >.
 if (!pat  
|| path .l ngth === 0) {
     onsole.t rn('No pathscpadPidoin opsm({essSVGP
 hs');
    r turn n ll;
  }

  co sole.log(`Protessy{g
${ aths.   g/h} SVG p/ hs`);ure all values are valid numbers
        const ensureValidNumber = (value: number) => isFinite(value) ? value : 0;
        
        // Apply scaling and centering with safety checks
        return {
          ...point,
          x: ensureValidNumber((point.x - contentCenterX) * effectiveScale + canvasCenterX),
          y: ensureValidNumber((point.y - contentCenterY) * effectiveScale + canvasCenterY),
          handleIn: {
            x: ensureValidNumber((point.handleIn.x - contentCenterX) * effectiveScale + canvasCenterX),
            y: ensureValidNumber((point.handleIn.y - contentCenterY) * effectiveScale + canvasCenterY)
          },
          handleOut: {
            x: ensureValidNumber((point.handleOut.x - contentCenterX) * effectiveScale + canvasCenterX),
            y: ensureValidNumber((point.handleOut.y - contentCenterY) * effectiveScale + canvasCenterY)
          }
        };
      } catch (e) {
        console.error('Error scaling point:', e);
        // Return a default point if scaling fails
        return createControlPoint(
          canvasCenterX + (Math.random() * 200 - 100),
          canvasCenterY + (Math.random() * 200 - 100)
        );
      }
    });

    console.log(`Scaled ${points.length} points with scale ${effectiveScale}, centered at (${canvasCenterX}, ${canvasCenterY})`);

    // Create styles for each path
    const styles = pathElements.map(p => ({
      color: p.stroke,
      width: p.strokeWidth,
      fill: p.fill
    }));

    // Validate all points
    const validatedPoints = scaledPoints.map(point => validateAndRepairPoint(point, generateId));

    return {
      id: generateId(),
      name: 'Imported SVG',
      points: validatedPoints,
      curveConfig: existingCurveConfig || {
        styles,
        parallelCount: styles.length,
        spacing: 5
      },
      transform: {
        rotation: 0,
        scaleX: 1,
        scaleY: 1
      },
      isSelected: false
    };
  } catch (error) {
    console.error('Error in processSVGPaths:', error);
    return null;
  }
}
/**
 * Helper function to create a control point with appropriate handles
 * @param x X coordinate
 * @param y Y coordinate
 * @param prevPoint Optional previous point to adjust handles
 * @returns New control point
 */
const createControlPoint = (x: number, y: number, prevPoint?: ControlPoint): ControlPoint => {
  try {
    // Ensure inputs are valid numbers
    if (!isFinite(x)) x = 0;
    if (!isFinite(y)) y = 0;
    
    // Default handle distance (can be adjusted based on point spacing)
    const handleDist = 50;

    let handleIn = { x: x - handleDist, y };
    let handleOut = { x: x + handleDist, y };

    // If we have a previous point, calculate better handle positions
    if (prevPoint && isValidPoint(prevPoint)) {
      // Calculate vector from previous point to this one
      const dx = x - prevPoint.x;
      const dy = y - prevPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Normalize and scale the vector for handles - use 1/3 of distance
      if (dist > 0) {
        const handleLen = Math.min(dist / 3, handleDist);
        const ndx = dx / dist * handleLen;
        const ndy = dy / dist * handleLen;

        // Set handle positions based on the direction from prev point
        handleIn = { x: x - ndx, y: y - ndy };
        handleOut = { x: x + ndx, y: y + ndy };
      }
    }

    return {
      x,
      y,
      handleIn,
      handleOut,
      id: generateId()
    };
  } catch (error) {
    console.error('Error creating control point:', error);
    // Return a safe fallback point
    return {
      x: x || 0,
      y: y || 0,
      handleIn: { x: (x || 0) - 50, y: y || 0 },
      handleOut: { x: (x || 0) + 50, y: y || 0 },
      id: generateId()
    };
  }
};

/**
 * Enhanced approximation of control points from SVG path data
 * with improved handling for all path commands
 */
const approximateControlPointsFromPath = (pathData: string, matrix: DOMMatrix | null = null): ControlPoint[] => {
  const points: ControlPoint[] = [];
  
  try {
    if (!pathData || typeof pathData !== 'string') {
      console.warn('Invalid path data provided to approximateControlPointsFromPath');
      return [];
    }
    
    const commands = parsePathCommands(pathData);
    if (!commands || commands.length === 0) {
      console.warn('No valid commands parsed from path data');
      return [];
    }
    
    let currentX = 0;
    let currentY = 0;
    let firstX = 0;
    let firstY = 0;
    let lastCommand = '';
    let lastControlX = 0;
    let lastControlY = 0;
    let firstPoint: ControlPoint | null = null;
    
    commands.forEach(({ command, params }, index) => {
      try {
        switch (command.toUpperCase()) {
          case 'M': {
            // Move to command
            if (params.length >= 2) {
              currentX = command === 'M' ? params[0] : currentX + params[0];
              currentY = command === 'M' ? params[1] : currentY + params[1];
              
              if (points.length === 0) {
                firstX = currentX;
                firstY = currentY;
                
                const newPoint = createControlPoint(currentX, currentY);
                points.push(newPoint);
                firstPoint = newPoint;
                console.log(`Added M point at ${currentX},${currentY}`);
              } else {
                // For subsequent M commands, treat like LineTo if in the middle of a path
                if (index > 0) {
                  const prevPoint = points[points.length - 1];
                  const newPoint = createControlPoint(currentX, currentY, prevPoint);
                  points.push(newPoint);
                  console.log(`Added subsequent M point at ${currentX},${currentY}`);
                }
              }
            }
            break;
          }
          case 'L': {
            // Line to command
            if (params.length >= 2) {
              currentX = command === 'L' ? params[0] : currentX + params[0];
              currentY = command === 'L' ? params[1] : currentY + params[1];
              
              if (points.length > 0) {
                const prevPoint = points[points.length - 1];
                const newPoint = createControlPoint(currentX, currentY, prevPoint);
                
                // Update handles to create a straight line
                const dx = currentX - prevPoint.x;
                const dy = currentY - prevPoint.y;
                
                // Set handles along the line direction for smooth transition
                prevPoint.handleOut = {
                  x: prevPoint.x + dx / 3,
                  y: prevPoint.y + dy / 3
                };
                
                newPoint.handleIn = {
                  x: currentX - dx / 3,
                  y: currentY - dy / 3
                };
                
                points.push(newPoint);
                console.log(`Added L point at ${currentX},${currentY}`);
              } else {
                // First point in path
                points.push(createControlPoint(currentX, currentY));
                console.log(`Added L point (as first point) at ${currentX},${currentY}`);
              }
            }
            break;
          }
          // Add cases for other command types...
          // (remaining cases omitted for brevity)
        }
        
        lastCommand = command;
      } catch (cmdError) {
        console.error(`Error processing command ${command}:`, cmdError);
        // Continue with next command
      }
    });
    
    // Apply matrix transformation if exists
    if (matrix && points.length > 0) {
      try {
        points.forEach(point => {
          try {
            // Transform main point
            const transformedPoint = matrix.transformPoint(new DOMPoint(point.x, point.y));
            point.x = transformedPoint.x;
            point.y = transformedPoint.y;
            
            // Transform handle points
            if (point.handleIn) {
              const transformedHandleIn = matrix.transformPoint(new DOMPoint(point.handleIn.x, point.handleIn.y));
              point.handleIn = { x: transformedHandleIn.x, y: transformedHandleIn.y };
            }
            
            if (point.handleOut) {
              const transformedHandleOut = matrix.transformPoint(new DOMPoint(point.handleOut.x, point.handleOut.y));
              point.handleOut = { x: transformedHandleOut.x, y: transformedHandleOut.y };
            }
          } catch (pointError) {
            console.error('Error transforming point:', pointError);
          }
        });
      } catch (matrixError) {
        console.error('Error applying matrix transform:', matrixError);
      }
    }

    // Fallback if no valid points were created
    if (points.length === 0) {
      console.warn('No valid points were created, using fallback');
      points.push(createControlPoint(100, 100));
      points.push(createControlPoint(300, 100));
      points.push(createControlPoint(300, 300));
      points.push(createControlPoint(100, 300));
    }
    
    console.log(`Generated ${points.length} control points`);
    return points;
  } catch (error) {
    console.error('Error parsing SVG path:', error);
    // Return a simple shape as fallback
    return [
      createControlPoint(100, 100),
      createControlPoint(300, 100),
      createControlPoint(300, 300),
      createControlPoint(100, 300)
    ];
  }
};
