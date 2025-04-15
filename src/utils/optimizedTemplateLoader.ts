
import { BezierObject } from '@/types/bezier';
import { generateId } from './bezierUtils';
import { importSVG } from './simpleSvgImporter';

// Configuration constants
const OBJECT_LIMIT = 20;
const POINTS_LIMIT = 20;
const BATCH_SIZE = 3;
const BATCH_DELAY = 20;

/**
 * Unified template loader with improved memory management and cancellation
 */
export const loadTemplateAsync = (
  templateData: string | BezierObject[],
  options: {
    onProgress?: (progress: number) => void;
    onComplete?: (objects: BezierObject[]) => void;
    onError?: (error: Error) => void;
    batchSize?: number;
    maxObjects?: number;
  }
): (() => void) => {
  const {
    onProgress = () => {},
    onComplete = () => {},
    onError = () => {},
    batchSize = BATCH_SIZE,
    maxObjects = OBJECT_LIMIT
  } = options;
  
  let isCancelled = false;
  
  // Start processing in the next tick
  const timeoutId = setTimeout(async () => {
    try {
      if (isCancelled) return;
      
      // Show initial progress
      onProgress(5);
      
      // Handle array input directly
      if (Array.isArray(templateData)) {
        if (isCancelled) return;
        await processObjectsInBatches(
          templateData, 
          progress => onProgress(5 + progress * 0.95),
          objects => !isCancelled && onComplete(objects),
          error => !isCancelled && onError(error),
          { batchSize, maxObjects, isCancelled: () => isCancelled }
        );
        return;
      }
      
      if (isCancelled) return;
      
      // Try parsing as JSON first
      try {
        const parsed = JSON.parse(templateData);
        onProgress(10);
        
        if (isCancelled) return;
        
        let objectsToProcess: BezierObject[] = [];
        
        if (Array.isArray(parsed)) {
          objectsToProcess = parsed;
        } else if (parsed.objects && Array.isArray(parsed.objects)) {
          objectsToProcess = parsed.objects;
        } else {
          throw new Error('Invalid JSON format');
        }
        
        if (isCancelled) return;
        
        await processObjectsInBatches(
          objectsToProcess,
          progress => onProgress(10 + progress * 0.9),
          objects => !isCancelled && onComplete(objects),
          error => !isCancelled && onError(error),
          { batchSize, maxObjects, isCancelled: () => isCancelled }
        );
      } catch (jsonError) {
        // Not valid JSON, try as SVG
        if (isCancelled) return;
        
        try {
          onProgress(15);
          const objects = importSVG(templateData);
          onProgress(40);
          
          if (isCancelled) return;
          
          await processObjectsInBatches(
            objects,
            progress => onProgress(40 + progress * 0.6),
            objects => !isCancelled && onComplete(objects),
            error => !isCancelled && onError(error),
            { batchSize, maxObjects, isCancelled: () => isCancelled }
          );
        } catch (svgError) {
          if (!isCancelled) {
            onError(new Error('Could not parse as JSON or SVG'));
          }
        }
      }
    } catch (error) {
      if (!isCancelled) {
        onError(error instanceof Error ? error : new Error('Unknown error loading template'));
      }
    }
  }, 50);
  
  // Return cancel function that properly cleans up resources
  return () => {
    isCancelled = true;
    clearTimeout(timeoutId);
  };
};

/**
 * Process objects in batches with improved memory management
 */
const processObjectsInBatches = async (
  objects: BezierObject[],
  onProgress: (progress: number) => void,
  onComplete: (objects: BezierObject[]) => void,
  onError: (error: Error) => void,
  options: {
    batchSize: number;
    maxObjects: number;
    isCancelled: () => boolean;
  }
): Promise<void> => {
  const { batchSize, maxObjects, isCancelled } = options;
  
  try {
    // Limit objects to prevent memory issues
    const limitedObjects = objects.slice(0, maxObjects);
    
    if (objects.length > maxObjects) {
      console.warn(`Limiting template objects from ${objects.length} to ${maxObjects}`);
    }
    
    const totalBatches = Math.ceil(limitedObjects.length / batchSize);
    const processedObjects: BezierObject[] = [];
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      if (isCancelled()) return;
      
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, limitedObjects.length);
      const batch = limitedObjects.slice(start, end);
      
      // Process this batch
      batch.forEach(obj => {
        processedObjects.push(validateAndFixObject(obj));
      });
      
      // Update progress
      const progress = Math.min(90, ((batchIndex + 1) / totalBatches) * 90);
      onProgress(progress);
      
      // Yield to UI thread with a small delay
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      
      if (isCancelled()) return;
    }
    
    onProgress(100);
    onComplete(processedObjects);
  } catch (error) {
    if (!isCancelled()) {
      onError(error instanceof Error ? error : new Error('Error processing objects'));
    }
  }
};

/**
 * Ensure object has all required properties
 */
const validateAndFixObject = (obj: BezierObject): BezierObject => {
  return {
    id: obj.id || generateId(),
    name: obj.name || 'Imported Object',
    isSelected: false,
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
};

/**
 * Validate and fix points with strict limits
 */
const validateAndFixPoints = (points: any[]): any[] => {
  // Limit points for performance
  if (points.length > POINTS_LIMIT) {
    console.warn(`Limiting points from ${points.length} to ${POINTS_LIMIT}`);
    points = points.slice(0, POINTS_LIMIT);
  }
  
  if (points.length === 0) {
    // Create a default point if empty
    return [createDefaultPoint(100, 100)];
  }
  
  return points.map(point => {
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
 * Create a default control point
 */
const createDefaultPoint = (x: number, y: number) => {
  return {
    id: generateId(),
    x,
    y,
    handleIn: { x: x - 20, y },
    handleOut: { x: x + 20, y }
  };
};

/**
 * Validate and fix handle point
 */
const validateHandle = (handle: any, x: number, y: number, offset: number) => {
  if (!handle || typeof handle.x !== 'number' || typeof handle.y !== 'number') {
    return { x: x + offset, y };
  }
  return handle;
};
