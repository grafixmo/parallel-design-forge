
import React from 'react';

interface CanvasInstructionsProps {
  message: string;
}

export const CanvasInstructions: React.FC<CanvasInstructionsProps> = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm px-5 py-3 rounded-lg shadow-md text-sm font-medium text-gray-800 border border-gray-200 z-10 min-w-[250px] text-center">
      {message}
    </div>
  );
};
