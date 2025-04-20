
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageIcon, Gallery } from 'lucide-react';

interface BackgroundImagesGridProps {
  images: string[];
  onSelectImage: (image: string) => void;
  isLoading?: boolean;
}

export const BackgroundImagesGrid = ({
  images,
  onSelectImage,
  isLoading = false
}: BackgroundImagesGridProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse">Loading images...</div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Gallery className="h-12 w-12 text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">No background images available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4">
      {images.map((image, index) => (
        <Card 
          key={`${image}-${index}`}
          className="group relative overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
          onClick={() => onSelectImage(image)}
        >
          <div className="aspect-square relative">
            {image ? (
              <img
                src={image}
                alt={`Background ${index + 1}`}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-gray-100">
                <ImageIcon className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onSelectImage(image);
              }}
            >
              Select
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};
