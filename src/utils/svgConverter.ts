/**
 * Generador de path SVG a partir de puntos de control
 */
export const generatePathData = (points: any[]): string | null => {
  if (!points || points.length < 2) return null;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];

    // Check if points have handle information (adapt based on your ControlPoint structure)
    // Assuming handles are named handleOut and handleIn as in svgExporter
    if (prev.handleOut && p.handleIn) {
      d += ` C ${prev.handleOut.x} ${prev.handleOut.y}, ${p.handleIn.x} ${p.handleIn.y}, ${p.x} ${p.y}`;
    } else {
      // Fallback to line if no handle info
      d += ` L ${p.x} ${p.y}`;
    }
  }

  // Optional: Add 'Z' if the shape should be closed based on object properties
  // if (isClosed) d += ' Z';

  return d;
};


/**
 * Convierte datos de diseño en un SVG válido (usado como fallback).
 */
export const convertToValidSVG = (data: any): string | null => {
  try {
    let parsed: any;
    if (typeof data === 'string') {
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        // If it's not JSON, maybe it's already SVG? Basic check.
        if (data.trim().startsWith('<svg')) {
             console.log('✅ convertToValidSVG: Input looks like SVG already.');
             return data;
        }
        console.warn('convertToValidSVG: No se pudo parsear como JSON. Retornando null.');
        return null;
      }
    } else {
      parsed = data;
    }

    // Expecting an object with an 'objects' array
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.objects)) {
      console.warn('convertToValidSVG: No se encontraron objetos válidos en el diseño. Expected { objects: [...] }.');
      return null;
    }

    const pathElements: string[] = [];
    for (const obj of parsed.objects) {
      // Validate object structure (needs at least points array)
      if (!obj || !Array.isArray(obj.points) || obj.points.length < 2) {
        console.warn('convertToValidSVG: Objeto inválido o con pocos puntos:', obj);
        continue; // Skip this object
      }

      const d = generatePathData(obj.points); // Use the helper function
      if (!d) {
        console.warn('convertToValidSVG: No se pudo generar atributo "d" del path para:', obj);
        continue; // Skip this object
      }

      // Extract style information if available, otherwise use defaults
      const stroke = obj.curveConfig?.styles?.[0]?.color || '#000000';
      const strokeWidth = obj.curveConfig?.styles?.[0]?.width || 2;
      const fill = obj.curveConfig?.styles?.[0]?.fill || 'none'; // Add fill support

      const path = `<path d="${d}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}"/>`;
      pathElements.push(path);
    }

    if (pathElements.length === 0) {
      console.warn('convertToValidSVG: No se generaron paths válidos a partir de los objetos.');
      return null;
    }

    // Basic SVG structure. Consider extracting canvas dimensions if available in 'parsed' data.
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <g> ${pathElements.join('\n    ')}
  </g>
</svg>`.trim();

    console.log('✅ convertToValidSVG: SVG generado con éxito');
    return svg;
  } catch (err) {
    console.error('❌ Error en convertToValidSVG:', err);
    return null;
  }
};