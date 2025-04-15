
import { BezierObject } from '@/types/bezier';
import { generateId } from './bezierUtils';
import { importSVG } from './simpleSvgImporter';

// Increased safety limit for better user experience
const MAX_OBJECTS = 20;

/**
 * Loads and processes templates with performance optimizations
 * Using proper chunking and batched processing to prevent UI freezing
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
): () => void => {
  const {
    onProgress = () => {},
    onComplete = () => {},
    onError = () => {},
    batchSize = 3,
    maxObjects = MAX_OBJECTS
  } = options;
  
  // Create an abort controller to allow cancellation
  const abortController = new AbortController();
  const signal = abortController.signal;
  
  // Start processing in the next tick to allow UI to update
  setTimeout(async () => {
    if (signal.aborted) return;
    
    try {
      // Show initial progress
      onProgress(5);
      
      // Handle array input directly
      if (Array.isArray(templateData)) {
        processObjectsInBatches(templateData, {
          onProgress: p => onProgress(5 + p * 0.95),
          onComplete,
          batchSize,
          maxObjects,
          signal
        });
        return;
      }
      
      // Try parsing as JSON first
      try {
        const parsed = JSON.parse(templateData);
        onProgress(10);
        
        if (signal.aborted) return;
        
        let objectsToProcess: BezierObject[] = [];
        
        if (Array.isArray(parsed)) {
          objectsToProcess = parsed;
        } else if (parsed.objects && Array.isArray(parsed.objects)) {
          objectsToProcess = parsed.objects;
        } else {
          throw new Error('Invalid JSON format');
        }
        
        processObjectsInBatches(objectsToProcess, {
          onProgress: p => onProgress(10 + p * 0.9),
          onComplete,
          batchSize,
          maxObjects,
          signal
        });
      } catch (jsonError) {
        // Not valid JSON, try as SVG
        try {
          if (signal.aborted) return;
          
          onProgress(15);
          const objects = importSVG(templateData);
          onProgress(40);
          
          if (signal.aborted) return;
          
          // Apply additional processing in batches
          processObjectsInBatches(objects, {
            onProgress: p => onProgress(40 + p * 0.6),
            onComplete,
            batchSize,
            maxObjects,
            signal
          });
        } catch (svgError) {
          if (!signal.aborted) {
            onError(new Error('Could not parse as JSON or SVG'));
          }
        }
      }
    } catch (error) {
      if (!signal.aborted) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  }, 50);
  
  // Return cancel function
  return () => {
    abortController.abort();
  };
};

/**
 * Process objects in batches with timeouts between batches
 * to prevent UI freezing
 */
const processObjectsInBatches = (
  objects: BezierObject[],
  options: {
    onProgress: (progress: number) => void;
    onComplete: (objects: BezierObject[]) => void;
    batchSize: number;
    maxObjects: number;
    signal: AbortSignal;
  }
): void => {
  const { onProgress, onComplete, batchSize, maxObjects, signal } = options;
  
  // Limit the number of objects to prevent performance issues
  const limitedObjects = objects.slice(0, maxObjects);
  
  if (objects.length > maxObjects) {
    console.warn(`Limiting template objects from ${objects.length} to ${maxObjects}`);
  }
  
  const totalBatches = Math.ceil(limitedObjects.length / batchSize);
  const processedObjects: BezierObject[] = [];
  
  // Process objects in batches
  const processBatch = (batchIndex: number) => {
    if (signal.aborted) return;
    
    // If all batches are processed, complete
    if (batchIndex >= totalBatches) {
      onProgress(100);
      onComplete(processedObjects);
      return;
    }
    
    // Calculate batch boundaries
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, limitedObjects.length);
    const batch = limitedObjects.slice(start, end);
    
    // Process this batch
    batch.forEach(obj => {
      processedObjects.push(validateAndFixObject(obj));
    });
    
    // Update progress
    const progress = Math.min(90, (batchIndex + 1) / totalBatches * 90);
    onProgress(progress);
    
    // Schedule next batch with a small delay to allow UI updates
    setTimeout(() => processBatch(batchIndex + 1), 20);
  };
  
  // Start processing from first batch
  processBatch(0);
};

/**
 * Ensure an object has all required properties and fix issues
 */
const validateAndFixObject = (obj: BezierObject): BezierObject => {
  return {
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
};

/**
 * Validate and fix points
 */
const validateAndFixPoints = (points: any[]): any[] => {
  // Reasonable point limit for good performance
  const MAX_POINTS = 20;
  
  if (points.length > MAX_POINTS) {
    console.warn(`Limiting points from ${points.length} to ${MAX_POINTS}`);
    points = points.slice(0, MAX_POINTS);
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
