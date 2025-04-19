
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BackgroundImage } from '@/types/bezier';
import { SavedBackImage, saveBackgroundImage, getBackgroundImages } from '@/services/backgroundImageService';
import { toast } from '@/hooks/use-toast';

interface BackgroundImageControlsProps {
  backgroundImage?: string;
  backgroundOpacity: number;
  onBackgroundOpacityChange: (opacity: number) => void;
  onUploadImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onSelectImage?: (image: BackgroundImage) => void;
}

export const BackgroundImageControls: React.FC<BackgroundImageControlsProps> = ({
  backgroundImage,
  backgroundOpacity,
  onBackgroundOpacityChange,
  onUploadImage,
  onRemoveImage,
  onSelectImage
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [savedImages, setSavedImages] = useState<SavedBackImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch saved images when component mounts
  useEffect(() => {
    fetchSavedImages();
  }, []);

  const fetchSavedImages = async () => {
    try {
      const images = await getBackgroundImages();
      setSavedImages(images);
    } catch (error) {
      console.error("Error fetching background images:", error);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSaveToGallery = async () => {
    if (!backgroundImage) {
      toast({
        title: "No Image",
        description: "There is no background image to save",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Generate name based on date
      const date = new Date();
      const name = `Background_${date.toISOString().split('T')[0]}_${date.getHours()}-${date.getMinutes()}`;

      const savedImage = await saveBackgroundImage(
        {
          url: backgroundImage,
          opacity: backgroundOpacity,
          format: detectImageFormat(backgroundImage)
        },
        name
      );

      if (savedImage) {
        toast({
          title: "Success",
          description: "Background image saved to gallery"
        });
        
        // Refresh the saved images list
        await fetchSavedImages();
      }
    } catch (error) {
      console.error("Error saving background image:", error);
      toast({
        title: "Error",
        description: "Failed to save background image to gallery",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to detect image format from URL
  const detectImageFormat = (url: string): 'jpg' | 'png' | 'svg' => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('image/svg')) return 'svg';
    if (lowerUrl.includes('image/png')) return 'png';
    return 'jpg';
  };

  return (
    <div className="p-4 border rounded-md">
      <div className="flex flex-col gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleUploadClick}
          className="w-full"
        >
          {backgroundImage ? 'Change Image' : 'Upload Image'}
        </Button>
        
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          accept="image/*" 
          onChange={onUploadImage}
        />
        
        {backgroundImage && (
          <>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Opacity</Label>
              <span className="text-xs text-gray-500">{Math.round(backgroundOpacity * 100)}%</span>
            </div>
            <Input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={backgroundOpacity}
              onChange={(e) => onBackgroundOpacityChange(Number(e.target.value))}
              className="mt-1"
            />
            
            <div className="flex gap-2 mt-2">
              <Button 
                variant="destructive" 
                size="sm"
                onClick={onRemoveImage}
                className="flex-1"
              >
                Remove
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSaveToGallery}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? 'Saving...' : 'Save to Gallery'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
