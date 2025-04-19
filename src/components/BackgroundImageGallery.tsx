
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SavedBackImage } from '@/services/backgroundImageService';
import { Trash2 } from 'lucide-react';

interface BackgroundImageGalleryProps {
  images: SavedBackImage[];
  onSelectImage: (image: SavedBackImage) => void;
  onDeleteImage: (id: string) => void;
}

const BackgroundImageGallery: React.FC<BackgroundImageGalleryProps> = ({
  images,
  onSelectImage,
  onDeleteImage,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
      {images.map((image) => (
        <Card
          key={image.id}
          className="p-2 hover:shadow-md transition-shadow cursor-pointer relative group"
          onClick={() => onSelectImage(image)}
        >
          <div className="aspect-square mb-2 border rounded flex items-center justify-center bg-gray-50 overflow-hidden">
            <img
              src={image.url}
              alt={image.name}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm truncate flex-1">{image.name}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteImage(image.id!);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default BackgroundImageGallery;
