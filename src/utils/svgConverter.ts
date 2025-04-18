
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

    // Directly return if already an SVG
    if (data.trim().startsWith('<svg') || data.includes('<?xml')) {
      // Clean up SVG - normalize attributes, remove unnecessary whitespace
      return cleanupSvgString(data);
    }

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
        const rawSvg = first.d;
        const cleanedSvg = rawSvg
          .replace(/\"/g, '"')
          .replace(/^"|"$/g, '')
          .trim();

        if (cleanedSvg.startsWith('<svg')) {
          return cleanupSvgString(cleanedSvg);
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
 * Cleanup and normalize SVG string
 */
function cleanupSvgString(svgString: string): string {
  // Remove redundant whitespace, normalize quotes
  return svgString
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s+>/g, '>')
    .replace(/<\s+/g, '<')
    .replace(/\"/g, '"')
    .trim();
}

/**
 * Process path data to ensure it's in a consistent format
 */
function processPathData(pathData: string): string {
  if (!pathData) return '';
  
  // Normalize spaces and commas
  let processed = pathData
    .replace(/,\s+/g, ' ') // Replace comma+space with just space
    .replace(/,/g, ' ')    // Replace remaining commas with spaces
    .replace(/\s+/g, ' ')  // Normalize multiple spaces to single space
    .trim();
    
  // Add spaces after command letters if missing (e.g., "M10,10" -> "M 10,10")
  processed = processed.replace(/([MLHVCSQTAZmlhvcsqtaz])([^\s])/g, '$1 $2');
  
  return processed;
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
