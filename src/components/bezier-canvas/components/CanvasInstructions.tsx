
import React from 'react';

interface CanvasInstructionsProps {
  message: string;
}

export const CanvasInstructions: React.FC<CanvasInstructionsProps> = ({ message }) => {
  return (
    <div className="absolute bottom-2 left-2 text-sm text-gray-700 bg-white/80 px-2 py-1 rounded shadow">
      {message}
    </div>
  );
};
