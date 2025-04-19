
/**
 * Utility functions for SVG processing and normalization
 */
import { BezierObject, ControlPoint, Point } from '@/types/bezier';
import { generateId } from './bezierUtils';

/**
 * Unescapes SVG content that has extra backslashes or escaped quotes
 * @param {string} svgString - The SVG string to unescape
 * @returns {string} - Unescaped SVG string
 */
export function unescapeSvgContent(svgString: string): string {
  if (!svgString || typeof svgString !== 'string') return svgString;
  
  // Fix multiple levels of escaping
  let result = svgString;
  
  // Replace escaped quotes
  result = result.replace(/\\+"/g, '"');
  
  // Fix escaped backslashes
  result = result.replace(/\\+\\/g, '\\');
  
  // Remove surrounding quotes if present
  result = result.replace(/^"|"$/g, '');
  
  return result;
}

/**
 * Normalizes SVG path data to handle various formats
 * @param {string} pathData - The SVG path data string
 * @returns {string} - Normalized path data
 */
export function normalizeSVGPath(pathData: string): string {
  if (!pathData) return '';
  
  // Special case for scientific notation
  const fixedData = pathData.replace(/(-?\d*\.?\d+)[eE]([-+]?\d+)/g, (match) => {
    return Number(match).toString();
  });
  
  return fixedData
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
 * @param {string} pathData - The SVG path data string
 * @returns {Array} - Array of command objects
 */
export function parsePathCommands(pathData: string): Array<{command: string, params: number[]}> {
  if (!pathData) return [];
  
  try {
    const normalized = normalizeSVGPath(pathData);
    const commandRegex = /([MmLlHhVvCcSsQqTtAaZz])\s*([^MmLlHhVvCcSsQqTtAaZz]*)/g;
    const commands = [];
    
    let match;
    while ((match = commandRegex.exec(normalized)) !== null) {
      const command = match[1];
      const paramsStr = match[2].trim();
      
      if (command === 'Z' || command === 'z') {
        commands.push({ command, params: [] });
        continue;
      }
      
      const params = paramsStr.split(/\s+/)
        .map(parseFloat)
        .filter(n => !isNaN(n)); // Remove any NaN values
      
      commands.push({ command, params });
    }
    
    return commands;
  } catch (error) {
    console.error('Error parsing path commands:', error);
    return [];
  }
}

/**
 * Validates if a point has proper coordinate values
 * @param {Object} point - The point object to validate
 * @returns {boolean} - Whether the point is valid
 */
export function isValidPoint(point: any): boolean {
  return point && 
    typeof point.x === 'number' && !isNaN(point.x) &&
    typeof point.y === 'number' && !isNaN(point.y);
}

/**
 * Validates if a handle has proper coordinate values
 * @param {Object} handle - The handle object to validate
 * @returns {boolean} - Whether the handle is valid
 */
export function isValidHandle(handle: any): boolean {
  return handle && 
    typeof handle.x === 'number' && !isNaN(handle.x) &&
    typeof handle.y === 'number' && !isNaN(handle.y);
}

/**
 * Fixes common issues in SVG attribute values
 * @param {string} svgString - The SVG string to fix
 * @returns {string} - Fixed SVG string
 */
export function fixSvgAttributes(svgString: string): string {
  if (!svgString || typeof svgString !== 'string') return svgString;
  
  let result = svgString;
  
  // Ensure xmlns attribute exists
  if (!result.includes('xmlns=')) {
    result = result.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  
  // Fix width and height attributes with escaped quotes
  result = result
    .replace(/width=["']\\+"?100%\\+"?["']/g, 'width="100%"')
    .replace(/height=["']\\+"?100%\\+"?["']/g, 'height="100%"');
  
  // Fix path data attributes with escaped quotes
  result = result.replace(/d=["'](\\+"?[^"']+\\+"?)["']/g, (match, p1) => {
    return `d="${unescapeSvgContent(p1)}"`;
  });
  
  return result;
}

/**
 * Parses template data from various formats to ensure consistent structure
 * @param templateData The raw template data as string
 * @returns Parsed and normalized template data object or null if invalid
 */
export const parseTemplateData = (templateData: string): any => {
  try {
    // First attempt to parse as JSON
    let parsed: any;

    try {
      parsed = JSON.parse(templateData);
    } catch (e) {
      // If not valid JSON, check if it's SVG and try to import
      if (typeof templateData === 'string' && (templateData.includes('<svg') || templateData.startsWith('<?xml'))) {
        console.log('Template appears to be SVG format, attempting import');
        return null; // This would normally call importSVGFromString but we'll handle that in svgExporter
      } else {
        throw new Error('Template data is neither valid JSON nor SVG');
      }
    }

    // Check what kind of data structure we have
    if (parsed.objects && Array.isArray(parsed.objects)) {
      // It's already in the expected format with objects array
      return parsed;
    } else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].points) {
      // It's an array of objects, convert to expected format
      return { objects: parsed };
    } else if (parsed.points && Array.isArray(parsed.points)) {
      // It's a single object with points array, convert to expected format
      const singleObject = {
        id: parsed.id || generateId(),
        name: parsed.name || 'Imported Object',
        points: parsed.points,
        curveConfig: parsed.curveConfig || {
          styles: [{ color: '#000000', width: 2 }],
          parallelCount: 1,
          spacing: 5
        },
        transform: parsed.transform || {
          rotation: 0,
          scaleX: 1,
          scaleY: 1
        },
        isSelected: false
      };
      return { objects: [singleObject] };
    }

    // If we couldn't determine the format, return null
    console.error('Could not parse template data into a recognized format');
    return null;
  } catch (error) {
    console.error('Error parsing template data:', error);
    return null;
  }
};

export function validateAndRepairPoint(point: any, generateId: () => string): any {
  if (!point || typeof point !== 'object') return null;
  if (typeof point.x !== 'number') point.x = 0;
  if (typeof point.y !== 'number') point.y = 0;
  if (!point.id && generateId) {
    point.id = generateId();
  }
  return point;
}
