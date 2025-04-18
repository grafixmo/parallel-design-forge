import {
  ControlPoint,
  CurveConfig,
  TransformSettings,
  BezierObject,
  CurveStyle,
  Point
} from '../types/bezier'; // Asegúrate que la ruta a tus tipos es correcta
// Asegúrate que estas utilidades existen en bezierUtils o defínelas/ajústalas si es necesario
import { generatePathData, generateId } from './bezierUtils';

/**
 * Parsea datos de plantilla desde varios formatos para asegurar una estructura consistente.
 * @param templateData Los datos crudos de la plantilla como string u objeto.
 * @returns Objeto de datos de plantilla parseado y normalizado, o null si es inválido.
 */
export const parseTemplateData = (templateData: string | object): { objects: BezierObject[] } | null => {
  try {
    let parsed: any;

    if (typeof templateData === 'string') {
      try {
        parsed = JSON.parse(templateData);
      } catch (e) {
        if (templateData.includes('<svg') || templateData.startsWith('<?xml')) {
          console.log('parseTemplateData: Template appears to be SVG format, attempting import...');
          // Llama a la versión robusta de importSVGFromString
          const importedObjects = importSVGFromString(templateData);
          return importedObjects.length > 0 ? { objects: importedObjects } : null;
        } else {
          throw new Error('Template data is neither valid JSON nor SVG');
        }
      }
    } else if (typeof templateData === 'object' && templateData !== null) {
       parsed = templateData;
    } else {
       throw new Error('Invalid template data type');
    }

    // Comprueba qué tipo de estructura de datos tenemos
    if (parsed.objects && Array.isArray(parsed.objects)) {
      // Ya está en el formato esperado con array objects
      return parsed;
    } else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].points) {
      // Es un array de objetos, convertir al formato esperado
      return { objects: parsed };
    } else if (parsed.points && Array.isArray(parsed.points)) {
      // Es una estructura de objeto único, envolverla en el formato esperado
      const singleObject: BezierObject = {
        id: parsed.id || generateId(),
        name: parsed.name || 'Imported Object',
        points: parsed.points.map((p: any) => validateAndRepairPoint(p)),
        curveConfig: parsed.curveConfig || defaultCurveConfig(),
        transform: parsed.transform || defaultTransform(),
        isSelected: false
      };
      return { objects: [singleObject] };
    }

    console.error('parseTemplateData: Could not parse template data into a recognized format.');
    return null;
  } catch (error) {
    console.error('Error parsing template data:', error);
    return null;
  }
};

// --- Funciones de Configuración por Defecto ---

/** Default transform settings */
const defaultTransform = (): TransformSettings => ({
  rotation: 0, scaleX: 1, scaleY: 1
});

/** Default curve style */
const defaultCurveStyle = (): CurveStyle => ({
  color: '#000000', width: 2, fill: 'none', opacity: 1,
  lineCap: 'round', lineJoin: 'round', dashArray: ''
});

/** Default curve configuration */
const defaultCurveConfig = (): CurveConfig => ({
  parallelCount: 1, spacing: 5, styles: [defaultCurveStyle()]
});

// --- Funciones de Utilidad ---

/** Gets the center X coordinate of a set of points */
const getPointsCenterX = (points: ControlPoint[], defaultWidth: number): number => {
  if (!points || points.length === 0) return defaultWidth / 2;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  return sumX / points.length;
};

/** Gets the center Y coordinate of a set of points */
const getPointsCenterY = (points: ControlPoint[], defaultHeight: number): number => {
  if (!points || points.length === 0) return defaultHeight / 2;
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  return sumY / points.length;
};

/** Generates an SVG path element string from path data and style */
const generateSVGPath = (pathData: string, style: CurveStyle): string => {
  const safeStyle = { ...defaultCurveStyle(), ...style };
  return `<path
    d="${pathData}"
    fill="${safeStyle.fill}"
    stroke="${safeStyle.color}"
    stroke-width="${safeStyle.width}"
    stroke-opacity="${safeStyle.opacity}"
    stroke-linecap="${safeStyle.lineCap}"
    stroke-linejoin="${safeStyle.lineJoin}"
    stroke-dasharray="${safeStyle.dashArray}"
  />`;
};

// --- Funciones de Exportación ---

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
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}"
      viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns:xlink="http://www.w3.org/1999/xlink">`;

    svg += `<metadata>
      <qordatta:design xmlns:qordatta="http://qordatta.com/ns" version="1.1">
        <qordatta:canvas width="${canvasWidth}" height="${canvasHeight}" />
      </qordatta:design>
    </metadata>`;

    if (includeBackground) {
      svg += `<rect width="100%" height="100%" fill="white"/>`;
    }

    objects.forEach((object, index) => {
      if (!object || !object.points || object.points.length < 2) {
        console.warn(`Skipping object ${index} due to invalid points.`);
        return;
      }

      const currentPoints = object.points;
      const currentTransform = { ...defaultTransform(), ...(object.transform || {}) };
      const currentCurveConfig = { ...defaultCurveConfig(), ...(object.curveConfig || {}) };
      if (!currentCurveConfig.styles || currentCurveConfig.styles.length === 0) {
          currentCurveConfig.styles = [defaultCurveStyle()];
      }

      const centerX = getPointsCenterX(currentPoints, canvasWidth);
      const centerY = getPointsCenterY(currentPoints, canvasHeight);

      svg += `<g id="${object.id || `bezier-object-${index}`}"
        data-name="${object.name || `Object ${index + 1}`}"
        data-curve-config='${JSON.stringify(currentCurveConfig)}'
        data-transform='${JSON.stringify(currentTransform)}'
        transform="translate(${object.position?.x || 0}, ${object.position?.y || 0}) rotate(${currentTransform.rotation} ${centerX} ${centerY}) scale(${currentTransform.scaleX} ${currentTransform.scaleY})">`;

      const mainPathData = generatePathData(currentPoints); // Asume que viene de bezierUtils

      if (mainPathData) {
        if (currentCurveConfig.parallelCount > 1) {
          const spacing = currentCurveConfig.spacing ?? 5;
          for (let i = 1; i < currentCurveConfig.parallelCount; i++) {
            const offset = i * spacing;
            const style = currentCurveConfig.styles?.[i] || currentCurveConfig.styles[0];
            // Nota: generatePathData necesitaría soportar offset para paralelas reales.
            // Como placeholder, dibujamos la misma ruta con diferente estilo.
            const parallelPathData = generatePathData(currentPoints); // Placeholder
            if (parallelPathData) {
                 svg += generateSVGPath(parallelPathData, style);
            }
          }
        }
        const mainStyle = currentCurveConfig.styles[0];
        svg += generateSVGPath(mainPathData, mainStyle);
      } else {
         console.warn(`Could not generate path data for object ${index}.`);
      }

      svg += `<metadata>
        <qordatta:points xmlns:qordatta="http://qordatta.com/ns">${JSON.stringify(currentPoints)}</qordatta:points>
      </metadata>`;
      svg += '</g>';
    });

    svg += '</svg>';
    return svg;
  } catch (error) {
    console.error('Error generating SVG:', error);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
      <rect width="100%" height="100%" fill="#fdd"/>
      <text x="50%" y="50%" font-family="sans-serif" font-size="14" text-anchor="middle" fill="red">
        Error generating SVG: ${error instanceof Error ? error.message : 'Unknown error'}
      </text>
    </svg>`;
  }
};

/**
 * Downloads an SVG file to the user's device
 * @param svgContent SVG content to download
 * @param fileName Name for the downloaded file (without extension)
 */
export const downloadSVG = (svgContent: string, fileName: string = 'bezier-design'): void => {
  try {
    const sanitizedName = fileName.trim().replace(/\s+/g, '_') || 'bezier-design';
    const fileNameWithExt = sanitizedName.endsWith('.svg') ? sanitizedName : `${sanitizedName}.svg`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileNameWithExt;

    document.body.appendChild(a);
    a.click();

    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error downloading SVG:', error);
    throw new Error('Failed to download SVG file.');
  }
};

// --- Funciones de Importación y Parseo ---

/**
 * Helper function to create a control point with appropriate handles
 */
const createControlPoint = (x: number, y: number, prevPoint?: ControlPoint): ControlPoint => {
  const handleDist = 30;
  let handleInX = x - handleDist, handleInY = y, handleOutX = x + handleDist, handleOutY = y;

  if (prevPoint) {
    const dx = x - prevPoint.x, dy = y - prevPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      const scaledHandleDist = Math.min(handleDist, dist * 0.3);
      const ndx = dx / dist * scaledHandleDist, ndy = dy / dist * scaledHandleDist;
      handleInX = x - ndx; handleInY = y - ndy;
      handleOutX = x + ndx; handleOutY = y + ndy;
    } else {
      handleInX = x - 5; handleOutX = x + 5;
    }
  }
  return { x, y, handleIn: { x: handleInX, y: handleInY }, handleOut: { x: handleOutX, y: handleOutY }, id: generateId() };
};

/**
 * Validates and repairs a control point object.
 */
const validateAndRepairPoint = (point: any): ControlPoint => {
  const defaultX = 0, defaultY = 0;
  const x = (typeof point?.x === 'number' && !isNaN(point.x)) ? point.x : defaultX;
  const y = (typeof point?.y === 'number' && !isNaN(point.y)) ? point.y : defaultY;

  let handleIn: Point = { x: x - 30, y: y };
  if (point?.handleIn && typeof point.handleIn.x === 'number' && !isNaN(point.handleIn.x) &&
      typeof point.handleIn.y === 'number' && !isNaN(point.handleIn.y)) {
    handleIn = point.handleIn;
  }
  let handleOut: Point = { x: x + 30, y: y };
  if (point?.handleOut && typeof point.handleOut.x === 'number' && !isNaN(point.handleOut.x) &&
      typeof point.handleOut.y === 'number' && !isNaN(point.handleOut.y)) {
    handleOut = point.handleOut;
  }
  const id = (typeof point?.id === 'string' && point.id) ? point.id : generateId();
  return { x, y, handleIn, handleOut, id };
};

/**
 * Parsea una cadena de estilo CSS inline (ej: "stroke: red; fill: none")
 * en un objeto clave-valor. Es una versión simple.
 * @param styleString La cadena del atributo style.
 * @returns Un objeto con las propiedades CSS encontradas.
 */
const parseStyleString = (styleString: string | null): { [key: string]: string } => {
  const styles: { [key: string]: string } = {};
  if (!styleString) {
    return styles;
  }
  // Separa por ';' para obtener declaraciones (ej: "stroke: red")
  styleString.split(';').forEach(declaration => {
    // Separa por ':' para obtener propiedad y valor
    const parts = declaration.split(':');
    if (parts.length === 2) {
      const property = parts[0].trim().toLowerCase(); // Clave en minúsculas
      const value = parts[1].trim(); // Valor
      if (property && value) { // Asegurarse que no estén vacíos
        styles[property] = value;
      }
    }
  });
  return styles;
};


/**
 * Process an array of SVG path elements and attempt to convert them into a single BezierObject.
 * Now handles styles from direct attributes OR inline style attribute.
 * @param paths Array of SVGPathElement objects.
 * @param existingCurveConfig Optional CurveConfig parsed from parent group metadata.
 * @returns A BezierObject representing the combined paths, or null if processing fails.
 */
const processSVGPaths = (paths: SVGPathElement[], existingCurveConfig?: CurveConfig): BezierObject | null => {
  if (!paths || paths.length === 0) return null;

  console.log(`Processing ${paths.length} SVG paths into one BezierObject`);

  // Extract path data and style attributes from each path element
  const pathElements = paths.map(path => {
    const d = path.getAttribute('d') || '';
    // --- INICIO: AJUSTE PARA LEER ESTILOS ---
    const styleString = path.getAttribute('style');
    const inlineStyles = parseStyleString(styleString); // Parsea el atributo style

    // Prioriza atributo directo, luego estilo inline, luego valor por defecto
    const stroke = path.getAttribute('stroke') || inlineStyles['stroke'] || '#000000';
    const strokeWidthAttr = path.getAttribute('stroke-width');
    const strokeWidthInline = inlineStyles['stroke-width'];
    const strokeWidth = parseFloat(strokeWidthAttr || strokeWidthInline || '2'); // Asegura que sea número
    const fill = path.getAttribute('fill') || inlineStyles['fill'] || 'none';
    const opacityAttr = path.getAttribute('stroke-opacity');
    const opacityInline = inlineStyles['stroke-opacity'];
    const opacity = parseFloat(opacityAttr || opacityInline || '1');
    const lineCapAttr = path.getAttribute('stroke-linecap');
    const lineCapInline = inlineStyles['stroke-linecap'];
    const lineCap = (lineCapAttr || lineCapInline || 'round') as CanvasLineCap;
    const lineJoinAttr = path.getAttribute('stroke-linejoin');
    const lineJoinInline = inlineStyles['stroke-linejoin'];
    const lineJoin = (lineJoinAttr || lineJoinInline || 'round') as CanvasLineJoin;
    const dashArrayAttr = path.getAttribute('stroke-dasharray');
    const dashArrayInline = inlineStyles['stroke-dasharray'];
    const dashArray = dashArrayAttr || dashArrayInline || '';
    // --- FIN: AJUSTE PARA LEER ESTILOS ---

    return {
      d,
      stroke,
      strokeWidth: isNaN(strokeWidth) ? 2 : strokeWidth, // Fallback si parseFloat falla
      fill,
      opacity: isNaN(opacity) ? 1 : opacity, // Fallback si parseFloat falla
      lineCap,
      lineJoin,
      dashArray
    };
  }).filter(p => p.d); // Filter out paths without a 'd' attribute

  if (pathElements.length === 0) {
    console.log('No valid path data (d attribute) found in provided elements');
    return null;
  }

  // --- Point Generation ---
  const mainPath = pathElements[0];
  console.log('Generating control points from first path:', mainPath.d.substring(0, 50) + '...');
  const points = approximateControlPointsFromPath(mainPath.d); // Use the detailed parser
  console.log(`Generated ${points.length} control points`);

  if (points.length < 2) {
    console.log('Not enough control points generated (minimum 2 required) from path data.');
    return null;
  }

  // --- Style and Curve Configuration ---
  let curveConfig: CurveConfig;
  if (existingCurveConfig) {
     console.log("Using existing curve configuration from SVG group metadata.");
     curveConfig = existingCurveConfig;
     if (curveConfig.styles.length !== pathElements.length) {
         console.warn(`Mismatch between path count (${pathElements.length}) and styles in metadata (${curveConfig.styles.length}). Adjusting styles.`);
         const stylesFromMetadata = curveConfig.styles;
         curveConfig.styles = pathElements.map((p, index) => stylesFromMetadata[index] || stylesFromMetadata[stylesFromMetadata.length - 1] || defaultCurveStyle());
         curveConfig.parallelCount = pathElements.length;
     }
  } else {
     console.log("Generating curve configuration from individual path attributes.");
     // Los estilos ahora se leen correctamente tomando en cuenta atributos directos e inline
     const styles: CurveStyle[] = pathElements.map(p => ({
        color: p.stroke,
        width: p.strokeWidth,
        fill: p.fill,
        opacity: p.opacity,
        lineCap: p.lineCap,
        lineJoin: p.lineJoin,
        dashArray: p.dashArray
     }));
     console.log('Created styles from path attributes:', styles);
     curveConfig = {
        styles,
        parallelCount: styles.length,
        spacing: 5
     };
  }

  // --- Create BezierObject ---
  return {
    id: generateId(),
    name: 'Imported Path',
    points: points.map(p => validateAndRepairPoint(p)),
    curveConfig,
    transform: defaultTransform(),
    isSelected: false
  };
};


/**
 * Approximate control points from an SVG path data string ('d' attribute).
 */
const approximateControlPointsFromPath = (pathData: string): ControlPoint[] => {
  const points: ControlPoint[] = [];
  if (!pathData || typeof pathData !== 'string') return points;
  try {
    const commandRegex = /([MLCSZ])([^MLCSZ]*)/gi;
    let match;
    let currentX = 0, currentY = 0, startX = 0, startY = 0;
    let lastCmd = '', lastControlX = 0, lastControlY = 0;

    while ((match = commandRegex.exec(pathData)) !== null) {
       const command = match[1];
       const args = (match[2] || '').trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
       let k = 0;
       while (k < args.length) {
          let point: ControlPoint | null = null;
          let control1: Point | null = null, control2: Point | null = null;

          switch (command.toUpperCase()) {
             case 'M':
                currentX = args[k++]; currentY = args[k++];
                if (points.length === 0) { startX = currentX; startY = currentY; }
                point = createControlPoint(currentX, currentY);
                points.push(point); lastCmd = 'M'; break;
             case 'L':
                currentX = args[k++]; currentY = args[k++];
                point = createControlPoint(currentX, currentY, points[points.length - 1]);
                points.push(point); lastCmd = 'L'; break;
             case 'C':
                control1 = { x: args[k++], y: args[k++] };
                control2 = { x: args[k++], y: args[k++] };
                currentX = args[k++]; currentY = args[k++];
                if (points.length > 0) points[points.length - 1].handleOut = control1;
                point = { x: currentX, y: currentY, handleIn: control2,
                   handleOut: { x: currentX + (currentX - control2.x), y: currentY + (currentY - control2.y) }, id: generateId() };
                points.push(point); lastControlX = control2.x; lastControlY = control2.y; lastCmd = 'C'; break;
             case 'S':
                control2 = { x: args[k++], y: args[k++] };
                currentX = args[k++]; currentY = args[k++];
                if (points.length > 0 && (lastCmd === 'C' || lastCmd === 'S')) {
                   const prevPoint = points[points.length - 1];
                   control1 = { x: prevPoint.x + (prevPoint.x - lastControlX), y: prevPoint.y + (prevPoint.y - lastControlY) };
                   prevPoint.handleOut = control1;
                } else {
                   control1 = { x: points[points.length - 1]?.x || currentX, y: points[points.length - 1]?.y || currentY };
                   if (points.length > 0) points[points.length - 1].handleOut = control1;
                }
                point = { x: currentX, y: currentY, handleIn: control2,
                   handleOut: { x: currentX + (currentX - control2.x), y: currentY + (currentY - control2.y) }, id: generateId() };
                points.push(point); lastControlX = control2.x; lastControlY = control2.y; lastCmd = 'S'; break;
              case 'Z':
                if (points.length > 0) {
                    const firstPoint = points[0]; const lastPoint = points[points.length - 1];
                    if (Math.abs(lastPoint.x - firstPoint.x) > 0.1 || Math.abs(lastPoint.y - firstPoint.y) > 0.1) {
                       if(points.length > 1) {
                           lastPoint.handleOut = { x: lastPoint.x + (firstPoint.x - lastPoint.x)*0.3, y: lastPoint.y + (firstPoint.y - lastPoint.y)*0.3 };
                           firstPoint.handleIn = { x: firstPoint.x - (firstPoint.x - lastPoint.x)*0.3, y: firstPoint.y - (firstPoint.y - lastPoint.y)*0.3 };
                       }
                    }
                    currentX = startX; currentY = startY;
                }
                lastCmd = 'Z'; break;
             default: k = args.length; // Skip unknown command args
          }
       }
    }
    return points;
  } catch (error) {
    console.error('Critical error parsing SVG path data:', error);
    return [];
  }
};

/**
 * Imports an SVG string and converts it to BezierObjects based on its structure.
 * (This is the corrected, non-duplicate version)
 * @param svgString SVG content as a string.
 * @returns An array of BezierObjects extracted from the SVG.
 */
export const importSVGFromString = (svgString: string): BezierObject[] => {
  try {
    console.log('Starting SVG import process...');
    if (!svgString || typeof svgString !== 'string') throw new Error('Invalid SVG input');
    const normalizedSvg = svgString.trim();
    if (!normalizedSvg.toLowerCase().includes('<svg')) throw new Error('Input does not appear to contain SVG markup');

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(normalizedSvg, 'image/svg+xml');
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) throw new Error(`Invalid SVG format: ${parserError.textContent}`);
    const svgRoot = svgDoc.documentElement;
    if (!svgRoot || svgRoot.tagName.toLowerCase() !== 'svg') throw new Error('No valid SVG element found');
    console.log('SVG parsed successfully.');

    const importedObjects: BezierObject[] = [];
    const isQordattaFormat = svgDoc.querySelector('metadata qordatta\\:design') !== null;
    console.log('Is Qordatta format?', isQordattaFormat);

    if (isQordattaFormat) {
       console.log('Qordatta format detected. Processing groups with metadata...');
       const groups = svgDoc.querySelectorAll('g[data-name]');
       console.log(`Found ${groups.length} potential Qordatta groups.`);
       groups.forEach((group, index) => {
         const objectId = group.getAttribute('id') || `imported_q_${generateId()}`;
         const objectName = group.getAttribute('data-name') || `Imported Qordatta ${index + 1}`;
         console.log(`Processing group: ${objectName} (ID: ${objectId})`);
         let curveConfig: CurveConfig | undefined, transform: TransformSettings | undefined, points: ControlPoint[] | undefined;
         try {
             const curveConfigData = group.getAttribute('data-curve-config'); if (curveConfigData) curveConfig = JSON.parse(curveConfigData);
             const transformData = group.getAttribute('data-transform'); if (transformData) transform = JSON.parse(transformData);
             const pointsMetadata = group.querySelector('metadata qordatta\\:points'); if (pointsMetadata?.textContent) points = JSON.parse(pointsMetadata.textContent);
         } catch (e) { console.warn(`Error parsing metadata for group ${objectName}:`, e); }

         if (points && Array.isArray(points) && points.length >= 2) {
             const validatedPoints = points.map(p => validateAndRepairPoint(p));
             importedObjects.push({ id: objectId, name: objectName, points: validatedPoints,
                curveConfig: curveConfig || defaultCurveConfig(), transform: transform || defaultTransform(), isSelected: false });
         } else {
             console.warn(`Could not get valid points from metadata for group ${objectName}. Attempting path fallback.`);
             const paths = group.querySelectorAll('path');
             if (paths.length > 0) {
                // Use the MODIFIED processSVGPaths here
                const processedObject = processSVGPaths(Array.from(paths), curveConfig);
                if (processedObject) {
                   processedObject.id = objectId; processedObject.name = objectName;
                   if(transform) processedObject.transform = transform;
                   importedObjects.push(processedObject);
                   console.log(`Successfully processed paths within group ${objectName}.`);
                } else console.warn(`Failed to process paths within group ${objectName}.`);
             } else console.warn(`No paths found within group ${objectName} for fallback processing.`);
         }
       });
    } // End Qordatta processing

    if (importedObjects.length === 0) { // Generic Extraction if no Qordatta objects found
       console.log('Performing generic SVG element extraction...');
       const processedElements = new Set<Element>();

       const topLevelGroups = Array.from(svgRoot.children).filter(el => el.tagName.toLowerCase() === 'g');
       topLevelGroups.forEach((group, index) => {
          const paths = group.querySelectorAll('path');
          if (paths.length > 0) {
             // Use the MODIFIED processSVGPaths here
             const processedObject = processSVGPaths(Array.from(paths));
             if (processedObject) {
                processedObject.id = group.getAttribute('id') || `imported_g_${generateId()}`;
                processedObject.name = group.getAttribute('id') || `Imported Group ${index + 1}`;
                importedObjects.push(processedObject);
                processedElements.add(group); paths.forEach(p => processedElements.add(p));
             }
          }
       });

       const loosePaths = Array.from(svgRoot.querySelectorAll('path')).filter(p => !processedElements.has(p));
       if (loosePaths.length > 0) {
          // Use the MODIFIED processSVGPaths here
          const combinedObject = processSVGPaths(loosePaths);
          if (combinedObject) {
             combinedObject.name = "Imported Loose Paths"; importedObjects.push(combinedObject);
             loosePaths.forEach(p => processedElements.add(p));
          }
       }

       // Handle polyline/polygon
       const otherShapes = Array.from(svgRoot.querySelectorAll('polyline, polygon')).filter(s => !processedElements.has(s));
       otherShapes.forEach((shape, index) => {
            const pointsAttr = shape.getAttribute('points');
            if (pointsAttr) {
                 let d = 'M ' + pointsAttr.trim().split(/\s+/).join(' L ');
                 if (shape.tagName.toLowerCase() === 'polygon') d += ' Z';
                 const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                 tempPath.setAttribute('d', d);
                 ['stroke', 'stroke-width', 'fill', 'stroke-opacity', 'style'].forEach(attr => { // Include style attr
                     if (shape.hasAttribute(attr)) tempPath.setAttribute(attr, shape.getAttribute(attr)!);
                 });
                 // Use the MODIFIED processSVGPaths here
                 const shapeObject = processSVGPaths([tempPath]);
                 if (shapeObject) {
                     shapeObject.id = shape.getAttribute('id') || `imported_shape_${generateId()}`;
                     shapeObject.name = `Imported ${shape.tagName} ${index + 1}`;
                     importedObjects.push(shapeObject); processedElements.add(shape);
                 }
            }
       });
       // TODO: Add similar logic for rect, circle, ellipse if needed
    } // End Generic Extraction

    if (importedObjects.length === 0) {
       console.warn("SVG import finished, but no BezierObjects could be created.");
    }

    const validatedObjects = importedObjects.map(obj => ({
         ...obj, points: obj.points.map(p => validateAndRepairPoint(p)),
         curveConfig: obj.curveConfig || defaultCurveConfig(), transform: obj.transform || defaultTransform(),
     }));

    console.log(`Completed import: ${validatedObjects.length} objects created.`);
    return validatedObjects;

  } catch (error) {
    console.error('Error during SVG import:', error);
    throw new Error(`Failed to import SVG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};