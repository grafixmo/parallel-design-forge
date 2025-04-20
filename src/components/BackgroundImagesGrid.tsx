import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Trash2, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getBackgroundImages, deleteBackgroundImage, BackImage } from '@/services/backImagesClient';

interface BackgroundImagesGridProps {
  onSelectBackgroundImage: (imageUrl: string, opacity?: number) => void;
  onClose?: () => void;
}

const BackgroundImagesGrid: React.FC<BackgroundImagesGridProps> = ({ 
  onSelectBackgroundImage,
  onClose 
}) => {
  const [backgroundImages, setBackgroundImages] = useState<BackImage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<BackImage | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBackgroundImages();
  }, []);

  const fetchBackgroundImages = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('BackgroundImagesGrid: Requesting images from backImagesClient...');
      const response = await getBackgroundImages();
      
      if (response.error) {
        console.error('BackgroundImagesGrid: Error response from getBackgroundImages:', response.error);
        throw new Error(response.error.message);
      }
      
      // Make sure we have valid data before setting it
      if (Array.isArray(response.data)) {
        console.log(`BackgroundImagesGrid: Fetched ${response.data.length} background images`);
        
        // Validate image_data in each record
        const validImages = response.data.filter(img => {
          if (!img.image_data) {
            console.warn(`BackgroundImagesGrid: Image ${img.id} (${img.name}) is missing image_data`);
            return false;
          }
          
          // Check if image_data is a valid data URL
          if (!img.image_data.startsWith('data:image/')) {
            console.warn(`BackgroundImagesGrid: Image ${img.id} (${img.name}) has invalid image_data format`);
            return false;
          }
          
          return true;
        });
        
        console.log(`BackgroundImagesGrid: ${validImages.length} of ${response.data.length} images have valid image_data`);
        // Set only valid images to state instead of all images
        setBackgroundImages(validImages);
      } else {
        console.warn('BackgroundImagesGrid: No background images data returned from API');
        setBackgroundImages([]);
      }
    } catch (err) {
      setError('Failed to load background images. Please try again.');
      console.error('BackgroundImagesGrid: Error fetching background images:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBackgroundImage = (image: BackImage) => {
    if (image && image.image_data) {
      onSelectBackgroundImage(image.image_data, image.opacity || 1);
      if (onClose) {
        onClose();
      }
      toast({
        title: 'Background Image Applied',
        description: `"${image.name}" has been set as the background image.`
      });
    }
  };

  const handleOpenDeleteDialog = (image: BackImage, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent image selection
    setSelectedImage(image);
    setDeleteDialogOpen(true);
  };

  const handleDeleteBackgroundImage = async () => {
    if (!selectedImage || !selectedImage.id) return;

    try {
      const { error } = await deleteBackgroundImage(selectedImage.id);

      if (error) {
        throw new Error(error.message);
      }

      setBackgroundImages((prev) => prev.filter(img => img.id !== selectedImage.id));
      toast({
        title: 'Background Image Deleted',
        description: `"${selectedImage.name}" has been removed`
      });
    } catch (error) {
      console.error('Error deleting background image:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the background image',
        variant: 'destructive'
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedImage(null);
    }
  };

  return (
    <>
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="text-lg font-medium">Background Images</h3>
        <Button variant="outline" size="sm" onClick={fetchBackgroundImages}>
          Refresh
        </Button>
      </div>

      <ScrollArea className="h-full max-h-[400px] w-full pr-3 p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-32">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-2 text-gray-500">Loading background images...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchBackgroundImages}>
              Try Again
            </Button>
          </div>
        ) : backgroundImages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No background images found.</p>
            <p className="text-sm mt-2">Save background images to use them here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {backgroundImages.map((image) => (
              <Card
                key={image.id}
                className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleSelectBackgroundImage(image)}
              >
                <div className="aspect-square mb-2 border rounded flex items-center justify-center bg-gray-50 overflow-hidden">
                  {image.image_data ? (
                    <>
                      <img 
                        src={image.image_data} 
                        alt={image.name} 
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          console.error(`Failed to load image: ${image.name}`);
                          e.currentTarget.onerror = null;
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                        }}
                      />
                      <div className="fallback-icon hidden">
                        <Image className="h-8 w-8 text-gray-300" />
                      </div>
                    </>
                  ) : (
                    <Image className="h-8 w-8 text-gray-300" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm truncate">{image.name}</h3>
                  <button
                    onClick={(e) => handleOpenDeleteDialog(image, e)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete background image"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    {image.format?.toUpperCase() || 'IMAGE'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Background Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedImage?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedImage(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBackgroundImage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BackgroundImagesGrid;