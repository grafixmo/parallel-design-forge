
import { ControlPoint, PointGroup } from '@/types/bezier';
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

// Copy selected points from grouped structure to clipboard
export const copyGroupedPointsToClipboard = (
  pointGroups: PointGroup[],
  selectedIndices: { groupIndex: number; pointIndex: number }[]
): ControlPoint[] => {
  return selectedIndices.map(({ groupIndex, pointIndex }) => {
    const group = pointGroups[groupIndex];
    if (!group || !group.points[pointIndex]) return null;
    
    return {
      ...group.points[pointIndex],
      id: generateId() // Generate new IDs for copied points
    };
  }).filter(Boolean) as ControlPoint[];
};

// Cut selected points from canvas
export const cutPointsFromCanvas = (
  points: ControlPoint[],
  selectedIndices: number[]
): ControlPoint[] => {
  return points.filter((_, index) => !selectedIndices.includes(index));
};

// Cut selected points from grouped structure
export const cutGroupedPointsFromCanvas = (
  pointGroups: PointGroup[],
  selectedIndices: { groupIndex: number; pointIndex: number }[]
): PointGroup[] => {
  const updatedGroups = [...pointGroups];
  
  // Group the indices by group index for efficient processing
  const groupedIndices: Record<number, number[]> = {};
  selectedIndices.forEach(({ groupIndex, pointIndex }) => {
    if (!groupedIndices[groupIndex]) {
      groupedIndices[groupIndex] = [];
    }
    groupedIndices[groupIndex].push(pointIndex);
  });
  
  // Process each group
  Object.entries(groupedIndices).forEach(([groupIdxStr, pointIndices]) => {
    const groupIdx = parseInt(groupIdxStr);
    if (groupIdx < 0 || groupIdx >= updatedGroups.length) return;
    
    const group = updatedGroups[groupIdx];
    if (!group) return;
    
    // Filter out the selected points from this group
    const updatedPoints = group.points.filter((_, idx) => !pointIndices.includes(idx));
    
    if (updatedPoints.length > 0) {
      // Update the group with remaining points
      updatedGroups[groupIdx] = {
        ...group,
        points: updatedPoints
      };
    } else {
      // If the group is now empty, remove it
      updatedGroups.splice(groupIdx, 1);
    }
  });
  
  return updatedGroups;
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

// Paste points from clipboard into grouped structure
export const pasteGroupedPointsFromClipboard = (
  pointGroups: PointGroup[],
  clipboardPoints: ControlPoint[],
  targetGroupIndex: number = -1,
  offset: number = 20
): { 
  updatedGroups: PointGroup[]; 
  newSelectionIndices: { groupIndex: number; pointIndex: number }[] 
} => {
  if (!clipboardPoints || clipboardPoints.length === 0) {
    return { updatedGroups: pointGroups, newSelectionIndices: [] };
  }
  
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
  
  const updatedGroups = [...pointGroups];
  let newSelectionIndices: { groupIndex: number; pointIndex: number }[] = [];
  
  // Determine where to paste the points
  if (targetGroupIndex >= 0 && targetGroupIndex < updatedGroups.length) {
    // Paste to existing group
    const targetGroup = updatedGroups[targetGroupIndex];
    const originalPointCount = targetGroup.points.length;
    
    updatedGroups[targetGroupIndex] = {
      ...targetGroup,
      points: [...targetGroup.points, ...pastedPoints]
    };
    
    // Create selection indices for newly pasted points
    newSelectionIndices = pastedPoints.map((_, i) => ({
      groupIndex: targetGroupIndex,
      pointIndex: originalPointCount + i
    }));
  } else {
    // Create a new group for the pasted points
    const newGroup: PointGroup = {
      id: generateId(),
      points: pastedPoints
    };
    
    updatedGroups.push(newGroup);
    
    // Create selection indices for newly pasted points
    const newGroupIndex = updatedGroups.length - 1;
    newSelectionIndices = pastedPoints.map((_, i) => ({
      groupIndex: newGroupIndex,
      pointIndex: i
    }));
  }
  
  return { updatedGroups, newSelectionIndices };
};
