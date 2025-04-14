
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Point, 
  BezierObject, 
  ControlPoint,
  CurveStyle,
  SelectionRect
} from '@/types/bezier';
import { 
  generatePathData, 
  isPointNear, 
  calculateDistance,
  isPointInSelectionRect,
  generateId
} from '@/utils/bezierUtils';
import { useResizeObserver } from '@/hooks/useResizeObserver';

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
  isDrawingMode = false
}) => {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Element dimensions
  const { width: containerWidth, height: containerHeight } = useResizeObserver(containerRef);
  
  // Memoize calculated scale factors
  const { scaleX, scaleY } = useMemo(() => {
    return {
      scaleX: containerWidth ? width / containerWidth : 1,
      scaleY: containerHeight ? height / containerHeight : 1
    };
  }, [width, height, containerWidth, containerHeight]);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<ControlPoint[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [draggedHandleType, setDraggedHandleType] = useState<'main' | 'handleIn' | 'handleOut' | null>(null);
  const [draggedObjectId, setDraggedObjectId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [lastPosition, setLastPosition] = useState<Point | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  
  // Constants
  const controlPointRadius = 6;
  const handlePointRadius = 4;
  const handleLineWidth = 1;
  const selectedControlPointColor = '#ff0000';
  const controlPointColor = '#0066ff';
  const handlePointColor = '#00cc44';
  const selectionRectColor = 'rgba(0, 102, 255, 0.2)';
  const selectionRectBorderColor = 'rgba(0, 102, 255, 0.8)';
  const canvasBackgroundColor = '#ffffff';
  
  // Load background image if provided
  useEffect(() => {
    if (backgroundImage) {
      const img = new Image();
      img.src = backgroundImage;
      img.onload = () => {
        setBgImage(img);
      };
    } else {
      setBgImage(null);
    }
  }, [backgroundImage]);
  
  // Get mouse position relative to canvas
  const getMousePosition = useCallback(
    (e: MouseEvent | React.MouseEvent): Point => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      return { x, y };
    },
    [scaleX, scaleY]
  );
  
  // Find point under cursor
  const findPointUnderCursor = useCallback(
    (position: Point, objectsToSearch = objects): {
      objectId: string | null;
      pointIndex: number | null;
      handleType: 'main' | 'handleIn' | 'handleOut' | null;
    } => {
      // Check for points in currently selected objects first for better UX
      const selectedObjects = objectsToSearch.filter(obj => selectedObjectIds.includes(obj.id));
      const allObjectsToCheck = [...selectedObjects, ...objectsToSearch.filter(obj => !selectedObjectIds.includes(obj.id))];
      
      for (const obj of allObjectsToCheck) {
        for (let i = 0; i < obj.points.length; i++) {
          const point = obj.points[i];
          
          // Check main control point first
          if (isPointNear(position, point, controlPointRadius)) {
            return { objectId: obj.id, pointIndex: i, handleType: 'main' };
          }
          
          // Then check handle points
          if (isPointNear(position, point.handleIn, handlePointRadius)) {
            return { objectId: obj.id, pointIndex: i, handleType: 'handleIn' };
          }
          
          if (isPointNear(position, point.handleOut, handlePointRadius)) {
            return { objectId: obj.id, pointIndex: i, handleType: 'handleOut' };
          }
        }
      }
      
      return { objectId: null, pointIndex: null, handleType: null };
    },
    [objects, selectedObjectIds, controlPointRadius, handlePointRadius]
  );
  
  // Drawing functions
  const drawBackground = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = canvasBackgroundColor;
      ctx.fillRect(0, 0, width, height);
      
      // Draw background image if available
      if (bgImage) {
        ctx.globalAlpha = backgroundOpacity;
        
        // Calculate dimensions to maintain aspect ratio and fit within canvas
        const imgRatio = bgImage.width / bgImage.height;
        const canvasRatio = width / height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (imgRatio > canvasRatio) {
          // Image is wider than canvas (relative to height)
          drawHeight = height;
          drawWidth = height * imgRatio;
          drawX = (width - drawWidth) / 2;
          drawY = 0;
        } else {
          // Image is taller than canvas (relative to width)
          drawWidth = width;
          drawHeight = width / imgRatio;
          drawX = 0;
          drawY = (height - drawHeight) / 2;
        }
        
        ctx.drawImage(bgImage, drawX, drawY, drawWidth, drawHeight);
        ctx.globalAlpha = 1.0;
      }
    },
    [width, height, bgImage, backgroundOpacity, canvasBackgroundColor]
  );
  
  const drawBezierCurve = useCallback(
    (ctx: CanvasRenderingContext2D, points: ControlPoint[], styles: CurveStyle[], parallelCount: number, spacing: number, isSelected: boolean) => {
      if (points.length < 2) return;
      
      // Log rendering information for debugging
      console.log('Styles:', JSON.stringify(styles, null, 2));
      
      // Draw the main path
      for (const style of styles) {
        ctx.beginPath();
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const pathData = generatePathData(points);
        const path = new Path2D(pathData);
        ctx.stroke(path);
      }
      
      // Draw parallel paths if specified
      if (parallelCount > 0 && spacing > 0) {
        for (let i = 1; i <= parallelCount; i++) {
          const offset = i * spacing;
          
          // Draw parallel path with offset
          ctx.beginPath();
          ctx.strokeStyle = styles[0].color;
          ctx.lineWidth = styles[0].width;
          
          const pathData = generatePathData(points, offset);
          const path = new Path2D(pathData);
          ctx.stroke(path);
        }
      }
      
      // Draw handles and control points if selected
      if (isSelected) {
        for (let i = 0; i < points.length; i++) {
          const point = points[i];
          
          // Draw handle lines
          ctx.beginPath();
          ctx.strokeStyle = handlePointColor;
          ctx.lineWidth = handleLineWidth;
          
          ctx.moveTo(point.handleIn.x, point.handleIn.y);
          ctx.lineTo(point.x, point.y);
          ctx.lineTo(point.handleOut.x, point.handleOut.y);
          ctx.stroke();
          
          // Draw handle points
          ctx.beginPath();
          ctx.fillStyle = handlePointColor;
          ctx.arc(point.handleIn.x, point.handleIn.y, handlePointRadius, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.beginPath();
          ctx.fillStyle = handlePointColor;
          ctx.arc(point.handleOut.x, point.handleOut.y, handlePointRadius, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw control point
          ctx.beginPath();
          ctx.fillStyle = i === 0 || i === points.length - 1 
            ? selectedControlPointColor 
            : controlPointColor;
          ctx.arc(point.x, point.y, controlPointRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    [controlPointRadius, handlePointRadius, handleLineWidth]
  );
  
  const drawCurrentPoints = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (currentPoints.length === 0) return;
      
      // Draw the path being created
      if (currentPoints.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const pathData = generatePathData(currentPoints);
        const path = new Path2D(pathData);
        ctx.stroke(path);
      }
      
      // Draw control points
      for (let i = 0; i < currentPoints.length; i++) {
        const point = currentPoints[i];
        
        // Draw handle lines
        ctx.beginPath();
        ctx.strokeStyle = handlePointColor;
        ctx.lineWidth = handleLineWidth;
        
        ctx.moveTo(point.handleIn.x, point.handleIn.y);
        ctx.lineTo(point.x, point.y);
        ctx.lineTo(point.handleOut.x, point.handleOut.y);
        ctx.stroke();
        
        // Draw handle points
        ctx.beginPath();
        ctx.fillStyle = handlePointColor;
        ctx.arc(point.handleIn.x, point.handleIn.y, handlePointRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.fillStyle = handlePointColor;
        ctx.arc(point.handleOut.x, point.handleOut.y, handlePointRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw control point
        ctx.beginPath();
        ctx.fillStyle = controlPointColor;
        ctx.arc(point.x, point.y, controlPointRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [currentPoints, controlPointRadius, handlePointRadius, handleLineWidth]
  );
  
  const drawSelectionRect = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!selectionRect) return;
      
      ctx.fillStyle = selectionRectColor;
      ctx.strokeStyle = selectionRectBorderColor;
      ctx.lineWidth = 1;
      
      ctx.fillRect(
        selectionRect.startX,
        selectionRect.startY,
        selectionRect.width,
        selectionRect.height
      );
      
      ctx.strokeRect(
        selectionRect.startX,
        selectionRect.startY,
        selectionRect.width,
        selectionRect.height
      );
    },
    [selectionRect]
  );
  
  // Main render function
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background
    drawBackground(ctx);
    
    // Draw all bezier objects
    for (const obj of objects) {
      console.log(`Rendering object ${obj.id} with parallelCount: ${obj.curveConfig.parallelCount}, spacing: ${obj.curveConfig.spacing}`);
      drawBezierCurve(
        ctx,
        obj.points,
        obj.curveConfig.styles,
        obj.curveConfig.parallelCount,
        obj.curveConfig.spacing,
        selectedObjectIds.includes(obj.id)
      );
    }
    
    // Draw current points if drawing
    if (isDrawingMode) {
      drawCurrentPoints(ctx);
    }
    
    // Draw selection rectangle if selecting
    if (isSelecting && selectionRect) {
      drawSelectionRect(ctx);
    }
  }, [
    width, 
    height, 
    objects, 
    selectedObjectIds, 
    isDrawingMode, 
    currentPoints, 
    isSelecting, 
    selectionRect, 
    drawBackground, 
    drawBezierCurve, 
    drawCurrentPoints, 
    drawSelectionRect
  ]);
  
  // Render canvas on changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);
  
  // Handle mouse down for drawing or selection
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const position = getMousePosition(e);
      setLastPosition(position);
      
      if (isDrawingMode) {
        // Start drawing mode
        setIsDrawing(true);
        
        // Create first point if starting a new path
        if (currentPoints.length === 0) {
          const handleDistance = 50;
          const newPoint: ControlPoint = {
            id: generateId(),
            x: position.x,
            y: position.y,
            handleIn: {
              x: position.x - handleDistance,
              y: position.y
            },
            handleOut: {
              x: position.x + handleDistance,
              y: position.y
            }
          };
          
          setCurrentPoints([newPoint]);
        }
      } else {
        // Check if clicking on an existing point or handle
        const { objectId, pointIndex, handleType } = findPointUnderCursor(position);
        
        if (objectId && pointIndex !== null && handleType) {
          // Start dragging a point or handle
          setIsDragging(true);
          setDraggedObjectId(objectId);
          setDraggedPointIndex(pointIndex);
          setDraggedHandleType(handleType);
          
          // Select the object if not already selected (unless shift is held for multi-select)
          if (!selectedObjectIds.includes(objectId)) {
            onObjectSelect(objectId, e.shiftKey);
          }
        } else {
          // Check if clicking on a path (for selection)
          const clickedObjectId = findObjectUnderCursor(position);
          
          if (clickedObjectId) {
            // Select the object
            onObjectSelect(clickedObjectId, e.shiftKey);
          } else {
            // Start selection rectangle
            setIsSelecting(true);
            setSelectionRect({
              startX: position.x,
              startY: position.y,
              width: 0,
              height: 0
            });
            
            // Clear selection if not multi-selecting
            if (!e.shiftKey) {
              onObjectSelect('', false);
            }
          }
        }
      }
    },
    [
      isDrawingMode, 
      currentPoints, 
      findPointUnderCursor, 
      getMousePosition, 
      onObjectSelect, 
      selectedObjectIds
    ]
  );
  
  // Find object under cursor (for selection)
  const findObjectUnderCursor = useCallback(
    (position: Point): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      // Check each object's path
      for (const obj of objects) {
        if (obj.points.length < 2) continue;
        
        // Create a path from the object's points
        const pathData = generatePathData(obj.points);
        const path = new Path2D(pathData);
        
        // Check if point is on the path
        if (ctx.isPointInStroke(path, position.x, position.y)) {
          return obj.id;
        }
      }
      
      return null;
    },
    [objects]
  );
  
  // Handle mouse move for drawing or dragging
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const position = getMousePosition(e);
      
      if (isDrawingMode && isDrawing) {
        // Update handle of the last point while drawing
        if (currentPoints.length > 0) {
          const updatedPoints = [...currentPoints];
          const lastPoint = updatedPoints[updatedPoints.length - 1];
          
          // Calculate handle direction
          const dx = position.x - lastPoint.x;
          const dy = position.y - lastPoint.y;
          
          // Update the out handle of the last point
          lastPoint.handleOut = {
            x: lastPoint.x + dx / 2,
            y: lastPoint.y + dy / 2
          };
          
          // Mirror the in handle
          lastPoint.handleIn = {
            x: lastPoint.x - dx / 2,
            y: lastPoint.y - dy / 2
          };
          
          setCurrentPoints(updatedPoints);
        }
      } else if (isDragging && draggedObjectId && draggedPointIndex !== null && draggedHandleType) {
        // Find the object being dragged
        const objectIndex = objects.findIndex(obj => obj.id === draggedObjectId);
        if (objectIndex === -1) return;
        
        // Create a copy of the objects array and the dragged object
        const updatedObjects = [...objects];
        const updatedObject = { ...updatedObjects[objectIndex] };
        const updatedPoints = [...updatedObject.points];
        
        // Get the point being dragged
        const point = { ...updatedPoints[draggedPointIndex] };
        
        // Calculate delta movement
        const deltaX = position.x - (lastPosition?.x || position.x);
        const deltaY = position.y - (lastPosition?.y || position.y);
        
        // Update based on which part is being dragged
        if (draggedHandleType === 'main') {
          // Move the main point and its handles
          point.x += deltaX;
          point.y += deltaY;
          point.handleIn.x += deltaX;
          point.handleIn.y += deltaY;
          point.handleOut.x += deltaX;
          point.handleOut.y += deltaY;
        } else if (draggedHandleType === 'handleIn') {
          // Move just the in handle
          point.handleIn.x += deltaX;
          point.handleIn.y += deltaY;
        } else if (draggedHandleType === 'handleOut') {
          // Move just the out handle
          point.handleOut.x += deltaX;
          point.handleOut.y += deltaY;
        }
        
        // Update the point in the array
        updatedPoints[draggedPointIndex] = point;
        
        // Update the object in the array
        updatedObject.points = updatedPoints;
        updatedObjects[objectIndex] = updatedObject;
        
        // Update the objects
        onObjectsChange(updatedObjects);
      } else if (isSelecting && selectionRect) {
        // Update selection rectangle
        setSelectionRect({
          ...selectionRect,
          width: position.x - selectionRect.startX,
          height: position.y - selectionRect.startY
        });
      }
      
      setLastPosition(position);
    },
    [
      isDrawingMode,
      isDrawing,
      isDragging,
      isSelecting,
      currentPoints,
      draggedObjectId,
      draggedPointIndex,
      draggedHandleType,
      objects,
      selectionRect,
      lastPosition,
      getMousePosition,
      onObjectsChange
    ]
  );
  
  // Handle mouse up for completing drawing or drag operations
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const position = getMousePosition(e);
      
      if (isDrawingMode && isDrawing) {
        // If a double click, finish the curve
        if (e.detail === 2 && currentPoints.length > 1) {
          // Create a new bezier object from the current points
          const objectId = onCreateObject(currentPoints);
          
          // Clear current points
          setCurrentPoints([]);
          setIsDrawing(false);
          
          // Save the state for undo
          onSaveState();
          
          // Select the new object
          onObjectSelect(objectId, false);
        } else if (!lastPosition || calculateDistance(position, lastPosition) > 5) {
          // Add a new point to the curve if not doubleclick and moved enough distance
          if (currentPoints.length > 0) {
            // Calculate the direction from the last point
            const lastPoint = currentPoints[currentPoints.length - 1];
            const dx = position.x - lastPoint.x;
            const dy = position.y - lastPoint.y;
            
            // Create a new point with default handles
            const newPoint: ControlPoint = {
              id: generateId(),
              x: position.x,
              y: position.y,
              handleIn: {
                x: position.x - dx / 2,
                y: position.y - dy / 2
              },
              handleOut: {
                x: position.x + dx / 2,
                y: position.y + dy / 2
              }
            };
            
            setCurrentPoints([...currentPoints, newPoint]);
          }
        }
      } else if (isDragging) {
        // End dragging
        setIsDragging(false);
        setDraggedObjectId(null);
        setDraggedPointIndex(null);
        setDraggedHandleType(null);
        
        // Save state for undo
        onSaveState();
      } else if (isSelecting && selectionRect) {
        // End selection
        setIsSelecting(false);
        
        // Find all objects in the selection rectangle
        const selectedObjects = objects.filter(obj =>
          obj.points.some(point => isPointInSelectionRect(point, selectionRect))
        );
        
        // Update selection
        if (selectedObjects.length > 0) {
          // If shift key is pressed, add to selection
          if (e.shiftKey) {
            const newSelection = [...selectedObjectIds];
            
            for (const obj of selectedObjects) {
              if (!newSelection.includes(obj.id)) {
                newSelection.push(obj.id);
              }
            }
            
            // Call selection handler with accumulated IDs
            if (newSelection.length > 0) {
              onObjectSelect(newSelection[0], true);
              
              // Select the rest in sequence
              for (let i = 1; i < newSelection.length; i++) {
                onObjectSelect(newSelection[i], true);
              }
            }
          } else {
            // Replace selection
            onObjectSelect(selectedObjects[0].id, false);
            
            // Select the rest in sequence
            for (let i = 1; i < selectedObjects.length; i++) {
              onObjectSelect(selectedObjects[i].id, true);
            }
          }
        }
        
        setSelectionRect(null);
      }
      
      setLastPosition(null);
    },
    [
      isDrawingMode,
      isDrawing,
      isDragging,
      isSelecting,
      currentPoints,
      selectionRect,
      lastPosition,
      objects,
      getMousePosition,
      onCreateObject,
      onObjectSelect,
      onSaveState,
      selectedObjectIds
    ]
  );
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        onUndo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo]);
  
  return (
    <div 
      ref={containerRef} 
      className="bezier-canvas-container w-full h-full overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: '100%',
          height: '100%',
          cursor: isDrawingMode ? 'crosshair' : 'default'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
};

export default BezierCanvas;
