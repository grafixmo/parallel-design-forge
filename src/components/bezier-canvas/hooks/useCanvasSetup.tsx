import { useState, useEffect, RefObject, useCallback } from 'react';
import { 
  Point, 
  BezierObject,
  SelectedPoint
} from '@/types/bezier';
import { toast } from '@/hooks/use-toast';

interface CanvasSetupProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  wrapperRef: RefObject<HTMLDivElement>;
  width: number;
  height: number;
  isDrawingMode: boolean;
  backgroundImage?: string;
  backgroundOpacity: number;
  objects: BezierObject[];
  selectedObjectIds: string[];
}

export const useCanvasSetup = ({
  canvasRef,
  wrapperRef,
  width,
  height,
  isDrawingMode,
  backgroundImage,
  backgroundOpacity,
  objects,
  selectedObjectIds
}: CanvasSetupProps) => {
  // Canvas state
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [instructionMessage, setInstructionMessage] = useState<string>(
    'Click to place first control point (ESC to cancel)'
  );
  const [backgroundImageObj, setBackgroundImageObj] = useState<HTMLImageElement | null>(null);
  
  // Zoom and pan state
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  
  // Drawing state
  const [currentDrawingObjectId, setCurrentDrawingObjectId] = useState<string | null>(null);
  
  // Canvas dimensions
  const [canvasDimensions, setCanvasDimensions] = useState({ width, height });
  
  // Initialize background image if URL is provided
  useEffect(() => {
    if (backgroundImage) {
      const img = new Image();
      img.src = backgroundImage;
      img.onload = () => {
        setBackgroundImageObj(img);
        console.log("Background image loaded:", img.width, "x", img.height);
      };
      img.onerror = (err) => {
        console.error("Error loading background image:", err);
        toast({
          title: "Image Error",
          description: "Failed to load background image",
          variant: "destructive"
        });
      };
    } else {
      setBackgroundImageObj(null);
    }
  }, [backgroundImage]);

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
      if (selectedObjectIds.length > 0) {
        setInstructionMessage('Drag selected objects or their points to move them, press DEL to delete');
      } else {
        setInstructionMessage('Click to select objects or Shift+Drag to select multiple objects');
      }
    }
  }, [isDrawingMode, currentDrawingObjectId, selectedObjectIds.length]);
  
  // Make sure canvas size is properly set
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Calculate dimensions based on available space or provided props
    let newWidth = width;
    let newHeight = height;
    
    // If width/height are not explicitly provided, use container dimensions
    if (!width || !height) {
      const container = wrapperRef.current;
      if (container) {
        newWidth = container.clientWidth || 800;
        newHeight = container.clientHeight || 600;
      } else {
        // Fallback to defaults
        newWidth = 800;
        newHeight = 600;
      }
    }
    
    // Set canvas dimensions with device pixel ratio for high DPI screens
    const dpr = window.devicePixelRatio || 1;
    canvas.width = newWidth * dpr;
    canvas.height = newHeight * dpr;
    
    // Adjust canvas display size with CSS
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;
    
    // Store dimensions for other calculations
    setCanvasDimensions({ width: newWidth, height: newHeight });
    
    console.log(`Canvas dimensions set to ${newWidth}x${newHeight} (DPR: ${dpr})`);
  }, [width, height, canvasRef, wrapperRef]);
  
  // Convert screen coordinates to canvas coordinates (accounting for zoom and pan)
  const screenToCanvas = useCallback((screenX: number, screenY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    // Adjust for high DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate the scale factor between CSS pixels and canvas pixels
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convert to canvas coordinates (accounting for pan and zoom)
    return {
      x: ((screenX - panOffset.x) / zoom) * scaleX / dpr,
      y: ((screenY - panOffset.y) / zoom) * scaleY / dpr
    };
  }, [canvasRef, zoom, panOffset]);
  
  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback((canvasX: number, canvasY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    // Adjust for high DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate the scale factor between canvas pixels and CSS pixels
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    
    // Convert to screen coordinates
    return {
      x: canvasX * scaleX * dpr * zoom + panOffset.x,
      y: canvasY * scaleY * dpr * zoom + panOffset.y
    };
  }, [canvasRef, zoom, panOffset]);
  
  // Render the canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Adjust for high DPI screens
    const dpr = window.devicePixelRatio || 1;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    
    // Clear canvas with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    
    // Apply zoom and pan transformations
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    
    // Draw background image if available
    if (backgroundImageObj) {
      ctx.globalAlpha = backgroundOpacity;
      
      // Calculate scaling to fit the canvas while maintaining aspect ratio
      const scale = Math.min(
        (canvas.width / dpr) / backgroundImageObj.width,
        (canvas.height / dpr) / backgroundImageObj.height
      ) / zoom; // Adjust for zoom
      
      const scaledWidth = backgroundImageObj.width * scale;
      const scaledHeight = backgroundImageObj.height * scale;
      
      const x = ((canvas.width / dpr) / zoom - scaledWidth) / 2;
      const y = ((canvas.height / dpr) / zoom - scaledHeight) / 2;
      
      ctx.drawImage(backgroundImageObj, x, y, scaledWidth, scaledHeight);
      ctx.globalAlpha = 1.0;
    }
    
    // Draw grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1 / zoom; // Adjust line width for zoom
    
    const gridSize = 20;
    const visibleWidth = (canvas.width / dpr) / zoom;
    const visibleHeight = (canvas.height / dpr) / zoom;
    const offsetX = -panOffset.x / zoom;
    const offsetY = -panOffset.y / zoom;
    
    // Calculate grid bounds
    const startX = Math.floor(offsetX / gridSize) * gridSize;
    const startY = Math.floor(offsetY / gridSize) * gridSize;
    const endX = offsetX + visibleWidth;
    const endY = offsetY + visibleHeight;
    
    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + visibleHeight);
      ctx.stroke();
    }
    
    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + visibleWidth, y);
      ctx.stroke();
    }
    
    // Draw coordinate axes for debugging
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(0, -1000);
    ctx.lineTo(0, 1000);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(-1000, 0);
    ctx.lineTo(1000, 0);
    ctx.stroke();
    
    // Add axes labels for debugging
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = `${12 / zoom}px Arial`;
    ctx.fillText('X', 50 / zoom, 10 / zoom);
    ctx.fillText('Y', 10 / zoom, 50 / zoom);
    ctx.fillText('0', 5 / zoom, 15 / zoom);
    
    // Restore context
    ctx.restore();
    
  }, [
    canvasRef,
    backgroundImageObj,
    backgroundOpacity,
    zoom,
    panOffset,
    mousePos,
    isDrawingMode
  ]);
  
  return {
    mousePos,
    setMousePos,
    instructionMessage,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    isDrawingMode,
    currentDrawingObjectId,
    setCurrentDrawingObjectId,
    backgroundImageObj,
    screenToCanvas,
    canvasToScreen,
    renderCanvas,
    canvasDimensions
  };
};
