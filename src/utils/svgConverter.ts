
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

    if (data.trim().startsWith('<svg') || data.includes('<?xml')) {
      return data;
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
          return cleanedSvg;
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
    const stroke = shape.stroke || 'black';
    const strokeWidth = shape.strokeWidth || 1;
    const fill = shape.fill || 'none';
    return `<path d="${shape.d}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" />`;
  });

  const svgContent = shapeElements.join("\n  ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${svgContent}
</svg>`.trim();

  return svg;
}
