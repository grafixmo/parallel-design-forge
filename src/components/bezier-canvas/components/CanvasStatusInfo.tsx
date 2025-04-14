
import React from 'react';

interface CanvasStatusInfoProps {
  width: number;
  height: number;
  zoom: number;
  isDrawingMode: boolean;
  objectsCount: number;
}

export const CanvasStatusInfo: React.FC<CanvasStatusInfoProps> = ({
  width,
  height,
  zoom,
  isDrawingMode,
  objectsCount
}) => {
  return (
    <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg shadow text-xs space-y-1">
      <div>
        <span className="font-medium">Canvas:</span> {width}×{height}px
      </div>
      <div>
        <span className="font-medium">Zoom:</span> {Math.round(zoom * 100)}%
      </div>
      <div>
        <span className="font-medium">Mode:</span>{' '}
        <span className={isDrawingMode ? 'text-green-600' : 'text-blue-600'}>
          {isDrawingMode ? 'Drawing' : 'Selection'}
        </span>
      </div>
      <div>
        <span className="font-medium">Objects:</span> {objectsCount}
      </div>
    </div>
  );
};
