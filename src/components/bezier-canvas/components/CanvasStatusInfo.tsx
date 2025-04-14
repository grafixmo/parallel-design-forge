
import React from 'react';

interface CanvasStatusInfoProps {
  width: number;
  height: number;
  zoom?: number;
  isDrawingMode?: boolean;
  objectsCount?: number;
  parallelCurves?: number;
}

export const CanvasStatusInfo: React.FC<CanvasStatusInfoProps> = ({ 
  width, 
  height,
  zoom = 1,
  isDrawingMode = true,
  objectsCount = 0,
  parallelCurves = 0
}) => {
  return (
    <div className="absolute bottom-2 left-2 text-xs text-gray-600 bg-white bg-opacity-70 p-1 rounded">
      <div>Canvas: {width}x{height}px</div>
      <div>Zoom: {Math.round(zoom * 100)}%</div>
      <div>Mode: {isDrawingMode ? 'Drawing' : 'Selection'}</div>
      <div>Objects: {objectsCount}</div>
      {parallelCurves > 0 && <div>Parallel curves: {parallelCurves}</div>}
    </div>
  );
};
