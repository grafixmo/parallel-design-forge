import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, Pencil, Plus, RotateCcw, RotateCw } from 'lucide-react';
import { BackgroundImageControls } from './BackgroundImageControls';
import { useCanvas } from '@/hooks/useCanvas';

interface ObjectControlsPanelProps {
  onClose: () => void;
}

const ObjectControlsPanel: React.FC<ObjectControlsPanelProps> = ({ onClose }) => {
  const {
    selectedObject,
    removeSelectedObject,
    duplicateSelectedObject,
    setObjectText,
    rotateObject,
    bringForward,
    sendToBack,
    setObjectFill,
    objectFill,
    backgroundOpacity,
    setBackgroundOpacity,
    backgroundImage,
    setBackgroundImage
  } = useCanvas();

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedObject && setObjectText) {
      setObjectText(e.target.value);
    }
  };

  const handleRemove = () => {
    if (selectedObject && removeSelectedObject) {
      removeSelectedObject();
      onClose();
    }
  };

  const handleDuplicate = () => {
    if (selectedObject && duplicateSelectedObject) {
      duplicateSelectedObject();
    }
  };

  const handleRotateLeft = () => {
    if (selectedObject && rotateObject) {
      rotateObject(-15);
    }
  };

  const handleRotateRight = () => {
    if (selectedObject && rotateObject) {
      rotateObject(15);
    }
  };

  const handleBringForward = () => {
    if (selectedObject && bringForward) {
      bringForward();
    }
  };

  const handleSendToBack = () => {
    if (selectedObject && sendToBack) {
      sendToBack();
    }
  };

  const handleFillChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedObject && setObjectFill) {
      setObjectFill(e.target.value);
    }
  };

  const handleBackgroundOpacityChange = (opacity: number) => {
    setBackgroundOpacity(opacity);
  };

  const handleUploadImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (setBackgroundImage) {
          setBackgroundImage(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    if (setBackgroundImage) {
      setBackgroundImage(null);
    }
  };

  if (!selectedObject) {
    return <div className="p-4">No object selected</div>;
  }

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
