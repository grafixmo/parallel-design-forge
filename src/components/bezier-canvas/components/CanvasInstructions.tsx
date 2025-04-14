
import React from 'react';
import { Loader2 } from 'lucide-react';

interface CanvasInstructionsProps {
  message: string;
  isLoading?: boolean;
}

export const CanvasInstructions: React.FC<CanvasInstructionsProps> = ({ 
  message, 
  isLoading = false 
}) => {
  if (!message) return null;
  
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm px-5 py-3 rounded-lg shadow-md text-sm font-medium text-gray-800 border border-gray-200 z-10 min-w-[250px] text-center">
      {isLoading && (
        <div className="flex items-center justify-center mb-2">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span>Processing...</span>
        </div>
      )}
      {message}
    </div>
  );
};
