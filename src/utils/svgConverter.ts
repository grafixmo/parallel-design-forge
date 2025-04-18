
/**
 * Converts various data formats to valid SVG
 */
export function convertToValidSVG(data: string): string | null {
  try {
    // First, normalize the data to ensure it's a string
    if (typeof data !== 'string') {
      try {
        data = JSON.stringify(data);
      } catch (e) {
        console.error('Failed to stringify non-string data:', e);
        return null;
      }
    }
    
    // Try to parse the data
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch (e) {
      // If it's already valid SVG, just return it
      if (data.includes('<svg') || data.startsWith('<?xml')) {
        return data;
      }
      console.error('Failed to parse data:', e);
      return null;
    }
    
    // If not an array, return null
    if (!Array.isArray(parsedData)) {
      console.error('Data is not an array:', parsedData);
      return null;
    }
    
    // Create SVG content
    let svgContent = '';
    
    // Determine width and height from the data if possible
    let width = 800;
    let height = 600;
    let viewBox = "0 0 800 600";
    
    // Check for explicit width/height in the first object
    if (parsedData[0] && (parsedData[0].width || parsedData[0].height)) {
      width = parsedData[0].width || width;
      height = parsedData[0].height || height;
      viewBox = `0 0 ${width} ${height}`;
    }
    
    // Format 1: SVG path elements with 'd' attribute
    if (parsedData.some(item => item.d)) {
      parsedData.forEach(item => {
        if (item.d) {
          const stroke = item.stroke || "black";
          const fill = item.fill || "none";
          const strokeWidth = item.strokeWidth || 1;
          svgContent += `<path d="${item.d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
        }
      });
    }
    // Format 2: Bezier curve data with points array
    else if (parsedData.some(item => item.points && Array.isArray(item.points))) {
      parsedData.forEach(item => {
        if (item.points && Array.isArray(item.points)) {
          // Generate SVG path data from bezier points
          let pathData = '';
          const points = item.points;
          const isClosed = item.isClosed || false;
          
          for (let i = 0; i < points.length; i++) {
            const point = points[i];
            
            if (i === 0) {
              // Move to first point
              pathData += `M ${point.x},${point.y} `;
            } else {
              const prevPoint = points[i-1];
              
              // Check if this point has control points
              if (point.controlPoint1 && prevPoint.controlPoint2) {
                // Cubic bezier curve
                pathData += `C ${prevPoint.controlPoint2.x},${prevPoint.controlPoint2.y} ${point.controlPoint1.x},${point.controlPoint1.y} ${point.x},${point.y} `;
              } else if (point.controlPoint1) {
                // Quadratic bezier curve
                pathData += `Q ${point.controlPoint1.x},${point.controlPoint1.y} ${point.x},${point.y} `;
              } else {
                // Line to
                pathData += `L ${point.x},${point.y} `;
              }
            }
          }
          
          // Close the path if needed
          if (isClosed) {
            pathData += 'Z';
          }
          
          const stroke = item.stroke || "black";
          const fill = item.fill || "none";
          const strokeWidth = item.strokeWidth || 1;
          
          svgContent += `<path d="${pathData}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
        }
      });
    }
    // Format 3: Simple coordinate points
    else if (parsedData.some(item => item.x !== undefined && item.y !== undefined)) {
      // Convert coordinate points to SVG path
      let pathData = '';
      
      parsedData.forEach((point, index) => {
        if (index === 0) {
          pathData += `M ${point.x},${point.y} `;
        } else {
          pathData += `L ${point.x},${point.y} `;
        }
      });
      
      svgContent += `<path d="${pathData}" fill="none" stroke="black" stroke-width="1" />`;
    }
    
    // If no content was generated, return null
    if (!svgContent) {
      console.error('Could not generate SVG content from data');
      return null;
    }
    
    // Return the complete SVG document
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${svgContent}</svg>`;
    
  } catch (error) {
    console.error('Error converting to SVG:', error);
    return null;
  }
}
