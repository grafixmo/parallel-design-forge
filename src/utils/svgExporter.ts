import {
  ControlPoint,
  CurveConfig,
  TransformSettings,
  BezierObject,
  CurveStyle,
  Point
} from '../types/bezier'; // Assuming types are in ../types/bezier
// Make sure generateId is correctly imported if needed elsewhere, or define it here if local
import { generateId } from './bezierUtils'; // Assuming generateId is in bezierUtils
// Keep generatePathData import if it's used by exportAsSVG and defined in bezierUtils
import { generatePathData } from './bezierUtils';

/**
 * Parses template data from various formats to ensure consistent structure
 * @param templateData The raw template data as string or object
 * @returns Parsed and normalized template data object or null if invalid
 */
export const parseTemplateData = (templateData: string | object): { objects: BezierObject[] } | null => {
  try {
    let parsed: any;

    if (typeof templateData === 'string') {
      try {
        parsed = JSON.parse(templateData);
      } catch (e) {
        // If not valid JSON, check if it's SVG and try to import
        if (templateData.includes('<svg') || templateData.startsWith('<?xml')) {
          console.log('parseTemplateData: Template appears to be SVG format, attempting import...');
          const importedObjects = importSVGFromString(templateData); // Use the corrected import function
          return importedObjects.length > 0 ? { objects: importedObjects } : null;
        } else {
          throw new Error('Template data is neither valid JSON nor SVG');
        }
      }
    } else if (typeof templateData === 'object' && templateData !== null) {
       parsed = templateData; // Already an object
    } else {
       throw new Error('Invalid template data type');
    }


    // Check what kind of data structure we have
    if (parsed.objects && Array.isArray(parsed.objects)) {
      // It's already in the expected format with objects array
       // Optional: Add validation/normalization for each object here
      return parsed;
    } else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].points) {
      // It's an array of objects, convert to expected format
      // Optional: Add validation/normalization for each object here
      return { objects: parsed };
    } else if (parsed.points && Array.isArray(parsed.points)) {
      // It's a single object structure, wrap it in the expected format
      const singleObject: BezierObject = {
        id: parsed.id || generateId(),
        name: parsed.name || 'Imported Object',
        points: parsed.points.map((p: any) => validateAndRepairPoint(p)), // Validate points
        curveConfig: parsed.curveConfig || defaultCurveConfig(),
        transform: parsed.transform || defaultTransform(),
        isSelected: false
      };
      return { objects: [singleObject] };
    }

    // If we couldn't determine the format, return null
    console.error('parseTemplateData: Could not parse template data into a recognized format.');
    return null;
  } catch (error) {
    console.error('Error parsing template data:', error);
    return null;
  }
};

/**
 * Default transform settings
 */
const defaultTransform = (): TransformSettings => {
  return {
    rotation: 0,
    scaleX: 1,
    scaleY: 1
  };
};

/**
 * Default curve style
 */
const defaultCurveStyle = (): CurveStyle => {
  return {
    color: '#000000',
    width: 2,
    fill: 'none',
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
    dashArray: '' // Ensure dashArray is included
  };
};


/**
 * Default curve configuration
 */
const defaultCurveConfig = (): CurveConfig => {
  return {
    parallelCount: 1,
    spacing: 5,
    styles: [defaultCurveStyle()]
  };
};


/**
 * Gets the center X coordinate of a set of points
 */
const getPointsCenterX = (points: ControlPoint[], defaultWidth: number): number => {
  if (!points || points.length === 0) return defaultWidth / 2;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  return sumX / points.length;
};
/**
 * Gets the center Y coordinate of a set of points
 */
const getPointsCenterY = (points: ControlPoint[], defaultHeight: number): number => {
  if (!points || points.length === 0) return defaultHeight / 2;
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  return sumY / points.length;
};


/**
 * Generates an SVG path element string from path data and style
 */
const generateSVGPath = (pathData: string, style: CurveStyle): string => {
  // Ensure defaults are applied if style properties are missing
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
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}"
      viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns:xlink="http://www.w3.org/1999/xlink">`;

    // Add metadata with custom namespace for easier identification and reimport
    svg += `<metadata>
      <qordatta:design xmlns:qordatta="http://qordatta.com/ns" version="1.1">
        <qordatta:canvas width="${canvasWidth}" height="${canvasHeight}" />
      </qordatta:design>
    </metadata>`;

    // Add background rect if requested
    if (includeBackground) {
      svg += `<rect width="100%" height="100%" fill="white"/>`; // Use 100% for flexibility
    }

    // Process each object
    objects.forEach((object, index) => {
      // Basic validation: skip objects without points or less than 2 points
      if (!object || !object.points || object.points.length < 2) {
         console.warn(`Skipping object ${index} due to invalid points.`);
        return;
      }

      // Ensure object has necessary properties, applying defaults if missing
      const currentPoints = object.points;
      const currentTransform = { ...defaultTransform(), ...(object.transform || {}) };
      const currentCurveConfig = { ...defaultCurveConfig(), ...(object.curveConfig || {}) };
      // Ensure styles array exists and has at least one style
      if (!currentCurveConfig.styles || currentCurveConfig.styles.length === 0) {
          currentCurveConfig.styles = [defaultCurveStyle()];
      }


      // Calculate the center of points for this object's transformation origin
      const centerX = getPointsCenterX(currentPoints, canvasWidth); // Pass canvasWidth as default reference
      const centerY = getPointsCenterY(currentPoints, canvasHeight);// Pass canvasHeight as default reference

      // Create a group for this object with ID and metadata attributes
      // Store configuration and transform as JSON strings in data attributes
      svg += `<g id="${object.id || `bezier-object-${index}`}"
        data-name="${object.name || `Object ${index + 1}`}"
        data-curve-config='${JSON.stringify(currentCurveConfig)}'
        data-transform='${JSON.stringify(currentTransform)}'
        transform="translate(${object.position?.x || 0}, ${object.position?.y || 0}) rotate(${currentTransform.rotation} ${centerX} ${centerY}) scale(${currentTransform.scaleX} ${currentTransform.scaleY})">`; // Apply transforms

      // --- Draw Paths ---
      // Generate main path data using the imported function
      const mainPathData = generatePathData(currentPoints); // Assumes generatePathData exists and works correctly

      if (mainPathData) {
        // Draw parallel curves first (if parallelCount > 1)
        if (currentCurveConfig.parallelCount > 1) {
          // Ensure spacing is defined
          const spacing = currentCurveConfig.spacing ?? 5;
          for (let i = 1; i < currentCurveConfig.parallelCount; i++) {
            const offset = i * spacing;
             // Get style for this parallel curve, fallback to main style or default
            const style = currentCurveConfig.styles?.[i] || currentCurveConfig.styles[0];
            // Generate path data with offset (generatePathData needs to support offset)
            // NOTE: generatePathData from bezierUtils might need modification to handle offset
            // For now, let's assume it *doesn't* handle offset and just draw the main path multiple times with different styles
             // To implement parallel paths correctly, generatePathData needs point offsetting logic.
             // As a placeholder, we draw the main path with potentially different styles:
            const parallelPathData = generatePathData(currentPoints); // Placeholder - needs offset calculation
            if (parallelPathData) {
                 svg += generateSVGPath(parallelPathData, style); // Use the style for this parallel line
            }
          }
        }

        // Draw the main curve (index 0)
        const mainStyle = currentCurveConfig.styles[0];
        svg += generateSVGPath(mainPathData, mainStyle);

      } else {
         console.warn(`Could not generate path data for object ${index}.`);
      }

      // Add control points as custom metadata for perfect reimport
      svg += `<metadata>
        <qordatta:points xmlns:qordatta="http://qordatta.com/ns">${JSON.stringify(currentPoints)}</qordatta:points>
      </metadata>`;

      // Close the group for this object
      svg += '</g>';
    });

    // Close SVG tag
    svg += '</svg>';

    return svg;
  } catch (error) {
    console.error('Error generating SVG:', error);
    // Return a simple error SVG for feedback
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
    // Ensure we have a valid file name
    const sanitizedName = fileName.trim().replace(/\s+/g, '_') || 'bezier-design';
    const fileNameWithExt = sanitizedName.endsWith('.svg') ? sanitizedName : `${sanitizedName}.svg`;

    // Create blob and download link
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' }); // Specify charset
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none'; // Hide the link
    a.href = url;
    a.download = fileNameWithExt;

    // Trigger download
    document.body.appendChild(a);
    a.click();

    // Clean up
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

  } catch (error) {
    console.error('Error downloading SVG:', error);
    // Consider user feedback here, e.g., using a toast notification
    throw new Error('Failed to download SVG file.');
  }
};


/**
 * Helper function to create a control point with appropriate handles
 * @param x X coordinate
 * @param y Y coordinate
 * @param prevPoint Optional previous point to adjust handles for smoother curves
 * @returns New control point object
 */
const createControlPoint = (x: number, y: number, prevPoint?: ControlPoint): ControlPoint => {
  // Default handle distance (can be adjusted based on point spacing or globally)
  const handleDist = 30; // Reduced default distance

  let handleInX = x - handleDist;
  let handleInY = y;
  let handleOutX = x + handleDist;
  let handleOutY = y;

  // If we have a previous point, calculate better initial handle positions based on the vector
  if (prevPoint) {
    // Calculate vector from previous point to this one
    const dx = x - prevPoint.x;
    const dy = y - prevPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Normalize and scale the vector for handles, only if distance is significant
    if (dist > 1) { // Avoid division by zero or tiny distances
       // Scale handle distance relative to point distance, capped at handleDist
      const scaledHandleDist = Math.min(handleDist, dist * 0.3);
      const ndx = dx / dist * scaledHandleDist;
      const ndy = dy / dist * scaledHandleDist;

      // Set handle positions based on the direction from prev point
      handleInX = x - ndx;
      handleInY = y - ndy;
      handleOutX = x + ndx; // Keep handleOut aligned initially
      handleOutY = y + ndy;
    } else {
        // If points are very close, place handles closer or overlapping
        handleInX = x - 5;
        handleOutX = x + 5;
    }
  }

  return {
    x,
    y,
    handleIn: { x: handleInX, y: handleInY },
    handleOut: { x: handleOutX, y: handleOutY },
    id: generateId() // Ensure each point gets a unique ID
  };
};


/**
 * Validates and repairs a control point object to ensure all properties are valid numbers and exist.
 * @param point The potentially incomplete or invalid point object.
 * @returns A valid ControlPoint object.
 */
const validateAndRepairPoint = (point: any): ControlPoint => {
  // Default position if point is totally invalid
  const defaultX = 0;
  const defaultY = 0;

  // Ensure x and y are valid numbers, default to 0 otherwise
  const x = (typeof point?.x === 'number' && !isNaN(point.x)) ? point.x : defaultX;
  const y = (typeof point?.y === 'number' && !isNaN(point.y)) ? point.y : defaultY;

  // Validate handleIn, default to a position relative to the main point
  let handleIn: Point = { x: x - 30, y: y }; // Default relative position
  if (point?.handleIn && typeof point.handleIn.x === 'number' && !isNaN(point.handleIn.x) &&
      typeof point.handleIn.y === 'number' && !isNaN(point.handleIn.y)) {
    handleIn = point.handleIn;
  }

  // Validate handleOut, default to a position relative to the main point
  let handleOut: Point = { x: x + 30, y: y }; // Default relative position
  if (point?.handleOut && typeof point.handleOut.x === 'number' && !isNaN(point.handleOut.x) &&
      typeof point.handleOut.y === 'number' && !isNaN(point.handleOut.y)) {
    handleOut = point.handleOut;
  }

  // Ensure point has an ID, generate one if missing
  const id = (typeof point?.id === 'string' && point.id) ? point.id : generateId();

  return { x, y, handleIn, handleOut, id };
};


/**
 * Approximate control points from an SVG path data string ('d' attribute).
 * This implementation attempts to parse M, L, C, S, Z commands.
 * NOTE: This is complex and may not perfectly replicate all path types.
 * @param pathData The SVG path data string.
 * @returns An array of approximated ControlPoint objects.
 */
const approximateControlPointsFromPath = (pathData: string): ControlPoint[] => {
  const points: ControlPoint[] = [];
  if (!pathData || typeof pathData !== 'string') return points;

  try {
    console.log('Parsing path data:', pathData.substring(0, 100) + (pathData.length > 100 ? '...' : ''));

    // Regex to match SVG path commands and their arguments
    const commandRegex = /([MLCSZ])([^MLCSZ]*)/gi; // Simplified for absolute commands only for now
    let match;
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;
    let lastCmd = '';
    let lastControlX = 0; // For S command reflection
    let lastControlY = 0;

    while ((match = commandRegex.exec(pathData)) !== null) {
       const command = match[1];
       // Split args carefully, considering negative numbers and decimals
       const args = (match[2] || '').trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

       console.log(`Processing command: ${command}, Args: ${args}`);

       let k = 0;
       while (k < args.length) {
          let point: ControlPoint | null = null;
          let control1: Point | null = null; // Handles for C/S commands
          let control2: Point | null = null;

          switch (command.toUpperCase()) { // Handle both upper (absolute) and lower (relative) cases if needed
             case 'M': // MoveTo: Start new subpath
                currentX = args[k++];
                currentY = args[k++];
                if (points.length === 0) { // Record start point for Z command
                   startX = currentX;
                   startY = currentY;
                }
                point = createControlPoint(currentX, currentY); // Create first point with default handles
                points.push(point);
                 console.log(`Added M point at ${currentX},${currentY}`);
                lastCmd = 'M';
                break;

             case 'L': // LineTo: Draw line to new point
                currentX = args[k++];
                currentY = args[k++];
                 // Create point, use previous point to suggest handles
                point = createControlPoint(currentX, currentY, points[points.length - 1]);
                points.push(point);
                 console.log(`Added L point at ${currentX},${currentY}`);
                lastCmd = 'L';
                break;

             case 'C': // CurveTo: Cubic Bezier curve
                control1 = { x: args[k++], y: args[k++] };
                control2 = { x: args[k++], y: args[k++] };
                currentX = args[k++];
                currentY = args[k++];

                // Update the handleOut of the *previous* point
                if (points.length > 0) {
                   points[points.length - 1].handleOut = control1;
                }

                 // Create the new point with handleIn = control2
                point = {
                   x: currentX, y: currentY,
                   handleIn: control2,
                   // Approximate handleOut by reflecting handleIn (can be improved)
                   handleOut: { x: currentX + (currentX - control2.x), y: currentY + (currentY - control2.y) },
                   id: generateId()
                };
                points.push(point);
                lastControlX = control2.x; // Remember last control point for potential S command
                lastControlY = control2.y;
                 console.log(`Added C point at ${currentX},${currentY}`);
                lastCmd = 'C';
                break;

             case 'S': // Smooth CurveTo: Smooth cubic Bezier
                control2 = { x: args[k++], y: args[k++] };
                currentX = args[k++];
                currentY = args[k++];

                 // Calculate the first control point (reflection of previous handleOut or previous point)
                if (points.length > 0 && (lastCmd === 'C' || lastCmd === 'S')) {
                   const prevPoint = points[points.length - 1];
                   control1 = {
                      x: prevPoint.x + (prevPoint.x - lastControlX), // Reflect last control point
                      y: prevPoint.y + (prevPoint.y - lastControlY)
                   };
                   // Update previous point's handleOut to this calculated control point
                   prevPoint.handleOut = control1;
                } else {
                   // If previous command wasn't C or S, first control point is the same as the current point
                   control1 = { x: points[points.length - 1]?.x || currentX, y: points[points.length - 1]?.y || currentY };
                   if (points.length > 0) points[points.length - 1].handleOut = control1; // Set handle anyway
                }


                 // Create the new point
                point = {
                   x: currentX, y: currentY,
                   handleIn: control2,
                   // Approximate handleOut
                   handleOut: { x: currentX + (currentX - control2.x), y: currentY + (currentY - control2.y) },
                   id: generateId()
                };
                points.push(point);
                lastControlX = control2.x; // Remember for next potential S command
                lastControlY = control2.y;
                 console.log(`Added S point at ${currentX},${currentY}`);
                lastCmd = 'S';
                break;

              case 'Z': // ClosePath: Connect back to start
                if (points.length > 0) {
                    // Close the path conceptually. How this affects handles depends on desired smoothness.
                    // A simple approach is to ensure the last point visually connects.
                    // More complex: Adjust first point's handleIn and last point's handleOut.
                    const firstPoint = points[0];
                    const lastPoint = points[points.length - 1];

                    // Check if already closed
                    if (Math.abs(lastPoint.x - firstPoint.x) > 0.1 || Math.abs(lastPoint.y - firstPoint.y) > 0.1) {
                        // Optional: Add a final point identical to the first point if structure requires it.
                        // Or, mark the path/object as 'closed' in its properties instead.
                        console.log(`Path closed back to start point (${startX}, ${startY}).`);
                        // Basic handle adjustment attempt for Z
                        if(points.length > 1) {
                             // Simple adjustment: aim last handle towards first point, first handle from last point
                             lastPoint.handleOut = { x: lastPoint.x + (firstPoint.x - lastPoint.x)*0.3, y: lastPoint.y + (firstPoint.y - lastPoint.y)*0.3 };
                             firstPoint.handleIn = { x: firstPoint.x - (firstPoint.x - lastPoint.x)*0.3, y: firstPoint.y - (firstPoint.y - lastPoint.y)*0.3 };
                        }
                    } else {
                        console.log('Path already closed or Z command redundant.');
                    }
                    currentX = startX; // Move conceptual pen back to start
                    currentY = startY;
                }
                lastCmd = 'Z';
                break;

             default:
                 console.warn(`Unsupported path command: ${command}`);
                 // Skip remaining args for this command if structure is unknown
                 k = args.length;
          }
       }
    }

    console.log(`Finished parsing path data. Generated ${points.length} points.`);
    return points;

  } catch (error) {
    console.error('Critical error parsing SVG path data:', error);
    return []; // Return empty array on critical error
  }
};

/**
 * Process an array of SVG path elements and attempt to convert them into a single BezierObject.
 * @param paths Array of SVGPathElement objects.
 * @param existingCurveConfig Optional CurveConfig parsed from parent group metadata.
 * @returns A BezierObject representing the combined paths, or null if processing fails.
 */
const processSVGPaths = (paths: SVGPathElement[], existingCurveConfig?: CurveConfig): BezierObject | null => {
  if (!paths || paths.length === 0) return null;

  console.log(`Processing ${paths.length} SVG paths into one BezierObject`);

  // Extract path data and style attributes from each path element
  const pathElements = paths.map(path => {
    return {
      d: path.getAttribute('d') || '',
      stroke: path.getAttribute('stroke') || '#000000',
      strokeWidth: parseFloat(path.getAttribute('stroke-width') || '2'),
      fill: path.getAttribute('fill') || 'none',
      opacity: parseFloat(path.getAttribute('stroke-opacity') || '1'),
      lineCap: (path.getAttribute('stroke-linecap') || 'round') as CanvasLineCap,
      lineJoin: (path.getAttribute('stroke-linejoin') || 'round') as CanvasLineJoin,
      dashArray: path.getAttribute('stroke-dasharray') || ''
    };
  }).filter(p => p.d); // Filter out paths without a 'd' attribute

  if (pathElements.length === 0) {
    console.log('No valid path data (d attribute) found in provided elements');
    return null;
  }

  // --- Point Generation ---
  // Use the 'd' attribute from the *first* path element to generate the primary control points.
  // This assumes parallel paths in SVG often repeat the same geometry.
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
     // Optional: You might still want to reconcile styles if the number of paths doesn't match parallelCount
     if (curveConfig.styles.length !== pathElements.length) {
         console.warn(`Mismatch between path count (${pathElements.length}) and styles in metadata (${curveConfig.styles.length}). Adjusting styles.`);
         // Strategy: Use styles from metadata up to path count, or repeat last style.
         const stylesFromMetadata = curveConfig.styles;
         curveConfig.styles = pathElements.map((p, index) => stylesFromMetadata[index] || stylesFromMetadata[stylesFromMetadata.length - 1] || defaultCurveStyle());
         curveConfig.parallelCount = pathElements.length; // Update parallel count to match actual paths found
     }

  } else {
     console.log("Generating curve configuration from individual path attributes.");
     // Create styles based on the attributes of each path element found
     const styles: CurveStyle[] = pathElements.map(p => ({
        color: p.stroke,
        width: p.strokeWidth,
        fill: p.fill,
        opacity: p.opacity,
        lineCap: p.lineCap, // Store as string compatible with CurveStyle type
        lineJoin: p.lineJoin, // Store as string compatible with CurveStyle type
        dashArray: p.dashArray
     }));
     console.log('Created styles from path attributes:', styles);

     // Create a curve configuration based on these styles
     curveConfig = {
        styles,
        parallelCount: styles.length, // Each path becomes a 'parallel' line
        spacing: 5 // Default spacing, maybe try to infer from transforms later?
     };
  }


  // --- Create BezierObject ---
  return {
    id: generateId(), // Generate a new ID for this imported object
    name: 'Imported Path', // Default name, can be overridden later if group name exists
    points: points.map(p => validateAndRepairPoint(p)), // Ensure points are valid
    curveConfig,
    transform: defaultTransform(), // Apply default transform, can be overridden later
    isSelected: false
  };
};


/**
 * Imports an SVG string and converts it to BezierObjects based on its structure.
 * Prioritizes 'qordatta' metadata if present, otherwise parses SVG elements.
 * @param svgString SVG content as a string.
 * @returns An array of BezierObjects extracted from the SVG.
 */
export const importSVGFromString = (svgString: string): BezierObject[] => {
  try {
    console.log('Starting SVG import process...');
    // 1. Validate and Sanitize Input
    if (!svgString || typeof svgString !== 'string') {
      throw new Error('Invalid SVG input: empty or not a string');
    }
    const normalizedSvg = svgString.trim(); //.replace(/\s+/g, ' '); // Keep original spacing for text potentially
    if (!normalizedSvg.toLowerCase().includes('<svg')) { // Case-insensitive check
      throw new Error('Input does not appear to contain SVG markup');
    }

    // 2. Parse SVG String into DOM
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(normalizedSvg, 'image/svg+xml');

    // Check for parser errors (important!)
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
      console.error('SVG parsing error:', parserError.textContent);
      throw new Error(`Invalid SVG format: ${parserError.textContent}`);
    }

    // 3. Get SVG Root Element
    const svgRoot = svgDoc.documentElement;
    if (!svgRoot || svgRoot.tagName.toLowerCase() !== 'svg') {
      throw new Error('No valid SVG element found in the provided content');
    }
    console.log('SVG parsed successfully.');

    // 4. Initialize variables
    const importedObjects: BezierObject[] = [];
    const isQordattaFormat = svgDoc.querySelector('metadata qordatta\\:design') !== null; // Check for our namespace
    console.log('Is Qordatta format (contains custom metadata)?', isQordattaFormat);

    // 5. Extraction Strategy: Prioritize Qordatta Metadata in Groups
    if (isQordattaFormat) {
       console.log('Qordatta format detected. Processing groups with metadata...');
       const groups = svgDoc.querySelectorAll('g[data-name]'); // Look for groups likely created by exportAsSVG

       if (groups.length > 0) {
          console.log(`Found ${groups.length} potential Qordatta groups.`);
          groups.forEach((group, index) => {
             const objectId = group.getAttribute('id') || `imported_q_${generateId()}`;
             const objectName = group.getAttribute('data-name') || `Imported Qordatta ${index + 1}`;
             console.log(`Processing group: ${objectName} (ID: ${objectId})`);

             let curveConfig: CurveConfig | undefined;
             let transform: TransformSettings | undefined;
             let points: ControlPoint[] | undefined;

             // Try parsing metadata attributes
             try {
                 const curveConfigData = group.getAttribute('data-curve-config');
                 if (curveConfigData) curveConfig = JSON.parse(curveConfigData);

                 const transformData = group.getAttribute('data-transform');
                 if (transformData) transform = JSON.parse(transformData);

                 const pointsMetadata = group.querySelector('metadata qordatta\\:points');
                 if (pointsMetadata?.textContent) points = JSON.parse(pointsMetadata.textContent);

             } catch (e) {
                 console.warn(`Error parsing metadata for group ${objectName}:`, e);
             }

             // Validate extracted points
             if (points && Array.isArray(points) && points.length >= 2) {
                 console.log(`Successfully parsed ${points.length} points from metadata.`);
                 const validatedPoints = points.map(p => validateAndRepairPoint(p)); // Validate each point
                 const object: BezierObject = {
                    id: objectId,
                    name: objectName,
                    points: validatedPoints,
                    curveConfig: curveConfig || defaultCurveConfig(), // Use parsed or default
                    transform: transform || defaultTransform(),       // Use parsed or default
                    isSelected: false
                 };
                 importedObjects.push(object);
             } else {
                 console.warn(`Could not get valid points from metadata for group ${objectName}. Will attempt to process paths within it.`);
                 // Fallback: Process paths within this group if metadata points failed
                 const paths = group.querySelectorAll('path');
                 if (paths.length > 0) {
                    const processedObject = processSVGPaths(Array.from(paths), curveConfig); // Pass existing config
                    if (processedObject) {
                       processedObject.id = objectId; // Use group ID
                       processedObject.name = objectName; // Use group name
                       if(transform) processedObject.transform = transform; // Apply transform if available
                       importedObjects.push(processedObject);
                       console.log(`Successfully processed paths within group ${objectName}.`);
                    } else {
                        console.warn(`Failed to process paths within group ${objectName}.`);
                    }
                 } else {
                     console.warn(`No paths found within group ${objectName} for fallback processing.`);
                 }
             }
          });
       } else {
           console.log("Qordatta format detected, but no specific groups found. Proceeding to generic extraction.");
       }
    }

    // 6. Generic Extraction (if not Qordatta or no Qordatta groups found/processed)
    if (importedObjects.length === 0) {
       console.log('Performing generic SVG element extraction (groups, paths, shapes)...');

       // Strategy: Process top-level groups first, then loose paths/shapes
       const topLevelGroups = Array.from(svgRoot.children).filter(el => el.tagName.toLowerCase() === 'g');
       const processedElements = new Set<Element>(); // Keep track of processed elements

       console.log(`Found ${topLevelGroups.length} top-level groups.`);
       topLevelGroups.forEach((group, index) => {
          const paths = group.querySelectorAll('path'); // Look for paths within the group
          if (paths.length > 0) {
             console.log(`Processing group ${index + 1} containing ${paths.length} paths...`);
             const processedObject = processSVGPaths(Array.from(paths));
             if (processedObject) {
                processedObject.id = group.getAttribute('id') || `imported_g_${generateId()}`;
                processedObject.name = group.getAttribute('id') || `Imported Group ${index + 1}`;
                 // Attempt to parse transform attribute from the group
                const transformAttr = group.getAttribute('transform');
                 // TODO: Implement a parser for SVG transform strings if needed
                importedObjects.push(processedObject);
                // Mark group and its paths as processed
                processedElements.add(group);
                paths.forEach(p => processedElements.add(p));
             }
          }
       });

       // Process remaining loose paths (not in processed groups)
       const loosePaths = Array.from(svgRoot.querySelectorAll('path')).filter(p => !processedElements.has(p));
       console.log(`Found ${loosePaths.length} loose paths.`);
       if (loosePaths.length > 0) {
          // Option 1: Treat all loose paths as one object
          console.log('Processing all loose paths as a single object...');
          const combinedObject = processSVGPaths(loosePaths);
          if (combinedObject) {
             combinedObject.name = "Imported Loose Paths";
             importedObjects.push(combinedObject);
             loosePaths.forEach(p => processedElements.add(p));
          }
          // Option 2: Treat each loose path as a separate object (might be too many)
          /*
          loosePaths.forEach((path, index) => {
              const singlePathObject = processSVGPaths([path]);
              if (singlePathObject) {
                  singlePathObject.id = path.getAttribute('id') || `imported_lp_${generateId()}`;
                  singlePathObject.name = `Imported Path ${index + 1}`;
                  importedObjects.push(singlePathObject);
                  processedElements.add(path);
              }
          });
          */
       }

       // TODO: Add processing for other shapes (rect, circle, polygon, polyline) if needed
       // Convert these shapes into approximate Bezier paths using processSVGPaths or a dedicated converter.
       const otherShapes = Array.from(svgRoot.querySelectorAll('rect, circle, ellipse, polyline, polygon'))
                              .filter(s => !processedElements.has(s));
       console.log(`Found ${otherShapes.length} other shapes (rect, circle, etc.) - processing not fully implemented.`);
       // Example for polyline/polygon:
       otherShapes.forEach((shape, index) => {
            if (shape.tagName.toLowerCase() === 'polyline' || shape.tagName.toLowerCase() === 'polygon') {
                const pointsAttr = shape.getAttribute('points');
                if (pointsAttr) {
                     let d = 'M ' + pointsAttr.trim().split(/\s+/).join(' L ');
                     if (shape.tagName.toLowerCase() === 'polygon') d += ' Z';
                     // Create a temporary path element to use processSVGPaths
                     const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                     tempPath.setAttribute('d', d);
                     // Copy basic style attributes
                     ['stroke', 'stroke-width', 'fill', 'stroke-opacity'].forEach(attr => {
                         if (shape.hasAttribute(attr)) tempPath.setAttribute(attr, shape.getAttribute(attr)!);
                     });
                     const shapeObject = processSVGPaths([tempPath]);
                     if (shapeObject) {
                         shapeObject.id = shape.getAttribute('id') || `imported_shape_${generateId()}`;
                         shapeObject.name = `Imported ${shape.tagName} ${index + 1}`;
                         importedObjects.push(shapeObject);
                         processedElements.add(shape);
                     }
                }
            }
            // Add similar logic for rect, circle, ellipse converting their attributes to path 'd' strings
       });

    }


    // 7. Final Validation and Return
    if (importedObjects.length === 0) {
       console.warn("SVG import process finished, but no BezierObjects could be created.");
       // Optionally throw an error here if an empty result is considered a failure
       // throw new Error('No convertible elements found in SVG');
    }

    // Final check on all created objects
     const validatedObjects = importedObjects.map(obj => ({
         ...obj,
         points: obj.points.map(p => validateAndRepairPoint(p)), // Final validation pass
         curveConfig: obj.curveConfig || defaultCurveConfig(),
         transform: obj.transform || defaultTransform(),
     }));


    console.log(`Completed import: ${validatedObjects.length} objects created.`);
    return validatedObjects;

  } catch (error) {
    console.error('Error during SVG import:', error);
    // Re-throw or return empty array depending on desired error handling
    // return [];
    throw new Error(`Failed to import SVG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};