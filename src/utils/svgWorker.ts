
// SVG Worker file for processing SVG paths in a separate thread
// This prevents the UI from freezing during complex SVG imports

// Process SVG path data in chunks
onmessage = function(e) {
  try {
    const { paths, options } = e.data;
    const totalPaths = paths.length;
    const results = [];
    
    // Process paths in batches to avoid blocking the worker
    const BATCH_SIZE = 5;
    let processedCount = 0;
    
    for (let i = 0; i < totalPaths; i += BATCH_SIZE) {
      const batch = paths.slice(i, Math.min(i + BATCH_SIZE, totalPaths));
      const batchResults = batch.map(pathData => processPath(pathData, options));
      results.push(...batchResults);
      
      processedCount += batch.length;
      
      // Report progress back to main thread
      postMessage({
        type: 'progress',
        progress: processedCount / totalPaths,
        processedCount,
        totalPaths
      });
    }
    
    // Send completed result
    postMessage({
      type: 'complete',
      results
    });
  } catch (error) {
    // Report error to main thread
    postMessage({
      type: 'error',
      error: error.message
    });
  }
};

// Process a single SVG path
function processPath(pathData, options) {
  const { path, color, width } = pathData;
  const points = convertPathToPoints(path);
  
  return {
    path,
    color,
    width,
    points
  };
}

// Optimized version of convertPathToPoints
function convertPathToPoints(path) {
  // Import the generateId function dynamically
  function generateUniqueId() {
    return Math.random().toString(36).substring(2, 11);
  }

  const points = [];
  
  try {
    // Optimized path parsing - works for simple paths
    const commands = path.match(/[a-zA-Z][^a-zA-Z]*/g) || [];
    
    let currentX = 0;
    let currentY = 0;
    
    commands.forEach((command) => {
      const type = command.charAt(0);
      const args = command.substring(1)
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat)
        .filter(n => !isNaN(n));
      
      if ((type === 'M' || type === 'm') && args.length >= 2) {
        // Move command
        if (type === 'M') {
          currentX = args[0];
          currentY = args[1];
        } else {
          currentX += args[0];
          currentY += args[1];
        }
        
        // Add first point
        points.push({
          x: currentX,
          y: currentY,
          handleIn: { x: currentX - 50, y: currentY },
          handleOut: { x: currentX + 50, y: currentY },
          id: generateUniqueId()
        });
      } else if ((type === 'C' || type === 'c') && args.length >= 6) {
        // Cubic bezier curve
        let control1X, control1Y, control2X, control2Y, endX, endY;
        
        if (type === 'C') {
          control1X = args[0];
          control1Y = args[1];
          control2X = args[2];
          control2Y = args[3];
          endX = args[4];
          endY = args[5];
        } else {
          control1X = currentX + args[0];
          control1Y = currentY + args[1];
          control2X = currentX + args[2];
          control2Y = currentY + args[3];
          endX = currentX + args[4];
          endY = currentY + args[5];
        }
        
        // Update the handle of the last point
        if (points.length > 0) {
          const lastPoint = points[points.length - 1];
          lastPoint.handleOut = { x: control1X, y: control1Y };
        }
        
        // Add new point with handle
        points.push({
          x: endX,
          y: endY,
          handleIn: { x: control2X, y: control2Y },
          handleOut: { x: endX + (endX - control2X), y: endY + (endY - control2Y) },
          id: generateUniqueId()
        });
        
        currentX = endX;
        currentY = endY;
      } else if ((type === 'L' || type === 'l') && args.length >= 2) {
        // Line command
        let endX, endY;
        
        if (type === 'L') {
          endX = args[0];
          endY = args[1];
        } else {
          endX = currentX + args[0];
          endY = currentY + args[1];
        }
        
        // Add new point (for lines, handles are aligned with the line)
        if (points.length > 0) {
          const lastPoint = points[points.length - 1];
          const dx = endX - lastPoint.x;
          const dy = endY - lastPoint.y;
          
          // Set the out handle of previous point along the line
          lastPoint.handleOut = {
            x: lastPoint.x + dx / 3,
            y: lastPoint.y + dy / 3
          };
          
          // Add new point with handle
          points.push({
            x: endX,
            y: endY,
            handleIn: {
              x: endX - dx / 3,
              y: endY - dy / 3
            },
            handleOut: {
              x: endX + dx / 3,
              y: endY + dy / 3
            },
            id: generateUniqueId()
          });
        }
        
        currentX = endX;
        currentY = endY;
      } else if ((type === 'Z' || type === 'z') && points.length > 1) {
        // Close path command - connect back to the first point
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        // Only add closing segment if we're not already at the start point
        if (Math.abs(lastPoint.x - firstPoint.x) > 0.1 || Math.abs(lastPoint.y - firstPoint.y) > 0.1) {
          const dx = firstPoint.x - lastPoint.x;
          const dy = firstPoint.y - lastPoint.y;
          
          // Set the out handle of last point along the closing line
          lastPoint.handleOut = {
            x: lastPoint.x + dx / 3,
            y: lastPoint.y + dy / 3
          };
          
          // Update the in handle of first point to match the curve
          firstPoint.handleIn = {
            x: firstPoint.x - dx / 3,
            y: firstPoint.y - dy / 3
          };
        }
      }
    });
  } catch (error) {
    console.error('Error converting path to points:', error);
  }
  
  return points;
}
