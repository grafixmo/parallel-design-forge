
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
  RefreshCw, 
  RotateCw, 
  Maximize, 
  Info
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
import { CurveStyle, CurveConfig, TransformSettings, BezierObject } from '@/types/bezier';
import ObjectsPanel from './ObjectsPanel';

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

const predefinedColors = [
  '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
  '#ff8000', '#8000ff', '#00ff80', '#ff0080', '#0080ff'
];

const ColorButton: React.FC<{
  color: string;
  selected: boolean;
  onClick: () => void;
}> = ({ color, selected, onClick }) => (
  <button
    type="button"
    className={`w-8 h-8 rounded-md transition-all ${
      selected ? 'ring-2 ring-blue-500 transform scale-110' : ''
    }`}
    style={{ backgroundColor: color }}
    onClick={onClick}
  />
);

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
        />
        
        {/* Controls for individual object or message */}
        {showGenericControls ? (
          <div className="text-center p-4 text-sm text-gray-500 border rounded-md">
            {selectedObjects.length === 0 
              ? "No object selected. Select an object to edit its properties."
              : "Multiple objects selected. Select a single object to edit its properties."}
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={['curve-color', 'curve-width', 'parallel-curves']}>
            <AccordionItem value="curve-color">
              <AccordionTrigger className="py-2">
                <div className="flex items-center">
                  <span>Curve Color</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 ml-2 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-[200px] text-xs">Select the color for the main curve</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {predefinedColors.map((color) => (
                    <ColorButton
                      key={color}
                      color={color}
                      selected={selectedObject.curveConfig.styles[0].color === color}
                      onClick={() => handleCurveColorChange(selectedObject.id, color)}
                    />
                  ))}
                </div>
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-10 h-10 rounded-md" 
                    style={{ backgroundColor: selectedObject.curveConfig.styles[0].color }}
                  ></div>
                  <input
                    type="color"
                    value={selectedObject.curveConfig.styles[0].color}
                    onChange={(e) => handleCurveColorChange(selectedObject.id, e.target.value)}
                    className="w-full h-8"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="curve-width">
              <AccordionTrigger className="py-2">
                <div className="flex items-center">
                  <span>Curve Width</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 ml-2 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-[200px] text-xs">Adjust the thickness of the main curve</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="flex items-center space-x-4">
                  <Slider
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
                    className="w-16"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="parallel-curves">
              <AccordionTrigger className="py-2">
                <div className="flex items-center">
                  <span>Parallel Curves</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 ml-2 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-[200px] text-xs">Configure parallel curves that follow the main curve path</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="parallel-count">Number of Curves</Label>
                      <Select
                        value={selectedObject.curveConfig.parallelCount.toString()}
                        onValueChange={(value) => handleParallelCountChange(selectedObject.id, value)}
                      >
                        <SelectTrigger id="parallel-count">
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
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <Label htmlFor="curve-spacing">Curve Spacing</Label>
                      <span className="text-sm text-gray-500">{selectedObject.curveConfig.spacing}px</span>
                    </div>
                    <Slider
                      id="curve-spacing"
                      value={[selectedObject.curveConfig.spacing]}
                      min={2}
                      max={50}
                      step={1}
                      onValueChange={(values) => handleParallelSpacingChange(selectedObject.id, values[0])}
                    />
                  </div>

                  {selectedObject.curveConfig.parallelCount > 0 && (
                    <div className="space-y-4 pt-2 border-t border-gray-100">
                      <h4 className="text-sm font-medium">Individual Curve Styles</h4>
                      
                      {Array.from({ length: Math.min(selectedObject.curveConfig.parallelCount, 4) }).map((_, i) => (
                        <div key={i} className="p-2 border border-gray-100 rounded-md">
                          <h5 className="text-sm font-medium mb-2">Curve {i + 1}</h5>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                              <Label htmlFor={`curve-${i}-color`} className="text-xs">Color</Label>
                              <div className="flex mt-1">
                                <div
                                  className="w-8 h-8 rounded-l-md border border-r-0"
                                  style={{ backgroundColor: selectedObject.curveConfig.styles[i]?.color || '#000000' }}
                                ></div>
                                <input
                                  id={`curve-${i}-color`}
                                  type="color"
                                  value={selectedObject.curveConfig.styles[i]?.color || '#000000'}
                                  onChange={(e) => handleParallelStyleChange(selectedObject.id, i, {
                                    ...selectedObject.curveConfig.styles[i],
                                    color: e.target.value
                                  })}
                                  className="rounded-r-md border h-8"
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor={`curve-${i}-width`} className="text-xs">Width</Label>
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
                                className="h-8 mt-1"
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

            <AccordionItem value="transform">
              <AccordionTrigger className="py-2">
                <div className="flex items-center">
                  <span>Transform</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 ml-2 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-[200px] text-xs">Apply rotation and scaling to the entire curve</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label htmlFor="rotation">Rotation</Label>
                      <span className="text-sm text-gray-500">{selectedObject.transform.rotation.toFixed(1)}°</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RotateCw className="h-4 w-4 text-gray-400" />
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

                  <div>
                    <div className="flex justify-between mb-2">
                      <Label htmlFor="scale-x">Scale X</Label>
                      <span className="text-sm text-gray-500">{selectedObject.transform.scaleX.toFixed(1)}x</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Maximize className="h-4 w-4 text-gray-400" />
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
                    <div className="flex justify-between mb-2">
                      <Label htmlFor="scale-y">Scale Y</Label>
                      <span className="text-sm text-gray-500">{selectedObject.transform.scaleY.toFixed(1)}x</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Maximize className="h-4 w-4 text-gray-400 rotate-90" />
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
          <AccordionItem value="background">
            <AccordionTrigger className="py-2">
              <div className="flex items-center">
                <span>Background Image</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 ml-2 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-[200px] text-xs">Add a reference image to trace over</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    <span className="mr-1">📷</span>
                    {backgroundImage ? 'Change Image' : 'Upload Image'}
                  </button>
                  
                  {backgroundImage && (
                    <button
                      type="button"
                      onClick={onRemoveImage}
                      className="flex items-center text-sm px-2 py-1 text-red-500 hover:text-red-700"
                    >
                      <span className="mr-1">❌</span>
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
                    <div className="flex justify-between mb-2">
                      <Label htmlFor="bg-opacity">Opacity</Label>
                      <span className="text-sm text-gray-500">{Math.round(backgroundOpacity * 100)}%</span>
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
