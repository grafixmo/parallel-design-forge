
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SavedDesign, BezierObject, DesignData } from '@/types/bezier';
import { getDesigns, getDesignsByCategory } from '@/services/supabaseClient';
import { X } from 'lucide-react';
import { convertShapesDataToObjects } from '@/utils/bezierUtils';
import { useToast } from '@/hooks/use-toast';

interface LibraryPanelProps {
  onClose: () => void;
  onSelectDesign: (design: SavedDesign) => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({ onClose, onSelectDesign }) => {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDesigns();
  }, [selectedCategory]);

  const fetchDesigns = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let response;
      
      if (selectedCategory === 'all') {
        response = await getDesigns();
      } else {
        response = await getDesignsByCategory(selectedCategory);
      }
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      // Process each design to validate its content before displaying
      const processedDesigns = (response.data || []).map((design: SavedDesign) => {
        try {
          // Ensure shapes_data is a string before trying to parse it
          if (design.shapes_data) {
            if (typeof design.shapes_data !== 'string') {
              // If it's already an object, stringify it
              console.log('Found non-string data in design:', design.id);
              design.shapes_data = JSON.stringify(design.shapes_data);
            }
            
            // Test parsing to validate JSON
            JSON.parse(design.shapes_data);
          }
          return design;
        } catch (err) {
          console.error(`Invalid JSON in design ${design.id}:`, err);
          return {
            ...design,
            hasError: true // Mark designs with invalid data
          };
        }
      });
      
      setDesigns(processedDesigns);
    } catch (err) {
      setError('Failed to load designs. Please try again.');
      console.error('Error fetching designs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const validateAndSelectDesign = (design: SavedDesign) => {
    try {
      // Check if design was marked as having an error
      if ((design as any).hasError) {
        throw new Error('This design contains invalid data');
      }
      
      // Ensure we have some data to work with
      if (!design.shapes_data) {
        throw new Error('Design contains no data');
      }
      
      let parsedData;
      
      // Handle the case where shapes_data might already be an object
      if (typeof design.shapes_data === 'string') {
        parsedData = JSON.parse(design.shapes_data);
      } else {
        console.warn('Design data was not a string, using as-is');
        parsedData = design.shapes_data;
      }
      
      console.log('Design data format:', parsedData);
      
      // Validate the data before proceeding
      let validFormat = false;
      let objectCount = 0;
      let bezierObjects: BezierObject[] = [];
      
      // Check if we have an array of shapes or objects
      if (Array.isArray(parsedData)) {
        // Try to pre-process the data with our utility function
        bezierObjects = convertShapesDataToObjects(parsedData);
        objectCount = bezierObjects.length;
        validFormat = objectCount > 0;
        
        console.log(`Converted design to ${objectCount} objects`);
      } 
      // Check if it's an object with the DesignData structure
      else if (typeof parsedData === 'object' && parsedData !== null) {
        if (parsedData.objects && Array.isArray(parsedData.objects)) {
          bezierObjects = parsedData.objects;
          objectCount = bezierObjects.length;
          validFormat = objectCount > 0;
        } else if (parsedData.points && Array.isArray(parsedData.points)) {
          // Legacy format with just points - create a single object
          objectCount = 1;
          validFormat = parsedData.points.length > 0;
        }
      }
      
      // If the format is valid, proceed with selecting the design
      if (validFormat) {
        // Add preserveOriginalProperties flag to indicate this is an imported design
        design.preserveOriginalProperties = true;
        onSelectDesign(design);
        onClose();
        return;
      }
      
      // If we couldn't validate the format, show an error
      throw new Error(`Could not process design format. Object count: ${objectCount}`);
    } catch (err) {
      console.error('Error validating design:', err);
      setError(`Failed to load design "${design.name}". The format may be incompatible.`);
      
      toast({
        title: 'Format Error',
        description: `Design "${design.name}" has an incompatible format. Please try another design.`,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Design Library</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-4 border-b">
          <div className="flex items-center space-x-4">
            <div className="w-40">
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Collares">Collares</SelectItem>
                  <SelectItem value="Anillos">Anillos</SelectItem>
                  <SelectItem value="Pendientes">Pendientes</SelectItem>
                  <SelectItem value="Prototipos">Prototipos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" size="sm" onClick={fetchDesigns}>
              Refresh
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-2 text-gray-500">Loading designs...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={fetchDesigns}>
                Try Again
              </Button>
            </div>
          ) : designs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No designs found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {designs.map((design) => (
                <Card
                  key={design.id}
                  className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${(design as any).hasError ? 'opacity-50' : ''}`}
                  onClick={() => validateAndSelectDesign(design)}
                >
                  <div className="aspect-square mb-2 border rounded flex items-center justify-center bg-gray-50">
                    <div className="text-5xl text-gray-300">⌘</div>
                  </div>
                  <h3 className="font-medium text-sm truncate">{design.name}</h3>
                  <p className="text-xs text-gray-500 truncate">{design.category}</p>
                  {(design as any).hasError && (
                    <p className="text-xs text-red-500 mt-1">Invalid format</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LibraryPanel;
