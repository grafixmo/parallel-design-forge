import {
  ControlPoint,
  CurveConfig,
  TransformSettings,
  BezierObject,
  CurveStyle,
  Point
} from '../types/bezier'; // Asegúrate que la ruta a types es correcta
import { generatePathData, generateId } from './bezierUtils'; // Asegúrate que la ruta a utils es correcta

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
        // Intenta importar como SVG. Asume que importSVGFromString devuelve BezierObject[]
        const importedObjects = importSVGFromString(templateData);
        // Devuelve en el formato esperado { objects: [...] }
        return importedObjects ? { objects: importedObjects } : null;
      } else {
        throw new Error('Template data is neither valid JSON nor SVG');
      }
    }

    // Check what kind of data structure we have
    if (parsed.objects && Array.isArray(parsed.objects)) {
      // It's already in the expected format with objects array
      return parsed;
    } else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.points) { // Añadido optional chaining
      // It's an array of objects, convert to expected format
      return { objects: parsed };
    } else if (parsed.points && Array.isArray(parsed.points)) {
      // It's a single object with points array, convert to expected format
      const singleObject: BezierObject = { // Añadido tipo explícito
        id: parsed.id || generateId(),
        name: parsed.name || 'Imported Object',
        points: parsed.points,
        // Añadir position si existe en el formato de objeto único
        position: parsed.position || { x: 0, y: 0 },
        curveConfig: parsed.curveConfig || defaultCurveConfig(), // Usar default
        transform: parsed.transform || defaultTransform(), // Usar default
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
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="<span class="math-inline">\{canvasWidth\}" height\="</span>{canvasHeight}"
      viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns:xlink="http://www.w3.org/1999/xlink">`;

    // Add metadata with custom data attributes for proper reimport
    svg += `<metadata>
      <qordatta:design xmlns:qordatta="http://qordatta.com/ns" version="1.0"/>
    </metadata>`;

    // Add background if requested
    if (includeBackground) {
      svg += `<rect width="<span class="math-inline">\{canvasWidth\}" height\="</span>{canvasHeight}" fill="white"/>`;
    }

    // Process each object
    objects.forEach((object, index) => {
      // Skip objects without points
      if (!object.points || object.points.length < 2) {
        return;
      }

      const { points, transform = defaultTransform(), curveConfig = defaultCurveConfig(), position = { x: 0, y: 0 } } = object; // Añadido position

      // Calculate the center of points for this object's transformation
      const centerX = getPointsCenterX(points, canvasWidth);
      const centerY = getPointsCenterY(points, canvasHeight);

      // Create a group for this object with ID and metadata
      // Aplicar la posición del objeto en el translate
      svg += `<g id="${object.id || `bezier-object-${index}`}"
        data-name="${object.name || `Object ${index + 1}`}"
        data-curve-config='<span class="math-inline">\{JSON\.stringify\(curveConfig\)\}'
data\-transform\='</span>{JSON.stringify(transform)}'
        transform="translate(${position.x}, <span class="math-inline">\{position\.y\}\)
rotate\(</span>{transform.rotation || 0} ${centerX} <span class="math-inline">\{centerY\}\)
scale\(</span>{transform.scaleX || 1} ${transform.scaleY || 1})">`; // position.x/y añadido

      // Draw all curves based on configuration
      const mainPathData = generatePathData(points);
      if (mainPathData) {
        // First draw parallel curves if configured
        if (curveConfig.parallelCount > 1) {
          for (let i = 1; i < curveConfig.parallelCount; i++) {
            const offset = i * (curveConfig.spacing || 5);
            const style = curveConfig.styles?.[i] || curveConfig.styles?.[0] || defaultCurveStyle();

            // Draw a path for each parallel curve
            const pathData = generatePathData(points, offset);
            if (pathData) {
              svg += generateSVGPath(