
import React from 'react';
import { ZoomIn, ZoomOut, Undo, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onUndo: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  onUndo
}) => {
  return (
    <div className="absolute top-2 left-2 z-10 flex gap-2 bg-white/90 backdrop-blur-sm p-1 rounded shadow">
      <Button size="icon" onClick={onZoomIn} title="Zoom In">
        <ZoomIn className="w-4 h-4" />
      </Button>
      <Button size="icon" onClick={onZoomOut} title="Zoom Out">
        <ZoomOut className="w-4 h-4" />
      </Button>
      <Button size="icon" onClick={onResetView} title="Reset View">
        <RotateCcw className="w-4 h-4" />
      </Button>
      <Button size="icon" onClick={onUndo} title="Undo">
        <Undo className="w-4 h-4" />
      </Button>
    </div>
  );
};
