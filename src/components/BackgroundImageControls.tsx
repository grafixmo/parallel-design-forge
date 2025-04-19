
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BackgroundImage } from '@/types/bezier';
import { SavedBackImage, saveBackgroundImage, getBackgroundImages, deleteBackgroundImage } from '@/services/backgroundImageService';
import { toast } from '@/hooks/use-toast';
import BackgroundImageGallery from './BackgroundImageGallery';

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
  const [showGallery, setShowGallery] = useState(false);
  const [savedImages, setSavedImages] = useState<SavedBackImage[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSavedImages();
  }, []);

  const loadSavedImages = async () => {
    const images = await getBackgroundImages();
    setSavedImages(images);
  };

  const handleSaveToGallery = async () => {
    if (!backgroundImage) {
      toast({
        title: "No Image",
        description: "There is no background image to save",
      });
      return;
    }

    // Generate name based on date
    const date = new Date();
    const name = `Background_${date.toISOString().split('T')[0]}_${date.getHours()}-${date.getMinutes()}`;

    const savedImage = await saveBackgroundImage(
      {
        url: backgroundImage,
        opacity: backgroundOpacity,
        format: 'jpg' // Default to jpg, the service will detect the actual format
      },
      name
    );

    if (savedImage) {
      setSavedImages(prev => [savedImage, ...prev]);
      toast({
        title: "Image Saved",
        description: "Background image has been saved to gallery"
      });
    }
  };

  const handleDeleteImage = async (id: string) => {
    const success = await deleteBackgroundImage(id);
    if (success) {
      setSavedImages(prev => prev.filter(img => img.id !== id));
      toast({
        title: "Image Deleted",
        description: "Background image has been removed from gallery"
      });
    }
  };

  const handleSelectImage = (image: SavedBackImage) => {
    if (onSelectImage) {
      onSelectImage({
        url: image.url,
        opacity: image.opacity,
        format: image.format
      });
    }
    setShowGallery(false);
  };

  return (
    <div className="p-4 border rounded-md">
      <Tabs defaultValue="upload">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="upload" className="flex-1">Upload</TabsTrigger>
          <TabsTrigger value="gallery" className="flex-1">Gallery</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div className="flex flex-col gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
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
                <Slider
                  value={[backgroundOpacity * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(values) => onBackgroundOpacityChange(values[0] / 100)}
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
                    className="flex-1"
                  >
                    Save to Gallery
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="gallery">
          <BackgroundImageGallery
            images={savedImages}
            onSelectImage={handleSelectImage}
            onDeleteImage={handleDeleteImage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

