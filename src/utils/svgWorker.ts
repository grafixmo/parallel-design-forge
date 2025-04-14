
// SVG Worker file for processing SVG paths in a separate thread
// This prevents the UI from freezing during complex SVG imports

// Track original SVG viewBox for proper positioning
let svgViewBox = { x: 0, y: 0, width: 800, height: 600 };

onmessage = function(e) {
  try {
    const { paths, options, viewBox } = e.data;
    
    // Store viewBox information for coordinate calculations
    if (viewBox) {
      svgViewBox = viewBox;
    }
    
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
    
    // Send completed result with viewBox information
    postMessage({
      type: 'complete',
      results,
      viewBox: svgViewBox
    });
  } catch (error) {
    // Report error to main thread
    postMessage({
      type: 'error',
      error: error.message
    });
  }
};

// Process a single SVG path - optimized to prevent freeze
function processPath(pathData, options) {
  const { path, color, width } = pathData;
  
  // Convert to points with minimal processing - only what's needed
  const points = convertPathToPoints(path, options?.simplifyPaths);
  
  return {
    path,
    color,
    width,
    points
  };
}

// Generate a unique ID with minimal overhead
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 11);
}

// Optimized version of convertPathToPoints - minimal handle generation
function convertPathToPoints(path, simplify = false) {
  const points = [];
  
  try {
    // Fast path parsing with minimal regex
    // Split the path into command groups without regex if possible
    let commands = [];
    let currentCommand = '';
    let currentType = '';
    
    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      
      // If this is a command character (letter)
      if (/[a-zA-Z]/.test(char)) {
        // If we already have a command in progress, save it
        if (currentCommand) {
          commands.push(currentCommand);
        }
        // Start a new command
        currentType = char;
        currentCommand = char;
      } else {
        // Add to current command
        currentCommand += char;
      }
    }
    
    // Add the last command if there is one
    if (currentCommand) {
      commands.push(currentCommand);
    }
    
    // Process each command
    let currentX = 0;
    let currentY = 0;
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const type = command.charAt(0);
      
      // Parse arguments - split by comma or whitespace
      const argsStr = command.substring(1).trim();
      const args = argsStr.split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
      
      if ((type === 'M' || type === 'm') && args.length >= 2) {
        // Move command
        if (type === 'M') {
          currentX = args[0];
          currentY = args[1];
        } else {
          currentX += args[0];
          currentY += args[1];
        }
        
        // Add first point - with minimal handle computation
        points.push({
          x: currentX,
          y: currentY,
          // Only create handles with minimal offset - they'll be adjusted as needed
          handleIn: { x: currentX, y: currentY },  // No offset initially
          handleOut: { x: currentX, y: currentY }, // No offset initially
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
          // Create handleOut that mirrors handleIn - simpler calculation
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
        
        // For lines, only add points with simplified handle calculation
        const lastPoint = points[points.length - 1];
        if (lastPoint) {
          // For lines, simple handle calculation along the line
          const dx = endX - lastPoint.x;
          const dy = endY - lastPoint.y;
          
          // Simple handle placement - small offsets to reduce complexity
          const handleDistance = simplify ? 5 : Math.min(Math.sqrt(dx*dx + dy*dy) / 3, 30);
          
          if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx*dx + dy*dy);
            const normalizedDx = dx / length;
            const normalizedDy = dy / length;
            
            lastPoint.handleOut = {
              x: lastPoint.x + normalizedDx * handleDistance,
              y: lastPoint.y + normalizedDy * handleDistance
            };
            
            points.push({
              x: endX,
              y: endY,
              handleIn: {
                x: endX - normalizedDx * handleDistance,
                y: endY - normalizedDy * handleDistance
              },
              handleOut: {
                x: endX + normalizedDx * handleDistance,
                y: endY + normalizedDy * handleDistance
              },
              id: generateUniqueId()
            });
          }
        } else {
          // If there's no previous point, just add this one
          points.push({
            x: endX,
            y: endY,
            handleIn: { x: endX, y: endY },
            handleOut: { x: endX, y: endY },
            id: generateUniqueId()
          });
        }
        
        currentX = endX;
        currentY = endY;
      } else if ((type === 'Z' || type === 'z') && points.length > 1) {
        // Close path - connect back to the first point
        // Only add if needed - avoid unnecessary complexity
        if (simplify) {
          // For simplified paths, just set a connection flag
          // and don't add extra points
          continue;
        }
        
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        // Only add closing segment if we're not already at the start point
        if (Math.abs(lastPoint.x - firstPoint.x) > 1 || Math.abs(lastPoint.y - firstPoint.y) > 1) {
          const dx = firstPoint.x - lastPoint.x;
          const dy = firstPoint.y - lastPoint.y;
          
          if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx*dx + dy*dy);
            const normalizedDx = dx / length;
            const normalizedDy = dy / length;
            const handleDistance = Math.min(length / 3, 30);
            
            // Set the out handle of last point along the closing line
            lastPoint.handleOut = {
              x: lastPoint.x + normalizedDx * handleDistance,
              y: lastPoint.y + normalizedDy * handleDistance
            };
            
            // Update the in handle of first point to match the curve
            firstPoint.handleIn = {
              x: firstPoint.x - normalizedDx * handleDistance,
              y: firstPoint.y - normalizedDy * handleDistance
            };
          }
        }
      }
    }
  } catch (error) {
    console.error('Error converting path to points:', error);
  }
  
  return points;
}
