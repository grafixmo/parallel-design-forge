
import React, { useRef, useState } from 'react';
import { BezierObject, ControlPoint } from '@/types/bezier';
import BezierCanvas from './BezierCanvas';

interface BezierCanvasContainerProps {
  width: number;
  height: number;
  objects: BezierObject[];
  selectedObjectIds: string[];
  onObjectSelect: (objectId: string, multiSelect: boolean) => void;
  onObjectsChange: (objects: BezierObject[]) => void;
  onCreateObject: (points: ControlPoint[]) => string;
  onSaveState: () => void;
  onUndo: () => void;
  backgroundImage?: string;
  backgroundOpacity: number;
  isDrawingMode?: boolean;
}

const BezierCanvasContainer: React.FC<BezierCanvasContainerProps> = ({
  width,
  height,
  objects,
  selectedObjectIds,
  onObjectSelect,
  onObjectsChange,
  onCreateObject,
  onSaveState,
  onUndo,
  backgroundImage,
  backgroundOpacity,
  isDrawingMode = false
}) => {
  // Pass through to the simplified main component with error handling
  try {
    return (
      <BezierCanvas 
        width={width}
        height={height}
        objects={objects}
        selectedObjectIds={selectedObjectIds}
        onObjectSelect={onObjectSelect}
        onObjectsChange={onObjectsChange}
        onCreateObject={onCreateObject}
        onSaveState={onSaveState}
        onUndo={onUndo}
        backgroundImage={backgroundImage}
        backgroundOpacity={backgroundOpacity}
        isDrawingMode={isDrawingMode}
      />
    );
  } catch (error) {
    console.error("Error rendering BezierCanvas:", error);
    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-100 border border-gray-300 rounded-md">
        <div className="text-center p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Canvas Error</h3>
          <p className="text-gray-600">There was an error rendering the canvas.</p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={onSaveState} // Save current state to allow recovery
          >
            Reset View
          </button>
        </div>
      </div>
    );
  }
};

export default BezierCanvasContainer;
