
import { BezierObject } from '@/types/bezier';
import { generateId } from './bezierUtils';
import { importSVG } from './simpleSvgImporter';

// Safety limit for number of objects
const MAX_OBJECTS = 10;

// Interface for template loading options
interface TemplateLoadingOptions {
  onProgress?: (progress: number) => void;
  onComplete?: (objects: BezierObject[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Safely load template data with minimal complexity
 * This function handles both JSON and SVG formats
 */
export const loadTemplateData = async (
  templateData: string | BezierObject[],
  options?: TemplateLoadingOptions
): Promise<BezierObject[]> => {
  try {
    // Track progress
    const updateProgress = (progress: number) => {
      options?.onProgress?.(progress);
    };
    
    updateProgress(10);
    
    // Step 1: Determine the data type and parse if needed
    let objects: BezierObject[] = [];
    
    if (Array.isArray(templateData)) {
      // Already an array of objects
      objects = templateData;
      updateProgress(50);
    } else {
      // String data - could be JSON or SVG
      try {
        // Try to parse as JSON first
        const parsed = JSON.parse(templateData);
        updateProgress(30);
        
        if (Array.isArray(parsed)) {
          // Direct array of objects
          objects = parsed;
        } else if (parsed.objects && Array.isArray(parsed.objects)) {
          // Object with objects property
          objects = parsed.objects;
        } else {
          // Invalid JSON format
          throw new Error('Invalid JSON format');
        }
        updateProgress(50);
      } catch (jsonError) {
        // Not valid JSON, try as SVG
        try {
          // Try to import as SVG
          objects = importSVG(templateData);
          updateProgress(50);
        } catch (svgError) {
          throw new Error('Could not parse as JSON or SVG');
        }
      }
    }
    
    // Step 2: Validate and fix any issues with the objects
    objects = validateAndFixObjects(objects);
    updateProgress(70);
    
    // Step 3: Limit the number of objects to prevent freezing
    if (objects.length > MAX_OBJECTS) {
      console.warn(`Limiting objects from ${objects.length} to ${MAX_OBJECTS} to prevent freezing`);
      objects = objects.slice(0, MAX_OBJECTS);
    }
    updateProgress(90);
    
    // Success!
    updateProgress(100);
    options?.onComplete?.(objects);
    return objects;
  } catch (error) {
    console.error('Error loading template data:', error);
    options?.onError?.(error instanceof Error ? error : new Error('Unknown error'));
    throw error;
  }
};

/**
 * Ensure all objects have the necessary properties and fix any issues
 */
const validateAndFixObjects = (objects: BezierObject[]): BezierObject[] => {
  return objects.map((obj) => {
    // Ensure object has all required properties
    const validObject: BezierObject = {
      id: obj.id || generateId(),
      name: obj.name || 'Imported Object',
      isSelected: false, // Always start unselected
      points: validateAndFixPoints(obj.points || []),
      curveConfig: {
        styles: obj.curveConfig?.styles || [{ color: '#000000', width: 2 }],
        parallelCount: obj.curveConfig?.parallelCount || 0,
        spacing: obj.curveConfig?.spacing || 0,
      },
      transform: {
        rotation: obj.transform?.rotation || 0,
        scaleX: obj.transform?.scaleX || 1.0,
        scaleY: obj.transform?.scaleY || 1.0,
      },
    };
    
    // If object has no valid points, create a simple shape
    if (validObject.points.length < 2) {
      validObject.points = createSimpleShape();
    }
    
    return validObject;
  });
};

/**
 * Validate and fix points in an object
 */
const validateAndFixPoints = (points: any[]): any[] => {
  // Limit points to prevent performance issues
  const MAX_POINTS = 10;
  if (points.length > MAX_POINTS) {
    console.warn(`Limiting points from ${points.length} to ${MAX_POINTS}`);
    points = points.slice(0, MAX_POINTS);
  }
  
  return points.map((point) => {
    // Ensure point has all required properties
    return {
      id: point.id || generateId(),
      x: typeof point.x === 'number' ? point.x : 0,
      y: typeof point.y === 'number' ? point.y : 0,
      handleIn: validateHandle(point.handleIn, point.x, point.y, -20),
      handleOut: validateHandle(point.handleOut, point.x, point.y, 20),
    };
  });
};

/**
 * Validate a handle point
 */
const validateHandle = (handle: any, x: number, y: number, offset: number) => {
  if (!handle || typeof handle.x !== 'number' || typeof handle.y !== 'number') {
    return { x: x + offset, y };
  }
  return handle;
};

/**
 * Create a simple shape for fallback
 */
const createSimpleShape = () => {
  const centerX = 400;
  const centerY = 300;
  const size = 100;
  
  return [
    {
      x: centerX - size/2,
      y: centerY - size/2,
      handleIn: { x: centerX - size/2 - 20, y: centerY - size/2 },
      handleOut: { x: centerX - size/2 + 20, y: centerY - size/2 },
      id: generateId()
    },
    {
      x: centerX + size/2,
      y: centerY - size/2,
      handleIn: { x: centerX + size/2 - 20, y: centerY - size/2 },
      handleOut: { x: centerX + size/2 + 20, y: centerY - size/2 },
      id: generateId()
    },
    {
      x: centerX + size/2,
      y: centerY + size/2,
      handleIn: { x: centerX + size/2, y: centerY + size/2 - 20 },
      handleOut: { x: centerX + size/2, y: centerY + size/2 + 20 },
      id: generateId()
    },
    {
      x: centerX - size/2,
      y: centerY + size/2,
      handleIn: { x: centerX - size/2 + 20, y: centerY + size/2 },
      handleOut: { x: centerX - size/2 - 20, y: centerY + size/2 },
      id: generateId()
    }
  ];
};
