import React, { useState, useEffect, useRef } from 'react';
import { BezierObject, ControlPoint, Point, TransformSettings, SelectionRect } from '@/types/bezier';
import { transformControlPoints, isPointInSelectionRect } from '@/utils/bezierUtils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

// This component contains fixes for transform functionality issues

// 1. Fix for transform control points to properly follow the path shape
export const applyTransformToPoints = (object: BezierObject): ControlPoint[] => {
  const { points, transform } = object;
  
  // Calculate center point for transformation
  let centerX = 0, centerY = 0;
  
  // Calculate bounding box to find the true center
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  // Find min and max coordinates to determine bounding box
  points.forEach(point => {
    // Check main point
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
    
    // Check handle points too
    minX = Math.min(minX, point.handleIn.x, point.handleOut.x);
    minY = Math.min(minY, point.handleIn.y, point.handleOut.y);
    maxX = Math.max(maxX, point.handleIn.x, point.handleOut.x);
    maxY = Math.max(maxY, point.handleIn.y, point.handleOut.y);
  });
  
  // Calculate center of bounding box
  centerX = (minX + maxX) / 2;
  centerY = (minY + maxY) / 2;
  
  // Apply transformations to all points including handles
  return transformControlPoints(
    points,
    centerX,
    centerY,
    transform.rotation,
    transform.scaleX,
    transform.scaleY
  );
};

// 2. Enhanced selection rectangle that connects with transform properties
export interface TransformSelectionProps {
  objects: BezierObject[];
  selectedObjectIds: string[];
  onUpdateTransform: (objectId: string, transform: TransformSettings) => void;
  onObjectSelect: (objectId: string, multiSelect: boolean) => void;
  selectionRect: SelectionRect | null;
}

export const TransformSelection: React.FC<TransformSelectionProps> = ({
  objects,
  selectedObjectIds,
  onUpdateTransform,
  onObjectSelect,
  selectionRect
}) => {
  const [selectedTransform, setSelectedTransform] = useState<TransformSettings>({
    rotation: 0,
    scaleX: 1,
    scaleY: 1
  });

  // Update transform values when selection changes
  useEffect(() => {
    if (selectedObjectIds.length === 1) {
      const selectedObject = objects.find(obj => obj.id === selectedObjectIds[0]);
      if (selectedObject) {
        setSelectedTransform(selectedObject.transform);
      }
    } else if (selectedObjectIds.length > 1) {
      // For multiple selection, use average values
      const selectedObjects = objects.filter(obj => selectedObjectIds.includes(obj.id));
      const avgRotation = selectedObjects.reduce((sum, obj) => sum + obj.transform.rotation, 0) / selectedObjects.length;
      const avgScaleX = selectedObjects.reduce((sum, obj) => sum + obj.transform.scaleX, 0) / selectedObjects.length;
      const avgScaleY = selectedObjects.reduce((sum, obj) => sum + obj.transform.scaleY, 0) / selectedObjects.length;
      
      setSelectedTransform({
        rotation: avgRotation,
        scaleX: avgScaleX,
        scaleY: avgScaleY
      });
    }
  }, [selectedObjectIds, objects]);

  // Apply transform to all selected objects
  const applyTransformToSelection = (transform: TransformSettings) => {
    selectedObjectIds.forEach(id => {
      onUpdateTransform(id, transform);
    });
  };

  // Handle transform changes
  const handleRotationChange = (rotation: number) => {
    const newTransform = { ...selectedTransform, rotation };
    setSelectedTransform(newTransform);
    applyTransformToSelection(newTransform);
  };

  const handleScaleXChange = (scaleX: number) => {
    const newTransform = { ...selectedTransform, scaleX };
    setSelectedTransform(newTransform);
    applyTransformToSelection(newTransform);
  };

  const handleScaleYChange = (scaleY: number) => {
    const newTransform = { ...selectedTransform, scaleY };
    setSelectedTransform(newTransform);
    applyTransformToSelection(newTransform);
  };

  // If no objects are selected or no selection rectangle, don't render controls
  if (selectedObjectIds.length === 0) {
    return null;
  }

  // Render selection rectangle if it exists
  const renderSelectionRect = () => {
    if (!selectionRect || selectionRect.width === 0 || selectionRect.height === 0) {
      return null;
    }

    return (
      <div 
        className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-20 pointer-events-none"
        style={{
          left: `${selectionRect.startX}px`,
          top: `${selectionRect.startY}px`,
          width: `${Math.abs(selectionRect.width)}px`,
          height: `${Math.abs(selectionRect.height)}px`,
          transform: selectionRect.width < 0 ? 'translateX(-100%)' : '',
          zIndex: 5
        }}
      >
        {/* Control handles for the selection rectangle */}
        <div className="absolute w-2 h-2 bg-blue-500 border border-white -top-1 -left-1" />
        <div className="absolute w-2 h-2 bg-blue-500 border border-white -top-1 -right-1" />
        <div className="absolute w-2 h-2 bg-blue-500 border border-white -bottom-1 -left-1" />
        <div className="absolute w-2 h-2 bg-blue-500 border border-white -bottom-1 -right-1" />
      </div>
    );
  };

  return (
    <>
      {renderSelectionRect()}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-lg shadow-md z-10 flex gap-4">
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Rotation: {selectedTransform.rotation.toFixed(1)}°</Label>
          <Slider
            value={[selectedTransform.rotation]}
            min={-180}
            max={180}
            step={1}
            onValueChange={(values) => handleRotationChange(values[0])}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Scale X: {selectedTransform.scaleX.toFixed(2)}x</Label>
          <Slider
            value={[selectedTransform.scaleX * 10]}
            min={1}
            max={30}
            step={1}
            onValueChange={(values) => handleScaleXChange(values[0] / 10)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Scale Y: {selectedTransform.scaleY.toFixed(2)}x</Label>
          <Slider
            value={[selectedTransform.scaleY * 10]}
            min={1}
            max={30}
            step={1}
            onValueChange={(values) => handleScaleYChange(values[0] / 10)}
          />
        </div>
      </div>
    </>
  );
};

// Rectangular Selection Tool Component
export interface RectangularSelectionToolProps {
  selectionRect: SelectionRect | null;
  onSelectionComplete: (selectedIds: string[]) => void;
  objects: BezierObject[];
}

export const RectangularSelectionTool: React.FC<RectangularSelectionToolProps> = ({
  selectionRect,
  onSelectionComplete,
  objects
}) => {
  // When selection is complete, find objects within the selection rectangle
  useEffect(() => {
    if (selectionRect && selectionRect.width !== 0 && selectionRect.height !== 0) {
      const selectedIds = objects
        .filter(obj => obj.points.some(point => isPointInSelectionRect(point, selectionRect)))
        .map(obj => obj.id);
      
      if (selectedIds.length > 0) {
        onSelectionComplete(selectedIds);
      }
    }
  }, [selectionRect, objects, onSelectionComplete]);

  if (!selectionRect || selectionRect.width === 0 || selectionRect.height === 0) {
    return null;
  }

  // Normalize the selection rectangle (handle negative width/height)
  const normalizedRect = {
    x: selectionRect.width < 0 ? selectionRect.startX + selectionRect.width : selectionRect.startX,
    y: selectionRect.height < 0 ? selectionRect.startY + selectionRect.height : selectionRect.startY,
    width: Math.abs(selectionRect.width),
    height: Math.abs(selectionRect.height)
  };

  return (
    <div 
      className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-20 pointer-events-none"
      style={{
        left: `${normalizedRect.x}px`,
        top: `${normalizedRect.y}px`,
        width: `${normalizedRect.width}px`,
        height: `${normalizedRect.height}px`,
        zIndex: 5
      }}
    >
      {/* Control handles for the selection rectangle */}
      <div className="absolute w-2 h-2 bg-blue-500 border border-white -top-1 -left-1" />
      <div className="absolute w-2 h-2 bg-blue-500 border border-white -top-1 -right-1" />
      <div className="absolute w-2 h-2 bg-blue-500 border border-white -bottom-1 -left-1" />
      <div className="absolute w-2 h-2 bg-blue-500 border border-white -bottom-1 -right-1" />
    </div>
  );
};

// 3. Background image resizing component
// This interface has been moved above the component implementation

export interface BackgroundImageControlsProps {
  backgroundImage?: string;
  backgroundOpacity: number;
  onBackgroundOpacityChange: (opacity: number) => void;
  onUploadImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onSaveToGallery?: (backgroundImage: string) => Promise<void>;
}

export const BackgroundImageControls: React.FC<BackgroundImageControlsProps> = ({
  backgroundImage,
  backgroundOpacity,
  onBackgroundOpacityChange,
  onUploadImage,
  onRemoveImage,
  onSaveToGallery
}) => {
  const [imageScale, setImageScale] = useState<number>(50); // Default to 50%
  const [localOpacity, setLocalOpacity] = useState<number>(backgroundOpacity * 100);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const opacityDebounceRef = useRef<NodeJS.Timeout>();
  const scaleDebounceRef = useRef<NodeJS.Timeout>();

  // Sync local opacity state with prop
  useEffect(() => {
    setLocalOpacity(backgroundOpacity * 100);
  }, [backgroundOpacity]);

  // Apply scale to background image
  useEffect(() => {
    if (backgroundImage) {
      // Find the background image element and apply scale
      const img = new Image();
      img.onload = () => {
        // Store original dimensions in data attributes for scaling
        document.documentElement.style.setProperty('--bg-image-scale', `${imageScale / 100}`);
      };
      img.src = backgroundImage;
    }
  }, [backgroundImage, imageScale]);

  // Handle opacity change with real-time updates
  const handleOpacityChange = (values: number[]) => {
    const newOpacity = values[0];
    setLocalOpacity(newOpacity);
    
    // Update immediately for real-time feedback
    onBackgroundOpacityChange(newOpacity / 100);
    
    // Clear any existing timeout
    if (opacityDebounceRef.current) {
      clearTimeout(opacityDebounceRef.current);
    }
    
    // Set a new timeout to avoid too many updates
    opacityDebounceRef.current = setTimeout(() => {
      onBackgroundOpacityChange(newOpacity / 100);
    }, 50);
  };

  // Handle scale change with real-time updates
  const handleScaleChange = (values: number[]) => {
    const newScale = values[0];
    setImageScale(newScale);
    
    // Update immediately for real-time feedback
    document.documentElement.style.setProperty('--bg-image-scale', `${newScale / 100}`);
    
    // Clear any existing timeout
    if (scaleDebounceRef.current) {
      clearTimeout(scaleDebounceRef.current);
    }
    
    // Set a new timeout to avoid too many updates
    scaleDebounceRef.current = setTimeout(() => {
      document.documentElement.style.setProperty('--bg-image-scale', `${newScale / 100}`);
    }, 50);
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSaveToGallery = async () => {
    if (!backgroundImage || !onSaveToGallery) return;
    
    try {
      setIsSaving(true);
      await onSaveToGallery(backgroundImage);
      toast({
        title: "Success",
        description: "Background image saved to Paper (JPG) category"
      });
    } catch (error) {
      console.error("Error saving to gallery:", error);
      toast({
        title: "Error",
        description: "Failed to save background image to gallery",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 border rounded-md">
      <div className="flex flex-col gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleUploadClick}
          className="w-full"
        >
          {backgroundImage ? 'Change Image' : 'Upload Image'}
        </Button>
        
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          accept="image/*" 
          onChange={onUploadImage}
        />
        
        {backgroundImage && (
          <>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Opacity</Label>
              <span className="text-xs text-gray-500">{Math.round(backgroundOpacity * 100)}%</span>
            </div>
            <Slider
              value={[localOpacity]}
              min={0}
              max={100}
              step={1}
              onValueChange={handleOpacityChange}
            />
            
            <div className="flex items-center justify-between">
              <Label className="text-xs">Size</Label>
              <span className="text-xs text-gray-500">{imageScale}%</span>
            </div>
            <Slider
              value={[imageScale]}
              min={10}
              max={200}
              step={5}
              onValueChange={handleScaleChange}
            />
            
            <div className="flex gap-2 mt-2">
              <Button 
                variant="destructive" 
                size="sm"
                onClick={onRemoveImage}
                className="flex-1"
              >
                Remove
              </Button>
              
              {onSaveToGallery && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSaveToGallery}
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? 'Saving...' : 'Save to Gallery'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// 4. Function to save background image to Paper(JPG) category
export const saveBackgroundImageToGallery = async (
  backgroundImage: string | undefined,
  saveDesign: (name: string, category: string, data: string, svgContent?: string) => Promise<any>
) => {
  if (!backgroundImage) {
    toast({
      title: "No Background Image",
      description: "There is no background image to save",
    });
    return;
  }

  try {
    // Generate a name based on date with a more readable format
    const date = new Date();
    const formattedDate = date.toISOString().split('T')[0];
    const formattedTime = `${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
    const name = `Background_${formattedDate}_${formattedTime}`;
    
    // Create design data object
    const designData = {
      objects: [], // Empty array since this is just a background
      backgroundImage: {
        url: backgroundImage,
        opacity: 1 // Default opacity
      }
    };
    
    // Convert to JSON string as expected by SavedDesign type
    const jsonData = JSON.stringify(designData);
    
    // Create a minimal SVG content with the background image
    // This is crucial as Supabase requires svg_content to be populated
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <rect width="800" height="600" fill="white"/>
      <image href="${backgroundImage}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"/>
    </svg>`;
    
    // Save to Paper (JPG) category - passing both the JSON data and SVG content
    const result = await saveDesign(name, "Paper(JPG)", jsonData, svgContent);
    
    if (result && result.error) {
      throw new Error(result.error.message);
    }
    
    toast({
      title: "Background Saved",
      description: `Background image saved to Paper (JPG) category as "${name}"`
    });
    
    return result;
  } catch (error) {
    console.error("Error saving background image:", error);
    toast({
      title: "Save Failed",
      description: "Failed to save background image to gallery",
      variant: "destructive"
    });
  }
};

// 5. Function to apply transform to group of objects
export const applyTransformToGroup = (objects, selectedIds, transform) => {
  // Calculate the center of the group
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  // Find the bounding box of all selected objects
  selectedIds.forEach(id => {
    const object = objects.find(obj => obj.id === id);
    if (!object) return;
    
    object.points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
      
      // Include handles in bounding box calculation
      minX = Math.min(minX, point.handleIn.x, point.handleOut.x);
      minY = Math.min(minY, point.handleIn.y, point.handleOut.y);
      maxX = Math.max(maxX, point.handleIn.x, point.handleOut.x);
      maxY = Math.max(maxY, point.handleIn.y, point.handleOut.y);
    });
  });
  
  // Calculate center of the group
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  // Apply transform to each object in the group
  return objects.map(obj => {
    if (!selectedIds.includes(obj.id)) return obj;
    
    // Apply the transform to this object
    return {
      ...obj,
      transform: transform
    };
  });
};
