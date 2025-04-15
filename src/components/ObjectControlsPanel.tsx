
import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { 
  RotateCw, 
  Maximize, 
  Info,
  Image,
  X,
  ChevronRight
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { CurveStyle, CurveConfig, TransformSettings, BezierObject } from '@/types/bezier';
import ObjectsPanel from './ObjectsPanel';
import { ColorPicker } from '@/components/ui/color-picker';
import { cn } from '@/lib/utils';

interface ObjectControlsPanelProps {
  selectedObjects: BezierObject[];
  allObjects: BezierObject[];
  selectedObjectIds: string[];
  onCreateObject: () => void;
  onSelectObject: (objectId: string, multiSelect: boolean) => void;
  onDeleteObject: (objectId: string) => void;
  onRenameObject: (objectId: string, name: string) => void;
  onUpdateCurveConfig: (objectId: string, config: CurveConfig) => void;
  onUpdateTransform: (objectId: string, transform: TransformSettings) => void;
  backgroundImage?: string;
  backgroundOpacity: number;
  onBackgroundOpacityChange: (opacity: number) => void;
  onUploadImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}

const ObjectControlsPanel: React.FC<ObjectControlsPanelProps> = ({
  selectedObjects,
  allObjects,
  selectedObjectIds,
  onCreateObject,
  onSelectObject,
  onDeleteObject,
  onRenameObject,
  onUpdateCurveConfig,
  onUpdateTransform,
  backgroundImage,
  backgroundOpacity,
  onBackgroundOpacityChange,
  onUploadImage,
  onRemoveImage
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // If no objects are selected or multiple objects are selected, return a message
  const showGenericControls = selectedObjects.length !== 1;
  
  // Get the currently selected object (if only one is selected)
  const selectedObject = selectedObjects[0];
  
  const handleParallelCountChange = (objectId: string, value: string) => {
    const count = parseInt(value);
    if (!isNaN(count) && count >= 1 && count <= 4) {
      const object = selectedObjects.find(obj => obj.id === objectId);
      if (object) {
        onUpdateCurveConfig(objectId, {
          ...object.curveConfig,
          parallelCount: count
        });
      }
    }
  };
  
  const handleCurveColorChange = (objectId: string, color: string) => {
    const object = selectedObjects.find(obj => obj.id === objectId);
    if (object) {
      const newStyles = [...object.curveConfig.styles];
      newStyles[0] = { ...newStyles[0], color };
      
      onUpdateCurveConfig(objectId, {
        ...object.curveConfig,
        styles: newStyles
      });
    }
  };
  
  const handleCurveWidthChange = (objectId: string, width: number) => {
    const object = selectedObjects.find(obj => obj.id === objectId);
    if (object) {
      const newStyles = [...object.curveConfig.styles];
      newStyles[0] = { ...newStyles[0], width };
      
      onUpdateCurveConfig(objectId, {
        ...object.curveConfig,
        styles: newStyles
      });
    }
  };
  
  const handleParallelSpacingChange = (objectId: string, spacing: number) => {
    const object = selectedObjects.find(obj => obj.id === objectId);
    if (object) {
      onUpdateCurveConfig(objectId, {
        ...object.curveConfig,
        spacing
      });
    }
  };
  
  const handleParallelStyleChange = (objectId: string, index: number, style: CurveStyle) => {
    const object = selectedObjects.find(obj => obj.id === objectId);
    if (object) {
      const newStyles = [...object.curveConfig.styles];
      newStyles[index] = style;
      
      onUpdateCurveConfig(objectId, {
        ...object.curveConfig,
        styles: newStyles
      });
    }
  };
  
  const handleRotationChange = (objectId: string, rotation: number) => {
    const object = selectedObjects.find(obj => obj.id === objectId);
    if (object) {
      onUpdateTransform(objectId, {
        ...object.transform,
        rotation
      });
    }
  };
  
  const handleScaleXChange = (objectId: string, scaleX: number) => {
    const object = selectedObjects.find(obj => obj.id === objectId);
    if (object) {
      onUpdateTransform(objectId, {
        ...object.transform,
        scaleX
      });
    }
  };
  
  const handleScaleYChange = (objectId: string, scaleY: number) => {
    const object = selectedObjects.find(obj => obj.id === objectId);
    if (object) {
      onUpdateTransform(objectId, {
        ...object.transform,
        scaleY
      });
    }
  };
  
  const SectionHeader = ({ children, tooltip }: { children: React.ReactNode, tooltip?: string }) => (
    <div className="flex items-center mb-2">
      <h4 className="text-sm font-medium">{children}</h4>
      {tooltip && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 ml-1.5 text-gray-400" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="w-[200px] text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
  
  return (
    <Card className="p-4 overflow-y-auto max-h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Design Controls</h3>
      </div>

      <div className="space-y-4">
        {/* Objects Panel */}
        <ObjectsPanel 
          objects={allObjects}
          selectedObjectIds={selectedObjectIds}
          onCreateObject={onCreateObject}
          onSelectObject={onSelectObject}
          onDeleteObject={onDeleteObject}
          onRenameObject={onRenameObject}
          onDeleteSelectedObjects={() => {
            // Call onDeleteObject for each selected object
            selectedObjectIds.forEach(id => onDeleteObject(id));
          }}
        />
        
        {/* Controls for individual object or message */}
        {showGenericControls ? (
          <div className="text-center p-4 text-sm text-gray-500 border rounded-md">
            {selectedObjects.length === 0 
              ? "No object selected. Select an object to edit its properties."
              : "Multiple objects selected. Select a single object to edit its properties."}
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={['curve-properties']}>
            <AccordionItem value="curve-properties" className="border-b">
              <AccordionTrigger className="py-2 hover:no-underline">
                <span className="text-sm font-medium">Curve Properties</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-4">
                {/* Color & Width in single row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="curve-color" className="text-xs flex items-center">
                      Color
                    </Label>
                    <div className="flex items-center space-x-2">
                      <ColorPicker 
                        color={selectedObject.curveConfig.styles[0].color}
                        onChange={(color) => handleCurveColorChange(selectedObject.id, color)}
                      />
                      <span className="text-xs text-gray-500">
                        {selectedObject.curveConfig.styles[0].color}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="curve-width" className="text-xs">Width</Label>
                    <div className="flex items-center space-x-2">
                      <Slider
                        id="curve-width"
                        value={[selectedObject.curveConfig.styles[0].width]}
                        min={1}
                        max={20}
                        step={1}
                        onValueChange={(values) => handleCurveWidthChange(selectedObject.id, values[0])}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={selectedObject.curveConfig.styles[0].width}
                        onChange={(e) => handleCurveWidthChange(selectedObject.id, Number(e.target.value))}
                        min={1}
                        max={20}
                        className="w-14 h-7 text-sm"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Parallel Curves */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <SectionHeader tooltip="Configure parallel curves that follow the main curve path">
                    Parallel Curves
                  </SectionHeader>
                  
                  <div className="flex items-end space-x-4">
                    <div className="flex-1">
                      <Label htmlFor="parallel-count" className="text-xs mb-1 block">Number of Curves</Label>
                      <Select
                        value={selectedObject.curveConfig.parallelCount.toString()}
                        onValueChange={(value) => handleParallelCountChange(selectedObject.id, value)}
                      >
                        <SelectTrigger id="parallel-count" className="h-8 text-xs">
                          <SelectValue placeholder="Select count" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Single Curve</SelectItem>
                          <SelectItem value="2">Double Curve</SelectItem>
                          <SelectItem value="3">Triple Curve</SelectItem>
                          <SelectItem value="4">Quad Curve</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex-1">
                      <Label htmlFor="curve-spacing" className="text-xs mb-1 block">
                        Spacing: {selectedObject.curveConfig.spacing}px
                      </Label>
                      <Slider
                        id="curve-spacing"
                        value={[selectedObject.curveConfig.spacing]}
                        min={2}
                        max={50}
                        step={1}
                        onValueChange={(values) => handleParallelSpacingChange(selectedObject.id, values[0])}
                      />
                    </div>
                  </div>

                  {selectedObject.curveConfig.parallelCount > 1 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs text-gray-500">Individual Curve Styles</p>
                      
                      {Array.from({ length: Math.min(selectedObject.curveConfig.parallelCount, 4) }).map((_, i) => (
                        <div key={i} className={cn(
                          "p-2 border border-gray-100 rounded-md",
                          i === 0 ? "bg-gray-50" : ""
                        )}>
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="text-xs font-medium">Curve {i + 1}</h5>
                            {i === 0 && <span className="text-[10px] text-gray-500">(Main)</span>}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label htmlFor={`curve-${i}-color`} className="text-[10px]">Color</Label>
                              <div className="flex mt-1 items-center space-x-1">
                                <ColorPicker 
                                  color={selectedObject.curveConfig.styles[i]?.color || '#000000'}
                                  onChange={(color) => handleParallelStyleChange(selectedObject.id, i, {
                                    ...selectedObject.curveConfig.styles[i],
                                    color
                                  })}
                                  className="h-6 w-6"
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor={`curve-${i}-width`} className="text-[10px]">Width</Label>
                              <Input
                                id={`curve-${i}-width`}
                                type="number"
                                value={selectedObject.curveConfig.styles[i]?.width || 1}
                                onChange={(e) => handleParallelStyleChange(selectedObject.id, i, {
                                  ...selectedObject.curveConfig.styles[i],
                                  width: Number(e.target.value)
                                })}
                                min={1}
                                max={20}
                                className="h-7 mt-1 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="transform" className="border-b">
              <AccordionTrigger className="py-2 hover:no-underline">
                <span className="text-sm font-medium">Transform</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <Label htmlFor="rotation" className="text-xs">Rotation</Label>
                    <span className="text-xs text-gray-500">{selectedObject.transform.rotation.toFixed(1)}°</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RotateCw className="h-3.5 w-3.5 text-gray-400" />
                    <Slider
                      id="rotation"
                      value={[selectedObject.transform.rotation]}
                      min={-180}
                      max={180}
                      step={1}
                      onValueChange={(values) => handleRotationChange(selectedObject.id, values[0])}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label htmlFor="scale-x" className="text-xs">Scale X</Label>
                      <span className="text-xs text-gray-500">{selectedObject.transform.scaleX.toFixed(1)}x</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Maximize className="h-3.5 w-3.5 text-gray-400" />
                      <Slider
                        id="scale-x"
                        value={[selectedObject.transform.scaleX * 10]}
                        min={5}
                        max={20}
                        step={1}
                        onValueChange={(values) => handleScaleXChange(selectedObject.id, values[0] / 10)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <Label htmlFor="scale-y" className="text-xs">Scale Y</Label>
                      <span className="text-xs text-gray-500">{selectedObject.transform.scaleY.toFixed(1)}x</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Maximize className="h-3.5 w-3.5 text-gray-400 rotate-90" />
                      <Slider
                        id="scale-y"
                        value={[selectedObject.transform.scaleY * 10]}
                        min={5}
                        max={20}
                        step={1}
                        onValueChange={(values) => handleScaleYChange(selectedObject.id, values[0] / 10)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
        
        {/* Background Controls - This is global so it's always shown */}
        <Accordion type="multiple" defaultValue={[]}>
          <AccordionItem value="background" className="border-b">
            <AccordionTrigger className="py-2 hover:no-underline">
              <span className="text-sm font-medium">Background Image</span>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    <Image className="h-3.5 w-3.5 mr-1" />
                    {backgroundImage ? 'Change Image' : 'Upload Image'}
                  </button>
                  
                  {backgroundImage && (
                    <button
                      type="button"
                      onClick={onRemoveImage}
                      className="flex items-center text-xs px-2 py-1 text-red-500 hover:text-red-700"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Remove
                    </button>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onUploadImage}
                    className="hidden"
                  />
                </div>
                
                {backgroundImage && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label htmlFor="bg-opacity" className="text-xs">Opacity</Label>
                      <span className="text-xs text-gray-500">{Math.round(backgroundOpacity * 100)}%</span>
                    </div>
                    <Slider
                      id="bg-opacity"
                      value={[backgroundOpacity * 100]}
                      min={10}
                      max={100}
                      step={5}
                      onValueChange={(values) => onBackgroundOpacityChange(values[0] / 100)}
                      className="flex-1"
                    />
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </Card>
  );
};

export default ObjectControlsPanel;
