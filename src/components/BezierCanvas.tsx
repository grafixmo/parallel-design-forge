const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
  // Prevent default scrolling behavior
  e.preventDefault();
  
  const canvas = canvasRef.current;
  if (!canvas) return;
  
  // Get mouse position
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // Get mouse position in canvas coordinates before zoom change
  const mouseCanvasPos = screenToCanvas(mouseX, mouseY);
  
  // Change zoom based on wheel direction
  const delta = e.deltaY > 0 ? -ZOOM_FACTOR : ZOOM_FACTOR;
  const newZoom = Math.max(0.1, Math.min(5, zoom + delta));
  
  // Set new zoom
  setZoom(newZoom);
  
  // Adjust pan offset to zoom toward/away from mouse position
  if (newZoom !== zoom) {
    // Calculate new offset to keep the point under the mouse in the same position
    const newPanOffset = {
      x: mouseX - mouseCanvasPos.x * newZoom,
      y: mouseY - mouseCanvasPos.y * newZoom
    };
    
    setPanOffset(newPanOffset);
    
    // Show zoom notification
    toast({
      title: e.deltaY > 0 ? "Zoom Out" : "Zoom In",
      description: `Zoom: ${Math.round(newZoom * 100)}%`
    });
  }
};

// Add keyboard event listeners for shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Space key for panning
    if (e.code === 'Space' && !isSpacePressed) {
      setIsSpacePressed(true);
      document.body.style.cursor = 'grab';
    }
    
    // Escape key to cancel drawing
    if (e.code === 'Escape' && currentDrawingObjectId) {
      cancelDrawing();
    }
    
    // Delete key to remove selected objects
    if ((e.code === 'Delete' || e.code === 'Backspace') && selectedObjectIds.length > 0) {
      // This would typically call a delete function in the parent component
      // Assuming there is an onDeleteSelectedObjects prop
      // onDeleteSelectedObjects();
    }
    
    // Ctrl+Z for undo
    if (e.ctrlKey && e.code === 'KeyZ') {
      onUndo();
    }
  };
  
  const handleKeyUp = (e: KeyboardEvent) => {
    // Space key released
    if (e.code === 'Space') {
      setIsSpacePressed(false);
      document.body.style.cursor = 'default';
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, [isSpacePressed, currentDrawingObjectId, selectedObjectIds, onUndo, cancelDrawing]);

return (
  <div className="relative" ref={wrapperRef}>
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <div className="bg-white/80 p-2 rounded-md shadow-md">
        <p className="text-sm">{instructionMessage}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={handleZoomIn} title="Zoom In">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleResetView} title="Reset View">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onUndo} title="Undo">
          <Undo className="h-4 w-4" />
        </Button>
      </div>
    </div>
    
    <canvas
      ref={canvasRef}
      className="bg-white"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    />
  </div>
);
};

export default BezierCanvas;
