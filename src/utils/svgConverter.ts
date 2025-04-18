
/**
 * Converts various data formats to valid SVG
 */

type Shape = {
  id?: string;
  type?: string;
  d?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

/**
 * Normalize SVG path data to handle various formats
 */
function normalizeSVGPath(pathData: string): string {
  return pathData
    // Normalize decimal numbers (preserve negative signs)
    .replace(/(-?\d*\.?\d+)([eE][+-]?\d+)?/g, ' $1 ')
    // Add spaces after letters
    .replace(/([a-zA-Z])/g, '$1 ')
    // Replace commas with spaces
    .replace(/,/g, ' ')
    // Convert multiple spaces to single space
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
      // Process SVG to normalize paths
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
