
import { useState, useEffect, RefObject } from 'react';
import { Point } from '@/types/bezier';

interface CanvasSetupReturn {
  canvasWidth: number;
  canvasHeight: number;
  mousePos: Point;
  setMousePos: (pos: Point) => void;
  backgroundImageObj: HTMLImageElement | null;
}

export function useCanvasSetup(
  width: number,
  height: number,
  backgroundImage?: string,
  canvasRef?: RefObject<HTMLCanvasElement>
): CanvasSetupReturn {
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [backgroundImageObj, setBackgroundImageObj] = useState<HTMLImageElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(width);
  const [canvasHeight, setCanvasHeight] = useState<number>(height);
  
  // Initialize background image if URL is provided
  useEffect(() => {
    if (backgroundImage) {
      const img = new Image();
      img.src = backgroundImage;
      img.onload = () => {
        setBackgroundImageObj(img);
      };
    } else {
      setBackgroundImageObj(null);
    }
  }, [backgroundImage]);
  
  // Update canvas dimensions when props change
  useEffect(() => {
    setCanvasWidth(width);
    setCanvasHeight(height);
  }, [width, height]);
  
  return {
    canvasWidth,
    canvasHeight,
    mousePos,
    setMousePos,
    backgroundImageObj
  };
}
