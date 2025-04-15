
import { BezierObject, ControlPoint } from '@/types/bezier';
import { generateId } from './bezierUtils';
import { importSVGtoCurves } from './curveImporter';

// Type for safely loading template data
export interface TemplateLoadingOptions {
  maxObjects?: number;
  maxPointsPerObject?: number;
  chunkSize?: number; 
  onProgress?: (progress: number) => void;
  onComplete?: (objects: BezierObject[]) => void;
  onError?: (error: Error) => void;
}

// Default options
const DEFAULT_OPTIONS: TemplateLoadingOptions = {
  maxObjects: 20,
  maxPointsPerObject: 20,
  chunkSize: 3,
};

/**
 * Safely loads template data with chunking to prevent UI freeze
 */
export const loadTemplateData = (
  templateData: string | BezierObject[], 
  options: TemplateLoadingOptions = {}
): Promise<BezierObject[]> => {
  return new Promise((resolve, reject) => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    try {
      console.log('Starting safe template loading...');
      
      // If already array of objects, process directly
      if (Array.isArray(templateData)) {
        processBezierObjects(templateData, opts)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      // Try to decode as JSON first
      try {
        const parsedData = JSON.parse(templateData);
        
        // Check if it's an array of objects or has an objects property
        if (Array.isArray(parsedData)) {
          processBezierObjects(parsedData, opts)
            .then(resolve)
            .catch(reject);
        } else if (parsedData.objects && Array.isArray(parsedData.objects)) {
          processBezierObjects(parsedData.objects, opts)
            .then(resolve)
            .catch(reject);
        } else {
          console.warn('Invalid template data format, trying as SVG...');
          // Try as SVG next
          try {
            const objects = importSVGtoCurves(templateData);
            opts.onProgress?.(100);
            opts.onComplete?.(objects);
            resolve(objects);
          } catch (svgError) {
            console.error('Error importing as SVG:', svgError);
            opts.onError?.(new Error('Invalid template data format'));
            reject(new Error('Invalid template data format'));
          }
        }
      } catch (jsonError) {
        console.warn('Failed to parse as JSON, trying as SVG...');
        // Try as SVG
        try {
          const objects = importSVGtoCurves(templateData);
          opts.onProgress?.(100);
          opts.onComplete?.(objects);
          resolve(objects);
        } catch (svgError) {
          console.error('Error importing as SVG:', svgError);
          opts.onError?.(new Error('Could not parse as JSON or SVG'));
          reject(new Error('Could not parse as JSON or SVG'));
        }
      }
    } catch (error) {
      console.error('Error loading template data:', error);
      opts.onError?.(error instanceof Error ? error : new Error('Unknown error loading template'));
      reject(error);
    }
  });
};

/**
 * Process bezier objects with chunking to prevent UI freeze
 */
const processBezierObjects = (
  objects: BezierObject[], 
  options: TemplateLoadingOptions
): Promise<BezierObject[]> => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Processing ${objects.length} bezier objects...`);
      
      // Limit the number of objects to prevent UI freeze
      const maxObjects = options.maxObjects || 20;
      const limitedObjects = objects.slice(0, maxObjects);
      
      if (objects.length > maxObjects) {
        console.warn(`Limiting from ${objects.length} to ${maxObjects} objects to prevent freezing`);
      }
      
      // Final array for processed objects
      const processedObjects: BezierObject[] = [];
      
      // Process in chunks to avoid UI freeze
      const chunkSize = options.chunkSize || 3;
      let currentIndex = 0;
      
      const processNextChunk = () => {
        // Process the next chunk of objects
        const chunk = limitedObjects.slice(currentIndex, currentIndex + chunkSize);
        
        // If no more chunks, we're done
        if (chunk.length === 0) {
          options.onProgress?.(100);
          options.onComplete?.(processedObjects);
          resolve(processedObjects);
          return;
        }
        
        // Process each object in the chunk
        chunk.forEach(obj => {
          // Validate the object has required properties
          if (!obj.points || !Array.isArray(obj.points)) {
            console.warn('Invalid object missing points array', obj);
            // Create a fallback object
            processedObjects.push(createFallbackObject());
            return;
          }
          
          // Limit points per object and ensure they have all required properties
          const maxPointsPerObject = options.maxPointsPerObject || 20;
          const limitedPoints = obj.points.slice(0, maxPointsPerObject)
            .map(ensureValidControlPoint);
          
          if (obj.points.length > maxPointsPerObject) {
            console.warn(`Limiting object from ${obj.points.length} to ${maxPointsPerObject} points`);
          }
          
          // Create a fresh object with the limited points
          processedObjects.push({
            id: generateId(), // Always generate a new ID
            points: limitedPoints,
            curveConfig: obj.curveConfig || {
              styles: [{ color: '#000000', width: 2 }],
              parallelCount: 0,
              spacing: 0
            },
            transform: obj.transform || {
              rotation: 0,
              scaleX: 1.0,
              scaleY: 1.0
            },
            name: obj.name || `Imported Object ${processedObjects.length + 1}`,
            isSelected: false // Always start unselected
          });
        });
        
        // Update progress
        currentIndex += chunkSize;
        const progress = Math.min(100, Math.round((currentIndex / limitedObjects.length) * 100));
        options.onProgress?.(progress);
        
        // Schedule next chunk with a small delay to allow UI to breathe
        setTimeout(processNextChunk, 10);
      };
      
      // Start processing
      processNextChunk();
    } catch (error) {
      console.error('Error processing bezier objects:', error);
      options.onError?.(error instanceof Error ? error : new Error('Error processing bezier objects'));
      reject(error);
    }
  });
};

/**
 * Ensure a control point has all required properties
 */
const ensureValidControlPoint = (point: Partial<ControlPoint>): ControlPoint => {
  // Make sure x and y exist
  const x = typeof point.x === 'number' ? point.x : 0;
  const y = typeof point.y === 'number' ? point.y : 0;
  
  // Ensure handles exist
  const handleIn = point.handleIn || { x: x - 10, y };
  const handleOut = point.handleOut || { x: x + 10, y };
  
  // Ensure id exists
  const id = point.id || generateId();
  
  return { x, y, handleIn, handleOut, id };
};

/**
 * Create a fallback bezier object if loading fails
 */
const createFallbackObject = (): BezierObject => {
  // Create a simple square
  const centerX = 400;
  const centerY = 300;
  const size = 80;
  
  const points: ControlPoint[] = [
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
  
  return {
    id: generateId(),
    points,
    curveConfig: {
      styles: [{ color: '#ff0000', width: 2 }], // Red for fallback shape
      parallelCount: 0,
      spacing: 0
    },
    transform: {
      rotation: 0,
      scaleX: 1.0,
      scaleY: 1.0
    },
    name: 'Fallback Shape',
    isSelected: false
  };
};
