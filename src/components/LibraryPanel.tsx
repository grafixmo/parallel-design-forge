
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
import { SavedDesign } from '@/types/bezier';
import { getDesigns, getDesignsByCategory } from '@/services/supabaseClient';
import { X } from 'lucide-react';
import { importSVGFromString } from '@/utils/svgExporter';

interface LibraryPanelProps {
  onClose: () => void;
  onSelectDesign: (design: SavedDesign) => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({ onClose, onSelectDesign }) => {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      
      // Validate each design and check if it's SVG
      const processedDesigns = response.data?.map(design => {
        try {
          // Ensure shapes_data is a string before any string operations
          const shapesData = design.shapes_data;
          
          // First check if shapes_data is a string
          if (typeof shapesData === 'string') {
            // Check if it's an SVG by looking for SVG tag
            if (shapesData.trim().startsWith('<svg')) {
              console.log(`Design ${design.name} is an SVG`);
              return {
                ...design,
                isSvg: true
              };
            }
            
            // Try to parse as JSON to validate
            JSON.parse(shapesData);
            return design;
          } else {
            // Handle non-string data (could be an object that was already parsed)
            console.log(`Design ${design.name} has non-string data of type ${typeof shapesData}`);
            
            // If it's already an object, we'll convert it back to a string for consistency
            if (typeof shapesData === 'object' && shapesData !== null) {
              return {
                ...design,
                shapes_data: JSON.stringify(shapesData),
                isObject: true
              };
            }
            
            // If it's undefined or null, mark it as having an error
            return {
              ...design,
              hasParseError: true
            };
          }
        } catch (parseError) {
          console.warn(`Error parsing design data for ${design.name}:`, parseError);
          // If JSON parse fails, check if it might be SVG despite not starting with <svg>
          if (typeof design.shapes_data === 'string' && design.shapes_data.includes('<svg')) {
            console.log(`Design ${design.name} contains SVG tag but in an unusual format`);
            return {
              ...design,
              isSvg: true
            };
          }
          // Still include the design even if it has parsing issues
          return {
            ...design,
            hasParseError: true
          };
        }
      }) || [];
      
      console.log(`Loaded ${processedDesigns.length} designs, including ${processedDesigns.filter(d => (d as any).isSvg).length} SVGs`);
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

  const handleSelectDesign = (design: SavedDesign) => {
    // Add diagnostic log
    console.log(`Selected design: ${design.name}, isSVG: ${(design as any).isSvg}, data length: ${typeof design.shapes_data === 'string' ? design.shapes_data.length : 'non-string'}`);
    if ((design as any).hasParseError) {
      console.warn(`Note: Design ${design.name} had parsing errors`);
    }
    
    onSelectDesign(design);
    onClose();
  };

  // Check if a string looks like SVG
  const isSvgContent = (content: any): boolean => {
    if (!content || typeof content !== 'string') return false;
    return content.trim().startsWith('<svg') || content.includes('<svg ');
  };

  // Render SVG preview safely
  const renderSvgPreview = (svgContent: string) => {
    try {
      // Create a safe version for display
      const cleanSvg = svgContent
        .replace(/script/gi, 'removed-script') // Remove potential script tags
        .replace(/on\w+=/gi, 'removed-event='); // Remove event handlers
        
      return (
        <div 
          className="w-full h-full flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: cleanSvg }}
        />
      );
    } catch (error) {
      console.error("Error rendering SVG preview:", error);
      return <div className="text-5xl text-blue-300">SVG</div>;
    }
  };

  // Get preview content for a design
  const getPreviewContent = (design: SavedDesign) => {
    if ((design as any).isSvg) {
      return isSvgContent(design.shapes_data) ? 
        renderSvgPreview(design.shapes_data as string) : 
        <div className="text-5xl text-blue-300">SVG</div>;
    } 
    
    if ((design as any).hasParseError) {
      return <div className="text-5xl text-red-300">!</div>;
    }
    
    if ((design as any).isObject) {
      return <div className="text-5xl text-green-300">✓</div>;
    }
    
    return <div className="text-5xl text-gray-300">⌘</div>;
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
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleSelectDesign(design)}
                >
                  <div className="aspect-square mb-2 border rounded flex items-center justify-center bg-gray-50 overflow-hidden">
                    {getPreviewContent(design)}
                  </div>
                  <h3 className="font-medium text-sm truncate">{design.name}</h3>
                  <p className="text-xs text-gray-500 truncate">
                    {design.category}
                    {(design as any).isSvg && " (SVG)"}
                    {(design as any).isObject && " (Object)"}
                    {(design as any).hasParseError && " (Data Error)"}
                  </p>
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
