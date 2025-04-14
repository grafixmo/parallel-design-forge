// SVG Worker file for processing SVG paths in a separate thread
// This version is optimized to prevent freezing during complex SVG imports

// Track original SVG viewBox for proper positioning
let svgViewBox = { x: 0, y: 0, width: 800, height: 600 };
let shouldCancel = false;

// Generate a unique ID with minimal overhead
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 11);
}

// Listen for messages from the main thread
onmessage = function(e) {
  try {
    const { paths, options, viewBox, requestId } = e.data;
    
    // Support canceling previous operations
    if (e.data.type === 'cancel') {
      shouldCancel = true;
      postMessage({ type: 'canceled', requestId: e.data.requestId });
      return;
    }
    
    // Reset cancel flag on new tasks
    shouldCancel = false;
    
    // Store viewBox information for coordinate calculations
    if (viewBox) {
      svgViewBox = viewBox;
    }
    
    // Track progress
    const totalPaths = paths.length;
    const results = [];
    
    // Process paths in smaller batches to avoid blocking the worker
    const BATCH_SIZE = Math.max(1, Math.min(5, Math.ceil(totalPaths / 10)));
    let processedCount = 0;
    
    // Send initial progress update
    postMessage({
      type: 'progress',
      progress: 0,
      processedCount: 0,
      totalPaths,
      requestId
    });
    
    // Process all paths in batches
    for (let i = 0; i < totalPaths; i += BATCH_SIZE) {
      // Check if operation should be canceled
      if (shouldCancel) {
        postMessage({
          type: 'canceled',
          requestId
        });
        return;
      }
      
      // Process the current batch
      const batch = paths.slice(i, Math.min(i + BATCH_SIZE, totalPaths));
      const batchResults = [];
      
      // Process each path in the batch
      for (let j = 0; j < batch.length; j++) {
        if (shouldCancel) break;
        
        const pathData = batch[j];
        batchResults.push(processPath(pathData, options));
      }
      
      // Add batch results to overall results
      results.push(...batchResults);
      
      // Update processed count and report progress
      processedCount += batch.length;
      
      postMessage({
        type: 'progress',
        progress: processedCount / totalPaths,
        processedCount,
        totalPaths,
        requestId
      });
      
      // Small delay to allow UI thread to process other events
      if (i + BATCH_SIZE < totalPaths) {
        setTimeout(() => {}, 0);
      }
    }
    
    // Send completed result with viewBox information
    postMessage({
      type: 'complete',
      results,
      viewBox: svgViewBox,
      requestId
    });
  } catch (error) {
    // Report error to main thread
    postMessage({
      type: 'error',
      error: error.message || 'Unknown error in SVG worker'
    });
  }
};

// Process a single SVG path - optimized to prevent freeze
function processPath(pathData, options) {
  const { path, color, width } = pathData;
  
  // Convert to points with optimized processing
  const points = convertPathToPoints(path, options?.simplifyPaths);
  
  return {
    path,
    color,
    width,
    points
  };
}

// Optimized and rewritten path parser to avoid regex bottlenecks
function convertPathToPoints(path, simplify = false) {
  // Fast array allocation - pre-allocate based on path length estimate
  const estimatedPoints = Math.max(10, Math.ceil(path.length / 10));
  const points = [];
  points.length = 0;
  
  try {
    // Parse path commands without regex - much faster
    const commands = [];
    let currentCommand = '';
    let currentType = '';
    
    // Parse commands character by character - avoid regex for better performance
    for (let i = 0; i < path.length; i++) {
      const char = path.charCodeAt(i);
      
      // If this is a command character (letter): A-Z (65-90) or a-z (97-122)
      if ((char >= 65 && char <= 90) || (char >= 97 && char <= 122)) {
        // If we already have a command in progress, save it
        if (currentCommand) {
          commands.push(currentCommand);
        }
        // Start a new command
        currentType = path[i];
        currentCommand = path[i];
      } else {
        // Add to current command
        currentCommand += path[i];
      }
    }
    
    // Add the last command if there is one
    if (currentCommand) {
      commands.push(currentCommand);
    }
    
    // Process each command with minimal object allocations
    let currentX = 0;
    let currentY = 0;
    let firstPointX = 0; // For closing paths
    let firstPointY = 0;
    let firstId = null;
    
    const skipHandles = simplify && commands.length > 100; // Skip detailed handles for very complex paths
    
    for (let i = 0; i < commands.length; i++) {
      // Check if operation should be canceled
      if (shouldCancel) return points;
      
      const command = commands[i];
      const type = command.charAt(0);
      
      // Parse arguments without regex when possible - split by whitespace or comma
      const argsStr = command.substring(1).trim();
      const args = [];
      let currentArg = '';
      let inNumber = false;
      
      // Manual number parsing - faster than regex
      for (let j = 0; j < argsStr.length; j++) {
        const c = argsStr[j];
        
        // If digit, decimal point, or sign at start of number
        if ((c >= '0' && c <= '9') || c === '.' || 
            (c === '-' && (j === 0 || argsStr[j-1] === ' ' || argsStr[j-1] === ','))) {
          if (!inNumber) inNumber = true;
          currentArg += c;
        } 
        // If separator (space or comma)
        else if (c === ' ' || c === ',') {
          if (inNumber) {
            // End of a number
            args.push(parseFloat(currentArg));
            currentArg = '';
            inNumber = false;
          }
        }
        // Other characters - part of scientific notation or other valid number format
        else if (inNumber && (c === 'e' || c === 'E' || c === '+')) {
          currentArg += c;
        }
      }
      
      // Add the last argument if there is one
      if (currentArg) {
        args.push(parseFloat(currentArg));
      }
      
      // Process by command type - optimized for performance
      if ((type === 'M' || type === 'm') && args.length >= 2) {
        // Move command
        if (type === 'M') {
          currentX = args[0];
          currentY = args[1];
        } else {
          currentX += args[0];
          currentY += args[1];
        }
        
        // Remember first point for Z command later
        if (i === 0 || firstId === null) {
          firstPointX = currentX;
          firstPointY = currentY;
        }
        
        // Create minimal point data
        const newId = generateUniqueId();
        if (i === 0) firstId = newId;
        
        // Add first point with minimal handle computation
        const handleDist = skipHandles ? 0 : 10;
        points.push({
          x: currentX,
          y: currentY,
          handleIn: { x: currentX - handleDist, y: currentY },
          handleOut: { x: currentX + handleDist, y: currentY },
          id: newId
        });
        
        // Process subsequent moves as line segments (SVG spec)
        if (args.length > 2) {
          for (let j = 2; j < args.length; j += 2) {
            if (j + 1 < args.length) {
              if (type === 'M') {
                currentX = args[j];
                currentY = args[j + 1];
              } else {
                currentX += args[j];
                currentY += args[j + 1];
              }
              
              // Add as lineTo
              const lastPoint = points[points.length - 1];
              const dx = currentX - lastPoint.x;
              const dy = currentY - lastPoint.y;
              
              // Only add if it's a meaningful distance away
              if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                const handleDist = skipHandles ? 0 : Math.min(Math.sqrt(dx*dx + dy*dy) / 3, 20);
                
                if (dx !== 0 || dy !== 0) {
                  const length = Math.sqrt(dx*dx + dy*dy);
                  const normalizedDx = dx / length;
                  const normalizedDy = dy / length;
                  
                  // Update previous point's handle out
                  lastPoint.handleOut = {
                    x: lastPoint.x + normalizedDx * handleDist,
                    y: lastPoint.y + normalizedDy * handleDist
                  };
                  
                  // Add new point
                  points.push({
                    x: currentX,
                    y: currentY,
                    handleIn: {
                      x: currentX - normalizedDx * handleDist,
                      y: currentY - normalizedDy * handleDist
                    },
                    handleOut: {
                      x: currentX + normalizedDx * handleDist,
                      y: currentY + normalizedDy * handleDist
                    },
                    id: generateUniqueId()
                  });
                }
              }
            }
          }
        }
      } else if ((type === 'L' || type === 'l') && args.length >= 2) {
        // Line command - optimized to minimize point creation for very close points
        for (let j = 0; j < args.length; j += 2) {
          if (j + 1 < args.length) {
            let endX, endY;
            
            if (type === 'L') {
              endX = args[j];
              endY = args[j + 1];
            } else {
              endX = currentX + args[j];
              endY = currentY + args[j + 1];
            }
            
            // Only add a point if it's meaningfully far from the previous one
            const lastPoint = points[points.length - 1];
            const dx = endX - lastPoint.x;
            const dy = endY - lastPoint.y;
            
            // Skip points that are too close together in complex paths
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (simplify && distance < 2 && commands.length > 50) {
              currentX = endX;
              currentY = endY;
              continue;
            }
            
            if (lastPoint && (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1)) {
              // For lines, simple handle calculation along the line
              const handleDistance = skipHandles ? 0 : Math.min(distance / 3, 30);
              
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
            }
            
            currentX = endX;
            currentY = endY;
          }
        }
      } else if ((type === 'H' || type === 'h') && args.length >= 1) {
        // Horizontal line
        for (let j = 0; j < args.length; j++) {
          let endX;
          
          if (type === 'H') {
            endX = args[j];
          } else {
            endX = currentX + args[j];
          }
          
          const lastPoint = points[points.length - 1];
          const dx = endX - lastPoint.x;
          
          // Skip points that are too close in complex paths
          if (simplify && Math.abs(dx) < 2 && commands.length > 50) {
            currentX = endX;
            continue;
          }
          
          if (lastPoint && Math.abs(dx) > 0.1) {
            // Handle calculation for horizontal line
            const handleDistance = skipHandles ? 0 : Math.min(Math.abs(dx) / 3, 30);
            const normalizedDx = dx > 0 ? 1 : -1;
            
            lastPoint.handleOut = {
              x: lastPoint.x + normalizedDx * handleDistance,
              y: lastPoint.y
            };
            
            points.push({
              x: endX,
              y: currentY,
              handleIn: {
                x: endX - normalizedDx * handleDistance,
                y: currentY
              },
              handleOut: {
                x: endX + normalizedDx * handleDistance,
                y: currentY
              },
              id: generateUniqueId()
            });
          }
          
          currentX = endX;
        }
      } else if ((type === 'V' || type === 'v') && args.length >= 1) {
        // Vertical line
        for (let j = 0; j < args.length; j++) {
          let endY;
          
          if (type === 'V') {
            endY = args[j];
          } else {
            endY = currentY + args[j];
          }
          
          const lastPoint = points[points.length - 1];
          const dy = endY - lastPoint.y;
          
          // Skip points that are too close in complex paths
          if (simplify && Math.abs(dy) < 2 && commands.length > 50) {
            currentY = endY;
            continue;
          }
          
          if (lastPoint && Math.abs(dy) > 0.1) {
            // Handle calculation for vertical line
            const handleDistance = skipHandles ? 0 : Math.min(Math.abs(dy) / 3, 30);
            const normalizedDy = dy > 0 ? 1 : -1;
            
            lastPoint.handleOut = {
              x: lastPoint.x,
              y: lastPoint.y + normalizedDy * handleDistance
            };
            
            points.push({
              x: currentX,
              y: endY,
              handleIn: {
                x: currentX,
                y: endY - normalizedDy * handleDistance
              },
              handleOut: {
                x: currentX,
                y: endY + normalizedDy * handleDistance
              },
              id: generateUniqueId()
            });
          }
          
          currentY = endY;
        }
      } else if ((type === 'C' || type === 'c') && args.length >= 6) {
        // Cubic bezier curve - efficient point and handle calculation
        for (let j = 0; j < args.length; j += 6) {
          if (j + 5 < args.length) {
            let control1X, control1Y, control2X, control2Y, endX, endY;
            
            if (type === 'C') {
              control1X = args[j];
              control1Y = args[j + 1];
              control2X = args[j + 2];
              control2Y = args[j + 3];
              endX = args[j + 4];
              endY = args[j + 5];
            } else {
              control1X = currentX + args[j];
              control1Y = currentY + args[j + 1];
              control2X = currentX + args[j + 2];
              control2Y = currentY + args[j + 3];
              endX = currentX + args[j + 4];
              endY = currentY + args[j + 5];
            }
            
            // Update the handle of the last point
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              lastPoint.handleOut = { x: control1X, y: control1Y };
            }
            
            // Add new point with proper handles for curve
            points.push({
              x: endX,
              y: endY,
              handleIn: { x: control2X, y: control2Y },
              handleOut: { 
                x: endX + (endX - control2X), 
                y: endY + (endY - control2Y) 
              },
              id: generateUniqueId()
            });
            
            currentX = endX;
            currentY = endY;
          }
        }
      } else if ((type === 'S' || type === 's') && args.length >= 4) {
        // Smooth cubic bezier curve
        for (let j = 0; j < args.length; j += 4) {
          if (j + 3 < args.length) {
            let control2X, control2Y, endX, endY;
            let control1X, control1Y;
            
            // Calculate reflection of previous control point
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              const lastHandleOut = lastPoint.handleOut;
              
              // Reflect the previous control point
              control1X = 2 * lastPoint.x - lastHandleOut.x;
              control1Y = 2 * lastPoint.y - lastHandleOut.y;
            } else {
              control1X = currentX;
              control1Y = currentY;
            }
            
            if (type === 'S') {
              control2X = args[j];
              control2Y = args[j + 1];
              endX = args[j + 2];
              endY = args[j + 3];
            } else {
              control2X = currentX + args[j];
              control2Y = currentY + args[j + 1];
              endX = currentX + args[j + 2];
              endY = currentY + args[j + 3];
            }
            
            // Update the handle of the last point
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              lastPoint.handleOut = { x: control1X, y: control1Y };
            }
            
            // Add new point
            points.push({
              x: endX,
              y: endY,
              handleIn: { x: control2X, y: control2Y },
              handleOut: { 
                x: endX + (endX - control2X), 
                y: endY + (endY - control2Y) 
              },
              id: generateUniqueId()
            });
            
            currentX = endX;
            currentY = endY;
          }
        }
      } else if ((type === 'Q' || type === 'q') && args.length >= 4) {
        // Quadratic bezier curve
        for (let j = 0; j < args.length; j += 4) {
          if (j + 3 < args.length) {
            let controlX, controlY, endX, endY;
            
            if (type === 'Q') {
              controlX = args[j];
              controlY = args[j + 1];
              endX = args[j + 2];
              endY = args[j + 3];
            } else {
              controlX = currentX + args[j];
              controlY = currentY + args[j + 1];
              endX = currentX + args[j + 2];
              endY = currentY + args[j + 3];
            }
            
            // Convert quadratic to cubic bezier
            // Formula: CP1 = QP0 + 2/3 * (QP1 - QP0)
            //          CP2 = QP2 + 2/3 * (QP1 - QP2)
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              
              // Convert quadratic control point to cubic control points
              const cp1x = lastPoint.x + 2/3 * (controlX - lastPoint.x);
              const cp1y = lastPoint.y + 2/3 * (controlY - lastPoint.y);
              const cp2x = endX + 2/3 * (controlX - endX);
              const cp2y = endY + 2/3 * (controlY - endY);
              
              // Update last point's handle out
              lastPoint.handleOut = { x: cp1x, y: cp1y };
              
              // Add new point
              points.push({
                x: endX,
                y: endY,
                handleIn: { x: cp2x, y: cp2y },
                handleOut: { 
                  x: endX + (endX - cp2x), 
                  y: endY + (endY - cp2y) 
                },
                id: generateUniqueId()
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
        }
      } else if ((type === 'T' || type === 't') && args.length >= 2) {
        // Smooth quadratic bezier curve
        for (let j = 0; j < args.length; j += 2) {
          if (j + 1 < args.length) {
            let controlX, controlY, endX, endY;
            
            // Calculate reflection of previous control point
            if (points.length > 1) {
              const lastPoint = points[points.length - 1];
              const prevPoint = points[points.length - 2];
              
              // Calculate where the implied control point would be
              // It's the reflection of the previous quadratic control point
              // We need to convert from cubic to quadratic first
              // For a cubic curve, the quadratic control point equivalent is at:
              // QP1 = CP0 + 3/2 * (CP1 - CP0)
              const lastHandleOut = lastPoint.handleOut;
              const implied1x = lastPoint.x + 3/2 * (lastHandleOut.x - lastPoint.x);
              const implied1y = lastPoint.y + 3/2 * (lastHandleOut.y - lastPoint.y);
              
              // Reflect it
              controlX = 2 * lastPoint.x - implied1x;
              controlY = 2 * lastPoint.y - implied1y;
            } else {
              // If no previous control point, use current point
              controlX = currentX;
              controlY = currentY;
            }
            
            if (type === 'T') {
              endX = args[j];
              endY = args[j + 1];
            } else {
              endX = currentX + args[j];
              endY = currentY + args[j + 1];
            }
            
            // Convert quadratic to cubic bezier as before
            if (points.length > 0) {
              const lastPoint = points[points.length - 1];
              
              // Convert to cubic
              const cp1x = lastPoint.x + 2/3 * (controlX - lastPoint.x);
              const cp1y = lastPoint.y + 2/3 * (controlY - lastPoint.y);
              const cp2x = endX + 2/3 * (controlX - endX);
              const cp2y = endY + 2/3 * (controlY - endY);
              
              // Update last point's handle out
              lastPoint.handleOut = { x: cp1x, y: cp1y };
              
              // Add new point
              points.push({
                x: endX,
                y: endY,
                handleIn: { x: cp2x, y: cp2y },
                handleOut: { 
                  x: endX + (endX - cp2x), 
                  y: endY + (endY - cp2y) 
                },
                id: generateUniqueId()
              });
            }
            
            currentX = endX;
            currentY = endY;
          }
        }
      } else if ((type === 'A' || type === 'a') && args.length >= 7) {
        // Arc command - simplified approximation for editor
        // We'll approximate arcs with cubic beziers - not perfect but workable
        for (let j = 0; j < args.length; j += 7) {
          if (j + 6 < args.length) {
            // Extract arc parameters
            const rx = Math.abs(args[j]);
            const ry = Math.abs(args[j + 1]);
            const xAxisRotation = args[j + 2] * (Math.PI / 180);
            const largeArcFlag = args[j + 3] !== 0;
            const sweepFlag = args[j + 4] !== 0;
            let endX, endY;
            
            if (type === 'A') {
              endX = args[j + 5];
              endY = args[j + 6];
            } else {
              endX = currentX + args[j + 5];
              endY = currentY + args[j + 6];
            }
            
            // Skip arc if radii are 0 - treat as line
            if (rx < 0.01 || ry < 0.01) {
              // Just create a straight line
              const lastPoint = points[points.length - 1];
              const dx = endX - lastPoint.x;
              const dy = endY - lastPoint.y;
              
              if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                const handleDist = skipHandles ? 0 : Math.min(Math.sqrt(dx*dx + dy*dy) / 3, 30);
                
                if (dx !== 0 || dy !== 0) {
                  const length = Math.sqrt(dx*dx + dy*dy);
                  const normalizedDx = dx / length;
                  const normalizedDy = dy / length;
                  
                  lastPoint.handleOut = {
                    x: lastPoint.x + normalizedDx * handleDist,
                    y: lastPoint.y + normalizedDy * handleDist
                  };
                  
                  points.push({
                    x: endX,
                    y: endY,
                    handleIn: {
                      x: endX - normalizedDx * handleDist,
                      y: endY - normalizedDy * handleDist
                    },
                    handleOut: {
                      x: endX + normalizedDx * handleDist,
                      y: endY + normalizedDy * handleDist
                    },
                    id: generateUniqueId()
                  });
                }
              }
            } else {
              // For complex arcs in simplify mode, use a simple approximation
              if (simplify) {
                // Just create a simple curve approximation
                const lastPoint = points[points.length - 1];
                const dx = endX - lastPoint.x;
                const dy = endY - lastPoint.y;
                
                if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                  // Use a single cubic bezier as a rough approximation
                  const dist = Math.sqrt(dx*dx + dy*dy);
                  const bulge = Math.min(dist * 0.5, rx, ry) * (sweepFlag ? 1 : -1);
                  
                  // Handle out from start point
                  lastPoint.handleOut = {
                    x: lastPoint.x + dx * 0.3,
                    y: lastPoint.y + dy * 0.3 + bulge
                  };
                  
                  // New point with handle in
                  points.push({
                    x: endX,
                    y: endY,
                    handleIn: {
                      x: endX - dx * 0.3,
                      y: endY - dy * 0.3 + bulge
                    },
                    handleOut: {
                      x: endX + dx * 0.1,
                      y: endY + dy * 0.1
                    },
                    id: generateUniqueId()
                  });
                }
              } else {
                // For non-simplified mode, we would implement a more accurate conversion
                // That would require elliptical arc to bezier approximation
                // Since this is complex, we will use a simple approximation for now
                const lastPoint = points[points.length - 1];
                const dx = endX - lastPoint.x;
                const dy = endY - lastPoint.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                // Simple approximation using up to two bezier curves
                if (dist > rx * 2 || dist > ry * 2) {
                  // Use two segments for larger arcs
                  const midX = lastPoint.x + dx * 0.5;
                  const midY = lastPoint.y + dy * 0.5;
                  const bulge = Math.min(dist * 0.3, rx, ry) * (sweepFlag ? 1 : -1);
                  
                  // First segment
                  lastPoint.handleOut = {
                    x: lastPoint.x + dx * 0.25,
                    y: lastPoint.y + dy * 0.25 + bulge
                  };
                  
                  // Middle point
                  const midId = generateUniqueId();
                  points.push({
                    x: midX,
                    y: midY,
                    handleIn: {
                      x: midX - dx * 0.25,
                      y: midY - dy * 0.25 + bulge
                    },
                    handleOut: {
                      x: midX + dx * 0.25,
                      y: midY + dy * 0.25 + bulge
                    },
                    id: midId
                  });
                  
                  // End point
                  points.push({
                    x: endX,
                    y: endY,
                    handleIn: {
                      x: endX - dx * 0.25,
                      y: endY - dy * 0.25 + bulge
                    },
                    handleOut: {
                      x: endX + dx * 0.1,
                      y: endY + dy * 0.1
                    },
                    id: generateUniqueId()
                  });
                } else {
                  // Single segment for smaller arcs
                  const bulge = Math.min(dist * 0.4, rx, ry) * (sweepFlag ? 1 : -1);
                  
                  lastPoint.handleOut = {
                    x: lastPoint.x + dx * 0.33,
                    y: lastPoint.y + dy * 0.33 + bulge
                  };
                  
                  points.push({
                    x: endX,
                    y: endY,
                    handleIn: {
                      x: endX - dx * 0.33,
                      y: endY - dy * 0.33 + bulge
                    },
                    handleOut: {
                      x: endX + dx * 0.1,
                      y: endY + dy * 0.1
                    },
                    id: generateUniqueId()
                  });
                }
              }
            }
            
            currentX = endX;
            currentY = endY;
          }
        }
      } else if ((type === 'Z' || type === 'z') && points.length > 1) {
        // Close path - connect back to the first point
        // First check if we're already at the start point
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        const dx = firstPoint.x - lastPoint.x;
        const dy = firstPoint.y - lastPoint.y;
        
        // Only add closing segment if we're not already at the start point
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          const handleDist = skipHandles ? 0 : Math.min(Math.sqrt(dx*dx + dy*dy) / 3, 30);
          
          if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx*dx + dy*dy);
            const normalizedDx = dx / length;
            const normalizedDy = dy / length;
            
            // Set the out handle of last point along the closing line
            lastPoint.handleOut = {
              x: lastPoint.x + normalizedDx * handleDist,
              y: lastPoint.y + normalizedDy * handleDist
            };
            
            // Update the in handle of first point to match the curve
            firstPoint.handleIn
