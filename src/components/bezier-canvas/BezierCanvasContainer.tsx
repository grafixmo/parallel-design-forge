
import React, { useRef, useEffect } from 'react';
import { 
  Point, 
  BezierObject, 
  ControlPoint
} from '@/types/bezier';
import { useCanvasSetup } from './hooks/useCanvasSetup';
import { useCanvasHandlers } from './hooks/useCanvasHandlers';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
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

const BezierCanvasContainer: React.FC<BezierCanvasContainerProps> = (props) => {
  // Pass through to the simplified main component
  return (
    <BezierCanvas {...props} />
  );
};

export default BezierCanvasContainer;
