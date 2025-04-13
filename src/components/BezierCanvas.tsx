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
import { ZoomIn, ZoomOut, Undo, Move } from 'lucide-react';
import { BezierObjectRenderer } from './BezierObject';

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
  
  // Update instruction message based on current state
  useEffect(() => {
    if (isDrawingMode) {
      if (objects.length === 0) {
        setInstructionMessage('Click to place first control point (ESC to cancel)');
      } else {
        setInstructionMessage('Click to add more points, or drag handles to adjust the curve (ESC to exit drawing mode)');
      }
    } else {
      if (selectedObjectIds.length > 0) {
        setInstructionMessage('Drag selected objects or their points to move them, press DEL to delete');
      } else {
        setInstructionMessage('Click to select objects or Shift+Drag to select multiple objects');
      }
    }
  }, [isDrawingMode, objects.length, selectedObjectIds.length]);
  
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
  
  // Convert screen coordinates to canvas coordinates (accounting for zoom)
  const screenToCanvas = (x: number, y: number): Point => {
    return {
      x: (x - panOffset.x) / zoom,
      y: (y - panOffset.y) / zoom
    };
  };

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and pan transformations
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    
    // Draw background image if available
    if (backgroundImageObj) {
      ctx.globalAlpha = backgroundOpacity;
      
      // Calculate scaling to fit the canvas while maintaining aspect ratio
      const scale = Math.min(
        canvas.width / backgroundImageObj.width,
        canvas.height / backgroundImageObj.height
      ) / zoom; // Adjust for zoom
      
      const scaledWidth = backgroundImageObj.width * scale;
      const scaledHeight = backgroundImageObj.height * scale;
      
      const x = (canvas.width / zoom - scaledWidth) / 2;
      const y = (canvas.height / zoom - scaledHeight) / 2;
      
      ctx.drawImage(backgroundImageObj, x, y, scaledWidth, scaledHeight);
      ctx.globalAlpha = 1.0;
    }
    
    // Draw grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1 / zoom; // Adjust line width for zoom
    
    const gridSize = 20;
    const visibleWidth = canvas.width / zoom;
    const visibleHeight = canvas.height / zoom;
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
    
    // Draw all bezier objects
    for (const object of objects) {
      const isObjectSelected = selectedObjectIds.includes(object.id);
      const bezierObject = new BezierObjectRenderer({
        object,
        isSelected: isObjectSelected,
        zoom,
        selectedPoint,
        onPointSelect: setSelectedPoint,
        onPointMove: () => {}, // This is handled by the parent component
        onSelect: onObjectSelect
      });
      
      bezierObject.renderObject(ctx);
    }
    
    // Draw selection rectangle if selecting
    if (isSelecting && selectionRect) {
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.8)';
      ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
      ctx.lineWidth = 2 / zoom; // Adjust for zoom
      
      ctx.beginPath();
      ctx.rect(
        selectionRect.startX,
        selectionRect.startY,
        selectionRect.width,
        selectionRect.height
      );
      ctx.fill();
      ctx.stroke();
    }
    
    // Draw zoom level indicator
    ctx.restore(); // Restore original context without zoom
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = '12px Arial';
    ctx.fillText(`Zoom: ${Math.round(zoom * 100)}%`, 10, 20);
    
    // Draw cursor based on interaction state
    if (isSpacePressed || isCanvasDragging) {
      const cursorSize = 20;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.font = `${cursorSize}px Arial`;
      ctx.fillText('✋', mousePos.x, mousePos.y);
    }
    
    // Show current mode indicator
    ctx.fillStyle = isDrawingMode ? 'rgba(46, 204, 113, 0.6)' : 'rgba(231, 76, 60, 0.6)';
    ctx.font = '12px Arial';
    ctx.fillText(`Mode: ${isDrawingMode ? 'Drawing' : 'Selection'}`, 10, 40);
    
    // Show drag indicator when dragging
    if (isMultiDragging && selectedObjectIds.length > 0) {
      ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
      ctx.font = '12px Arial';
      ctx.fillText(`Moving ${selectedObjectIds.length} objects`, 10, 60);
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
    isMultiDragging
  ]);
  
  // Handle mouse down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // Convert to canvas coordinates
    const canvasCoords = screenToCanvas(screenX, screenY);
    const x = canvasCoords.x;
    const y = canvasCoords.y;
    
    setMousePos({ x, y });
    
    // Handle canvas dragging with middle mouse button or when space is pressed
    if (e.button === 1 || isSpacePressed) {
      setIsCanvasDragging(true);
      setDragStart({ x: screenX, y: screenY });
      return;
    }
    
    // First, check if we're clicking on any existing objects
    let clickedOnObject = false;
    
    for (const object of objects) {
      // Create a temporary bezier object to use its methods
      const bezierObject = new BezierObjectRenderer({
        object,
        isSelected: selectedObjectIds.includes(object.id),
        zoom,
        selectedPoint,
        onPointSelect: setSelectedPoint,
        onPointMove: () => {}, // This is handled by the parent component
        onSelect: onObjectSelect
      });
      
      // If object is selected, check if we're clicking on a control point
      if (selectedObjectIds.includes(object.id)) {
        const result = bezierObject.handlePointInteraction(x, y, POINT_RADIUS / zoom);
        
        if (result.found) {
          // We found a point to interact with
          setSelectedPoint({
            objectId: object.id,
            pointIndex: result.pointIndex,
            type: result.type
          });
          setIsDragging(true);
          setLastDragPosition({ x, y });
          clickedOnObject = true;
          break;
        }
      }
      
      // Check if we're clicking on the object itself
      if (bezierObject.isPointInObject(x, y, POINT_RADIUS / zoom)) {
        onObjectSelect(object.id, e.shiftKey);
        clickedOnObject = true;
        
        // If the object is now selected, prepare for dragging
        if (selectedObjectIds.includes(object.id) || e.shiftKey) {
          setIsMultiDragging(true);
          setLastDragPosition({ x, y });
        }
        
        break;
      }
    }
    
    // If we didn't click on any object, handle canvas interaction
    if (!clickedOnObject) {
      if (!isDrawingMode && e.shiftKey) {
        // Start selection rectangle (only in selection mode)
        setIsSelecting(true);
        setSelectionRect({
          startX: x,
          startY: y,
          width: 0,
          height: 0
        });
      } else if (isDrawingMode) {
        // In drawing mode, add a new point to a new object
        const newPoint: ControlPoint = {
          x,
          y,
          handleIn: { x: x - 50, y },
          handleOut: { x: x + 50, y },
          id: generateId()
        };
        
        // Create a new object with this point
        const newObjectId = onCreateObject([newPoint]);
        
        // Select the new point for potential dragging
        setSelectedPoint({
          objectId: newObjectId,
          pointIndex: 0,
          type: ControlPointType.MAIN
        });
        setIsDragging(true);
        setLastDragPosition({ x, y });
      } else {
        // In selection mode, clear selection when clicking on empty space
        if (selectedObjectIds.length > 0) {
          onObjectSelect('', false); // Deselect all objects
        }
      }
    }
  };
  
  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // Convert to canvas coordinates
    const canvasCoords = screenToCanvas(screenX, screenY);
    const x = canvasCoords.x;
    const y = canvasCoords.y;
    
    setMousePos({ x: screenX, y: screenY }); // Use screen coordinates for cursor
    
    // Handle canvas dragging
    if (isCanvasDragging) {
      const deltaX = screenX - dragStart.x;
      const deltaY = screenY - dragStart.y;
      
      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setDragStart({ x: screenX, y: screenY });
      return;
    }
    
    // Handle multi-object dragging
    if (isMultiDragging && lastDragPosition && selectedObjectIds.length > 0) {
      const deltaX = x - lastDragPosition.x;
      const deltaY = y - lastDragPosition.y;
      
      // Update all selected objects
      const updatedObjects = objects.map(obj => {
        if (!selectedObjectIds.includes(obj.id)) return obj;
        
        // Move all points in the object
        const updatedPoints = obj.points.map(point => ({
          ...point,
          x: point.x + deltaX,
          y: point.y + deltaY,
          handleIn: {
            x: point.handleIn.x + deltaX,
            y: point.handleIn.y + deltaY
          },
          handleOut: {
            x: point.handleOut.x + deltaX,
            y: point.handleOut.y + deltaY
          }
        }));
        
        return { ...obj, points: updatedPoints };
      });
      
      onObjectsChange(updatedObjects);
      setLastDragPosition({ x, y });
      return;
    }
    
    // Handle single point dragging
    if (isDragging && selectedPoint !== null && lastDragPosition) {
      const { objectId, pointIndex, type } = selectedPoint;
      
      // Find the object
      const objectIndex = objects.findIndex(obj => obj.id === objectId);
      if (objectIndex === -1) return;
      
      const object = objects[objectIndex];
      if (pointIndex < 0 || pointIndex >= object.points.length) return;
      
      // Create a copy of the object's points
      const updatedPoints = [...object.points];
      const point = { ...updatedPoints[pointIndex] };
      
      if (type === ControlPointType.MAIN) {
        // Move the entire point and its handles
        const deltaX = x - lastDragPosition.x;
        const deltaY = y - lastDragPosition.y;
        
        point.x += deltaX;
        point.y += deltaY;
        point.handleIn.x += deltaX;
        point.handleIn.y += deltaY;
        point.handleOut.x += deltaX;
        point.handleOut.y += deltaY;
      } else if (type === ControlPointType.HANDLE_IN) {
        // Move handle in
        point.handleIn.x = x;
        point.handleIn.y = y;
      } else if (type === ControlPointType.HANDLE_OUT) {
        // Move handle out
        point.handleOut.x = x;
        point.handleOut.y = y;
      }
      
      updatedPoints[pointIndex] = point;
      
      // Update the object with new points
      const updatedObjects = [...objects];
      updatedObjects[objectIndex] = { ...object, points: updatedPoints };
      onObjectsChange(updatedObjects);
      
      setLastDragPosition({ x, y });
    } else if (isSelecting && selectionRect) {
      // Update selection rectangle
      setSelectionRect({
        ...selectionRect,
        width: x - selectionRect.startX,
        height: y - selectionRect.startY
      });
    }
    
    // Update cursor based on context
    if (canvas) {
      if (isSpacePressed || isCanvasDragging) {
        canvas.style.cursor = 'grab';
      } else if (isDrawingMode) {
        canvas.style.cursor = 'crosshair';
      } else if (isMultiDragging || (selectedObjectIds.length > 0 && !isSelecting)) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'default';
      }
    }
  };
  
  // Handle mouse up
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle canvas dragging
    if (isCanvasDragging) {
      setIsCanvasDragging(false);
      return;
    }
    
    // If we were dragging points or objects, save the current state
    if (isDragging || isMultiDragging) {
      onSaveState();
    }
    
    if (isSelecting && selectionRect) {
      // Find objects with points inside the selection rectangle
      const objectsInSelection = objects.filter(obj => 
        obj.points.some(point => isPointInSelectionRect(point, selectionRect))
      );
      
      // Get IDs of selected objects
      const objectIdsInSelection = objectsInSelection.map(obj => obj.id);
      
      // If shift is held, add to current selection
      if (e.shiftKey) {
        const newSelectedIds = [...selectedObjectIds];
        
        objectIdsInSelection.forEach(id => {
          if (!newSelectedIds.includes(id)) {
            newSelectedIds.push(id);
          }
        });
        
        // Update selected objects in parent component
        if (newSelectedIds.length !== selectedObjectIds.length) {
          // Only update if the selection changed
          objectIdsInSelection.forEach(id => onObjectSelect(id, true));
        }
      } else {
        // Replace current selection
        if (objectIdsInSelection.length > 0) {
          // Deselect all first
          onObjectSelect('', false);
          
          // Then select all in the rectangle
          objectIdsInSelection.forEach(id => onObjectSelect(id, true));
        }
      }
      
      if (objectIdsInSelection.length > 0) {
        toast({
          title: `${objectIdsInSelection.length} objects selected`,
          description: "Drag to move objects as a group, or press Delete to remove them"
        });
      }
    }
    
    setIsDragging(false);
    setIsMultiDragging(false);
    setIsSelecting(false);
    setSelectionRect(null);
    setLastDragPosition(null);
  };
  
  // Handle double click to add points to an existing object or delete points
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // Convert to canvas coordinates
    const canvasCoords = screenToCanvas(screenX, screenY);
    const x = canvasCoords.x;
    const y = canvasCoords.y;
    
    // If in drawing mode and an object is selected, add a point to it
    if (isDrawingMode && selectedObjectIds.length === 1) {
      const objectId = selectedObjectIds[0];
      const objectIndex = objects.findIndex(obj => obj.id === objectId);
      if (objectIndex === -1) return;
      
      const object = objects[objectIndex];
      
      // Create a new point
      const newPoint: ControlPoint = {
        x,
        y,
        handleIn: { x: x - 50, y },
        handleOut: { x: x + 50, y },
        id: generateId()
      };
      
      // Add the point to the object
      const updatedPoints = [...object.points, newPoint];
      const updatedObjects = [...objects];
      updatedObjects[objectIndex] = { ...object, points: updatedPoints };
      
      onObjectsChange(updatedObjects);
      onSaveState();
      
      toast({
        title: "Point Added",
        description: `Added a new point to ${object.name}`
      });
    }
    
    // If in drawing mode, also check if double-clicking on a point to delete it
    if (isDrawingMode && selectedObjectIds.length === 1) {
      const objectId = selectedObjectIds[0];
      const objectIndex = objects.findIndex(obj => obj.id === objectId);
      if (objectIndex === -1) return;
      
      const object = objects[objectIndex];
      
      // Check if double-clicking on an existing point
      for (let i = 0; i < object.points.length; i++) {
        const point = object.points[i];
        
        if (isPointNear({ x, y }, point, POINT_RADIUS / zoom)) {
          // Only delete if there are more than 2 points (to maintain a valid curve)
          if (object.points.length > 2) {
            // Remove the point
            const updatedPoints = object.points.filter((_, index) => index !== i);
            const updatedObjects = [...objects];
            updatedObjects[objectIndex] = { ...object, points: updatedPoints };
            
            onObjectsChange(updatedObjects);
            onSaveState();
            
            toast({
              title: "Point Removed",
              description: `Removed point ${i + 1} from ${object.name}`
            });
          } else {
            toast({
              title: "Cannot Remove Point",
              description: "An object must have at least 2 points",
              variant: "destructive"
            });
          }
          
          break;
        }
      }
    }
  };
  
  // Handle mouse wheel for zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate zoom direction
    const delta = e.deltaY < 0 ? 1 : -1;
    const newZoom = Math.max(0.1, Math.min(5, zoom * (1 + delta * ZOOM_FACTOR)));
    
    // Calculate new offset to zoom centered on mouse position
    const zoomRatio = newZoom / zoom;
    
    // Set new zoom and offset
    setZoom(newZoom);
    
    toast({
      title: `Zoom: ${Math.round(newZoom * 100)}%`,
      description: 'Use mouse wheel to zoom in and out'
    });
  };
  
  // Add keyboard event handler for shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC key to exit selection or clear selections
      if (e.key === 'Escape') {
        clearSelections();
      }
      
      // Delete key to delete selected objects
      if (e.key === 'Delete' && !isDrawingMode && selectedObjectIds.length > 0) {
        // This would be handled by the parent component
        toast({
          title: `${selectedObjectIds.length} objects deleted`,
          description: 'Selected objects have been removed'
        });
      }
      
      // Ctrl+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        onUndo();
      }
      
      // Space to enable panning
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Space to disable panning
      if (e.key === ' ') {
        setIsSpacePressed(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedObjectIds, isDrawingMode, onUndo]);
  
  return (
    <div ref={wrapperRef} className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full bg-white"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
      
      <div className="absolute bottom-4 left-4 text-sm text-gray-500 bg-white/80 px-3 py-1 rounded shadow">
        {instructionMessage}
      </div>
      
      <div className="absolute top-4 right-4 flex space-x-2">
        <button 
          className="bg-white/80 p-2 rounded shadow hover:bg-white transition-colors"
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-5 h-5" />
        </button>
        <button 
          className="bg-white/80 p-2 rounded shadow hover:bg-white transition-colors"
          onClick={() => setZoom(prev => Math.min(5, prev + ZOOM_FACTOR))}
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button 
          className="bg-white/80 p-2 rounded shadow hover:bg-white transition-colors"
          onClick={() => setZoom(prev => Math.max(0.1, prev - ZOOM_FACTOR))}
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default BezierCanvas;
