
import { loadTemplateAsync } from './optimizedTemplateLoader';
import { BezierObject } from '@/types/bezier';

/**
 * Simplified template loader that forwards to the optimized implementation
 * with proper cleanup handling
 */
export const loadTemplateData = async (
  templateData: string | BezierObject[],
  options: {
    onProgress?: (progress: number) => void;
    onComplete?: (objects: BezierObject[]) => void;
    onError?: (error: Error) => void;
  }
): Promise<BezierObject[]> => {
  return new Promise((resolve, reject) => {
    try {
      // Reference to the cancel function
      let cancelLoader: (() => void) | null = null;
      
      // Use the optimized implementation
      cancelLoader = loadTemplateAsync(templateData, {
        onProgress: options.onProgress || (() => {}),
        onComplete: (objects) => {
          options.onComplete?.(objects);
          resolve(objects);
          cancelLoader = null; // Clear reference
        },
        onError: (error) => {
          options.onError?.(error);
          reject(error);
          cancelLoader = null; // Clear reference
        }
      });
      
      // Handle potential external Promise rejection
      // by ensuring we cancel the loader
      setTimeout(() => {
        if (cancelLoader) {
          const cleanup = cancelLoader;
          cancelLoader = null;
          cleanup();
        }
      }, 15000); // Safety timeout
      
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error('Unknown error'));
      reject(error);
    }
  });
};
