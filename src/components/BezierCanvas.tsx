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
      const isDrawingObject = object.id === currentDrawingObjectId;
      
      const bezierObject = new BezierObjectRenderer({
        object,
        isSelected: isObjectSelected || isDrawingObject,
        zoom,
        selectedPoint,
        onPointSelect: setSelectedPoint,
        onPointMove: () => {}, // This is handled by the parent component
        onSelect: onObjectSelect
      });
      
      bezierObject.renderObject(ctx);
      
      // Add special visual indicator for the object being drawn
      if (isDrawingObject && object.points.length > 0) {
        // Draw a hint line from the last point to the mouse position
        const lastPoint = object.points[object.points.length - 1];
        
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([5 / zoom, 5 / zoom]);
        
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Text hint to show number of points in the drawing
        ctx.fillStyle = 'rgba(46, 204, 113, 0.8)';
        ctx.font = `${12 / zoom}px Arial`;
        ctx.fillText(
          `Drawing: ${object.points.length} point${object.points.length === 1 ? '' : 's'} (need at least 2)`, 
          lastPoint.x + 10 / zoom, 
          lastPoint.y - 10 / zoom
        );
      }
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
    
    // Show drawing status if applicable
    if (currentDrawingObjectId) {
      const drawingObject = objects.find(obj => obj.id === currentDrawingObjectId);
      if (drawingObject) {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.6)';
        ctx.font = '12px Arial';
        ctx.fillText(
          `Drawing object: ${drawingObject.points.length} point${drawingObject.points.length === 1 ? '' : 's'}`, 
          10, 60
        );
      }
    }
    
    // Show drag indicator when dragging
    if (isMultiDragging && selectedObjectIds.length > 0) {
      ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
      ctx.font = '12px Arial';
      ctx.fillText(`Moving ${selectedObjectIds.length} objects`, 10, 80);
    }
    
    // Debug coordinates
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = '12px Arial';
    ctx.fillText(`Mouse: ${Math.round(mousePos.x)},${Math.round(mousePos.y)}`, 10, canvas.height - 10);
    
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
  
  // Handle mouse down
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
    
    setMousePos({ x, y }); // Update mouse position for drawing hints
    
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
  e.preventDefault();
  
  const canvas = canvasRef.current;
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Calculate zoom direction
  const delta = e.delta
