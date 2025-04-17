import React, { useRef, useEffect, useState } from 'react';
import { 
  ControlPoint, 
  Point, 
  ControlPointType, 
  SelectedPoint,
  SelectionRect,
  HistoryState,
  BezierObject
} from '../types/bezier';
import { 
  isPointNear, 
  generateId,
  isPointInSelectionRect
} from '../utils/bezierUtils';
import { toast } from '@/hooks/use-toast';
import { ZoomIn, ZoomOut, Undo, Move, RotateCcw } from 'lucide-react';
import { BezierObjectRenderer } from './BezierObject';
import { Button } from '@/components/ui/button';

interface BezierCanvasProps {
  width: number;
  height: number;
  objects: BezierObject[];
  selectedObjectIds: string[];
  onObjectSelect: (objectId: string, multiSelect: boolean) => void;
  onObjectsChange: (objects: BezierObject[]) => void;
  onCreateObject: (points: ControlPoint[]) => string;
  onSaveState: () => void;
  onUndo: () => void;
  backgroundImage?: string;
  backgroundOpacity: number;
  isDrawingMode?: boolean;
}

const BezierCanvas: React.FC<BezierCanvasProps> = ({
  width,
  height,
  objects,
  selectedObjectIds,
  onObjectSelect,
  onObjectsChange,
  onCreateObject,
  onSaveState,
  onUndo,
  backgroundImage,
  backgroundOpacity,
  isDrawingMode = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMultiDragging, setIsMultiDragging] = useState(false);
  const [lastDragPosition, setLastDragPosition] = useState<Point | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [instructionMessage, setInstructionMessage] = useState<string>(
    'Click to place first control point (ESC to cancel)'
  );
  const [backgroundImageObj, setBackgroundImageObj] = useState<HTMLImageElement | null>(null);
  
  // Zoom and pan state
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  
  // Canvas dragging state
  const [isCanvasDragging, setIsCanvasDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

  // New state for tracking current drawing object
  const [currentDrawingObjectId, setCurrentDrawingObjectId] = useState<string | null>(null);
  
  const POINT_RADIUS = 8;
  const HANDLE_RADIUS = 6;
  const ZOOM_FACTOR = 0.1;
  
  // Clear all selections and reset drag states
  const clearSelections = () => {
    setSelectedPoint(null);
    setIsDragging(false);
    setIsMultiDragging(false);
    setIsSelecting(false);
    setSelectionRect(null);
    setLastDragPosition(null);
  };
  
  // Reset drawing state - called when cancelling or completing a drawing
  const resetDrawingState = () => {
    setCurrentDrawingObjectId(null);
    setSelectedPoint(null);
  };
  
  // Convert screen coordinates to canvas coordinates (accounting for zoom)
  const screenToCanvas = (x: number, y: number): Point => {
    return {
      x: (x - panOffset.x) / zoom,
      y: (y - panOffset.y) / zoom
    };
  };

  // Complete and finalize the current drawing object
  const finalizeDrawingObject = () => {
    if (currentDrawingObjectId) {
      // Find the current drawing object
      const drawingObject = objects.find(obj => obj.id === currentDrawingObjectId);
      
      if (drawingObject && drawingObject.points.length >= 2) {
        // Object has at least 2 points, so it's valid
        toast({
          title: "Object Created",
          description: `Created "${drawingObject.name}" with ${drawingObject.points.length} points`
        });
        
        // Save state and reset drawing
        onSaveState();
        resetDrawingState();
        
        // Deselect the object to allow for creating a new one next
        onObjectSelect('', false);
      } else {
        // Not enough points, inform the user
        toast({
          title: "Cannot Create Object",
          description: "An object must have at least 2 points. Keep clicking to add more points.",
          variant: "destructive"
        });
      }
    }
  };
  
  // Cancel the current drawing
  const cancelDrawing = () => {
    if (currentDrawingObjectId) {
      // Remove the partial object
      onObjectsChange(objects.filter(obj => obj.id !== currentDrawingObjectId));
      resetDrawingState();
      
      toast({
        title: "Drawing Cancelled",
        description: "The current drawing has been discarded"
      });
    }
  };

  // Handle zoom in
  const handleZoomIn = () => {
    setZoom(prev => Math.min(5, prev + ZOOM_FACTOR));
    toast({
      title: "Zoom In",
      description: `Zoom: ${Math.round((zoom + ZOOM_FACTOR) * 100)}%`
    });
  };

  // Handle zoom out
  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.1, prev - ZOOM_FACTOR));
    toast({
      title: "Zoom Out",
      description: `Zoom: ${Math.round((zoom - ZOOM_FACTOR) * 100)}%`
    });
  };

  // Reset view (zoom and pan)
  const handleResetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    toast({
      title: "View Reset",
      description: "Zoom and pan reset to default"
    });
  };

  // Handle mouse wheel for zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // Prevent default scrolling behavior
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get mouse position
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get mouse position in canvas coordinates before zoom change
    const mouseCanvasPos = screenToCanvas(mouseX, mouseY);
    
    // Change zoom based on wheel direction
    const delta = e.deltaY > 0 ? -ZOOM_FACTOR : ZOOM_FACTOR;
    const newZoom = Math.max(0.1, Math.min(5, zoom + delta));
    
    // Set new zoom
    setZoom(newZoom);
    
    // Adjust pan offset to zoom toward/away from mouse position
    if (newZoom !== zoom) {
      // Calculate new offset to keep the point under the mouse in the same position
      const newPanOffset = {
        x: mouseX - mouseCanvasPos.x * newZoom,
        y: mouseY - mouseCanvasPos.y * newZoom
      };
      
      setPanOffset(newPanOffset);
      
      // Show zoom notification
      toast({
        title: e.deltaY > 0 ? "Zoom Out" : "Zoom In",
        description: `Zoom: ${Math.round(newZoom * 100)}%`
      });
    }
  };
  
  // Handle mouse down on canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoom;
    const y = (e.clientY - rect.top - panOffset.y) / zoom;

    // Handle canvas panning when space is pressed
    if (isSpacePressed) {
      setIsCanvasDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Create new object in drawing mode
    if (isDrawingMode) {
      // If we're already drawing, add a point to the current object
      if (currentDrawingObjectId) {
        const updatedObjects = objects.map(obj => {
          if (obj.id === currentDrawingObjectId) {
            // Find the object we're currently drawing
            const newPoint: ControlPoint = {
              x,
              y,
              handleIn: { x: x - 50, y },
              handleOut: { x: x + 50, y },
              id: generateId()
            };
            return {
              ...obj,
              points: [...obj.points, newPoint]
            };
          }
          return obj;
        });
        onObjectsChange(updatedObjects);
      } else {
        // Start a new object
        const newPoint: ControlPoint = {
          x,
          y,
          handleIn: { x: x - 50, y },
          handleOut: { x: x + 50, y },
          id: generateId()
        };
        
        // Create the new object with initial point
        const newObjectId = onCreateObject([newPoint]);
        setCurrentDrawingObjectId(newObjectId);
      }
      return;
    }

    // Handle selection mode
    if (!isDrawingMode) {
      // Start selection rectangle if not clicking on an object
      let clickedOnObject = false;
      
      objects.forEach(obj => {
        // Find clicked point
        const clickResult = new BezierObjectRenderer({
          object: obj,
          isSelected: selectedObjectIds.includes(obj.id),
          zoom,
          selectedPoint,
          onPointSelect: setSelectedPoint,
          onPointMove: () => {},
          onSelect: () => {}
        }).handlePointInteraction(x, y, POINT_RADIUS);

        if (clickResult.found) {
          clickedOnObject = true;
          setSelectedPoint({
            objectId: obj.id,
            pointIndex: clickResult.pointIndex,
            type: clickResult.type
          });
          setIsDragging(true);
          onObjectSelect(obj.id, e.shiftKey);
        }
      });

      if (!clickedOnObject) {
        // Start selection rectangle
        setIsSelecting(true);
        setSelectionRect({
          startX: x,
          startY: y,
          width: 0,
          height: 0
        });
        
        // Clear selection if not holding shift
        if (!e.shiftKey) {
          onObjectSelect('', false);
        }
      }
    }
  };

  // Handle mouse move on canvas
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - panOffset.x) / zoom;
    const y = (e.clientY - rect.top - panOffset.y) / zoom;
    
    setMousePos({ x, y });

    // Handle canvas panning
    if (isCanvasDragging && dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPanOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Update selection rectangle
    if (isSelecting && selectionRect) {
      setSelectionRect({
        ...selectionRect,
        width: x - selectionRect.startX,
        height: y - selectionRect.startY
      });
      return;
    }

    // Handle point dragging
    if (isDragging && selectedPoint) {
      const updatedObjects = objects.map(obj => {
        if (obj.id === selectedPoint.objectId) {
          const newPoints = [...obj.points];
          const point = newPoints[selectedPoint.pointIndex];

          switch (selectedPoint.type) {
            case ControlPointType.MAIN:
              const dx = x - point.x;
              const dy = y - point.y;
              point.x = x;
              point.y = y;
              point.handleIn.x += dx;
              point.handleIn.y += dy;
              point.handleOut.x += dx;
              point.handleOut.y += dy;
              break;
            case ControlPointType.HANDLE_IN:
              point.handleIn = { x, y };
              break;
            case ControlPointType.HANDLE_OUT:
              point.handleOut = { x, y };
              break;
          }
          return { ...obj, points: newPoints };
        }
        return obj;
      });

      onObjectsChange(updatedObjects);
    }
  };

  // Handle mouse up on canvas
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Clear canvas dragging state
    if (isCanvasDragging) {
      setIsCanvasDragging(false);
      setDragStart(null);
      return;
    }

    // Handle selection rectangle
    if (isSelecting && selectionRect) {
      const selectedObjects = objects.filter(obj => 
        obj.points.some(point => 
          isPointInSelectionRect(point, selectionRect)
        )
      );

      if (selectedObjects.length > 0) {
        selectedObjects.forEach(obj => {
          onObjectSelect(obj.id, true);
        });
      }

      setIsSelecting(false);
      setSelectionRect(null);
    }

    // Save state after dragging
    if (isDragging) {
      onSaveState();
    }

    // Clear dragging states
    setIsDragging(false);
    setSelectedPoint(null);
  };

  // Handle context menu (right click)
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (currentDrawingObjectId) {
      finalizeDrawingObject();
    }
  };

  // Handle double click
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentDrawingObjectId) {
      finalizeDrawingObject();
    }
  };

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
  }, [width, height]);
  
  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and pan transformations
    ctx.setTransform(zoom, 0, 0, zoom, panOffset.x, panOffset.y);
    
    // Draw background image if available
    if (backgroundImageObj) {
      ctx.globalAlpha = backgroundOpacity;
      ctx.drawImage(backgroundImageObj, 0, 0, canvas.width / zoom, canvas.height / zoom);
      ctx.globalAlpha = 1;
    }
    
    // Render each Bezier object
    objects.forEach(object => {
      const isSelected = selectedObjectIds.includes(object.id);
      
      new BezierObjectRenderer({
        object: object,
        isSelected: isSelected,
        zoom: zoom,
        selectedPoint: selectedPoint,
        onPointSelect: setSelectedPoint,
        onPointMove: onObjectsChange,
        onSelect: onObjectSelect
      }).renderObject(ctx);
    });
    
    // Draw selection rectangle
    if (isSelecting && selectionRect) {
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.8)';
      ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([5 / zoom, 3 / zoom]);
      
      ctx.beginPath();
      ctx.rect(
        selectionRect.startX,
        selectionRect.startY,
        selectionRect.width,
        selectionRect.height
      );
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Reset transformation matrix to identity matrix
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Display mouse position
    if (isSpacePressed) {
      ctx.font = '16px sans-serif';
      ctx.fillStyle = 'black';
      ctx.fillText(`Pan: ${panOffset.x}, ${panOffset.y}`, 10, 20);
    } else {
      ctx.font = '16px sans-serif';
      ctx.fillStyle = 'black';
      ctx.fillText(`Mouse: ${mousePos.x}, ${mousePos.y}`, 10, 20);
    }
  }, [
    objects,
    selectedObjectIds,
    selectedPoint,
    selectionRect,
    isSelecting,
    backgroundImageObj,
    backgroundOpacity,
    zoom,
    panOffset,
    isSpacePressed,
    isCanvasDragging,
    mousePos,
    isDrawingMode,
    isMultiDragging,
    currentDrawingObjectId
  ]);
  
  // Add keyboard event listeners for shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space key for panning
      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
        document.body.style.cursor = 'grab';
      }
      
      // Escape key to cancel drawing
      if (e.code === 'Escape' && currentDrawingObjectId) {
        cancelDrawing();
      }
      
      // Delete key to remove selected objects
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedObjectIds.length > 0) {
        // This would typically call a delete function in the parent component
        // Assuming there is an onDeleteSelectedObjects prop
        // onDeleteSelectedObjects();
      }
      
      // Ctrl+Z for undo
      if (e.ctrlKey && e.code === 'KeyZ') {
        onUndo();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Space key released
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        document.body.style.cursor = 'default';
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed, currentDrawingObjectId, selectedObjectIds, onUndo, cancelDrawing]);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-white/80 p-2 rounded-md shadow-md">
          <p className="text-sm">{instructionMessage}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleResetView} title="Reset View">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onUndo} title="Undo">
            <Undo className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        className="bg-white"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
};

export default BezierCanvas;
