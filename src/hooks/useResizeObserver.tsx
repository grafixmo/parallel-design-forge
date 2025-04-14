
import { useEffect, useState, RefObject } from 'react';

/**
 * A hook to observe changes in an element's dimensions
 * @param ref - A React ref object pointing to the element to observe
 * @returns The observed element's width and height
 */
export const useResizeObserver = <T extends HTMLElement>(ref: RefObject<T>) => {
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (!ref.current) return;

    // Function to update dimensions
    const updateDimensions = () => {
      if (ref.current) {
        const { offsetWidth, offsetHeight } = ref.current;
        
        setDimensions({
          width: offsetWidth,
          height: offsetHeight,
        });
      }
    };

    // Initialize with current dimensions
    updateDimensions();

    // Set up ResizeObserver
    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length) {
        updateDimensions();
      }
    });

    // Start observing the element
    resizeObserver.observe(ref.current);

    // Clean up observer on unmount
    return () => {
      if (ref.current) {
        resizeObserver.unobserve(ref.current);
      }
      resizeObserver.disconnect();
    };
  }, [ref]);

  return dimensions;
};
