
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, Pencil, Plus, RotateCcw, RotateCw } from 'lucide-react';
import { BackgroundImageControls } from './BackgroundImageControls';
import { BezierObject, BackgroundImage } from '@/types/bezier';

interface ObjectControlsPanelProps {
  onClose?: () => void;
  selectedObjects?: BezierObject[];
  allObjects?: BezierObject[];
  selectedObjectIds?: string[];
  onCreateObject?: () => void;
  onSelectObject?: (objectId: string, multiSelect?: boolean) => void;
  onDeleteObject?: (objectId: string) => void;
  onRenameObject?: (objectId: string, name: string) => void;
  onUpdateCurveConfig?: (objectId: string, config: any) => void;
  onUpdateTransform?: (objectId: string, transform: any) => void;
  backgroundImage?: string | null;
  backgroundOpacity?: number;
  onBackgroundOpacityChange?: (opacity: number) => void;
  onUploadImage?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage?: () => void;
  onSelectImage?: (image: BackgroundImage) => void;
}

const ObjectControlsPanel: React.FC<ObjectControlsPanelProps> = ({ 
  onClose = () => {},
  selectedObjects = [],
  backgroundImage,
  backgroundOpacity = 0.5,
  onBackgroundOpacityChange = () => {},
  onUploadImage = () => {},
  onRemoveImage = () => {},
}) => {
  const selectedObject = selectedObjects && selectedObjects.length > 0 ? selectedObjects[0] : null;

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedObject && selectedObject.text) {
      // In a real implementation, this would call a prop function to update the text
      console.log('Text changed:', e.target.value);
    }
  };

  const handleRemove = () => {
    if (selectedObject) {
      // In a real implementation, this would call onDeleteObject
      onClose();
    }
  };

  const handleDuplicate = () => {
    if (selectedObject) {
      // In a real implementation, this would duplicate the object
    }
  };

  const handleRotateLeft = () => {
    if (selectedObject) {
      // In a real implementation, this would rotate the object
    }
  };

  const handleRotateRight = () => {
    if (selectedObject) {
      // In a real implementation, this would rotate the object
    }
  };

  const handleBringForward = () => {
    if (selectedObject) {
      // In a real implementation, this would bring the object forward
    }
  };

  const handleSendToBack = () => {
    if (selectedObject) {
      // In a real implementation, this would send the object to back
    }
  };

  const handleFillChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedObject) {
      // In a real implementation, this would change the object's fill
    }
  };

  const handleBackgroundOpacityChange = (opacity: number) => {
    onBackgroundOpacityChange(opacity);
  };

  const handleUploadImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    onUploadImage(event);
  };

  const handleRemoveImage = () => {
    onRemoveImage();
  };

  if (!selectedObject) {
    return <div className="p-4">No object selected</div>;
  }

  const objectFill = selectedObject.curveConfig?.styles[0]?.color || '#000000';

  return (
    <div className="p-4 space-y-4">
      {selectedObject.type === 'i-text' && (
        <div>
          <Label htmlFor="text">Text</Label>
          <Input
            type="text"
            id="text"
            defaultValue={selectedObject.text}
            onChange={handleTextChange}
          />
        </div>
      )}

      <div>
        <Label htmlFor="fill">Fill</Label>
        <Input
          type="color"
          id="fill"
          value={objectFill}
          onChange={handleFillChange}
        />
      </div>

      <BackgroundImageControls
        backgroundImage={backgroundImage}
        backgroundOpacity={backgroundOpacity}
        onBackgroundOpacityChange={handleBackgroundOpacityChange}
        onUploadImage={handleUploadImage}
        onRemoveImage={handleRemoveImage}
      />

      <div className="flex space-x-2">
        <Button variant="outline" size="icon" onClick={handleRotateLeft}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleRotateRight}>
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleBringForward}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleSendToBack}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleDuplicate}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="destructive" size="icon" onClick={handleRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ObjectControlsPanel;
