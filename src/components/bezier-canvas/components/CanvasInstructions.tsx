
import React from 'react';

interface CanvasInstructionsProps {
  message: string;
}

export const CanvasInstructions: React.FC<CanvasInstructionsProps> = ({ message }) => {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-lg shadow text-sm font-medium text-gray-800">
      {message}
    </div>
  );
};
