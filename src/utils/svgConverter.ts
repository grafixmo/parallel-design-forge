
/**
 * Converts various data formats to valid SVG
 */

import { CurveConfig, BezierObject } from '@/types/bezier';
type Shape = {
  id?: string;
  type?: string;
  d?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

/**
 * Extract viewBox and dimensions from SVG string
 */
function extractSVGDimensions(svgString: string): { width: number; height: number; viewBox: string | null } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.documentElement;

  // Get dimensions from viewBox first
  const viewBox = svg.getAttribute('viewBox');
  let [vbX, vbY, vbWidth, vbHeight] = (viewBox || '0 0 0 0').split(/[\s,]+/).map(parseFloat);

  // Get explicit width/height
  let width = parseFloat(svg.getAttribute('width') || '0');
  let height = parseFloat(svg.getAttribute('height') || '0');

  // Use viewBox dimensions if width/height not specified
  if (!width && vbWidth) width = vbWidth;
  if (!height && vbHeight) height = vbHeight;

  // Fallback dimensions - use canvas size (800x600) if nothing found
  if (!width || !height || isNaN(width) || isNaN(height)) {
    width = 800;
    height = 600;
  }

  return { width, height, viewBox };
}

/**
 * Normalize SVG path data to handle various formats
 */
function normalizeSVGPath(pathData: string): string {
  if (!pathData) return '';
  
  return pathData
    // Handle scientific notation
    .replace(/(-?\d*\.?\d+)[eE][+-]?\d+/g, (match) => Number(match).toString())
    // Handle various coordinate formats
    .replace(/([0-9])-/g, '$1 -')
    // Add spaces after letters
    .replace(/([a-zA-Z])/g, '$1 ')
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
  const tokens = normalized.split(' ');
  const commands: { command: string; params: number[] }[] = [];
  let currentCommand: { command: string; params: number[] } | null = null;

  tokens.forEach(token => {
    if (/[a-zA-Z]/.test(token)) {
      if (currentCommand) {
        commands.push(currentCommand);
      }
      currentCommand = { command: token, params: [] };
    } else if (currentCommand) {
      const num = parseFloat(token);
      if (!isNaN(num)) {
        currentCommand.params.push(num);
      }
    }
  });

  if (currentCommand) {
    commands.push(currentCommand);
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
    if (data.trim().startsWith('<svg') || data.includes('<?xml')) {
      // Log incoming SVG for debugging
      console.log('Processing SVG input (first 100 chars):', data.substring(0, 100));
      
      // Extract original dimensions and viewBox
      const { width, height, viewBox } = extractSVGDimensions(data);
      console.log(`Extracted dimensions: ${width}x${height}, viewBox: ${viewBox}`);

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
      
      // Force width and height to canvas dimensions (800x600) for consistent sizing
      svg.setAttribute('width', '800');
      svg.setAttribute('height', '600');
      
      // Create a viewBox that centers the content if original dimensions exist
      if (!svg.hasAttribute('viewBox') || !viewBox) {
        // If we have original width/height, create a viewBox that centers the content
        if (width > 0 && height > 0) {
          // Calculate centering offsets (negative values to move content into view)
          const xOffset = (800 - width) / 2;
          const yOffset = (600 - height) / 2;
          svg.setAttribute('viewBox', `${-xOffset} ${-yOffset} 800 600`);
          console.log(`Created centering viewBox: ${-xOffset} ${-yOffset} 800 600`);
        } else {
          // Fallback to standard full-canvas viewBox
          svg.setAttribute('viewBox', '0 0 800 600');
        }
      }

      // Modify the generated SVG to ensure it's compatible with our application
      const result = new XMLSerializer().serializeToString(doc);
      console.log('Processed SVG (first 100 chars):', result.substring(0, 100));
      return result;
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
  
  // Calculate scale factor to fit the content within 80% of the canvas
  // but don't scale up small content more than 2x
  const scaleX = Math.min(2, (width * 0.8) / contentWidth);
  const scaleY = Math.min(2, (height * 0.8) / contentHeight);
  const scale = Math.min(scaleX, scaleY);
  
  // Calculate centering offsets
  const offsetX = (width - contentWidth * scale) / 2 - minX * scale;
  const offsetY = (height - contentHeight * scale) / 2 - minY * scale;
  
  const shapeElements = shapes.map((shape) => {
    if (!shape.d) return '';
    
    // Process path data to ensure consistent format
    const processedPathData = processPathData(shape.d);
    
    const stroke = shape.stroke || 'black';
    const strokeWidth = shape.strokeWidth || 1;
    const fill = shape.fill || 'none';
    
    // Apply transform for centering and scaling
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

function processSVGPaths(paths: SVGPathElement[], existingCurveConfig?: CurveConfig): BezierObject | null {
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

  // Calculate content dimensions and scale factor to fit canvas
  const contentWidth = Math.max(10, maxX - minX);
  const contentHeight = Math.max(10, maxY - minY);
  
  // Calculate scale to fit the content within 80% of the canvas (800x600)
  // but don't scale up small content more than 2x
  const scaleX = Math.min(2, (800 * 0.8) / contentWidth);
  const scaleY = Math.min(2, (600 * 0.8) / contentHeight);
  const scale = Math.min(scaleX, scaleY);
  
  // Calculate canvas center and content center for proper centering
  const canvasCenterX = 400; // 800/2
  const canvasCenterY = 300; // 600/2
  const contentCenterX = (minX + maxX) / 2;
  const contentCenterY = (minY + maxY) / 2;

  // Generate scaled and centered points
  const points = approximateControlPointsFromPath(pathElements[0].d);
  const scaledPoints = points.map(point => ({
    ...point,
    x: (point.x - contentCenterX) * scale + canvasCenterX,
    y: (point.y - contentCenterY) * scale + canvasCenterY,
    handleIn: {
      x: (point.handleIn.x - contentCenterX) * scale + canvasCenterX,
      y: (point.handleIn.y - contentCenterY) * scale + canvasCenterY
    },
    handleOut: {
      x: (point.handleOut.x - contentCenterX) * scale + canvasCenterX,
      y: (point.handleOut.y - contentCenterY) * scale + canvasCenterY
    }
  }));

  console.log(`Scaled ${points.length} points with scale ${scale}, centered at (${canvasCenterX}, ${canvasCenterY})`);

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

import { ControlPoint, Point, CurveStyle, generateId } from './bezierUtils';

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
            
            currentX = absX;
            currentY = absY;
            console.log(`Added C point at ${absX},${absY}`);
          }
          break;
        }
        case 'Z': {
          // Close path command
          if (points.length > 0 && (currentX !== firstX || currentY !== firstY)) {
            const lastPoint = points[points.length - 1];
            const firstPoint = points[0];
            
            // Create smooth connection back to start
            const closePoint = createControlPoint(firstX, firstY, lastPoint);
            
            firstPoint.handleIn = {
              x: firstX - (closePoint.handleOut.x - firstX),
              y: firstY - (closePoint.handleOut.y - firstY)
            };
            
            lastPoint.handleOut = {
              x: lastPoint.x - (firstPoint.handleIn.x - firstX),
              y: lastPoint.y - (firstPoint.handleIn.y - firstY)
            };
            
            currentX = firstX;
            currentY = firstY;
          }
          break;
        }
      }
      
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
