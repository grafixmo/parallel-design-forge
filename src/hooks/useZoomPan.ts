
import { useState, useCallback } from 'react';
import { Point } from '@/types/bezier';
import { toast } from '@/components/ui/use-toast';

const ZOOM_FACTOR = 0.1;

interface ZoomPanReturn {
  zoom: number;
  panOffset: Point;
  isSpacePressed: boolean;
  isCanvasDragging: boolean;
  dragStart: Point;
  screenToCanvas: (screenX: number, screenY: number) => Point;
  canvasToScreen: (canvasX: number, canvasY: number) => Point;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  handleWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
  setIsSpacePressed: (isPressed: boolean) => void;
  setIsCanvasDragging: (isDragging: boolean) => void;
  setDragStart: (point: Point) => void;
  updatePanOffset: (deltaX: number, deltaY: number) => void;
}

export function useZoomPan(): ZoomPanReturn {
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isCanvasDragging, setIsCanvasDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });

  // Convert screen coordinates to canvas coordinates (accounting for zoom)
  const screenToCanvas = useCallback((screenX: number, screenY: number): Point => {
    return {
      x: (screenX - panOffset.x) / zoom,
      y: (screenY - panOffset.y) / zoom
    };
  }, [zoom, panOffset]);

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback((canvasX: number, canvasY: number): Point => {
    return {
      x: canvasX * zoom + panOffset.x,
      y: canvasY * zoom + panOffset.y
    };
  }, [zoom, panOffset]);

  // Zoom in
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(5, zoom * (1 + ZOOM_FACTOR));
    setZoom(newZoom);
    
    toast({
      title: `Zoom: ${Math.round(newZoom * 100)}%`,
      description: "View has been zoomed in"
    });
  }, [zoom]);

  // Zoom out
  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(0.1, zoom * (1 - ZOOM_FACTOR));
    setZoom(newZoom);
    
    toast({
      title: `Zoom: ${Math.round(newZoom * 100)}%`,
      description: "View has been zoomed out"
    });
  }, [zoom]);

  // Reset zoom and pan
  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    
    toast({
      title: "Zoom reset",
      description: "View has been reset to 100%"
    });
  }, []);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    // Calculate zoom direction
    const delta = e.deltaY < 0 ? 1 : -1;
    const newZoom = Math.max(0.1, Math.min(5, zoom * (1 + delta * ZOOM_FACTOR)));
    
    // Set new zoom
    setZoom(newZoom);
    
    toast({
      title: `Zoom: ${Math.round(newZoom * 100)}%`,
      description: "Use mouse wheel to zoom in/out"
    });
  }, [zoom]);

  // Update pan offset
  const updatePanOffset = useCallback((deltaX: number, deltaY: number) => {
    setPanOffset(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));
  }, []);

  return {
    zoom,
    panOffset,
    isSpacePressed,
    isCanvasDragging,
    dragStart,
    screenToCanvas,
    canvasToScreen,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleWheel,
    setIsSpacePressed,
    setIsCanvasDragging,
    setDragStart,
    updatePanOffset
  };
}
