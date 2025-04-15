// This file is being replaced by optimizedTemplateLoader.ts
// Keeping this file for backward compatibility
import { loadTemplateAsync } from './optimizedTemplateLoader';
import { BezierObject } from '@/types/bezier';

// Re-export the optimized function with a simpler interface
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
      // Use the newer implementation with cancellation
      const cancel = loadTemplateAsync(templateData, {
        onProgress: options.onProgress,
        onComplete: (objects) => {
          options.onComplete?.(objects);
          resolve(objects);
        },
        onError: (error) => {
          options.onError?.(error);
          reject(error);
        }
      });
      
      // Return the results directly for compatibility
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error('Unknown error'));
      reject(error);
    }
  });
};
