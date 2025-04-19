// Add this import at the top of your imports section
import { saveBackgroundImageToGallery } from './TransformFixes';

// ... rest of imports and code ...

{showBackgroundControls && (
  <BackgroundImageControls
    backgroundImage={backgroundImage}
    backgroundOpacity={backgroundOpacity}
    onBackgroundOpacityChange={handleBackgroundOpacityChange}
    onUploadImage={handleImageUpload}
    onRemoveImage={handleRemoveBackground}
    onSaveToGallery={(image) => saveBackgroundImageToGallery(
      image, 
      (window as any).saveDesignToLibrary
    )}
  />
)}

// ... rest of the component code ...
