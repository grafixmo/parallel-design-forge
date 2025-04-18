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

  let width = parseFloat(svg.getAttribute('width') || '0');
  let height = parseFloat(svg.getAttribute('height') || '0');
  const viewBox = svg.getAttribute('viewBox');

  // If viewBox exists, use it for dimensions when width/height are missing
  if (viewBox) {
    const [, , vbWidth, vbHeight] = viewBox.split(/[\s,]+/).map(parseFloat);
    if (!width && vbWidth) width = vbWidth;
    if (!height && vbHeight) height = vbHeight;
  }

  // Fallback dimensions if neither width/height nor viewBox are present
  if (!width || !height) {
    width = 800;
    height = 600;
  }

  return { width, height, viewBox };
}

/**
 * Normalize SVG path data to handle various formats
 */
function normalizeSVGPath(pathData: string): string {
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
      // Extract original dimensions and viewBox
      const { width, height, viewBox } = extractSVGDimensions(data);

      // Process SVG to normalize paths and preserve dimensions
      const parser = new DOMParser();
      const doc = parser.parseFromString(data, 'image/svg+xml');
      
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
      if (!svg.hasAttribute('width')) svg.setAttribute('width', width.toString());
      if (!svg.hasAttribute('height')) svg.setAttribute('height', height.toString());
      if (!svg.hasAttribute('viewBox') && viewBox) {
        svg.setAttribute('viewBox', viewBox);
      } else if (!svg.hasAttribute('viewBox')) {
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }

      return new XMLSerializer().serializeToString(doc);
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
  const width = 800;
  const height = 600;

  const shapeElements = shapes.map((shape) => {
    if (!shape.d) return '';
    
    // Process path data to ensure consistent format
    const processedPathData = processPathData(shape.d);
    
    const stroke = shape.stroke || 'black';
    const strokeWidth = shape.strokeWidth || 1;
    const fill = shape.fill || 'none';
    return `<path d="${processedPathData}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" />`;
  });

  const svgContent = shapeElements.join("\n  ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${svgContent}
</svg>`.trim();

  return svg;
}

function processSVGPaths(paths: SVGPathElement[], existingCurveConfig?: CurveConfig): BezierObject | null {
  if (paths.length === 0) return null;

  console.log(`Processing ${paths.length} SVG paths`);

  // Extract path data and ensure proper positioning
  const pathElements = paths.map(path => {
    const d = path.getAttribute('d') || '';
    
    // Get transform matrix if any
    const transform = path.getAttribute('transform');
    let matrix: DOMMatrix | null = null;
    
    if (transform) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempPath.setAttribute('transform', transform);
      svg.appendChild(tempPath);
      matrix = tempPath.getCTM();
    }

    return {
      d: d,
      matrix: matrix,
      stroke: path.getAttribute('stroke') || '#000000',
      strokeWidth: parseFloat(path.getAttribute('stroke-width') || '2'),
      fill: path.getAttribute('fill') || 'none',
      opacity: parseFloat(path.getAttribute('stroke-opacity') || '1'),
      lineCap: path.getAttribute('stroke-linecap') || 'round',
      lineJoin: path.getAttribute('stroke-linejoin') || 'round',
      dashArray: path.getAttribute('stroke-dasharray') || ''
    };
  }).filter(p => p.d);

  if (pathElements.length === 0) {
    console.log('No valid path data found');
    return null;
  }

  // Create control points from the first path
  const mainPath = pathElements[0];
  console.log('Generating control points from path:', mainPath.d.substring(0, 50) + '...');

  // Apply matrix transformation if exists
  const points = approximateControlPointsFromPath(mainPath.d, mainPath.matrix);
  console.log(`Generated ${points.length} control points`);

  if (points.length < 2) {
    console.log('Not enough control points generated (minimum 2 required)');
    return null;
  }

  // Create styles for each path
  const styles: CurveStyle[] = pathElements.map(p => ({
    color: p.stroke,
    width: p.strokeWidth,
    fill: p.fill,
    opacity: p.opacity,
    lineCap: p.lineCap as string,
    lineJoin: p.lineJoin as string,
    dashArray: p.dashArray
  }));

  // Use existing curve config if provided, otherwise create one from styles
  const curveConfig: CurveConfig = existingCurveConfig || {
    styles,
    parallelCount: styles.length,
    spacing: 5
  };

  return {
    id: generateId(),
    name: 'Imported Path',
    points,
    curveConfig,
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
