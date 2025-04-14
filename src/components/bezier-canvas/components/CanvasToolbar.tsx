
import React from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Undo, Home } from 'lucide-react';

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
    <div className="absolute bottom-4 right-4 flex space-x-2 bg-white/80 backdrop-blur-sm p-2 rounded-lg shadow">
      <Button
        variant="outline"
        size="icon"
        onClick={onZoomIn}
        title="Zoom In"
        className="w-8 h-8"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onZoomOut}
        title="Zoom Out"
        className="w-8 h-8"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onResetView}
        title="Reset View"
        className="w-8 h-8"
      >
        <Home className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onUndo}
        title="Undo"
        className="w-8 h-8"
      >
        <Undo className="h-4 w-4" />
      </Button>
    </div>
  );
};
