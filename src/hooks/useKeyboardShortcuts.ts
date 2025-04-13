import { useEffect, useCallback } from 'react';
import { ControlPoint } from '@/types/bezier';
import { toast } from '@/components/ui/use-toast';
import { copyPointsToClipboard, cutPointsFromCanvas, pastePointsFromClipboard } from '@/utils/canvas/clipboardHelpers';

interface UseKeyboardShortcutsProps {
  points: ControlPoint[];
  onPointsChange: (points: ControlPoint[]) => void;
  selectedPointsIndices: number[];
  setSelectedPointsIndices: (indices: number[]) => void;
  selectedPoint: { pointIndex: number, type: string } | null;
  setSelectedPoint: (point: { pointIndex: number, type: string } | null) => void;
  clearSelections: () => void;
  handleUndo: () => void;
  clipboard: ControlPoint[];
  setClipboard: (points: ControlPoint[]) => void;
  isSpacePressed: boolean;
  setIsSpacePressed: (isPressed: boolean) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isDrawingMode: boolean;
  zoom: number;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number, y: number }) => void;
}

export function useKeyboardShortcuts({
  points,
  onPointsChange,
  selectedPointsIndices,
  setSelectedPointsIndices,
  selectedPoint,
  setSelectedPoint,
  clearSelections,
  handleUndo,
  clipboard,
  setClipboard,
  isSpacePressed,
  setIsSpacePressed,
  canvasRef,
  isDrawingMode,
  zoom,
  setZoom,
  setPanOffset
}: UseKeyboardShortcutsProps): void {
  
  // Copy selected points to clipboard
  const copySelectedPoints = useCallback(() => {
    if (selectedPointsIndices.length > 0) {
      const pointsToCopy = copyPointsToClipboard(points, selectedPointsIndices);
      setClipboard(pointsToCopy);
      
      toast({
        title: "Copied points",
        description: `${pointsToCopy.length} points copied to clipboard`
      });
    } else if (selectedPoint) {
      const pointToCopy = copyPointsToClipboard(points, [selectedPoint.pointIndex]);
      setClipboard(pointToCopy);
      
      toast({
        title: "Copied point",
        description: "1 point copied to clipboard"
      });
    }
  }, [points, selectedPointsIndices, selectedPoint, setClipboard]);
  
  // Cut selected points to clipboard
  const cutSelectedPoints = useCallback(() => {
    if (selectedPointsIndices.length > 0) {
      // First copy
      const pointsToCut = copyPointsToClipboard(points, selectedPointsIndices);
      setClipboard(pointsToCut);
      
      // Then delete
      const updatedPoints = cutPointsFromCanvas(points, selectedPointsIndices);
      onPointsChange(updatedPoints);
      setSelectedPointsIndices([]);
      
      toast({
        title: "Cut points",
        description: `${pointsToCut.length} points cut to clipboard`
      });
    } else if (selectedPoint) {
      // First copy
      const pointToCut = copyPointsToClipboard(points, [selectedPoint.pointIndex]);
      setClipboard(pointToCut);
      
      // Then delete
      const updatedPoints = cutPointsFromCanvas(points, [selectedPoint.pointIndex]);
      onPointsChange(updatedPoints);
      setSelectedPoint(null);
      
      toast({
        title: "Cut point",
        description: "1 point cut to clipboard"
      });
    }
  }, [
    points, 
    selectedPointsIndices, 
    selectedPoint, 
    setClipboard, 
    onPointsChange, 
    setSelectedPointsIndices, 
    setSelectedPoint
  ]);
  
  // Paste points from clipboard
  const pastePoints = useCallback(() => {
    if (clipboard.length > 0) {
      const { updatedPoints, newSelectionIndices } = pastePointsFromClipboard(points, clipboard);
      onPointsChange(updatedPoints);
      setSelectedPointsIndices(newSelectionIndices);
      
      toast({
        title: "Pasted points",
        description: `${clipboard.length} points pasted from clipboard`
      });
    }
  }, [clipboard, points, onPointsChange, setSelectedPointsIndices]);
  
  // Delete selected points
  const deleteSelectedPoints = useCallback(() => {
    if (selectedPointsIndices.length > 0) {
      const updatedPoints = cutPointsFromCanvas(points, selectedPointsIndices);
      onPointsChange(updatedPoints);
      setSelectedPointsIndices([]);
      
      toast({
        title: "Points removed",
        description: `${selectedPointsIndices.length} points have been deleted`
      });
    }
  }, [points, selectedPointsIndices, onPointsChange, setSelectedPointsIndices]);
  
  // Reset zoom and pan
  const resetZoomAndPan = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    
    toast({
      title: "Zoom reset",
      description: "View has been reset to 100%"
    });
  }, [setZoom, setPanOffset]);
  
  // Zoom in
  const zoomIn = useCallback(() => {
    const ZOOM_FACTOR = 0.1;
    const newZoom = Math.min(5, zoom * (1 + ZOOM_FACTOR));
    setZoom(newZoom);
    
    toast({
      title: `Zoom: ${Math.round(newZoom * 100)}%`,
      description: "View has been zoomed in"
    });
  }, [zoom, setZoom]);
  
  // Zoom out
  const zoomOut = useCallback(() => {
    const ZOOM_FACTOR = 0.1;
    const newZoom = Math.max(0.1, zoom * (1 - ZOOM_FACTOR));
    setZoom(newZoom);
    
    toast({
      title: `Zoom: ${Math.round(newZoom * 100)}%`,
      description: "View has been zoomed out"
    });
  }, [zoom, setZoom]);
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Add spacebar check for canvas dragging
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
        
        // Change cursor to indicate canvas dragging mode
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grab';
        }
      }
      
      // Undo (Ctrl+Z or Cmd+Z)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      
      // Copy (Ctrl+C or Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelectedPoints();
      }
      
      // Cut (Ctrl+X or Cmd+X)
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        cutSelectedPoints();
      }
      
      // Paste (Ctrl+V or Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pastePoints();
      }
      
      // Delete selected points when Delete or Backspace is pressed
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPointsIndices.length > 0) {
        e.preventDefault();
        deleteSelectedPoints();
      }
      
      // Cancel current operation when Escape is pressed
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelections();
        
        // Reset cursor
        if (canvasRef.current) {
          canvasRef.current.style.cursor = isDrawingMode ? 'crosshair' : 'default';
        }
        
        toast({
          title: "Selection cleared",
          description: "All selected points have been deselected"
        });
      }
      
      // Reset zoom with 0 key
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        resetZoomAndPan();
      }
      
      // Zoom in with + key
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      }
      
      // Zoom out with - key
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Handle spacebar release
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
        
        // Reset cursor
        if (canvasRef.current) {
          canvasRef.current.style.cursor = isDrawingMode ? 'crosshair' : 'default';
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    points,
    selectedPointsIndices,
    selectedPoint,
    clipboard,
    zoom,
    onPointsChange,
    handleUndo,
    isSpacePressed,
    isDrawingMode,
    canvasRef,
    setIsSpacePressed,
    clearSelections,
    setClipboard,
    setSelectedPointsIndices,
    setSelectedPoint,
    setZoom,
    setPanOffset
  ]);
}
