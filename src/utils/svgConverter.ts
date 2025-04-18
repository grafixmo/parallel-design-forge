
/**
 * Converts various data formats to valid SVG
 */

import { CurveConfig, BezierObject, ControlPoint, Point } from '@/types/bezier';

type Shape = {
  id?: string;
  type?: string;
  d?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

/**
 * Extract viewBox and dimensions from SVG string with improved handling
 */
function extractSVGDimensions(svgString: string): { width: number; height: number; viewBox: string | null } {
  const parser = new DOMParser();
  let doc;
  
  try {
    doc = parser.parseFromString(svgString, 'image/svg+xml');
  } catch (e) {
    console.error('Error parsing SVG:', e);
    return { width: 800, height: 600, viewBox: null };
  }
  
  const svg = doc.documentElement;

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
}

/**
 * Normalize SVG path data to handle various formats
 */
function normalizeSVGPath(pathData: string): string {
  if (!pathData) return '';
  
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
}

/**
 * Parse SVG path data into individual commands and coordinates
 */
function parsePathCommands(pathData: string): { command: string; params: number[] }[] {
  if (!pathData) return [];
  
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
    
    const params = paramsStr.split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
    commands.push({ command, params });
  }

  return commands;
}

/**
 * Process path data into a consistent format
 */
function processPathData(pathData: string): string {
  if (!pathData) return '';
  
  // Normalize and validate path data
  const commands = parsePathCommands(pathData);
  
  // Build normalized path string
  return commands.map(cmd => {
    if (cmd.command === 'Z' || cmd.command === 'z') {
      return cmd.command;
    }
    return `${cmd.command}${cmd.params.join(' ')}`;
  }).join(' ');
}

export function convertToValidSVG(data: string): string | null {
  try {
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
          return null;
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
        // Return the original SVG as fallback
        return data;
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
    return null;
  } catch (error) {
    console.error('Error in convertToValidSVG:', error);
    return null;
  }
}

/**
 * Generate centered and properly scaled SVG from shape objects
 */
export function generateSVGFromShapes(shapes: Shape[]): string {
  // Use fixed canvas dimensions for consistent output
  const width = 800;
  const height = 600;
  
  // Calculate bounding box of all shapes for centering
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  // First pass to analyze shape coordinates
  shapes.forEach(shape => {
    if (!shape.d) return;
    
    const commands = parsePathCommands(shape.d);
    commands.forEach(cmd => {
      // Estimate points from commands - this is simplified but works for most SVGs
      for (let i = 0; i < cmd.params.length; i += 2) {
        if (i + 1 < cmd.params.length) {
          const x = cmd.params[i];
          const y = cmd.params[i + 1];
          if (!isNaN(x) && !isNaN(y)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
    });
  });
  
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
  
  const shapeElements = shapes.map((shape) => {
    if (!shape.d) return '';
    
    // Process path data to ensure consistent format
    const processedPathData = processPathData(shape.d);
    
    const stroke = shape.stroke || 'black';
    const strokeWidth = shape.strokeWidth || 1;
    const fill = shape.fill || 'none';
    
    // Apply transform for centering and scaling directly in the SVG
    return `<path d="${processedPathData}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" transform="translate(${offsetX}, ${offsetY}) scale(${scale})" />`;
  }).filter(Boolean);

  console.log(`Generated ${shapeElements.length} paths with scale ${scale} and offset (${offsetX}, ${offsetY})`);

  const svgContent = shapeElements.join("\n  ");

  // Include the viewBox for proper rendering
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${svgContent}
</svg>`.trim();

  return svg;
}

/**
 * Process SVG paths to create a BezierObject
 * This is used by the SVG importer in svgExporter.ts
 */
export function processSVGPaths(paths: SVGPathElement[], existingCurveConfig?: CurveConfig): BezierObject | null {
  if (paths.length === 0) return null;

  console.log(`Processing ${paths.length} SVG paths`);

  // Extract path data and calculate bounds
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const pathElements = paths.map(path => {
    const d = path.getAttribute('d') || '';
    
    // Calculate bounds from path coordinates
    const points = approximateControlPointsFromPath(d);
    points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });

    return {
      d,
      stroke: path.getAttribute('stroke') || '#000000',
      strokeWidth: parseFloat(path.getAttribute('stroke-width') || '2'),
      fill: path.getAttribute('fill') || 'none'
    };
  }).filter(p => p.d);

  if (pathElements.length === 0) return null;

  // Calculate content dimensions - ensure we have valid bounds
  minX = isFinite(minX) ? minX : 0;
  minY = isFinite(minY) ? minY : 0;
  maxX = isFinite(maxX) ? maxX : 800;
  maxY = isFinite(maxY) ? maxY : 600;
  
  const contentWidth = Math.max(10, maxX - minX);
  const contentHeight = Math.max(10, maxY - minY);
  
  // Calculate scale to fit the content within 70% of the canvas (800x600) - increased from 60%
  // Scale more aggressively to fix tiny SVG issue
  const scaleX = Math.min(2.0, (800 * 0.7) / contentWidth);
  const scaleY = Math.min(2.0, (600 * 0.7) / contentHeight);
  const scale = Math.min(scaleX, scaleY);
  
  // Calculate canvas center and content center for proper centering
  const canvasCenterX = 400; // 800/2
  const canvasCenterY = 300; // 600/2
  const contentCenterX = (minX + maxX) / 2;
  const contentCenterY = (minY + maxY) / 2;

  console.log(`Content size: ${contentWidth}x${contentHeight}, scale: ${scale}`);
  console.log(`Canvas center: (${canvasCenterX}, ${canvasCenterY}), Content center: (${contentCenterX}, ${contentCenterY})`);

  // Generate scaled and centered points
  const points = approximateControlPointsFromPath(pathElements[0].d);
  
  // Apply additional safety checks before scaling
  if (points.length === 0) {
    console.error('No points could be extracted from the path');
    return null;
  }
  
  // Scale more conservatively if we have extreme values
  const effectiveScale = isFinite(scale) && scale > 0 ? scale : 1.0;
  
  const scaledPoints = points.map(point => {
    // Ensure all values are valid numbers
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
  });

  console.log(`Scaled ${points.length} points with scale ${effectiveScale}, centered at (${canvasCenterX}, ${canvasCenterY})`);

  // Create styles for each path
  const styles = pathElements.map(p => ({
    color: p.stroke,
    width: p.strokeWidth,
    fill: p.fill
  }));

  return {
    id: generateId(),
    name: 'Imported SVG',
    points: scaledPoints,
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
}

import { generateId } from './bezierUtils';

/**
 * Approximate control points from an SVG path data string with optional transform
 */
const approximateControlPointsFromPath = (pathData: string, matrix: DOMMatrix | null = null): ControlPoint[] => {
  const points: ControlPoint[] = [];
  try {
    if (!pathData) return [];
    
    const commands = parsePathCommands(pathData);
    
    let currentX = 0;
    let currentY = 0;
    let firstX = 0;
    let firstY = 0;
    let lastCommand = '';
    let lastControlX = 0;
    let lastControlY = 0;
    
    commands.forEach(({ command, params }) => {
      switch (command.toUpperCase()) {
        case 'M': {
          // Move to command
          if (params.length >= 2) {
            currentX = command === 'M' ? params[0] : currentX + params[0];
            currentY = command === 'M' ? params[1] : currentY + params[1];
            
            if (points.length === 0) {
              firstX = currentX;
              firstY = currentY;
            }
            
            points.push(createControlPoint(currentX, currentY));
            console.log(`Added M point at ${currentX},${currentY}`);
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
              points.push(createControlPoint(currentX, currentY, prevPoint));
            } else {
              points.push(createControlPoint(currentX, currentY));
            }
            console.log(`Added L point at ${currentX},${currentY}`);
          }
          break;
        }
        case 'H': {
          // Horizontal line to
          if (params.length >= 1) {
            currentX = command === 'H' ? params[0] : currentX + params[0];
            
            if (points.length > 0) {
              const prevPoint = points[points.length - 1];
              points.push(createControlPoint(currentX, currentY, prevPoint));
            } else {
              points.push(createControlPoint(currentX, currentY));
            }
          }
          break;
        }
        case 'V': {
          // Vertical line to
          if (params.length >= 1) {
            currentY = command === 'V' ? params[0] : currentY + params[0];
            
            if (points.length > 0) {
              const prevPoint = points[points.length - 1];
              points.push(createControlPoint(currentX, currentY, prevPoint));
            } else {
              points.push(createControlPoint(currentX, currentY));
            }
          }
          break;
        }
        case 'C': {
          // Cubic bezier curve command
          if (params.length >= 6) {
            const [x1, y1, x2, y2, x, y] = params;
            
            // Convert to absolute coordinates if needed
            const absX1 = command === 'c' ? currentX + x1 : x1;
            const absY1 = command === 'c' ? currentY + y1 : y1;
            const absX2 = command === 'c' ? currentX + x2 : x2;
            const absY2 = command === 'c' ? currentY + y2 : y2;
            const absX = command === 'c' ? currentX + x : x;
            const absY = command === 'c' ? currentY + y : y;
            
            // Update last point's handle out
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              lastPoint.handleOut = { x: absX1, y: absY1 };
            }
            
            // Add new point with handles
            points.push({
              x: absX,
              y: absY,
              handleIn: { x: absX2, y: absY2 },
              handleOut: { x: absX + (absX - absX2), y: absY + (absY - absY2) },
              id: generateId()
            });
            
            // Save last control point for S command
            lastControlX = absX2;
            lastControlY = absY2;
            
            currentX = absX;
            currentY = absY;
            console.log(`Added C point at ${absX},${absY}`);
          }
          break;
        }
        case 'S': {
          // Smooth cubic bezier curve
          if (params.length >= 4) {
            const [x2, y2, x, y] = params;
            
            // Convert to absolute coordinates
            const absX2 = command === 's' ? currentX + x2 : x2;
            const absY2 = command === 's' ? currentY + y2 : y2;
            const absX = command === 's' ? currentX + x : x;
            const absY = command === 's' ? currentY + y : y;
            
            // Calculate the first control point as reflection of the previous curve's second control point
            let absX1 = currentX;
            let absY1 = currentY;
            
            if (points.length > 0 && (lastCommand.toUpperCase() === 'C' || lastCommand.toUpperCase() === 'S')) {
              absX1 = currentX + (currentX - lastControlX);
              absY1 = currentY + (currentY - lastControlY);
            }
            
            // Update last point's handle out
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              lastPoint.handleOut = { x: absX1, y: absY1 };
            }
            
            // Add new point with handles
            points.push({
              x: absX,
              y: absY,
              handleIn: { x: absX2, y: absY2 },
              handleOut: { x: absX + (absX - absX2), y: absY + (absY - absY2) },
              id: generateId()
            });
            
            // Save last control point for next S command
            lastControlX = absX2;
            lastControlY = absY2;
            
            currentX = absX;
            currentY = absY;
          }
          break;
        }
        case 'Q': {
          // Quadratic bezier curve
          if (params.length >= 4) {
            const [x1, y1, x, y] = params;
            
            // Convert to absolute coordinates
            const absX1 = command === 'q' ? currentX + x1 : x1;
            const absY1 = command === 'q' ? currentY + y1 : y1;
            const absX = command === 'q' ? currentX + x : x;
            const absY = command === 'q' ? currentY + y : y;
            
            // For quadratic curves, we need to convert to cubic control points
            const cp1x = currentX + 2/3 * (absX1 - currentX);
            const cp1y = currentY + 2/3 * (absY1 - currentY);
            const cp2x = absX + 2/3 * (absX1 - absX);
            const cp2y = absY + 2/3 * (absY1 - absY);
            
            // Update last point's handle out
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              lastPoint.handleOut = { x: cp1x, y: cp1y };
            }
            
            // Add new point with handles
            points.push({
              x: absX,
              y: absY,
              handleIn: { x: cp2x, y: cp2y },
              handleOut: { x: absX + (absX - cp2x), y: absY + (absY - cp2y) },
              id: generateId()
            });
            
            // Save control point for T command
            lastControlX = absX1;
            lastControlY = absY1;
            
            currentX = absX;
            currentY = absY;
          }
          break;
        }
        case 'T': {
          // Smooth quadratic bezier curve
          if (params.length >= 2) {
            const [x, y] = params;
            
            // Convert to absolute coordinates
            const absX = command === 't' ? currentX + x : x;
            const absY = command === 't' ? currentY + y : y;
            
            // Calculate the control point as reflection of the previous curve's control point
            let absX1 = currentX;
            let absY1 = currentY;
            
            if (points.length > 0 && (lastCommand.toUpperCase() === 'Q' || lastCommand.toUpperCase() === 'T')) {
              absX1 = currentX + (currentX - lastControlX);
              absY1 = currentY + (currentY - lastControlY);
            }
            
            // Convert quadratic to cubic (same as Q command)
            const cp1x = currentX + 2/3 * (absX1 - currentX);
            const cp1y = currentY + 2/3 * (absY1 - currentY);
            const cp2x = absX + 2/3 * (absX1 - absX);
            const cp2y = absY + 2/3 * (absY1 - absY);
            
            // Update last point's handle out
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              lastPoint.handleOut = { x: cp1x, y: cp1y };
            }
            
            // Add new point with handles
            points.push({
              x: absX,
              y: absY,
              handleIn: { x: cp2x, y: cp2y },
              handleOut: { x: absX + (absX - cp2x), y: absY + (absY - cp2y) },
              id: generateId()
            });
            
            // Save control point for next T command
            lastControlX = absX1;
            lastControlY = absY1;
            
            currentX = absX;
            currentY = absY;
          }
          break;
        }
        case 'A': {
          // Arc command - approximate with cubic curves
          if (params.length >= 7) {
            const [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y] = params;
            
            // Convert to absolute coordinates
            const absX = command === 'a' ? currentX + x : x;
            const absY = command === 'a' ? currentY + y : y;
            
            // For simplicity, just create a straight line with handles
            // A proper implementation would convert the arc to cubic bezier segments
            if (points.length > 0) {
              const prevPoint = points[points.length - 1];
              const newPoint = createControlPoint(absX, absY, prevPoint);
              
              // Add some curvature in the direction of movement
              const dx = absX - currentX;
              const dy = absY - currentY;
              const dist = Math.sqrt(dx*dx + dy*dy);
              const bendFactor = Math.min(dist * 0.5, 50);
              
              prevPoint.handleOut = {
                x: currentX + dx * 0.25 + (sweepFlag ? bendFactor : -bendFactor) * dy / dist,
                y: currentY + dy * 0.25 + (sweepFlag ? -bendFactor : bendFactor) * dx / dist
              };
              
              newPoint.handleIn = {
                x: absX - dx * 0.25 + (sweepFlag ? bendFactor : -bendFactor) * dy / dist,
                y: absY - dy * 0.25 + (sweepFlag ? -bendFactor : bendFactor) * dx / dist
              };
              
              points.push(newPoint);
            } else {
              points.push(createControlPoint(absX, absY));
            }
            
            currentX = absX;
            currentY = absY;
          }
          break;
        }
        case 'Z': {
          // Close path command - connect back to first point
          if (points.length > 0 && (currentX !== firstX || currentY !== firstY)) {
            const lastPoint = points[points.length - 1];
            const firstPoint = points[0];
            
            // Create smooth connection back to start
            const dx = firstX - lastPoint.x;
            const dy = firstY - lastPoint.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Only add closing handles if there's a reasonable distance
            if (dist > 5) {
              // Update the last point's handleOut
              lastPoint.handleOut = {
                x: lastPoint.x + dx / 3,
                y: lastPoint.y + dy / 3
              };
              
              // Update the first point's handleIn
              firstPoint.handleIn = {
                x: firstX - dx / 3,
                y: firstY - dy / 3
              };
            }
            
            currentX = firstX;
            currentY = firstY;
          }
          break;
        }
      }
      
      lastCommand = command;
      
      // Apply matrix transformation if exists
      if (matrix && points.length > 0) {
        const lastPoint = points[points.length - 1];
        const transformedPoint = matrix.transformPoint(new DOMPoint(lastPoint.x, lastPoint.y));
        lastPoint.x = transformedPoint.x;
        lastPoint.y = transformedPoint.y;
        
        if (lastPoint.handleIn) {
          const transformedHandleIn = matrix.transformPoint(new DOMPoint(lastPoint.handleIn.x, lastPoint.handleIn.y));
          lastPoint.handleIn = { x: transformedHandleIn.x, y: transformedHandleIn.y };
        }
        
        if (lastPoint.handleOut) {
          const transformedHandleOut = matrix.transformPoint(new DOMPoint(lastPoint.handleOut.x, lastPoint.handleOut.y));
          lastPoint.handleOut = { x: transformedHandleOut.x, y: transformedHandleOut.y };
        }
      }
    });
    
    console.log(`Generated ${points.length} control points`);
    return points;
  } catch (error) {
    console.error('Error parsing SVG path:', error);
    return [];
  }
};

/**
 * Helper function to create a control point with appropriate handles
 * @param x X coordinate
 * @param y Y coordinate
 * @param prevPoint Optional previous point to adjust handles
 * @returns New control point
 */
const createControlPoint = (x: number, y: number, prevPoint?: ControlPoint): ControlPoint => {
  // Default handle distance (can be adjusted based on point spacing)
  const handleDist = 50;

  let handleIn = { x: x - handleDist, y };
  let handleOut = { x: x + handleDist, y };

  // If we have a previous point, calculate better handle positions
  if (prevPoint) {
    // Calculate vector from previous point to this one
    const dx = x - prevPoint.x;
    const dy = y - prevPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Normalize and scale the vector for handles
    if (dist > 0) {
      const ndx = dx / dist * handleDist;
      const ndy = dy / dist * handleDist;

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
};
