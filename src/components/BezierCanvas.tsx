import React, { useState, useEffect, useRef } from 'react';
import { ControlPoint, BezierObject, SelectionRect, SelectionTool, TransformSettings } from '@/types/bezier';
import { generateId } from '@/utils/bezierUtils';
import { BackgroundImageControls, saveBackgroundImageToGallery } from './TransformFixes';

interface BezierCanvasProps {
  width: number;
  height: number;
  objects: BezierObject[];
  selectedObjectIds: string[];
  onObjectSelect: (objectId: string, multiSelect?: boolean) => void;
  onObjectsChange: (objects: BezierObject[]) => void;
  onCreateObject: (points: ControlPoint[]) => string;
  onSaveState: () => void;
  onUndo: () => void;
  backgroundImage?: string;
  backgroundOpacity: number;
  isDrawingMode: boolean;
  onUpdateTransform: (objectId: string, transform: TransformSettings) => void;
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
  isDrawingMode,
  onUpdateTransform
}) => {
  // State variables
  const [currentPoints, setCurrentPoints] = useState<ControlPoint[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragPointIndex, setDragPointIndex] = useState<number>(-1);
  const [dragObjectId, setDragObjectId] = useState<string>('');
  const [dragHandleType, setDragHandleType] = useState<'main' | 'handleIn' | 'handleOut'>('main');
  const [showControls, setShowControls] = useState<boolean>(true);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [selectionTool, setSelectionTool] = useState<SelectionTool>('none');
  const [showBackgroundControls, setShowBackgroundControls] = useState<boolean>(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastMousePosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Handle mouse down event
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lastMousePosition.current = { x, y };
    
    if (isDrawingMode) {
      // Start drawing a new curve
      const newPoint: ControlPoint = {
        id: generateId(),
        x,
        y,
        handleIn: { x: x - 50, y },
        handleOut: { x: x + 50, y },
      };
      setCurrentPoints([newPoint]);
    } else if (selectionTool === 'rectangle') {
      // Start drawing selection rectangle
      setSelectionRect({
        startX: x,
        startY: y,
        width: 0,
        height: 0
      });
    } else {
      // Check if we clicked on an existing point or handle
      for (const object of objects) {
        for (let i = 0; i < object.points.length; i++) {
          const point = object.points[i];
          
          // Check if we clicked on the main point
          const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
          if (distance < 10) {
            setIsDragging(true);
            setDragPointIndex(i);
            setDragObjectId(object.id);
            setDragHandleType('main');
            return;
          }
          
          // Check if we clicked on the handleIn
          const distanceHandleIn = Math.sqrt((x - point.handleIn.x) ** 2 + (y - point.handleIn.y) ** 2);
          if (distanceHandleIn < 10) {
            setIsDragging(true);
            setDragPointIndex(i);
            setDragObjectId(object.id);
            setDragHandleType('handleIn');
            return;
          }
          
          // Check if we clicked on the handleOut
          const distanceHandleOut = Math.sqrt((x - point.handleOut.x) ** 2 + (y - point.handleOut.y) ** 2);
          if (distanceHandleOut < 10) {
            setIsDragging(true);
            setDragPointIndex(i);
            setDragObjectId(object.id);
            setDragHandleType('handleOut');
            return;
          }
        }
      }
      
      // If no point or handle was clicked, start object selection
      setSelectionTool('rectangle');
      setSelectionRect({
        startX: x,
        startY: y,
        width: 0,
        height: 0
      });
    }
  };
  
  // Handle mouse move event
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lastMousePosition.current = { x, y };
    
    if (isDrawingMode && currentPoints.length > 0) {
      // Update the last point's handleOut
      const updatedPoints = [...currentPoints];
      const lastPoint = updatedPoints[updatedPoints.length - 1];
      lastPoint.handleOut = { x, y };
      setCurrentPoints(updatedPoints);
    } else if (isDragging) {
      // Update the position of the dragged point or handle
      const updatedObjects = objects.map(object => {
        if (object.id === dragObjectId) {
          const updatedPoints = [...object.points];
          const point = updatedPoints[dragPointIndex];
          
          if (dragHandleType === 'main') {
            point.x = x;
            point.y = y;
          } else if (dragHandleType === 'handleIn') {
            point.handleIn = { x, y };
          } else if (dragHandleType === 'handleOut') {
            point.handleOut = { x, y };
          }
          
          return { ...object, points: updatedPoints };
        }
        return object;
      });
      onObjectsChange(updatedObjects);
    } else if (selectionTool === 'rectangle' && selectionRect) {
      // Update selection rectangle dimensions
      setSelectionRect(prevRect => ({
        ...prevRect!,
        width: x - prevRect!.startX,
        height: y - prevRect!.startY
      }));
    }
  };
  
  // Handle mouse up event
  const handleMouseUp = () => {
    if (isDrawingMode && currentPoints.length > 0) {
      // Finish drawing the curve
      const newPoint: ControlPoint = {
        id: generateId(),
        x: lastMousePosition.current.x,
        y: lastMousePosition.current.y,
        handleIn: { x: lastMousePosition.current.x - 50, y: lastMousePosition.current.y },
        handleOut: { x: lastMousePosition.current.x + 50, y: lastMousePosition.current.y },
      };
      const allPoints = [...currentPoints, newPoint];
      onCreateObject(allPoints);
      setCurrentPoints([]);
    } else if (isDragging) {
      // Stop dragging
      setIsDragging(false);
      setDragPointIndex(-1);
      setDragObjectId('');
      setDragHandleType('main');
      onSaveState();
    } else if (selectionTool === 'rectangle' && selectionRect) {
      // Finish selection
      setSelectionTool('none');
      
      // Determine selected objects based on selection rectangle
      if (selectionRect.width === 0 && selectionRect.height === 0) {
        onObjectSelect('');
      } else {
        // Determine selected objects based on selection rectangle
        onObjectSelect('');
      }
      setSelectionRect(null);
    }
  };
  
  // Render a single Bezier curve
  const renderCurve = (points: ControlPoint[], objectId: string) => {
    if (points.length < 2) return null;
    
    let pathData = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const startPoint = points[i];
      const endPoint = points[i + 1];
      pathData += ` C ${startPoint.handleOut.x} ${startPoint.handleOut.y}, ${endPoint.handleIn.x} ${endPoint.handleIn.y}, ${endPoint.x} ${endPoint.y}`;
    }
    
    const isSelected = selectedObjectIds.includes(objectId);
    
    return (
      <path
        key={objectId}
        d={pathData}
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth="2"
        fill="transparent"
      />
    );
  };
  
  // Render control points and handles
  const renderControlPoints = (points: ControlPoint[], objectId: string) => {
    const isSelected = selectedObjectIds.includes(objectId);
    
    return points.map((point, index) => (
      <React.Fragment key={point.id}>
        {/* Main point */}
        <circle
          cx={point.x}
          cy={point.y}
          r="5"
          fill={isSelected ? 'blue' : 'gray'}
          className="cursor-pointer"
        />
        
        {/* Handle In */}
        <line
          x1={point.x}
          y1={point.y}
          x2={point.handleIn.x}
          y2={point.handleIn.y}
          stroke="gray"
          strokeWidth="1"
        />
        <circle
          cx={point.handleIn.x}
          cy={point.handleIn.y}
          r="4"
          fill="lightgray"
          className="cursor-pointer"
        />
        
        {/* Handle Out */}
        <line
          x1={point.x}
          y1={point.y}
          x2={point.handleOut.x}
          y2={point.handleOut.y}
          stroke="gray"
          strokeWidth="1"
        />
        <circle
          cx={point.handleOut.x}
          cy={point.handleOut.y}
          r="4"
          fill="lightgray"
          className="cursor-pointer"
        />
      </React.Fragment>
    ));
  };

  // Handle background opacity change
  const handleBackgroundOpacityChange = (opacity: number) => {
    // This is a prop function passed down from parent
    // The actual state is managed in the parent component
  };
  
  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    // This is a prop function passed down from parent
    // The actual state is managed in the parent component
  };
  
  // Handle removing background
  const handleRemoveBackground = () => {
    // This is a prop function passed down from parent
    // The actual state is managed in the parent component
  };

  return (
    <div className="relative">
      <div
        ref={canvasRef}
        className="relative border border-gray-300 bg-white overflow-hidden"
        style={{ width: `${width}px`, height: `${height}px` }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Background image */}
        {backgroundImage && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              backgroundPosition: 'center',
              backgroundSize: `calc(100% * var(--bg-image-scale, 1))`,
              backgroundRepeat: 'no-repeat',
              opacity: backgroundOpacity,
            }}
          />
        )}
        
        {/* Render curves for all objects */}
        <svg width={width} height={height} className="pointer-events-none">
          {objects.map(object => (
            <g key={object.id}>
              {renderCurve(object.points, object.id)}
              {showControls && renderControlPoints(object.points, object.id)}
            </g>
          ))}
        </svg>
      </div>
      
      {/* Control panel toggle */}
      <button
        className="absolute left-4 top-4 bg-white rounded-full p-2 shadow-md"
        onClick={() => setShowControls(!showControls)}
        title="Toggle control points"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      </button>
      
      {/* Background controls toggle */}
      <button
        className="absolute right-4 top-16 bg-white rounded-full p-2 shadow-md"
        onClick={() => setShowBackgroundControls(!showBackgroundControls)}
        title="Toggle background controls"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </button>
      
      {/* Background image controls */}
      {showBackgroundControls && (
        <div className="absolute right-4 top-24 z-10">
          <BackgroundImageControls
            backgroundImage={backgroundImage}
            backgroundOpacity={backgroundOpacity}
            onBackgroundOpacityChange={handleBackgroundOpacityChange}
            onUploadImage={handleImageUpload}
            onRemoveImage={handleRemoveBackground}
            onSaveToGallery={(image) => saveBackgroundImageToGallery(
              image, 
              (window as any).saveDesignToLibrary
            )}
          />
        </div>
      )}
      
      {/* Selection rectangle */}
      {selectionRect && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-20 pointer-events-none"
          style={{
            left: `${selectionRect.startX}px`,
            top: `${selectionRect.startY}px`,
            width: `${selectionRect.width}px`,
            height: `${selectionRect.height}px`,
          }}
        />
      )}
    </div>
  );
};

export default BezierCanvas;
