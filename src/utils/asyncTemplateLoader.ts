
import { BezierObject } from '@/types/bezier';
import { generateId } from './bezierUtils';
import { importSVG } from './simpleSvgImporter';

/**
 * Loads template data asynchronously with chunking to prevent UI freeze
 */
export const loadTemplateAsync = (
  templateData: string | BezierObject[],
  onProgress: (progress: number) => void,
  onComplete: (objects: BezierObject[]) => void,
  onError: (error: Error) => void
): void => {
  // Start the loading process in the next tick to give UI a chance to update
  setTimeout(async () => {
    try {
      // Update progress to show we're starting
      onProgress(5);
      
      // If it's already an array of objects, process directly
      if (Array.isArray(templateData)) {
        await processObjectsAsync(templateData, onProgress, onComplete);
        return;
      }
      
      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(templateData);
        onProgress(20);
        
        if (Array.isArray(parsed)) {
          await processObjectsAsync(parsed, 
            (p) => onProgress(20 + p * 0.8), // Scale progress to 20-100%
            onComplete
          );
        } else if (parsed.objects && Array.isArray(parsed.objects)) {
          await processObjectsAsync(parsed.objects, 
            (p) => onProgress(20 + p * 0.8), // Scale progress to 20-100%
            onComplete
          );
        } else {
          throw new Error('Invalid JSON format');
        }
      } catch (jsonError) {
        // Not valid JSON, try as SVG
        try {
          onProgress(30);
          const objects = importSVG(templateData);
          onProgress(90);
          
          // Apply additional processing in chunks if needed
          await processObjectsAsync(objects, 
            (p) => onProgress(90 + p * 0.1), // Scale progress to 90-100%
            onComplete
          );
        } catch (svgError) {
          onError(new Error('Could not parse as JSON or SVG'));
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Unknown error'));
    }
  }, 50); // Small delay to allow UI to update
};

/**
 * Process objects in async chunks to prevent UI freezing
 */
const processObjectsAsync = async (
  objects: BezierObject[],
  onProgress: (progress: number) => void,
  onComplete: (objects: BezierObject[]) => void
): Promise<void> => {
  // Safety limit to prevent performance issues
  const MAX_OBJECTS = 8;
  
  // Limit the number of objects
  const limitedObjects = objects.slice(0, MAX_OBJECTS);
  
  if (objects.length > MAX_OBJECTS) {
    console.warn(`Limiting objects from ${objects.length} to ${MAX_OBJECTS} to prevent freezing`);
  }
  
  onProgress(30);
  
  // Process objects in chunks
  const processedObjects: BezierObject[] = [];
  const chunkSize = 2; // Process 2 objects at a time
  
  for (let i = 0; i < limitedObjects.length; i += chunkSize) {
    const chunk = limitedObjects.slice(i, i + chunkSize);
    
    // Process this chunk
    chunk.forEach(obj => {
      // Create a clean copy with all required properties
      processedObjects.push({
        id: generateId(), // Always generate a new ID
        name: obj.name || `Imported Object ${processedObjects.length + 1}`,
        isSelected: false,
        points: Array.isArray(obj.points) ? validatePoints(obj.points) : [],
        curveConfig: obj.curveConfig || {
          styles: [{ color: '#000000', width: 2 }],
          parallelCount: 0,
          spacing: 0
        },
        transform: obj.transform || {
          rotation: 0,
          scaleX: 1.0,
          scaleY: 1.0
        }
      });
    });
    
    // Update progress
    onProgress(30 + (i / limitedObjects.length) * 60);
    
    // Yield to UI thread to prevent freezing
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  onProgress(95);
  
  // Final processing if needed
  await new Promise(resolve => setTimeout(resolve, 0));
  
  onProgress(100);
  onComplete(processedObjects);
};

/**
 * Validate and fix points if needed
 */
const validatePoints = (points: any[]): any[] => {
  // Safety limit
  const MAX_POINTS = 10;
  
  // Limit points
  const limitedPoints = points.slice(0, MAX_POINTS);
  
  // Make sure all points have required properties
  return limitedPoints.map(point => ({
    id: point.id || generateId(),
    x: typeof point.x === 'number' ? point.x : 0,
    y: typeof point.y === 'number' ? point.y : 0,
    handleIn: validateHandle(point.handleIn, point.x, point.y, -20),
    handleOut: validateHandle(point.handleOut, point.x, point.y, 20)
  }));
};

/**
 * Validate and fix a handle
 */
const validateHandle = (handle: any, x: number, y: number, offset: number) => {
  if (!handle || typeof handle.x !== 'number' || typeof handle.y !== 'number') {
    return { x: x + offset, y };
  }
  return handle;
};
