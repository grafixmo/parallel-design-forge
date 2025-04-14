
import { useState, useRef, useEffect } from 'react';
import { Point } from '@/types/bezier';

interface CanvasSetupProps {
  width: number;
  height: number;
  isDrawingMode: boolean;
  pannable?: boolean;
}

export const useCanvasSetup = ({
  width,
  height,
  isDrawingMode,
  pannable = true
}: CanvasSetupProps) => {
  // Refs for DOM elements
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Canvas view state
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [isCanvasInitialized, setIsCanvasInitialized] = useState<boolean>(false);
  
  // Initialize canvas on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set initial dimensions on the canvas element
    canvas.width = width;
    canvas.height = height;
    
    // Mark canvas as initialized
    setIsCanvasInitialized(true);
  }, [width, height]);
  
  // Update canvas size when dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Update canvas dimensions
    canvas.width = width;
    canvas.height = height;
    
    // Re-render content
    console.log('Canvas dimensions updated:', width, height);
  }, [width, height]);
  
  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = (screenX: number, screenY: number): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Adjust for zoom and pan
    const x = (screenX - rect.left - panOffset.x) / zoom;
    const y = (screenY - rect.top - panOffset.y) / zoom;
    
    return { x, y };
  };
  
  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = (canvasX: number, canvasY: number): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Adjust for zoom and pan
    const x = canvasX * zoom + panOffset.x + rect.left;
    const y = canvasY * zoom + panOffset.y + rect.top;
    
    return { x, y };
  };
  
  // Reset view to default
  const resetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };
  
  return {
    canvasRef,
    containerRef,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    mousePos,
    setMousePos,
    isCanvasInitialized,
    screenToCanvas,
    canvasToScreen,
    resetView
  };
};
