
import { useState, useEffect, RefObject } from 'react';
import { Point } from '@/types/bezier';
import { toast } from '@/hooks/use-toast';

interface CanvasSetupProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  wrapperRef: RefObject<HTMLDivElement>;
  width: number;
  height: number;
  isDrawingMode: boolean;
  backgroundImage?: string;
  backgroundOpacity: number;
}

export const useCanvasSetup = ({
  canvasRef,
  wrapperRef,
  width,
  height,
  isDrawingMode,
  backgroundImage,
  backgroundOpacity
}: CanvasSetupProps) => {
  // State for canvas setup and configuration
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [instructionMessage, setInstructionMessage] = useState<string>(
    'Click to place first control point (ESC to cancel)'
  );
  const [backgroundImageObj, setBackgroundImageObj] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [currentDrawingObjectId, setCurrentDrawingObjectId] = useState<string | null>(null);
  
  const ZOOM_FACTOR = 0.1;
  
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

  // Make sure canvas size is properly set
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Ensure canvas dimensions are set correctly
    if (width && height) {
      canvas.width = width;
      canvas.height = height;
      console.log(`Canvas dimensions set to ${width}x${height}`);
    } else {
      // Fallback to container size if width/height not provided
      const container = wrapperRef.current;
      if (container) {
        canvas.width = container.clientWidth || 800;
        canvas.height = container.clientHeight || 600;
        console.log(`Canvas fallback dimensions: ${canvas.width}x${canvas.height}`);
      } else {
        // Last resort fallback
        canvas.width = 800;
        canvas.height = 600;
        console.log('Using default canvas dimensions: 800x600');
      }
    }
  }, [width, height, canvasRef, wrapperRef]);
  
  // Update instruction message based on current state
  useEffect(() => {
    if (isDrawingMode) {
      if (currentDrawingObjectId) {
        // Currently drawing an object
        setInstructionMessage('Click to add more points. Right-click or double-click to finish the object. (ESC to cancel)');
      } else {
        // Ready to start drawing
        setInstructionMessage('Click to place first control point (ESC to cancel)');
      }
    } else {
      setInstructionMessage('Click to select objects or Shift+Drag to select multiple objects');
    }
  }, [isDrawingMode, currentDrawingObjectId]);
  
  // Convert screen coordinates to canvas coordinates (accounting for zoom)
  const screenToCanvas = (x: number, y: number): Point => {
    return {
      x: (x - panOffset.x) / zoom,
      y: (y - panOffset.y) / zoom
    };
  };
  
  // Handle zoom in function
  const handleZoomIn = () => {
    const newZoom = Math.min(5, zoom * (1 + ZOOM_FACTOR));
    setZoom(newZoom);
    toast({
      title: `Zoom: ${Math.round(newZoom * 100)}%`,
      description: 'Zoomed in'
    });
  };

  // Handle zoom out function
  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, zoom * (1 - ZOOM_FACTOR));
    setZoom(newZoom);
    toast({
      title: `Zoom: ${Math.round(newZoom * 100)}%`,
      description: 'Zoomed out'
    });
  };

  // Handle reset view
  const handleResetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    toast({
      title: 'View Reset',
      description: 'Zoom and pan have been reset'
    });
  };
  
  return {
    mousePos,
    setMousePos,
    instructionMessage,
    backgroundImageObj,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    isDrawingMode,
    currentDrawingObjectId,
    setCurrentDrawingObjectId,
    screenToCanvas,
    handleZoomIn,
    handleZoomOut,
    handleResetView
  };
};
