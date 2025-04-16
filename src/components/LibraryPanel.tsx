
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
import { getDesigns, getDesignsByCategory, updateDesign } from '@/services/supabaseClient';
import { X } from 'lucide-react';
import { importSVGFromString } from '@/utils/svgExporter';
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
      
      // Validate and normalize each design
      const processedDesigns = await Promise.all((response.data || []).map(async (design) => {
        try {
          // Store original data type for debugging
          const originalDataType = typeof design.shapes_data;
          
          // Ensure shapes_data is a string
          let normalizedData: string;
          let dataFormat: 'json' | 'svg' | 'invalid' = 'invalid';
          let needsUpdate = false;
          
          if (typeof design.shapes_data === 'string') {
            normalizedData = design.shapes_data;
            
            // Check if it's an SVG
            if (normalizedData.trim().startsWith('<svg') || normalizedData.includes('<svg ')) {
              dataFormat = 'svg';
            } else {
              // Try to parse as JSON to validate
              try {
                JSON.parse(normalizedData);
                dataFormat = 'json';
              } catch (parseError) {
                console.warn(`Design ${design.name} has invalid JSON data`);
              }
            }
          } else if (typeof design.shapes_data === 'object' && design.shapes_data !== null) {
            // Convert object to string for consistency
            normalizedData = JSON.stringify(design.shapes_data);
            dataFormat = 'json';
            needsUpdate = true; // Flag for database update
            
            // Auto-fix: update the design in the database with stringified data
            if (design.id && needsUpdate) {
              try {
                console.log(`Fixing design ${design.name} with ID ${design.id} - converting object to JSON string`);
                const updateResult = await updateDesign(design.id, { 
                  shapes_data: normalizedData 
                });
                
                if (updateResult.error) {
                  console.error(`Failed to fix design ${design.name}:`, updateResult.error);
                } else {
                  console.log(`Successfully fixed design ${design.name}`);
                }
              } catch (updateError) {
                console.error(`Error updating design ${design.name}:`, updateError);
              }
            }
          } else {
            // Unknown data type, set as empty string to prevent errors
            normalizedData = '';
            console.warn(`Design ${design.name} has invalid shapes_data of type ${typeof design.shapes_data}`);
          }
          
          return {
            ...design,
            shapes_data: normalizedData,
            originalDataType,
            isSvg: dataFormat === 'svg',
            isJson: dataFormat === 'json',
            isInvalid: dataFormat === 'invalid',
            needsFixing: needsUpdate
          };
        } catch (processError) {
          console.warn(`Error processing design ${design.name}:`, processError);
          return {
            ...design,
            hasParseError: true,
            isInvalid: true
          };
        }
      }));
      
      const fixedDesignsCount = processedDesigns.filter(d => (d as any).needsFixing).length;
      if (fixedDesignsCount > 0) {
        toast({
          title: "Database Cleanup",
          description: `Fixed ${fixedDesignsCount} designs with incorrect data format`,
        });
      }
      
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
    
    if ((design as any).isJson) {
      return <div className="text-5xl text-green-300">✓</div>;
    }
    
    if ((design as any).hasParseError || (design as any).isInvalid) {
      return <div className="text-5xl text-red-300">!</div>;
    }
    
    return <div className="text-5xl text-gray-300">⌘</div>;
  };

  // Get status label for design
  const getStatusLabel = (design: SavedDesign) => {
    if ((design as any).isSvg) return "SVG";
    if ((design as any).isJson) return "JSON";
    if ((design as any).needsFixing) return "Fixed";
    if ((design as any).hasParseError) return "Error";
    return design.category || "";
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
                    {getStatusLabel(design)}
                    {(design as any).needsFixing && " (Auto-Fixed)"}
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
