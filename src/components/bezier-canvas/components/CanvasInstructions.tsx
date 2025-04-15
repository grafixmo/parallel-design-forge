
import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

interface CanvasInstructionsProps {
  message: string;
  isLoading?: boolean;
  error?: boolean;
  progress?: number; // New progress property
}

export const CanvasInstructions: React.FC<CanvasInstructionsProps> = ({ 
  message, 
  isLoading = false,
  error = false,
  progress
}) => {
  if (!message) return null;
  
  return (
    <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-lg shadow-md text-sm font-medium border z-10 min-w-[250px] text-center ${
      error 
        ? 'bg-red-50 text-red-800 border-red-200' 
        : 'bg-white/90 backdrop-blur-sm text-gray-800 border-gray-200'
    }`}>
      {isLoading && (
        <div className="flex flex-col items-center justify-center mb-2">
          <div className="flex items-center justify-center mb-1">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span>Processing...</span>
          </div>
          
          {/* Progress bar for SVG processing */}
          {progress !== undefined && (
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="flex items-center justify-center mb-2 text-red-600">
          <AlertTriangle className="h-4 w-4 mr-2" />
        </div>
      )}
      
      {message}
    </div>
  );
};
