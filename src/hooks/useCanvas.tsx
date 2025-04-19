
import { useCallback } from 'react';
import { BezierObject } from '@/types/bezier';

// This is a simplified version of the hook providing only what ObjectControlsPanel needs
export function useCanvas() {
  const selectedObject = null;
  const removeSelectedObject = useCallback(() => {
    console.log('Remove selected object');
  }, []);
  
  const duplicateSelectedObject = useCallback(() => {
    console.log('Duplicate selected object');
  }, []);
  
  const setObjectText = useCallback((text: string) => {
    console.log('Set object text:', text);
  }, []);
  
  const rotateObject = useCallback((degrees: number) => {
    console.log('Rotate object by:', degrees);
  }, []);
  
  const bringForward = useCallback(() => {
    console.log('Bring forward');
  }, []);
  
  const sendToBack = useCallback(() => {
    console.log('Send to back');
  }, []);
  
  const setObjectFill = useCallback((color: string) => {
    console.log('Set object fill:', color);
  }, []);
  
  const objectFill = '#000000';
  
  const backgroundOpacity = 0.5;
  const setBackgroundOpacity = useCallback((opacity: number) => {
    console.log('Set background opacity:', opacity);
  }, []);
  
  const backgroundImage = null;
  const setBackgroundImage = useCallback((image: string | null) => {
    console.log('Set background image:', image);
  }, []);
  
  return {
    selectedObject,
    removeSelectedObject,
    duplicateSelectedObject,
    setObjectText,
    rotateObject,
    bringForward,
    sendToBack,
    setObjectFill,
    objectFill,
    backgroundOpacity,
    setBackgroundOpacity,
    backgroundImage,
    setBackgroundImage
  };
}
