
import { Canvas as FabricCanvas, Path, Object as FabricObject } from 'fabric';
import { BezierObject, ControlPoint, CurveConfig, TransformSettings, Point } from '@/types/bezier';
import { generateId } from '@/utils/bezierUtils';
import { toast } from '@/hooks/use-toast';

/**
 * Import SVG content using Fabric.js and convert to BezierObjects
 * This provides better SVG path parsing than our manual implementation
 */
export const importSVG = (svgContent: string): BezierObject[] => {
  try {
    console.log('Starting SVG import with Fabric.js');
    return parseSVGWithFabric(svgContent);
  } catch (error) {
    console.error('Error importing SVG with Fabric.js:', error);
    toast({
      title: "Import Error",
      description: "Failed to import SVG. The file might be too complex.",
      variant: "destructive"
    });
    return [];
  }
};

/**
 * Read SVG file from input element
 */
export const readSVGFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading SVG file'));
    };
    
    reader.readAsText(file);
  });
};

/**
 * Parse SVG content using Fabric.js
 */
const parseSVGWithFabric = (svgContent: string): BezierObject[] => {
  // Create a temporary canvas for Fabric.js
  const canvas = new FabricCanvas(undefined);
  const objects: BezierObject[] = [];
  
  // Load the SVG content
  return new Promise<BezierObject[]>((resolve) => {
    // Using Fabric.js to load SVG
    FabricCanvas.prototype.loadSVGFromString(svgContent, (fabricObjects: FabricObject[], options: any) => {
      console.log(`Loaded ${fabricObjects.length} objects from SVG`);
      
      // Convert each Fabric.js path to our BezierObject format
      fabricObjects.forEach((fabricObject, index) => {
        if (fabricObject.type === 'path') {
          try {
            const pathObj = fabricObject as unknown as Path;
            const bezierObject = convertFabricPathToBezierObject(pathObj, index);
            if (bezierObject) {
              objects.push(bezierObject);
            }
          } catch (err) {
            console.error('Error converting path:', err);
          }
        }
      });
      
      // Position and scale the objects to fit the canvas
      if (objects.length > 0) {
        positionImportedObjects(objects);
      }
      
      // Clean up
      canvas.dispose();
      resolve(objects);
    }, (error: any) => {
      console.error('Error loading SVG with Fabric.js:', error);
      canvas.dispose();
      resolve([]);
    }, {
      // Options for SVG loading
      crossOrigin: 'anonymous'
    });
  });
};

/**
 * Convert a Fabric.js path to our BezierObject format
 */
const convertFabricPathToBezierObject = (pathObj: Path, index: number): BezierObject | null => {
  try {
    // Extract path data from Fabric.js object
    const path = pathObj.path;
    if (!path || !Array.isArray(path) || path.length === 0) {
      console.error('Invalid path data in Fabric.js object');
      return null;
    }
    
    // Convert Fabric.js path commands to control points
    const points = convertFabricPathToControlPoints(path);
    if (points.length < 2) {
      console.warn('Not enough points extracted from path');
      return null;
    }
    
    // Create curve configuration from path properties
    const curveConfig: CurveConfig = {
      styles: [{
        color: pathObj.stroke || '#000000',
        width: pathObj.strokeWidth || 2
      }],
      parallelCount: 0,
      spacing: 0
    };
    
    // Create transformation settings
    const transform: TransformSettings = {
      rotation: pathObj.angle || 0,
      scaleX: pathObj.scaleX || 1.0,
      scaleY: pathObj.scaleY || 1.0
    };
    
    // Create the bezier object
    return {
      id: generateId(),
      points,
      curveConfig,
      transform,
      name: `Imported Path ${index + 1}`,
      isSelected: false
    };
  } catch (error) {
    console.error('Error converting Fabric.js path to BezierObject:', error);
    return null;
  }
};

/**
 * Convert Fabric.js path commands to control points
 */
const convertFabricPathToControlPoints = (path: any[]): ControlPoint[] => {
  const points: ControlPoint[] = [];
  let currentX = 0, currentY = 0;
  let firstX = 0, firstY = 0;
  let lastControlX = 0, lastControlY = 0;
  let hasLastControl = false;
  
  // Process each path command
  for (let i = 0; i < path.length; i++) {
    const cmd = path[i];
    const command = cmd[0]; // Command type (M, L, C, Q, etc.)
    
    switch (command) {
      case 'M': // Move to (absolute)
        currentX = cmd[1];
        currentY = cmd[2];
        
        // Remember first point for Z command
        if (points.length === 0) {
          firstX = currentX;
          firstY = currentY;
        }
        
        // Add point with default handles
        if (points.length === 0) {
          points.push({
            x: currentX,
            y: currentY,
            handleIn: { x: currentX - 10, y: currentY },
            handleOut: { x: currentX + 10, y: currentY },
            id: generateId()
          });
        }
        
        hasLastControl = false;
        break;
        
      case 'L': // Line to (absolute)
        // Handle previous point's handle out
        if (points.length > 0) {
          const prevPoint = points[points.length - 1];
          const dx = cmd[1] - prevPoint.x;
          const dy = cmd[2] - prevPoint.y;
          const distance = Math.sqrt(dx*dx + dy*dy);
          const handleDistance = distance / 3;
          
          prevPoint.handleOut = {
            x: prevPoint.x + dx * 0.33,
            y: prevPoint.y + dy * 0.33
          };
          
          // Add new point
          points.push({
            x: cmd[1],
            y: cmd[2],
            handleIn: {
              x: cmd[1] - dx * 0.33,
              y: cmd[2] - dy * 0.33
            },
            handleOut: {
              x: cmd[1] + dx * 0.33,
              y: cmd[2] + dy * 0.33
            },
            id: generateId()
          });
          
          currentX = cmd[1];
          currentY = cmd[2];
        }
        
        hasLastControl = false;
        break;
        
      case 'C': // Cubic Bezier curve (absolute)
        if (points.length > 0) {
          // Set handle out for previous point
          const prevPoint = points[points.length - 1];
          prevPoint.handleOut = {
            x: cmd[1],
            y: cmd[2]
          };
          
          // Add new point with handle in
          points.push({
            x: cmd[5],
            y: cmd[6],
            handleIn: {
              x: cmd[3],
              y: cmd[4]
            },
            handleOut: {
              x: cmd[5] + (cmd[5] - cmd[3]),
              y: cmd[6] + (cmd[6] - cmd[4])
            },
            id: generateId()
          });
          
          currentX = cmd[5];
          currentY = cmd[6];
          lastControlX = cmd[3];
          lastControlY = cmd[4];
          hasLastControl = true;
        }
        break;
        
      case 'S': // Smooth cubic Bezier curve (absolute)
        if (points.length > 0) {
          const prevPoint = points[points.length - 1];
          let controlX, controlY;
          
          // Reflect the previous control point
          if (hasLastControl) {
            controlX = 2 * prevPoint.x - lastControlX;
            controlY = 2 * prevPoint.y - lastControlY;
          } else {
            controlX = prevPoint.x;
            controlY = prevPoint.y;
          }
          
          // Update previous point's handle out
          prevPoint.handleOut = {
            x: controlX,
            y: controlY
          };
          
          // Add new point
          points.push({
            x: cmd[3],
            y: cmd[4],
            handleIn: {
              x: cmd[1],
              y: cmd[2]
            },
            handleOut: {
              x: cmd[3] + (cmd[3] - cmd[1]),
              y: cmd[4] + (cmd[4] - cmd[2])
            },
            id: generateId()
          });
          
          currentX = cmd[3];
          currentY = cmd[4];
          lastControlX = cmd[1];
          lastControlY = cmd[2];
          hasLastControl = true;
        }
        break;
        
      case 'Q': // Quadratic Bezier curve (absolute)
        if (points.length > 0) {
          const prevPoint = points[points.length - 1];
          
          // Convert quadratic to cubic
          const cp1x = prevPoint.x + 2/3 * (cmd[1] - prevPoint.x);
          const cp1y = prevPoint.y + 2/3 * (cmd[2] - prevPoint.y);
          const cp2x = cmd[3] + 2/3 * (cmd[1] - cmd[3]);
          const cp2y = cmd[4] + 2/3 * (cmd[2] - cmd[4]);
          
          // Update previous point's handle out
          prevPoint.handleOut = {
            x: cp1x,
            y: cp1y
          };
          
          // Add new point
          points.push({
            x: cmd[3],
            y: cmd[4],
            handleIn: {
              x: cp2x,
              y: cp2y
            },
            handleOut: {
              x: cmd[3] + (cmd[3] - cp2x),
              y: cmd[4] + (cmd[4] - cp2y)
            },
            id: generateId()
          });
          
          currentX = cmd[3];
          currentY = cmd[4];
          hasLastControl = false;
        }
        break;
        
      case 'Z': // Close path
      case 'z':
        if (points.length > 1 && (currentX !== firstX || currentY !== firstY)) {
          // Connect last point to first point
          const lastPoint = points[points.length - 1];
          const firstPoint = points[0];
          
          const dx = firstPoint.x - lastPoint.x;
          const dy = firstPoint.y - lastPoint.y;
          const distance = Math.sqrt(dx*dx + dy*dy);
          
          if (distance > 0) {
            const handleDistance = distance / 3;
            const ratio = handleDistance / distance;
            
            // Update the last point's handle out
            lastPoint.handleOut = {
              x: lastPoint.x + dx * ratio,
              y: lastPoint.y + dy * ratio
            };
            
            // Update the first point's handle in
            firstPoint.handleIn = {
              x: firstPoint.x - dx * ratio,
              y: firstPoint.y - dy * ratio
            };
          }
        }
        break;
    }
  }
  
  return points;
};

/**
 * Position imported objects to fit within the canvas
 */
const positionImportedObjects = (objects: BezierObject[]): void => {
  if (objects.length === 0) return;
  
  // Find bounds of all objects
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  objects.forEach(obj => {
    obj.points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });
  
  // Calculate dimensions and center
  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;
  
  // Target center and dimensions
  const targetCenterX = 400; // Default canvas width / 2
  const targetCenterY = 300; // Default canvas height / 2
  const maxTargetDimension = 600;
  
  // Calculate offset to center the objects in canvas
  const offsetX = targetCenterX - centerX;
  const offsetY = targetCenterY - centerY;
  
  // Calculate scale if necessary
  let scale = 1.0;
  if (width > maxTargetDimension || height > maxTargetDimension) {
    scale = Math.min(maxTargetDimension / width, maxTargetDimension / height) * 0.8; // 80% of max scale for margin
  }
  
  // Apply translation and scaling to all objects
  objects.forEach(obj => {
    obj.points = obj.points.map(point => ({
      ...point,
      x: (point.x + offsetX) * scale,
      y: (point.y + offsetY) * scale,
      handleIn: {
        x: (point.handleIn.x + offsetX) * scale,
        y: (point.handleIn.y + offsetY) * scale
      },
      handleOut: {
        x: (point.handleOut.x + offsetX) * scale,
        y: (point.handleOut.y + offsetY) * scale
      },
      id: point.id
    }));
  });
};
