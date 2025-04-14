
import React from 'react';

interface CanvasStatusInfoProps {
  width: number;
  height: number;
}

export const CanvasStatusInfo: React.FC<CanvasStatusInfoProps> = ({ width, height }) => {
  return (
    <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white/50 px-1 py-0.5 rounded">
      Canvas: {width}x{height}
    </div>
  );
};
