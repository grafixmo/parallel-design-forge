import { 
  ControlPoint, 
  CurveConfig, 
  TransformSettings, 
  BezierObject,
  CurveStyle,
  Point
} from '../types/bezier';
import { generatePathData, generateId } from './bezierUtils';

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
    
    // Add metadata with custom data attributes for proper reimport
    svg += `<metadata>
      <qordatta:design xmlns:qordatta="http://qordatta.com/ns" version="1.0"/>
    </metadata>`;
    
    // Add background if requested
    if (includeBackground) {
      svg += `<rect width="${canvasWidth}" height="${canvasHeight}" fill="white"/>`;
    }
    
    // Process each object
    objects.forEach((object, index) => {
      // Skip objects without points
      if (!object.points || object.points.length < 2) {
        return;
      }
      
      const { points, transform = defaultTransform(), curveConfig = defaultCurveConfig() } = object;
      
      // Calculate the center of points for this object's transformation
      const centerX = getPointsCenterX(points, canvasWidth);
      const centerY = getPointsCenterY(points, canvasHeight);
      
      // Create a group for this object with ID and metadata
      svg += `<g id="${object.id || `bezier-object-${index}`}" 
        data-name="${object.name || `Object ${index + 1}`}"
        data-curve-config='${JSON.stringify(curveConfig)}'
        data-transform='${JSON.stringify(transform)}'
        transform="translate(${object.position?.x || 0}, ${object.position?.y || 0}) 
        rotate(${transform.rotation || 0} ${centerX} ${centerY}) 
        scale(${transform.scaleX || 1} ${transform.scaleY || 1})">`;
      
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
              svg += generateSVGPath(pathData, style);
            }
          }
        }
        
        // Then draw main curve
        const mainStyle = curveConfig.styles?.[0] || defaultCurveStyle();
        svg += generateSVGPath(mainPathData, mainStyle);
      }
      
      // Add control points as data attributes for perfect reimport
      svg += `<metadata>
        <qordatta:points xmlns:qordatta="http://qordatta.com/ns">${JSON.stringify(points)}</qordatta:points>
      </metadata>`;
      
      // Close the group
      svg += '</g>';
    });
    
    // Close SVG tag
    svg += '</svg>';
    
    return svg;
  } catch (error) {
    console.error('Error generating SVG:', error);
    // Return a simple error SVG
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
      <rect width="${canvasWidth}" height="${canvasHeight}" fill="white"/>
      <text x="${canvasWidth/2}" y="${canvasHeight/2}" font-family="sans-serif" font-size="14" text-anchor="middle" fill="red">
        Error generating SVG
      </text>
    </svg>`;
  }
};

/**
 * Generates an SVG path element from path data and style
 */
const generateSVGPath = (pathData: string, style: CurveStyle): string => {
  return `<path 
    d="${pathData}" 
    fill="${style.fill || 'none'}" 
    stroke="${style.color || '#000000'}" 
    stroke-width="${style.width || 2}" 
    stroke-opacity="${style.opacity !== undefined ? style.opacity : 1}" 
    stroke-linecap="${style.lineCap || 'round'}" 
    stroke-linejoin="${style.lineJoin || 'round'}"
    stroke-dasharray="${style.dashArray || ''}"
  />`;
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
 * Default curve style
 */
const defaultCurveStyle = (): CurveStyle => {
  return {
    color: '#000000',
    width: 2,
    fill: 'none',
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round'
  };
};

/**
 * Downloads an SVG file to the user's device
 * @param svgContent SVG content to download
 * @param fileName Name for the downloaded file (without extension)
 */
export const downloadSVG = (svgContent: string, fileName: string = 'bezier-design'): void => {
  try {
    // Ensure we have a valid file name
    const sanitizedName = fileName.trim() || 'bezier-design';
    const fileNameWithExt = sanitizedName.endsWith('.svg') ? sanitizedName : `${sanitizedName}.svg`;
    
    // Create blob and download link
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNameWithExt;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Error downloading SVG:', error);
    throw new Error('Failed to download SVG file.');
  }
};

/**
 * Imports an SVG string and converts it to BezierObjects
 * @param svgString SVG content as string
 * @returns Array of BezierObjects
 */
export const importSVGFromString = (svgString: string): BezierObject[] => {
  try {
    console.log('Starting SVG import process...');
    
    // Sanitize and validate SVG input
    if (!svgString || typeof svgString !== 'string') {
      throw new Error('Invalid SVG input: empty or not a string');
    }
    
    // Trim and normalize SVG string
    const normalizedSvg = svgString.trim().replace(/\s+/g, ' ');
    
    // Check if it's actually an SVG
    if (!normalizedSvg.includes('<svg')) {
      throw new Error('Input does not contain SVG markup');
    }
    
    // Parse the SVG string into a DOM document
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(normalizedSvg, 'image/svg+xml');
    
    // Check for parsing errors
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
      console.error('SVG parsing error:', parserError.textContent);
      throw new Error('Invalid SVG format: parsing error');
    }
    
    // Get the SVG root element
    const svgRoot = svgDoc.documentElement;
    if (!svgRoot || svgRoot.tagName !== 'svg') {
      throw new Error('No SVG element found in the provided content');
    }
    
    console.log('SVG parsed successfully, searching for path elements...');
    const importedObjects: BezierObject[] = [];
    
    // Check if this is a Qordatta-generated SVG with our custom metadata
    const isQordattaFormat = svgDoc.querySelector('metadata qordatta\\:design') !== null;
    console.log('Is Qordatta format?', isQordattaFormat);
    
    // Process all path groups (g elements)
    const groups = svgDoc.querySelectorAll('g');
    console.log(`Found ${groups.length} groups in SVG`);
    
    if (groups.length === 0) {
      // If no groups, try to process individual paths directly
      const paths = svgDoc.querySelectorAll('path');
      console.log(`Found ${paths.length} ungrouped paths in SVG`);
      
      if (paths.length > 0) {
        const singleObject = processSVGPaths(Array.from(paths));
        if (singleObject) {
          singleObject.name = 'Imported Path';
          importedObjects.push(singleObject);
          console.log('Created single object from ungrouped paths');
        }
      }
    } else {
      // Process each group as a separate object
      let groupCount = 0;
      groups.forEach((group, index) => {
        // Get object ID and name
        const objectId = group.getAttribute('id') || `imported_obj_${generateId()}`;
        const objectName = group.getAttribute('data-name') || `Imported Object ${index + 1}`;
        
        // Check for our custom data attributes with curve config and transform
        let curveConfig: CurveConfig | undefined;
        let transform: TransformSettings | undefined;
        
        try {
          const curveConfigData = group.getAttribute('data-curve-config');
          if (curveConfigData) {
            curveConfig = JSON.parse(curveConfigData);
            console.log('Found curve config in SVG metadata');
          }
          
          const transformData = group.getAttribute('data-transform');
          if (transformData) {
            transform = JSON.parse(transformData);
            console.log('Found transform in SVG metadata');
          }
        } catch (e) {
          console.warn('Error parsing Qordatta metadata:', e);
        }
        
        // Check for our custom points metadata (most accurate)
        let points: ControlPoint[] | undefined;
        const pointsMetadata = group.querySelector('metadata qordatta\\:points');
        if (pointsMetadata && pointsMetadata.textContent) {
          try {
            points = JSON.parse(pointsMetadata.textContent);
            console.log(`Found ${points.length} points in metadata`);
            
            // Validate points data
            if (points.length > 0) {
              // Ensure all points have valid IDs and handle positions
              points = points.map(point => validateAndRepairPoint(point));
            }
          } catch (e) {
            console.warn('Error parsing Qordatta points metadata:', e);
            points = undefined;
          }
        }
        
        // If we couldn't get points from metadata, extract them from paths
        if (!points || points.length < 2) {
          console.log('No valid points in metadata, extracting from paths');
          // Get all paths in this group
          const paths = group.querySelectorAll('path');
          if (paths.length === 0) {
            console.log('No paths found in group, skipping');
            return;
          }
          
          // Process the paths to create a BezierObject
          const object = processSVGPaths(Array.from(paths), curveConfig);
          if (!object) {
            console.log('Failed to process paths in group, skipping');
            return;
          }
          
          // Set object properties
          object.id = objectId;
          object.name = objectName;
          
          // Apply any transform we parsed
          if (transform) {
            object.transform = transform;
          }
          
          importedObjects.push(object);
          groupCount++;
          console.log(`Added object from group ${index + 1}`);
        } else {
          // Create object directly from our metadata points
          const object: BezierObject = {
            id: objectId,
            name: objectName,
            points: points,
            curveConfig: curveConfig || defaultCurveConfig(),
            transform: transform || defaultTransform(),
            isSelected: false
          };
          
          importedObjects.push(object);
          groupCount++;
          console.log(`Added object from metadata points in group ${index + 1}`);
        }
      });
      
      console.log(`Successfully processed ${groupCount} groups`);
    }
    
    // If no objects were created, try a simpler approach
    if (importedObjects.length === 0) {
      console.log('No objects created from groups, trying simpler approach with direct path extraction');
      
      // First, attempt to find all paths
      const paths = svgDoc.querySelectorAll('path');
      if (paths.length > 0) {
        // Create one object with all paths
        const allPathsObject = processSVGPaths(Array.from(paths));
        if (allPathsObject) {
          allPathsObject.name = 'Imported SVG';
          importedObjects.push(allPathsObject);
          console.log('Created single object from all paths');
        } else {
          // If that failed, try a more aggressive approach by extracting path data directly
          console.log('Attempting direct path data extraction as fallback');
          const pathElements = Array.from(paths);
          const pathData = pathElements[0]?.getAttribute('d');
          
          if (pathData) {
            console.log('Found path data, generating points directly');
            const points = approximateControlPointsFromPath(pathData);
            
            if (points.length >= 2) {
              const fallbackObject: BezierObject = {
                id: generateId(),
                name: 'Extracted SVG Path',
                points: points,
                curveConfig: defaultCurveConfig(),
                transform: defaultTransform(),
                isSelected: false
              };
              
              importedObjects.push(fallbackObject);
              console.log('Created object with directly extracted points');
            } else {
              throw new Error('Could not generate sufficient control points from SVG path data');
            }
          } else {
            throw new Error('No path data found in SVG paths');
          }
        }
      } else {
        // Last resort: try to find any element with a shape
        console.log('No path elements found, looking for other shape elements');
        const shapes = svgDoc.querySelectorAll('rect, circle, ellipse, polygon, polyline');
        
        if (shapes.length > 0) {
          console.log(`Found ${shapes.length} shape elements, creating simplified representation`);
          
          // Create a very simple object with 4 corner points
          const width = parseFloat(svgRoot.getAttribute('width') || '100');
          const height = parseFloat(svgRoot.getAttribute('height') || '100');
          
          const simplePoints: ControlPoint[] = [
            createControlPoint(0, 0),
            createControlPoint(width, 0),
            createControlPoint(width, height),
            createControlPoint(0, height)
          ];
          
          const simpleObject: BezierObject = {
            id: generateId(),
            name: 'SVG Shape Outline',
            points: simplePoints,
            curveConfig: defaultCurveConfig(),
            transform: defaultTransform(),
            isSelected: false
          };
          
          importedObjects.push(simpleObject);
        } else {
          throw new Error('No drawable elements found in SVG');
        }
      }
    }
    
    // Validate and sanitize all objects before returning
    const validatedObjects = importedObjects.map(obj => {
      // Ensure all points have valid properties
      const validPoints = obj.points.map(point => validateAndRepairPoint(point));
      
      // Create a cleaned-up object
      return {
        ...obj,
        points: validPoints,
        curveConfig: obj.curveConfig || defaultCurveConfig(),
        transform: obj.transform || defaultTransform(),
        isSelected: false
      };
    });
    
    console.log(`Completed import: ${validatedObjects.length} objects with ${validatedObjects.reduce((sum, obj) => sum + obj.points.length, 0)} total points`);
    
    return validatedObjects;
  } catch (error) {
    console.error('Error importing SVG:', error);
    throw new Error(`Failed to import SVG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Validates and repairs a control point to ensure all properties are valid
 */
const validateAndRepairPoint = (point: any): ControlPoint => {
  if (!point) {
    // Create default point if null
    return createControlPoint(0, 0);
  }
  
  // Ensure x and y are valid numbers
  const x = typeof point.x === 'number' && !isNaN(point.x) ? point.x : 0;
  const y = typeof point.y === 'number' && !isNaN(point.y) ? point.y : 0;
  
  // Validate handle in
  let handleIn: Point = { x: x - 50, y: y };
  if (point.handleIn) {
    if (typeof point.handleIn.x === 'number' && !isNaN(point.handleIn.x) &&
        typeof point.handleIn.y === 'number' && !isNaN(point.handleIn.y)) {
      handleIn = point.handleIn;
    }
  }
  
  // Validate handle out
  let handleOut: Point = { x: x + 50, y: y };
  if (point.handleOut) {
    if (typeof point.handleOut.x === 'number' && !isNaN(point.handleOut.x) &&
        typeof point.handleOut.y === 'number' && !isNaN(point.handleOut.y)) {
      handleOut = point.handleOut;
    }
  }
  
  // Ensure point has an ID
  const id = point.id || generateId();
  
  return { x, y, handleIn, handleOut, id };
};

/**
 * Process SVG paths and convert them to a BezierObject
 * @param paths Array of SVG path elements
 * @returns BezierObject or null if processing failed
 */
const processSVGPaths = (paths: SVGPathElement[], existingCurveConfig?: CurveConfig): BezierObject | null => {
  if (paths.length === 0) return null;
  
  console.log(`Processing ${paths.length} SVG paths`);
  
  // Extract path data
  const pathElements = paths.map(path => {
    return {
      d: path.getAttribute('d') || '',
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
  
  const points = approximateControlPointsFromPath(mainPath.d);
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
  
  console.log('Created styles from path attributes:', styles);
  
  // Use existing curve config if provided, otherwise create one from styles
  const curveConfig: CurveConfig = existingCurveConfig || {
    styles,
    parallelCount: styles.length,
    spacing: 5
  };
  
  // Create the BezierObject
  return {
    id: generateId(),
    name: 'Imported Path',
    points,
    curveConfig,
    transform: defaultTransform(),
    isSelected: false
  };
};

/**
 * Approximate control points from an SVG path data string
 * This is a very simplified implementation that works for basic paths
 */
const approximateControlPointsFromPath = (pathData: string): ControlPoint[] => {
  // Simple path parser that extracts points from M, C, S, and Z commands
  const points: ControlPoint[] = [];
  
  // This is a very simplified parser - a real implementation would be more robust
  try {
    console.log('Parsing path data:', pathData.substring(0, 100) + (pathData.length > 100 ? '...' : ''));
    
    // Remove all letters and replace them with spaces for tokenization
    const cleaned = pathData.replace(/([A-Za-z])/g, ' $1 ').trim();
    const tokens = cleaned.split(/\s+/);
    
    console.log(`Tokenized path data into ${tokens.length} tokens`);
    
    let currentX = 0;
    let currentY = 0;
    let firstX = 0;
    let firstY = 0;
    let i = 0;
    
    while (i < tokens.length) {
      const token = tokens[i++];
      
      if (!token) continue;
      
      if (token === 'M' || token === 'm') {
        // Move to command
        if (i + 1 >= tokens.length) break;
        
        try {
          const x = parseFloat(tokens[i++] || '0');
          const y = parseFloat(tokens[i++] || '0');
          
          // Check for NaN values
          if (isNaN(x) || isNaN(y)) {
            console.log('Invalid M command coordinates, skipping');
            continue;
          }
          
          currentX = token === 'm' ? currentX + x : x;
          currentY = token === 'm' ? currentY + y : y;
          
          // Remember the first point for Z command
          if (points.length === 0) {
            firstX = currentX;
            firstY = currentY;
          }
          
          // Add the point with default handles
          points.push(createControlPoint(currentX, currentY));
          
          console.log(`Added M point at ${currentX},${currentY}`);
        } catch (e) {
          console.log('Error processing M command:', e);
        }
      } else if (token === 'L' || token === 'l') {
        // Line to command
        if (i + 1 >= tokens.length) break;
        
        try {
          const x = parseFloat(tokens[i++] || '0');
          const y = parseFloat(tokens[i++] || '0');
          
          // Check for NaN values
          if (isNaN(x) || isNaN(y)) {
            console.log('Invalid L command coordinates, skipping');
            continue;
          }
          
          currentX = token === 'l' ? currentX + x : x;
          currentY = token === 'l' ? currentY + y : y;
          
          // Add the point with calculated handles
          if (points.length > 0) {
            const prevPoint = points[points.length - 1];
            points.push(createControlPoint(currentX, currentY, prevPoint));
          } else {
            points.push(createControlPoint(currentX, currentY));
          }
          
          console.log(`Added L point at ${currentX},${currentY}`);
        } catch (e) {
          console.log('Error processing L command:', e);
        }
      } else if (token === 'C' || token === 'c') {
        // Cubic bezier curve command
        if (i + 5 >= tokens.length) break;
        
        try {
          const x1 = parseFloat(tokens[i++] || '0');
          const y1 = parseFloat(tokens[i++] || '0');
          const x2 = parseFloat(tokens[i++] || '0');
          const y2 = parseFloat(tokens[i++] || '0');
          const x = parseFloat(tokens[i++] || '0');
          const y = parseFloat(tokens[i++] || '0');
          
          // Check for NaN values
          if ([x1, y1, x2, y2, x, y].some(v => isNaN(v))) {
            console.log('Invalid C command coordinates, skipping');
            continue;
          }
          
          // Convert to absolute coordinates if relative
          const absX1 = token === 'c' ? currentX + x1 : x1;
          const absY1 = token === 'c' ? currentY + y1 : y1;
          const absX2 = token === 'c' ? currentX + x2 : x2;
          const absY2 = token === 'c' ? currentY + y2 : y2;
          const absX = token === 'c' ? currentX + x : x;
          const absY = token === 'c' ? currentY + y : y;
          
          // Update last point's handle out
          if (points.length > 0) {
            const lastPoint = points[points.length - 1];
            lastPoint.handleOut = { x: absX1, y: absY1 };
          } else if (absX1 !== 0 || absY1 !== 0) {
            // If there's no previous point but handle is not at origin, create an artificial first point
            points.push({
              x: currentX,
              y: currentY,
              handleIn: { x: currentX - 50, y: currentY },
              handleOut: { x: absX1, y: absY1 },
              id: generateId()
            });
          }
          
          // Add new point with handle in from the curve
          points.push({
            x: absX,
            y: absY,
            handleIn: { x: absX2, y: absY2 },
            handleOut: { x: absX + (absX - absX2), y: absY + (absY - absY2) }, // Approximate handle out
            id: generateId()
          });
          
          console.log(`Added C point at ${absX},${absY} with handles`);
          
          currentX = absX;
          currentY = absY;
        } catch (e) {
          console.log('Error processing C command:', e);
        }
      } else if (token === 'S' || token === 's') {
        // Smooth cubic bezier curve command
        if (i + 3 >= tokens.length) break;
        
        try {
          const x2 = parseFloat(tokens[i++] || '0');
          const y2 = parseFloat(tokens[i++] || '0');
          const x = parseFloat(tokens[i++] || '0');
          const y = parseFloat(tokens[i++] || '0');
          
          // Check for NaN values
          if ([x2, y2, x, y].some(v => isNaN(v))) {
            console.log('Invalid S command coordinates, skipping');
            continue;
          }
          
          // Convert to absolute coordinates if relative
          const absX2 = token === 's' ? currentX + x2 : x2;
          const absY2 = token === 's' ? currentY + y2 : y2;
          const absX = token === 's' ? currentX + x : x;
          const absY = token === 's' ? currentY + y : y;
          
          // Calculate the reflection of the previous control point
          let x1 = currentX;
          let y1 = currentY;
          
          if (points.length > 0) {
            const prevPoint = points[points.length - 1];
            if (prevPoint.handleOut) {
              // Reflect the handle
              x1 = currentX + (currentX - prevPoint.handleOut.x);
              y1 = currentY + (currentY - prevPoint.handleOut.y);
            }
            
            // Update previous point's handle out
            prevPoint.handleOut = { x: x1, y: y1 };
          }
          
          // Add new point
          points.push({
            x: absX,
            y: absY,
            handleIn: { x: absX2, y: absY2 },
            handleOut: { x: absX + (absX - absX2), y: absY + (absY - absY2) },
            id: generateId()
          });
          
          console.log(`Added S point at ${absX},${absY}`);
          
          currentX = absX;
          currentY = absY;
        } catch (e) {
          console.log('Error processing S command:', e);
        }
      } else if (token === 'Z' || token === 'z') {
        // Close path command - connect back to first point
        try {
          if (points.length > 0 && (currentX !== firstX || currentY !== firstY)) {
            console.log(`Adding Z point to close path back to ${firstX},${firstY}`);
            
            // If we already have points, use the last point to determine handle positions for the closing point
            if (points.length > 1) {
              const lastPoint = points[points.length - 1];
              const firstPoint = points[0];
              
              // Create a new point that closes back to the first point
              const closePoint = createControlPoint(firstX, firstY, lastPoint);
              
              // Update the first point's handle in to match the closure
              firstPoint.handleIn = { 
                x: firstX - (closePoint.handleOut.x - firstX),
                y: firstY - (closePoint.handleOut.y - firstY)
              };
              
              points.push(closePoint);
            } else {
              // Just add a simple point to close
              points.push(createControlPoint(firstX, firstY));
            }
            
            currentX = firstX;
            currentY = firstY;
          }
        } catch (e) {
          console.log('Error processing Z command:', e);
        }
      } else {
        // Skip other commands for now (A, Q, T, H, V)
        console.log(`Skipping unsupported command: ${token}`);
        i++;
      }
    }
    
    console.log(`Generated ${points.length} points from path`);
    
    // If we have at least 2 points, make sure handles are properly set
    if (points.length >= 2) {
      // Improve handle positions for smoother curves
      adjustHandlesForSmoothCurves(points);
    }
    
    return points;
  } catch (error) {
    console.error('Error parsing SVG path:', error);
    // Return with at least 2 points (min required for a path)
    if (points.length < 2) {
      console.log('Error resulted in too few points, adding placeholder points');
      return [
        createControlPoint(0, 0),
        createControlPoint(100, 100)
      ];
    }
    return points;
  }
};

/**
 * Adjust handle positions for smoother curves
 */
const adjustHandlesForSmoothCurves = (points: ControlPoint[]): void => {
  if (points.length < 2) return;
  
  // For each point (except first and last), adjust handles based on neighboring points
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Calculate direction vectors
    const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    
    // Normalize vectors
    const toPrevLength =
