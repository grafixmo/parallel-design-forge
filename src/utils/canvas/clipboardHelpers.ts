
import { ControlPoint } from '@/types/bezier';
import { generateId } from '../bezierUtils';

// Copy selected points to clipboard
export const copyPointsToClipboard = (
  points: ControlPoint[],
  selectedIndices: number[]
): ControlPoint[] => {
  return selectedIndices.map(index => ({
    ...points[index],
    id: generateId() // Generate new IDs for copied points
  }));
};

// Cut selected points from canvas
export const cutPointsFromCanvas = (
  points: ControlPoint[],
  selectedIndices: number[]
): ControlPoint[] => {
  return points.filter((_, index) => !selectedIndices.includes(index));
};

// Paste points from clipboard with offset
export const pastePointsFromClipboard = (
  existingPoints: ControlPoint[],
  clipboardPoints: ControlPoint[],
  offset: number = 20
): { 
  updatedPoints: ControlPoint[]; 
  newSelectionIndices: number[] 
} => {
  // Create offset points from clipboard
  const pastedPoints = clipboardPoints.map(point => ({
    ...point,
    x: point.x + offset,
    y: point.y + offset,
    handleIn: {
      x: point.handleIn.x + offset,
      y: point.handleIn.y + offset
    },
    handleOut: {
      x: point.handleOut.x + offset,
      y: point.handleOut.y + offset
    },
    id: generateId() // Generate new IDs for pasted points
  }));
  
  // Add pasted points to canvas
  const updatedPoints = [...existingPoints, ...pastedPoints];
  
  // Create selection indices for newly pasted points
  const newSelectionIndices = pastedPoints.map((_, i) => existingPoints.length + i);
  
  return { updatedPoints, newSelectionIndices };
};
