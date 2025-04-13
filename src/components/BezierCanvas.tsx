import React, { useRef, useEffect, useState } from 'react';
import { 
  ControlPoint, 
  Point, 
  ControlPointType, 
  SelectedPoint,
  SelectionRect,
  HistoryState,
  PointGroup
} from '../types/bezier';
import { 
  isPointNear, 
  calculateBezierPoint,
  calculateParallelPoint, 
  generateId,
  isPointInSelectionRect
} from '../utils/bezierUtils';
import { toast } from '@/components/ui/use-toast';
import { Copy, Scissors, ZoomIn, ZoomOut, Undo, Move } from 'lucide-react';

interface BezierCanvasProps {
  width: number;
  height: number;
  points: ControlPoint[];
  onPointsChange: (points: ControlPoint[]) => void;
  curveWidth: number;
  curveColor: string;
  parallelCount: number;
  parallelSpacing: number;
  parallelColors: string[];
  parallelWidths: number[];
  rotation: number;
  scaleX: number;
  scaleY: number;
  backgroundImage?: string;
  backgroundOpacity: number;
  isDrawingMode?: boolean;
}

const BezierCanvas: React.FC<BezierCanvasProps> = ({
  width,
  height,
  points,
  onPointsChange,
  curveWidth,
  curveColor,
  parallelCount,
  parallelSpacing,
  parallelColors,
  parallelWidths,
  rotation,
  scaleX,
  scaleY,
  backgroundImage,
  backgroundOpacity,
  isDrawingMode = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMultiDragging, setIsMultiDragging] = useState(false); // New state for dragging multiple points
  const [lastDragPosition, setLastDragPosition] = useState<Point | null>(null); // Track last drag position
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [selectedPointsIndices, setSelectedPointsIndices] = useState<number[]>([]);
  const [instructionMessage, setInstructionMessage] = useState<string>(
    'Click to place first control point (ESC to cancel)'
  );
  const [backgroundImageObj, setBackgroundImageObj] = useState<HTMLImageElement | null>(null);
  
  // Convert flat points array to point groups structure
  const [pointGroups, setPointGroups] = useState<PointGroup[]>([]);
  
  // Initialize point groups from flat points array on first render
  useEffect(() => {
    if (points.length > 0 && pointGroups.length === 0) {
      // Initially, put all points in one group
      setPointGroups([{
        id: generateId(),
        points: [...points]
      }]);
    }
  }, [points, pointGroups.length]);
  
  // Helper function to convert point groups to flat array (for backward compatibility)
  const pointGroupsToFlatArray = (groups: PointGroup[]): ControlPoint[] => {
    return groups.flatMap(group => group.points);
  };
  
  // Update the external points array when point groups change
  useEffect(() => {
    if (pointGroups.length > 0) {
      const flatPoints = pointGroupsToFlatArray(pointGroups);
      onPointsChange(flatPoints);
    }
  }, [pointGroups, onPointsChange]);
  
  // Add zoom state
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  
  // Add clipboard state
  const [clipboard, setClipboard] = useState<ControlPoint[]>([]);
  
  // Add history state for undo functionality
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  
  // Add canvas dragging state
  const [isCanvasDragging, setIsCanvasDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  
  const POINT_RADIUS = 8;
  const HANDLE_RADIUS = 6;
  const POINT_COLOR = '#3498db'; // Blue
  const CONTROL_POINT_COLOR = '#2ecc71'; // Green
  const SELECTED_COLOR = '#e74c3c'; // Red
  const HANDLE_LINE_COLOR = 'rgba(52, 152, 219, 0.5)';
  const ZOOM_FACTOR = 0.1; // Zoom in/out factor
  const MAX_HISTORY_SIZE = 50; // Maximum number of history states to store
  
  // Clear all selections and reset states
  const clearSelections = () => {
    setSelectedPoint(null);
    setIsDragging(false);
    setIsMultiDragging(false);
    setIsSelecting(false);
    setSelectionRect(null);
    setSelectedPointsIndices([]);
    setLastDragPosition(null);
  };
  
  // Update instruction message based on drawing mode and points
  useEffect(() => {
    if (isDrawingMode) {
      if (points.length === 0) {
        setInstructionMessage('Click to place first control point (ESC to cancel)');
      } else {
        setInstructionMessage('Click to add more points, or drag handles to adjust the curve (ESC to exit drawing mode)');
      }
    } else {
      if (selectedPointsIndices.length > 0) {
        setInstructionMessage('Drag selected points to move them as a group, or press DEL to delete them');
      } else {
        setInstructionMessage('Click to select points or Shift+Drag to select multiple points. Press ESC to deselect.');
      }
    }
  }, [isDrawingMode, points.length, selectedPointsIndices.length]);
  
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
  
  // Save points to history when they change
  useEffect(() => {
    if (pointGroups.length > 0) {
      // Only add to history if this is a new state (not an undo/redo)
      if (currentHistoryIndex === history.length - 1 || currentHistoryIndex === -1) {
        const newHistoryState: HistoryState = {
          pointGroups: JSON.parse(JSON.stringify(pointGroups)), // Deep clone to avoid reference issues
          timestamp: Date.now()
        };
        
        // Limit history size by removing oldest entries if needed
        const newHistory = [...history, newHistoryState].slice(-MAX_HISTORY_SIZE);
        setHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);
      }
    }
  }, [pointGroups, history, currentHistoryIndex]);
  
  // Effect to clear selection when drawing mode changes
  useEffect(() => {
    clearSelections();
    
    if (isDrawingMode) {
      toast({
        title: 'Drawing Mode Activated',
        description: 'Click to add points, drag to adjust curves'
      });
    } else {
      toast({
        title: 'Selection Mode Activated',
        description: 'Select points to move or delete'
      });
    }
  }, [isDrawingMode]);
  
  // Undo function
  const handleUndo = () => {
    if (currentHistoryIndex > 0) {
      const prevState = history[currentHistoryIndex - 1];
      setCurrentHistoryIndex(currentHistoryIndex - 1);
      setPointGroups(prevState.pointGroups);
      
      toast({
        title: 'Undo',
        description: 'Previous action undone'
      });
    } else {
      toast({
        title: 'Cannot Undo',
        description: 'No more actions to undo',
        variant: 'destructive'
      });
    }
  };
  
  // Convert screen coordinates to canvas coordinates (accounting for zoom)
  const screenToCanvas = (x: number, y: number): Point => {
    return {
      x: (x - panOffset.x) / zoom,
      y: (y - panOffset.y) / zoom
    };
  };
  
  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = (x: number, y: number): Point => {
    return {
      x: x * zoom + panOffset.x,
      y: y * zoom + panOffset.y
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
    
    // Save the context state for transformation
    ctx.save();
    
    // Calculate center point for transformation
    const sumX = points.reduce((sum, point) => sum + point.x, 0);
    const sumY = points.reduce((sum, point) => sum + point.y, 0);
    const centerX = points.length > 0 ? sumX / points.length : canvas.width / (2 * zoom);
    const centerY = points.length > 0 ? sumY / points.length : canvas.height / (2 * zoom);
    
    // Apply transformations
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-centerX, -centerY);
    
    // Draw curves if we have enough points
    if (points.length >= 2) {
      // Draw parallel curves first (behind main curve)
      for (let p = 1; p <= parallelCount; p++) {
        const offset = p * parallelSpacing;
        const color = parallelColors[p - 1] || parallelColors[0] || curveColor;
        const width = parallelWidths[p - 1] || parallelWidths[0] || curveWidth;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = width / zoom; // Adjust for zoom
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        
        // Draw each segment between control points
        for (let i = 0; i < points.length - 1; i++) {
          const current = points[i];
          const next = points[i + 1];
          
          // Sample points along the curve and offset them
          const steps = 30; // More steps = smoother curve
          
          for (let t = 0; t <= steps; t++) {
            const normalizedT = t / steps;
            
            const offsetPoint = calculateParallelPoint(
              current,
              current.handleOut,
              next.handleIn,
              next,
              normalizedT,
              offset
            );
            
            if (t === 0) {
              ctx.moveTo(offsetPoint.x, offsetPoint.y);
            } else {
              ctx.lineTo(offsetPoint.x, offsetPoint.y);
            }
          }
        }
        
        ctx.stroke();
      }
      
      // Draw main curve
      ctx.strokeStyle = curveColor;
      ctx.lineWidth = curveWidth / zoom; // Adjust for zoom
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      
      // Draw bezier curve through all points
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        
        ctx.bezierCurveTo(
          current.handleOut.x, current.handleOut.y,
          next.handleIn.x, next.handleIn.y,
          next.x, next.y
        );
      }
      
      ctx.stroke();
    }
    
    // Draw handle lines
    ctx.strokeStyle = HANDLE_LINE_COLOR;
    ctx.lineWidth = 1 / zoom; // Adjust for zoom
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      // Only show handles in drawing mode or if the point is selected
      if (isDrawingMode || selectedPoint?.pointIndex === i || selectedPointsIndices.includes(i)) {
        // Draw handle lines
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(point.handleIn.x, point.handleIn.y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(point.handleOut.x, point.handleOut.y);
        ctx.stroke();
      }
    }
    
    // Restore the context state (remove transformation)
    ctx.restore();
    
    // Draw all control points and handles on top (without transformation)
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const isPointSelected = selectedPoint?.pointIndex === i || selectedPointsIndices.includes(i);
      
      // Draw handle points - only visible in drawing mode or when point is selected
      if (isDrawingMode || isPointSelected) {
        ctx.fillStyle = CONTROL_POINT_COLOR;
        
        // Handle In
        ctx.beginPath();
        ctx.arc(point.handleIn.x, point.handleIn.y, HANDLE_RADIUS / zoom, 0, Math.PI * 2);
        if (selectedPoint && selectedPoint.pointIndex === i && selectedPoint.type === ControlPointType.HANDLE_IN) {
          ctx.fillStyle = SELECTED_COLOR;
        } else {
          ctx.fillStyle = CONTROL_POINT_COLOR;
        }
        ctx.fill();
        
        // Handle Out
        ctx.beginPath();
        ctx.arc(point.handleOut.x, point.handleOut.y, HANDLE_RADIUS / zoom, 0, Math.PI * 2);
        if (selectedPoint && selectedPoint.pointIndex === i && selectedPoint.type === ControlPointType.HANDLE_OUT) {
          ctx.fillStyle = SELECTED_COLOR;
        } else {
          ctx.fillStyle = CONTROL_POINT_COLOR;
        }
        ctx.fill();
      }
      
      // Draw main point
      ctx.beginPath();
      ctx.arc(point.x, point.y, POINT_RADIUS / zoom, 0, Math.PI * 2);
      
      // Change color if selected
      if (selectedPoint && selectedPoint.pointIndex === i && selectedPoint.type === ControlPointType.MAIN) {
        ctx.fillStyle = SELECTED_COLOR;
      } else if (selectedPointsIndices.includes(i)) {
        ctx.fillStyle = SELECTED_COLOR;
      } else {
        ctx.fillStyle = POINT_COLOR;
      }
      
      ctx.fill();
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
    
    // Draw indication for multiple selected points in selection mode
    if (!isDrawingMode && selectedPointsIndices.length > 1) {
      // Draw a bounding box or highlight around the selected points
      const selectedPoints = selectedPointsIndices.map(index => points[index]);
      
      // Find min/max bounds of selected points
      const minX = Math.min(...selectedPoints.map(p => p.x));
      const minY = Math.min(...selectedPoints.map(p => p.y));
      const maxX = Math.max(...selectedPoints.map(p => p.x));
      const maxY = Math.max(...selectedPoints.map(p => p.y));
      
      // Draw dashed rectangle around selected points
      ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([5 / zoom, 3 / zoom]);
      
      ctx.beginPath();
      ctx.rect(minX - 10 / zoom, minY - 10 / zoom, maxX - minX + 20 / zoom, maxY - minY + 20 / zoom);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw move icon in the center
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      // Draw a simple move icon
      ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 15 / zoom, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'white';
      ctx.font = `${24 / zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⤸', centerX, centerY);
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
    
    // Show drag indicator when dragging multiple points
    if (isMultiDragging && selectedPointsIndices.length > 0) {
      ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
      ctx.font = '12px Arial';
      ctx.fillText(`Moving ${selectedPointsIndices.length} points`, 10, 60);
    }
    
  }, [
    points, 
    selectedPoint, 
    curveWidth, 
    curveColor, 
    parallelCount, 
    parallelSpacing, 
    parallelColors, 
    parallelWidths,
    rotation,
    scaleX,
    scaleY,
    selectionRect,
    isSelecting,
    selectedPointsIndices,
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
    
    // Check if we're in selection mode and have selected points
    if (!isDrawingMode && selectedPointsIndices.length > 0) {
      // Check if clicking within the bounds of selected points
      const selectedPoints = selectedPointsIndices.map(index => points[index]);
      
      // Find min/max bounds of selected points
      const minX = Math.min(...selectedPoints.map(p => p.x));
      const minY = Math.min(...selectedPoints.map(p => p.y));
      const maxX = Math.max(...selectedPoints.map(p => p.x));
      const maxY = Math.max(...selectedPoints.map(p => p.y));
      
      // Add some padding for easier selection
      const padding = 20 / zoom;
      
      // Check if click is within the bounding box of selected points
      if (x >= minX - padding && x <= maxX + padding && 
          y >= minY - padding && y <= maxY + padding) {
        setIsMultiDragging(true);
        setLastDragPosition({ x, y });
        return;
      }
    }
    
    // Check if clicking on a control point or handle
    let found = false;
    const currentGroupIndex = 0; // Default to first group for backward compatibility
    
    // For old codebase compatibility, we're assuming all points are in the first group
    if (pointGroups.length > 0) {
      const group = pointGroups[0];
      const points = group.points;
      
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        
        // Check main point
        if (isPointNear({ x, y }, point, POINT_RADIUS / zoom)) {
          if (!isDrawingMode && !e.shiftKey && !selectedPointsIndices.includes(i)) {
            // In selection mode, clicking on a point selects just that point
            setSelectedPointsIndices([i]);
          } else if (!isDrawingMode && e.shiftKey) {
            // Add/remove from selection with shift
            if (selectedPointsIndices.includes(i)) {
              setSelectedPointsIndices(selectedPointsIndices.filter(idx => idx !== i));
            } else {
              setSelectedPointsIndices([...selectedPointsIndices, i]);
            }
          } else {
            setSelectedPoint({ 
              groupIndex: currentGroupIndex,
              pointIndex: i, 
              type: ControlPointType.MAIN 
            });
          }
          
          setIsDragging(true);
          setLastDragPosition({ x, y });
          found = true;
          break;
        }
        
        // Only check handles in drawing mode or if point is already selected
        if (isDrawingMode || selectedPointsIndices.includes(i)) {
          // Check handle in
          if (isPointNear({ x, y }, point.handleIn, HANDLE_RADIUS / zoom)) {
            setSelectedPoint({ 
              groupIndex: currentGroupIndex,
              pointIndex: i, 
              type: ControlPointType.HANDLE_IN 
            });
            setIsDragging(true);
            setLastDragPosition({ x, y });
            found = true;
            break;
          }
          
          // Check handle out
          if (isPointNear({ x, y }, point.handleOut, HANDLE_RADIUS / zoom)) {
            setSelectedPoint({ 
              groupIndex: currentGroupIndex,
              pointIndex: i, 
              type: ControlPointType.HANDLE_OUT 
            });
            setIsDragging(true);
            setLastDragPosition({ x, y });
            found = true;
            break;
          }
        }
      }
    }
    
    // If not clicking on a point, start selection or add new point
    if (!found) {
      if (e.shiftKey) {
        // Start selection rectangle
        setIsSelecting(true);
        setSelectionRect({
          startX: x,
          startY: y,
          width: 0,
          height: 0
        });
      } else {
        if (isDrawingMode) {
          // Add new point if in drawing mode
          const newPoint: ControlPoint = {
            x,
            y,
            handleIn: { x: x - 50, y },
            handleOut: { x: x + 50, y },
            id: generateId()
          };
          
          // For compatibility with old code, we'll add to the first group or create one
          let updatedPointGroups = [...pointGroups];
          
          if (updatedPointGroups.length === 0) {
            // Create first group if none exists
            updatedPointGroups = [{
              id: generateId(),
              points: [newPoint]
            }];
          } else {
            // Add to first group
            const firstGroup = {...updatedPointGroups[0]};
            firstGroup.points = [...firstGroup.points, newPoint];
            updatedPointGroups[0] = firstGroup;
          }
          
          setPointGroups(updatedPointGroups);
          
          // Update flat points array for backward compatibility
          const flatPoints = pointGroupsToFlatArray(updatedPointGroups);
          onPointsChange(flatPoints);
          
          setSelectedPoint({ 
            groupIndex: 0,
            pointIndex: updatedPointGroups[0].points.length - 1, 
            type: ControlPointType.MAIN 
          });
          setIsDragging(true);
          setLastDragPosition({ x, y });
        } else {
          // In selection mode, clear selection when clicking on empty space
          clearSelections();
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
    
    // Handle multi-point dragging
    if (isMultiDragging && lastDragPosition && selectedPointsIndices.length > 0) {
      const deltaX = x - lastDragPosition.x;
      const deltaY = y - lastDragPosition.y;
      
      // Update all selected points
      const updatedPoints = [...points];
      
      selectedPointsIndices.forEach(index => {
        if (index >= 0 && index < updatedPoints.length) {
          const point = { ...updatedPoints[index] };
          
          // Move the point and its handles
          point.x += deltaX;
          point.y += deltaY;
          point.handleIn.x += deltaX;
          point.handleIn.y += deltaY;
          point.handleOut.x += deltaX;
          point.handleOut.y += deltaY;
          
          updatedPoints[index] = point;
        }
      });
      
      onPointsChange(updatedPoints);
      setLastDragPosition({ x, y });
      return;
    }
    
    // Handle single point dragging
    if (isDragging && selectedPoint !== null && lastDragPosition) {
      const { pointIndex, type } = selectedPoint;
      const updatedPoints = [...points];
      
      if (pointIndex >= 0 && pointIndex < updatedPoints.length) {
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
        onPointsChange(updatedPoints);
        setLastDragPosition({ x, y });
      }
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
      } else if (isMultiDragging || (selectedPointsIndices.length > 0 && !isSelecting)) {
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
    
    if (isSelecting && selectionRect) {
      // Find points inside the selection rectangle
      const selectedIndices = points.reduce((indices: number[], point, index) => {
        if (isPointInSelectionRect(point, selectionRect)) {
          indices.push(index);
        }
        return indices;
      }, []);
      
      setSelectedPointsIndices(selectedIndices);
      
      if (selectedIndices.length > 0) {
        toast({
          title: `${selectedIndices.length} points selected`,
          description: "Drag to move points as a group, or press Delete to remove them"
        });
      }
    }
    
    setIsDragging(false);
    setIsMultiDragging(false);
    setIsSelecting(false);
    setSelectionRect(null);
    setLastDragPosition(null);
  };
  
  // Handle double click to delete a point
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return; // Only allow point deletion in drawing mode
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // Convert to canvas coordinates
    const canvasCoords = screenToCanvas(screenX, screenY);
    const x = canvasCoords.x;
    const y = canvasCoords.y;
    
    // Check if double-clicking on a control point
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      if (isPointNear({ x, y }, point, POINT_RADIUS / zoom)) {
        // Remove the point
        const updatedPoints = points.filter((_, index) => index !== i);
        onPointsChange(updatedPoints);
        
        toast({
          title: "Point removed",
          description: `Point ${i + 1} has been deleted`
        });
        
        break;
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
      description: "Use mouse wheel to zoom in/out"
    });
  };
  
  // Copy selected points to clipboard
  const copySelectedPoints = () => {
    if (selectedPointsIndices.length > 0) {
      const pointsToCopy = selectedPointsIndices.map(index => ({
        ...points[index],
        id: generateId() // Generate new IDs for copied points
      }));
      setClipboard(pointsToCopy);
      
      toast({
        title: "Copied points",
        description: `${pointsToCopy.length} points copied to clipboard`
      });
    } else if (selectedPoint) {
      const pointToCopy = { 
        ...points[selectedPoint.pointIndex],
        id: generateId() // Generate new ID for copied point
      };
      setClipboard([pointToCopy]);
      
      toast({
        title: "Copied point",
        description: "1 point copied to clipboard"
      });
    }
  };
  
  // Cut selected points to clipboard
  const cutSelectedPoints = () => {
    if (selectedPointsIndices.length > 0) {
      // First copy
      const pointsToCut = selectedPointsIndices.map(index => ({
        ...points[index],
        id: generateId() // Generate new IDs for cut points
      }));
      setClipboard(pointsToCut);
      
      // Then delete
      const updatedPoints = points.filter((_, index) => !selectedPointsIndices.includes(index));
      onPointsChange(updatedPoints);
      setSelectedPointsIndices([]);
      
      toast({
        title: "Cut points",
        description: `${pointsToCut.length} points cut to clipboard`
      });
    } else if (selectedPoint) {
      // First copy
      const pointToCut = { 
        ...points[selectedPoint.pointIndex],
        id: generateId() // Generate new ID for cut point
      };
      setClipboard([pointToCut]);
      
      // Then delete
      const updatedPoints = points.filter((_, index) => index !== selectedPoint.pointIndex);
      onPointsChange(updatedPoints);
      setSelectedPoint(null);
      
      toast({
        title: "Cut point",
        description: "1 point cut to clipboard"
      });
    }
  };
  
  // Paste points from clipboard
  const pastePoints = () => {
    if (clipboard.length > 0) {
      // Calculate paste position - offset from original position
      const offset = 20; // Pixels to offset
      
      const pastedPoints = clipboard.map(point => ({
        ...point,
        x: point.x + offset,
        y: point.y + offset,
        handleIn: {
          x: point.handleIn.x + offset,
          y: point.handleIn.y + offset
        },
        handleOut: {
          x: point.handleOut.x + offset,
          y: point.handleOut.y + offset
        },
        id: generateId() // Generate new IDs for pasted points
      }));
      
      // Add pasted points to canvas
      const updatedPoints = [...points, ...pastedPoints];
      onPointsChange(updatedPoints);
      
      // Select newly pasted points
      const newSelectionIndices = pastedPoints.map((_, i) => points.length + i);
      setSelectedPointsIndices(newSelectionIndices);
      
      toast({
        title: "Pasted points",
        description: `${pastedPoints.length} points pasted from clipboard`
      });
    }
  };
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Add spacebar check for canvas dragging
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
        
        // Change cursor to indicate canvas dragging mode
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grab';
        }
      }
      
      // Undo (Ctrl+Z or Cmd+Z)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      
      // Copy (Ctrl+C or Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelectedPoints();
      }
      
      // Cut (Ctrl+X or Cmd+X)
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        cutSelectedPoints();
      }
      
      // Paste (Ctrl+V or Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pastePoints();
      }
      
      // Delete selected points when Delete or Backspace is pressed
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPointsIndices.length > 0) {
        e.preventDefault();
        const updatedPoints = points.filter((_, index) => !selectedPointsIndices.includes(index));
        onPointsChange(updatedPoints);
        setSelectedPointsIndices([]);
        
        toast({
          title: "Points removed",
          description: `${selectedPointsIndices.length} points have been deleted`
        });
      }
      
      // Cancel current operation when Escape is pressed
      if (e.key === 'Escape') {
        e.preventDefault();
        
        clearSelections();
        
        // Reset cursor
        if (canvasRef.current) {
          canvasRef.current.style.cursor = isDrawingMode ? 'crosshair' : 'default';
        }
        
        toast({
          title: "Selection cleared",
          description: "All selected points have been deselected"
        });
      }
      
      // Reset zoom with 0 key
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
        
        toast({
          title: "Zoom reset",
          description: "View has been reset to 100%"
        });
      }
      
      // Zoom in with + key
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const newZoom = Math.min(5, zoom * (1 + ZOOM_FACTOR));
        setZoom(newZoom);
        
        toast({
          title: `Zoom: ${Math.round(newZoom * 100)}%`,
          description: "View has been zoomed in"
        });
      }
      
      // Zoom out with - key
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const newZoom = Math.max(0.1, zoom * (1 - ZOOM_FACTOR));
        setZoom(newZoom);
        
        toast({
          title: `Zoom: ${Math.round(newZoom * 100)}%`,
          description: "View has been zoomed out"
        });
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Handle spacebar release
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
        
        // Reset cursor
        if (canvasRef.current) {
          canvasRef.current.style.cursor = isDrawingMode ? 'crosshair' : 'default';
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [points, selectedPointsIndices, selectedPoint, clipboard, zoom, onPointsChange, history, currentHistoryIndex, isSpacePressed, isDrawingMode]);
  
  return (
    <div ref={wrapperRef} className="relative w-full h-full overflow-hidden border border-gray-200 rounded-md bg-white">
      <div className="absolute top-4 left-4 text-sm text-gray-600 bg-white bg-opacity-70 px-2 py-1 rounded-md">
        {instructionMessage}
      </div>
      
      <div className="absolute bottom-4 left-4 text-xs text-gray-500">
        Shortcuts: Copy (⌘/Ctrl+C) • Cut (⌘/Ctrl+X) • Paste (⌘/Ctrl+V) • Undo (⌘/Ctrl+Z) • Delete (Del/Backspace) • Cancel/Deselect (ESC) • Multiple Selection (Shift+Drag) • Zoom (Mouse Wheel) • Pan Canvas (Space+Drag or Middle Mouse Button)
      </div>
      
      <div className="absolute top-4 right-4 flex space-x-2">
        <button
          className="p-1 bg-white bg-opacity-70 rounded hover:bg-opacity-100 transition-colors"
          onClick={handleUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo size={16} />
        </button>
        <button
          className="p-1 bg-white bg-opacity-70 rounded hover:bg-opacity-100 transition-colors"
          onClick={() => {
            setZoom(Math.min(5, zoom * (1 + ZOOM_FACTOR)));
          }}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="p-1 bg-white bg-opacity-70 rounded hover:bg-opacity-100 transition-colors"
          onClick={() => {
            setZoom(Math.max(0.1, zoom * (1 - ZOOM_FACTOR)));
          }}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          className="p-1 bg-white bg-opacity-70 rounded hover:bg-opacity-100 transition-colors"
          onClick={() => {
            setZoom(1);
            setPanOffset({ x: 0, y: 0 });
          }}
          title="Reset Zoom"
        >
          100%
        </button>
      </div>
      
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`touch-none ${
          isSpacePressed || isCanvasDragging 
            ? 'cursor-grab' 
            : isMultiDragging || (selectedPointsIndices.length > 0 && !isDrawingMode) 
              ? 'cursor-move' 
              : isDrawingMode 
                ? 'cursor-crosshair' 
                : 'cursor-default'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
    </div>
  );
};

export default BezierCanvas;
