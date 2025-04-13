
import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
  recentColors?: string[];
}

const predefinedColors = [
  '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
  '#ff8000', '#8000ff', '#00ff80', '#ff0080', '#0080ff'
];

export function ColorPicker({
  color,
  onChange,
  className,
  recentColors = []
}: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border shadow-sm",
            className
          )}
          style={{ backgroundColor: color }}
          aria-label="Pick a color"
        />
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-3" 
        align="start"
        sideOffset={5}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-md border"
              style={{ backgroundColor: color }}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="h-8"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="flex h-8 w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </div>
          
          {recentColors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Recent Colors</p>
              <div className="grid grid-cols-8 gap-1">
                {recentColors.map((c) => (
                  <button
                    key={c}
                    className="h-5 w-5 rounded-sm border border-muted"
                    style={{ backgroundColor: c }}
                    onClick={() => onChange(c)}
                  />
                ))}
              </div>
            </div>
          )}
          
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Predefined Colors</p>
            <div className="grid grid-cols-6 gap-1">
              {predefinedColors.map((c) => (
                <button
                  key={c}
                  className="h-6 w-6 rounded-sm border border-muted transition-transform hover:scale-110 hover:border-primary"
                  style={{ backgroundColor: c }}
                  onClick={() => onChange(c)}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
