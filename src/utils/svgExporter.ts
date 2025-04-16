
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
    
    // Parse the SVG string into a DOM document
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    
    // Check for parsing errors
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Invalid SVG format');
    }
    
    // Get the SVG root element
    const svgRoot = svgDoc.documentElement;
    if (!svgRoot || svgRoot.tagName !== 'svg') {
      throw new Error('No SVG element found');
    }
    
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
              // Ensure all points have valid IDs
              points = points.map(point => ({
                ...point,
                id: point.id || generateId(),
                // Ensure handle positions exist
                handleIn: point.handleIn || {
                  x: point.x - 50,
                  y: point.y
                },
                handleOut: point.handleOut || {
                  x: point.x + 50,
                  y: point.y
                }
              }));
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
      console.log('No objects created from groups, trying simpler approach');
      const paths = svgDoc.querySelectorAll('path');
      if (paths.length > 0) {
        // Create one object with all paths
        const allPathsObject = processSVGPaths(Array.from(paths));
        if (allPathsObject) {
          allPathsObject.name = 'Imported SVG';
          importedObjects.push(allPathsObject);
          console.log('Created single object from all paths');
        } else {
          throw new Error('Could not process SVG paths');
        }
      } else {
        throw new Error('No path elements found in SVG');
      }
    }
    
    // Validate and sanitize all objects before returning
    const validatedObjects = importedObjects.map(obj => {
      // Ensure all points have valid properties
      const validPoints = obj.points.map(point => {
        return {
          ...point,
          x: isNaN(point.x) ? 0 : point.x,
          y: isNaN(point.y) ? 0 : point.y,
          id: point.id || generateId(),
          handleIn: {
            x: isNaN(point.handleIn?.x) ? point.x - 50 : point.handleIn.x,
            y: isNaN(point.handleIn?.y) ? point.y : point.handleIn.y
          },
          handleOut: {
            x: isNaN(point.handleOut?.x) ? point.x + 50 : point.handleOut.x,
            y: isNaN(point.handleOut?.y) ? point.y : point.handleOut.y
          }
        };
      });
      
      return {
        ...obj,
        points: validPoints,
        curveConfig: obj.curveConfig || defaultCurveConfig(),
        transform: obj.transform || defaultTransform(),
        isSelected: false
      };
    });
    
    console.log(`Imported ${validatedObjects.length} objects with valid points`);
    
    return validatedObjects;
  } catch (error) {
    console.error('Error importing SVG:', error);
    throw new Error(`Failed to import SVG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
    console.log('Parsing path data...');
    
    // Remove all letters and replace them with spaces
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
      
      if (token === 'M' || token === 'm') {
        // Move to command
        if (i + 1 >= tokens.length) break;
        
        try {
          currentX = parseFloat(tokens[i++]);
          currentY = parseFloat(tokens[i++]);
          
          // Check for NaN values
          if (isNaN(currentX) || isNaN(currentY)) {
            console.log('Invalid M command coordinates, skipping');
            continue;
          }
          
          // Remember the first point for Z command
          if (points.length === 0) {
            firstX = currentX;
            firstY = currentY;
          }
          
          // Add the point
          points.push({
            x: currentX,
            y: currentY,
            handleIn: { x: currentX - 50, y: currentY },
            handleOut: { x: currentX + 50, y: currentY },
            id: generateId()
          });
          
          console.log(`Added M point at ${currentX},${currentY}`);
        } catch (e) {
          console.log('Error processing M command:', e);
        }
      } else if (token === 'C' || token === 'c') {
        // Cubic bezier curve command
        if (i + 5 >= tokens.length) break;
        
        try {
          const x1 = parseFloat(tokens[i++]);
          const y1 = parseFloat(tokens[i++]);
          const x2 = parseFloat(tokens[i++]);
          const y2 = parseFloat(tokens[i++]);
          const x = parseFloat(tokens[i++]);
          const y = parseFloat(tokens[i++]);
          
          // Check for NaN values
          if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2) || isNaN(x) || isNaN(y)) {
            console.log('Invalid C command coordinates, skipping');
            continue;
          }
          
          // Update last point's handle out
          if (points.length > 0) {
            const lastPoint = points[points.length - 1];
            lastPoint.handleOut = { x: x1, y: y1 };
          }
          
          // Add new point
          points.push({
            x,
            y,
            handleIn: { x: x2, y: y2 },
            handleOut: { x: x + (x - x2), y: y + (y - y2) }, // Approximate handle out
            id: generateId()
          });
          
          console.log(`Added C point at ${x},${y} with handles`);
          
          currentX = x;
          currentY = y;
        } catch (e) {
          console.log('Error processing C command:', e);
        }
      } else if (token === 'Z' || token === 'z') {
        // Close path command - connect back to first point
        try {
          if (points.length > 0 && (currentX !== firstX || currentY !== firstY)) {
            console.log(`Adding Z point to close path back to ${firstX},${firstY}`);
            
            points.push({
              x: firstX,
              y: firstY,
              handleIn: { x: firstX - 50, y: firstY },
              handleOut: { x: firstX + 50, y: firstY },
              id: generateId()
            });
          }
        } catch (e) {
          console.log('Error processing Z command:', e);
        }
      } else {
        // Skip other commands (for simplicity)
        console.log(`Skipping unsupported command: ${token}`);
        i++;
      }
    }
    
    console.log(`Generated ${points.length} points from path`);
    
    // If we have at least 2 points, make sure handles are properly set
    if (points.length >= 2) {
      // For the first point, set handle out in direction of second point
      const p0 = points[0];
      const p1 = points[1];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 0) {
        const handleLen = Math.min(50, dist / 3);
        p0.handleOut = {
          x: p0.x + (dx / dist) * handleLen,
          y: p0.y + (dy / dist) * handleLen
        };
        
        p1.handleIn = {
          x: p1.x - (dx / dist) * handleLen,
          y: p1.y - (dy / dist) * handleLen
        };
      }
      
      // For the last point, set handle in direction of second-to-last point
      if (points.length > 2) {
        const pLast = points[points.length - 1];
        const pPrev = points[points.length - 2];
        const dx = pLast.x - pPrev.x;
        const dy = pLast.y - pPrev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
          const handleLen = Math.min(50, dist / 3);
          pLast.handleIn = {
            x: pLast.x - (dx / dist) * handleLen,
            y: pLast.y - (dy / dist) * handleLen
          };
          
          pPrev.handleOut = {
            x: pPrev.x + (dx / dist) * handleLen,
            y: pPrev.y + (dy / dist) * handleLen
          };
        }
      }
    }
    
    return points;
  } catch (error) {
    console.error('Error parsing SVG path:', error);
    return [];
  }
};

/**
 * Parse transform attribute from SVG
 * This is a simplified implementation for basic transforms
 */
const parseTransform = (transform: string): Partial<TransformSettings> | null => {
  if (!transform) return null;
  
  const result: Partial<TransformSettings> = {
    rotation: 0,
    scaleX: 1,
    scaleY: 1
  };
  
  // Extract rotation
  const rotateMatch = transform.match(/rotate\s*\(\s*([^,)]+)/);
  if (rotateMatch && rotateMatch[1]) {
    result.rotation = parseFloat(rotateMatch[1]) || 0;
  }
  
  // Extract scale
  const scaleMatch = transform.match(/scale\s*\(\s*([^,)]+)(?:,\s*([^)]+))?/);
  if (scaleMatch) {
    if (scaleMatch[1]) {
      result.scaleX = parseFloat(scaleMatch[1]) || 1;
    }
    if (scaleMatch[2]) {
      result.scaleY = parseFloat(scaleMatch[2]) || 1;
    } else if (scaleMatch[1]) {
      // If only one value is provided, use it for both x and y
      result.scaleY = result.scaleX;
    }
  }
  
  return result;
};

/**
 * Normalizes design data to ensure a consistent format
 * Handles both {"objects":[...]} and direct [...] formats
 */
export const normalizeDesignData = (designData: string): BezierObject[] => {
  try {
    // Parse the JSON
    const parsedData = JSON.parse(designData);
    
    // Handle the case where data is already in array format [{"id":...}]
    if (Array.isArray(parsedData)) {
      return parsedData.map(obj => normalizeObject(obj));
    }
    
    // Handle the case where data is in {"objects":[...]} format
    if (parsedData && parsedData.objects && Array.isArray(parsedData.objects)) {
      return parsedData.objects.map(obj => normalizeObject(obj));
    }
    
    // If we can't determine the format, return empty array
    console.error('Unknown design data format:', designData);
    return [];
  } catch (error) {
    console.error('Error parsing design data:', error);
    return [];
  }
};

/**
 * Normalizes a single bezier object to ensure all required properties
 */
const normalizeObject = (obj: any): BezierObject => {
  if (!obj) return createEmptyObject();
  
  // Ensure we have points
  if (!obj.points || !Array.isArray(obj.points) || obj.points.length === 0) {
    obj.points = [];
  }
  
  // Ensure each point has the correct structure
  obj.points = obj.points.map((point: any) => {
    if (!point) return createEmptyPoint(0, 0);
    
    // Ensure point has x,y coordinates
    if (typeof point.x !== 'number' || typeof point.y !== 'number') {
      point.x = point.x || 0;
      point.y = point.y || 0;
    }
    
    // Ensure point has handles
    if (!point.handleIn || typeof point.handleIn !== 'object') {
      point.handleIn = { x: point.x - 50, y: point.y };
    }
    
    if (!point.handleOut || typeof point.handleOut !== 'object') {
      point.handleOut = { x: point.x + 50, y: point.y };
    }
    
    // Ensure handle properties
    if (typeof point.handleIn.x !== 'number') point.handleIn.x = point.x - 50;
    if (typeof point.handleIn.y !== 'number') point.handleIn.y = point.y;
    if (typeof point.handleOut.x !== 'number') point.handleOut.x = point.x + 50;
    if (typeof point.handleOut.y !== 'number') point.handleOut.y = point.y;
    
    // Ensure point has an ID
    if (!point.id) point.id = generatePointId();
    
    return point;
  });
  
  // Ensure object has an ID
  if (!obj.id) obj.id = generateObjectId();
  
  // Ensure object has a name
  if (!obj.name) obj.name = `Object ${obj.id.slice(0, 6)}`;
  
  // Ensure object has transform settings
  if (!obj.transform) obj.transform = defaultTransform();
  
  // Ensure object has curve configuration
  if (!obj.curveConfig) obj.curveConfig = defaultCurveConfig();
  
  return obj;
};

/**
 * Creates an empty point at the specified coordinates
 */
const createEmptyPoint = (x: number, y: number): ControlPoint => {
  return {
    x,
    y,
    handleIn: { x: x - 50, y },
    handleOut: { x: x + 50, y },
    id: generatePointId()
  };
};

/**
 * Creates an empty bezier object
 */
const createEmptyObject = (): BezierObject => {
  return {
    id: generateObjectId(),
    name: 'New Object',
    points: [],
    transform: defaultTransform(),
    curveConfig: defaultCurveConfig(),
    isSelected: false,
    position: { x: 0, y: 0 }
  };
};

/**
 * Generates a random ID for a point
 */
const generatePointId = (): string => {
  return `pt_${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Generates a random ID for an object
 */
const generateObjectId = (): string => {
  return `obj_${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Generates a template data structure for saving
 */
export const createTemplateData = (
  objects: BezierObject[],
  name: string,
  description: string = '',
  thumbnail: string = '',
  canvasWidth: number = 800,
  canvasHeight: number = 600
) => {
  // Ensure objects have valid structure
  const normalizedObjects = objects.map(obj => normalizeObject(obj));
  
  // Create template with proper format
  return {
    version: "1.0",
    name: name || 'Untitled Design',
    description,
    thumbnail,
    canvasWidth,
    canvasHeight,
    createdAt: new Date().toISOString(),
    objects: normalizedObjects
  };
};

/**
 * Safely parses template data from various formats
 */
export const parseTemplateData = (templateString: string) => {
  try {
    // Try to parse the template string
    const parsed = JSON.parse(templateString);
    
    // If it's in the correct template format
    if (parsed && parsed.objects) {
      return {
        ...parsed,
        objects: normalizeDesignData(JSON.stringify(parsed.objects))
      };
    }
    
    // If it's just an array of objects
    if (Array.isArray(parsed)) {
      return {
        version: "1.0",
        name: 'Imported Design',
        description: '',
        thumbnail: '',
        canvasWidth: 800,
        canvasHeight: 600,
        createdAt: new Date().toISOString(),
        objects: normalizeDesignData(templateString)
      };
    }
    
    // Unknown format
    console.error('Unknown template format:', templateString);
    return null;
  } catch (error) {
    console.error('Error parsing template data:', error);
    return null;
  }
};

/**
 * Generates a thumbnail from SVG content
 */
export const generateThumbnail = async (
  svgString: string, 
  width: number = 200, 
  height: number = 150
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      const svg = new Blob([svgString], {type: 'image/svg+xml'});
      const url = URL.createObjectURL(svg);
      
      img.onload = () => {
        // Create a small canvas for the thumbnail
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Could not get canvas context"));
          return;
        }
        
        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate aspect ratio to fit the image
        const scale = Math.min(
          canvas.width / img.width,
          canvas.height / img.height
        );
        
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        
        // Draw the SVG on the canvas
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        
        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load SVG for thumbnail"));
      };
      
      img.src = url;
    } catch (error) {
      reject(new Error(`Error generating thumbnail: ${error}`));
    }
  });
};
