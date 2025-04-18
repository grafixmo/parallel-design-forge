
import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Layers2 } from 'lucide-react';

interface MergeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const MergeToggle: React.FC<MergeToggleProps> = ({ enabled, onToggle }) => {
  return (
    <div className="flex items-center space-x-2">
      <Layers2 className="h-4 w-4 text-muted-foreground" />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center space-x-2">
              <Switch
                id="merge-mode"
                checked={enabled}
                onCheckedChange={onToggle}
              />
              <Label htmlFor="merge-mode">Merge Mode</Label>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>When enabled, imported designs will be added to existing canvas content</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default MergeToggle;
