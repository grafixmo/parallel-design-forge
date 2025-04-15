
import React, { useState, useEffect, useRef, useCallback } from 'react';
import BezierCanvas from './BezierCanvas';
import { useBezierObjects } from '@/hooks/useBezierObjects';
import { CanvasStatusInfo } from './components/CanvasStatusInfo';
import { BezierObject } from '@/types/bezier';

const BezierCanvasContainer: React.FC = () => {
  const [width, setWidth] = useState<number>(800);
  const [height, setHeight] = useState<number>(600);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(true);
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>(undefined);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(0.4);
  
  // Use the hook to manage bezier objects
  const {
    objects,
    selectedObjectIds,
    createObject,
    setAllObjects,
    updateObjects,
    updateObjectCurveConfig,
    updateObjectTransform,
    deleteObject,
    deleteSelectedObjects,
    renameObject,
    undo,
    redo,
    saveCurrentState,
    selectObject
  } = useBezierObjects();
  
  // Update canvas dimensions on resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth);
        setHeight(containerRef.current.clientHeight);
      }
    };
    
    // Set initial dimensions
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Clean up event listener on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden" ref={containerRef}>
      <BezierCanvas
        width={width}
        height={height}
        objects={objects}
        selectedObjectIds={selectedObjectIds}
        onObjectSelect={selectObject}
        onObjectsChange={setAllObjects}
        onCreateObject={createObject}
        onSaveState={saveCurrentState}
        onUndo={undo}
        backgroundImage={backgroundImage}
        backgroundOpacity={backgroundOpacity}
        isDrawingMode={isDrawingMode}
      />
      
      {/* Using CanvasStatusInfo with visible prop set to false to hide it by default */}
      <CanvasStatusInfo 
        width={width} 
        height={height} 
        zoom={1} 
        isDrawingMode={isDrawingMode}
        objectsCount={objects.length}
        visible={false}
      />
    </div>
  );
};

export default BezierCanvasContainer;
