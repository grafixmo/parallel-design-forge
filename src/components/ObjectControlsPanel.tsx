import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BezierObject, CurveStyle, TransformSettings, BackgroundImage } from '@/types/bezier';
import { SketchPicker } from 'react-color';
import { generateId } from '@/utils/bezierUtils';
import { Trash2, Pencil, Plus, RotateCcw, RotateCw, Scale, Text } from 'lucide-react';
import { BackgroundImageControls } from './BackgroundImageControls';
import { ColorPicker } from '@/components/ui/color-picker'; // Replace SketchPicker with our custom ColorPicker

interface ObjectControlsPanelProps {
  selectedObjects: BezierObject[];
  allObjects: BezierObject[];
  selectedObjectIds: string[];
  onCreateObject: () => void;
  onSelectObject: (objectId: string, multiSelect?: boolean) => void;
  onDeleteObject: (objectId: string) => void;
  onRenameObject: (objectId: string, newName: string) => void;
  onUpdateCurveConfig: (objectId: string, newConfig: Partial<CurveStyle>) => void;
  onUpdateTransform: (objectId: string, newTransform: Partial<TransformSettings>) => void;
  backgroundImage?: string;
  backgroundOpacity: number;
  onBackgroundOpacityChange: (opacity: number) => void;
  onUploadImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onSelectImage?: (image: BackgroundImage) => void;
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
  onRemoveImage,
  onSelectImage
}) => {
  const handleColorChange = (color: string) => {
    if (selectedObjects.length > 0) {
      selectedObjects.forEach(obj => {
        onUpdateCurveConfig(obj.id, { color });
      });
    }
  };

  const handleWidthChange = (width: number) => {
    if (selectedObjects.length > 0) {
      selectedObjects.forEach(obj => {
        onUpdateCurveConfig(obj.id, { width });
      });
    }
  };

  const handleRotationChange = (rotation: number) => {
    if (selectedObjects.length > 0) {
      selectedObjects.forEach(obj => {
        onUpdateTransform(obj.id, { rotation });
      });
    }
  };

  const handleScaleXChange = (scaleX: number) => {
    if (selectedObjects.length > 0) {
      selectedObjects.forEach(obj => {
        onUpdateTransform(obj.id, { scaleX });
      });
    }
  };

  const handleScaleYChange = (scaleY: number) => {
    if (selectedObjects.length > 0) {
      selectedObjects.forEach(obj => {
        onUpdateTransform(obj.id, { scaleY });
      });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium">Objects</h3>
        <div className="mt-2 space-y-1">
          {allObjects.map((obj) => (
            <div
              key={obj.id}
              className={`flex items-center justify-between px-3 py-1.5 rounded-md text-sm cursor-pointer hover:bg-gray-100 ${selectedObjectIds.includes(obj.id) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
            >
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onSelectObject(obj.id, true)}
                  className="flex-1 text-left focus:outline-none"
                >
                  {obj.name}
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newName = prompt('Enter new name', obj.name);
                    if (newName) {
                      onRenameObject(obj.id, newName);
                    }
                  }}
                  className="hover:text-gray-500 focus:outline-none"
                  aria-label="Rename"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteObject(obj.id);
                  }}
                  className="hover:text-red-500 focus:outline-none"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onCreateObject}>
            <Plus className="w-4 h-4 mr-2" />
            Add Object
          </Button>
        </div>
      </div>

      {selectedObjects.length > 0 && (
        <>
          <div>
            <h3 className="text-sm font-medium">Style</h3>
            <div className="mt-2 space-y-4">
              <div>
                <Label className="text-xs">Color</Label>
                {/* Replace SketchPicker with ColorPicker */}
                <ColorPicker
                  color={selectedObjects[0].curveConfig?.styles?.[0]?.color || '#000000'}
                  onChange={handleColorChange}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Width</Label>
                <Input
                  type="number"
                  className="mt-1 w-24 text-sm"
                  value={String(selectedObjects[0].curveConfig?.styles?.[0]?.width || 2)}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium">Transform</h3>
            <div className="mt-2 space-y-4">
              <div className="flex items-center space-x-3">
                <Label className="text-xs w-20">Rotation</Label>
                <Input
                  type="number"
                  className="mt-1 w-24 text-sm"
                  value={String(selectedObjects[0].transform?.rotation || 0)}
                  onChange={(e) => handleRotationChange(Number(e.target.value))}
                />
                <div className="space-x-1">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleRotationChange((selectedObjects[0].transform?.rotation || 0) - 15)}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleRotationChange((selectedObjects[0].transform?.rotation || 0) + 15)}
                  >
                    <RotateCw className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Label className="text-xs w-20">Scale X</Label>
                <Input
                  type="number"
                  className="mt-1 w-24 text-sm"
                  value={String(selectedObjects[0].transform?.scaleX || 1)}
                  onChange={(e) => handleScaleXChange(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center space-x-3">
                <Label className="text-xs w-20">Scale Y</Label>
                <Input
                  type="number"
                  className="mt-1 w-24 text-sm"
                  value={String(selectedObjects[0].transform?.scaleY || 1)}
                  onChange={(e) => handleScaleYChange(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </>
      )}
      
      <BackgroundImageControls
        backgroundImage={backgroundImage}
        backgroundOpacity={backgroundOpacity}
        onBackgroundOpacityChange={onBackgroundOpacityChange}
        onUploadImage={onUploadImage}
        onRemoveImage={onRemoveImage}
        onSelectImage={onSelectImage}
      />
    </div>
  );
};

export default ObjectControlsPanel;
