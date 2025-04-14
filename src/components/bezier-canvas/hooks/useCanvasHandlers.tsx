
import { useState, useEffect, RefObject } from 'react';
import { 
  ControlPoint, 
  Point, 
  ControlPointType,
  SelectionRect,
  SelectedPoint,
  BezierObject
} from '@/types/bezier';
import { 
  isPointNear, 
  generateId,
  isPointInSelectionRect
} from '@/utils/bezierUtils';
import { toast } from '@/hooks/use-toast';
import { BezierObjectRenderer } from '@/components/BezierObject';

interface CanvasHandlersProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  objects: BezierObject[];
  selectedObjectIds: string[];
  onObjectSelect: (objectId: string, multiSelect: boolean) => void;
  onObjectsChange: (objects: BezierObject[]) => void;
  onCreateObject: (points: ControlPoint[]) => string;
  onSaveState: () => void;
  onUndo: () => void;
  zoom: number;
  panOffset: Point;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: Point) => void;
  isDrawingMode: boolean;
  currentDrawingObjectId: string | null;
  setCurrentDrawingObjectId: (id: string | null) => void;
}

export const useCanvasHandlers = ({
  canvasRef,
  objects,
  selectedObjectIds,
  onObjectSelect,
  onObjectsChange,
  onCreateObject,
  onSaveState,
  onUndo,
  zoom,
  panOffset,
  setZoom,
  setPanOffset,
  isDrawingMode,
  currentDrawingObjectId,
  setCurrentDrawingObjectId
}: CanvasHandlersProps) => {
  // State for handling interactions
  const [isDragging, setIsDragging] = useState(false);
  const [isMultiDragging, setIsMultiDragging] = useState(false);
  const [lastDragPosition, setLastDragPosition] = useState<Point | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [isCanvasDragging, setIsCanvasDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  
  const POINT_RADIUS = 8;
  const HANDLE_RADIUS = 6;
  const ZOOM_FACTOR = 0.1;
  
  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = (x: number, y: number): Point => {
    return {
      x: (x - panOffset.x) / zoom,
      y: (y - panOffset.y) / zoom
    };
  };
  
  // Clear all selections and reset drag states
  const clearSelections = () => {
    setSelectedPoint(null);
    setIsDragging(false);
    setIsMultiDragging(false);
    setIsSelecting(false);
    setSelectionRect(null);
    setLastDragPosition(null);
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
        setCurrentDrawingObjectId(null);
        
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
      setCurrentDrawingObjectId(null);
      
      toast({
        title: "Drawing Cancelled",
        description: "The current drawing has been discarded"
      });
    }
  };
  
  // Handle mouse down event
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    console.log(`Mouse down at screen coordinates: ${screenX}, ${screenY}`);
    
    // Convert to canvas coordinates
    const canvasCoords = screenToCanvas(screenX, screenY);
    const x = canvasCoords.x;
    const y = canvasCoords.y;
    
    console.log(`Converted to canvas coordinates: ${x}, ${y}`);
    console.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
    
    setMousePos({ x, y });
    
    // Right click to finish drawing
    if (e.button === 2 && currentDrawingObjectId) {
      e.preventDefault();
      finalizeDrawingObject();
      return;
    }
    
    // Handle canvas dragging with middle mouse button or when space is pressed
    if (e.button === 1 || isSpacePressed) {
      setIsCanvasDragging(true);
      setDragStart({ x: screenX, y: screenY });
      return;
    }
    
    // First, check if we're clicking on any existing objects
    let clickedOnObject = false;
    
    for (const object of objects) {
      // Skip the current drawing object for selection
      if (object.id === currentDrawingObjectId) continue;
      
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
    
    // If we're in drawing mode and didn't click on any object, handle drawing
    if (!clickedOnObject && isDrawingMode) {
      // If we're starting a new drawing, make sure no objects are selected
      if (!currentDrawingObjectId) {
        // Deselect any previously selected objects
        onObjectSelect('', false);
      }
      
      if (currentDrawingObjectId) {
        // We're already drawing an object, add a new point to it
        const objectIndex = objects.findIndex(obj => obj.id === currentDrawingObjectId);
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
        
        // Select the new point for potential dragging
        setSelectedPoint({
          objectId: object.id,
          pointIndex: updatedPoints.length - 1,
          type: ControlPointType.MAIN
        });
        setIsDragging(true);
        setLastDragPosition({ x, y });
        
        console.log(`Added point to existing object, now has ${updatedPoints.length} points`);
      } else {
        // Start a new drawing with the first point
        const newPoint: ControlPoint = {
          x,
          y,
          handleIn: { x: x - 50, y },
          handleOut: { x: x + 50, y },
          id: generateId()
        };
        
        console.log(`Creating new object at ${x},${y}`);
        
        // Create a new object with this point
        const newObjectId = onCreateObject([newPoint]);
        setCurrentDrawingObjectId(newObjectId);
        
        console.log(`New object created with ID: ${newObjectId}`);
        
        // Select the new point for potential dragging
        setSelectedPoint({
          objectId: newObjectId,
          pointIndex: 0,
          type: ControlPointType.MAIN
        });
        setIsDragging(true);
        setLastDragPosition({ x, y });
        
        toast({
          title: "Started Drawing",
          description: "Click to add more points. Right-click or double-click to finish."
        });
      }
    } else if (!clickedOnObject && !isDrawingMode) {
      // In selection mode with Shift key, start selection rectangle
      if (e.shiftKey) {
        setIsSelecting(true);
        setSelectionRect({
          startX: x,
          startY: y,
          width: 0,
          height: 0
        });
      } else if (selectedObjectIds.length > 0) {
        // In selection mode, clear selection when clicking on empty space (without Shift)
        onObjectSelect('', false); // Deselect all objects
      }
    }
  };
  
  // Handle mouse move event
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
    
    setMousePos({ x, y }); // Update mouse position for drawing hints
    
    // Handle canvas dragging
    if (isCanvasDragging) {
      const deltaX = screenX - dragStart.x;
      const deltaY = screenY - dragStart.y;
      
      // Update canvas offset for panning
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
  
  // Handle mouse up event
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
  
  // Handle context menu (right-click)
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent the browser context menu
    
    // If in drawing mode with an active drawing, finalize the object
    if (isDrawingMode && currentDrawingObjectId) {
      finalizeDrawingObject();
    }
  };
  
  // Handle double click to add points to an existing object, finalize drawing, or delete points
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
    
    // If in drawing mode with an active drawing, finalize the object
    if (isDrawingMode && currentDrawingObjectId) {
      finalizeDrawingObject();
      return;
    }
    
    // Check if double-clicking on a point to delete it (works in both modes)
    let pointDeleted = false;
    
    // For each object (prioritize selected objects)
    const objectsToCheck = [...objects].sort((a, b) => 
      (b.isSelected ? 1 : 0) - (a.isSelected ? 1 : 0)
    );
    
    for (const object of objectsToCheck) {
      // Skip if this would leave the object with fewer than 2 points
      if (object.points.length <= 2) continue;
      
      // Check if double-clicking on an existing point
      for (let i = 0; i < object.points.length; i++) {
        const point = object.points[i];
        
        if (isPointNear({ x, y }, point, POINT_RADIUS / zoom)) {
          // Remove the point
          const updatedPoints = object.points.filter((_, index) => index !== i);
          const updatedObjects = objects.map(obj => 
            obj.id === object.id 
              ? { ...obj, points: updatedPoints }
              : obj
          );
          
          onObjectsChange(updatedObjects);
          onSaveState();
          
          toast({
            title: "Point Removed",
            description: `Removed point ${i + 1} from ${object.name}`
          });
          
          pointDeleted = true;
          break;
        }
      }
      
      if (pointDeleted) break;
    }
    
    // If we didn't delete a point and we're in drawing mode, handle adding a point to selected object
    if (!pointDeleted && isDrawingMode && selectedObjectIds.length === 1) {
      const objectId = selectedObjectIds[0];
      const objectIndex = objects.findIndex(obj => obj.id === objectId);
      if (objectIndex === -1) return;
      
      const object = objects[objectIndex];
      
      // Don't add another point if we're too close to an existing point
      const tooCloseToExisting = object.points.some(point => 
        isPointNear({ x, y }, point, POINT_RADIUS * 2 / zoom)
      );
      
      if (!tooCloseToExisting) {
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
    }
  };
  
  // Handle mouse wheel for zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // This is necessary for the zoom behavior, but it may trigger a passive event warning
    
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
    
    setZoom(newZoom);
    
    toast({
      title: `Zoom: ${Math.round(newZoom * 100)}%`,
      description: 'Use mouse wheel to zoom in and out'
    });
  };
  
  // Setup wheel event with passive: false
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate zoom direction
      const delta = e.deltaY < 0 ? 1 : -1;
      const newZoom = Math.max(0.1, Math.min(5, zoom * (1 + delta * ZOOM_FACTOR)));
      
      // Set new zoom
      setZoom(newZoom);
    };
    
    // Add wheel event with passive false to prevent console errors
    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent);
    };
  }, [canvasRef, zoom, setZoom]);
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC key to exit drawing mode or clear selections
      if (e.key === 'Escape') {
        if (currentDrawingObjectId) {
          // Cancel the current drawing
          cancelDrawing();
        } else {
          clearSelections();
          // Also clear object selection when pressing ESC
          if (selectedObjectIds.length > 0) {
            onObjectSelect('', false);
          }
        }
      }
      
      // Delete key to delete selected objects
      if (e.key === 'Delete' && !isDrawingMode && selectedObjectIds.length > 0) {
        // This would be handled by the parent component
        toast({
          title: `${selectedObjectIds.length} objects deleted`,
          description: 'Selected objects have been removed'
        });
      }
      
      // Enter key to finalize drawing
      if (e.key === 'Enter' && currentDrawingObjectId) {
        finalizeDrawingObject();
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
  }, [selectedObjectIds, isDrawingMode, onUndo, currentDrawingObjectId, objects]);
  
  // Helper functions for external components to use
  const handleZoomIn = () => {
    const newZoom = Math.min(5, zoom * (1 + ZOOM_FACTOR));
    setZoom(newZoom);
    toast({
      title: `Zoom: ${Math.round(newZoom * 100)}%`,
      description: 'Zoomed in'
    });
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, zoom * (1 - ZOOM_FACTOR));
    setZoom(newZoom);
    toast({
      title: `Zoom: ${Math.round(newZoom * 100)}%`,
      description: 'Zoomed out'
    });
  };

  const handleResetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    toast({
      title: 'View Reset',
      description: 'Zoom and pan have been reset'
    });
  };
  
  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    handleDoubleClick,
    handleWheel,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    selectedPoint,
    mousePos,
    isSelecting,
    selectionRect,
    isCanvasDragging,
    isSpacePressed
  };
};
