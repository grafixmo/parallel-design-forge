
import React from 'react';
import { Button } from '@/components/ui/button';
import { BezierObject, CurveStyle, CurveConfig, TransformSettings } from '@/types/bezier';
import { Plus, Trash, Copy, Edit, Eye, EyeOff } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ObjectsPanelProps {
  objects: BezierObject[];
  selectedObjectIds: string[];
  onCreateObject: () => void;
  onSelectObject: (objectId: string, multiSelect: boolean) => void;
  onDeleteObject: (objectId: string) => void;
  onDeleteSelectedObjects: () => void;
  onRenameObject: (objectId: string, name: string) => void;
}

const ObjectsPanel: React.FC<ObjectsPanelProps> = ({
  objects,
  selectedObjectIds,
  onCreateObject,
  onSelectObject,
  onDeleteObject,
  onDeleteSelectedObjects,
  onRenameObject
}) => {
  const [editingObjectId, setEditingObjectId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState<string>('');
  
  const handleStartRename = (object: BezierObject) => {
    setEditingObjectId(object.id);
    setEditName(object.name);
  };
  
  const handleFinishRename = () => {
    if (editingObjectId && editName.trim()) {
      onRenameObject(editingObjectId, editName.trim());
      setEditingObjectId(null);
      setEditName('');
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishRename();
    } else if (e.key === 'Escape') {
      setEditingObjectId(null);
      setEditName('');
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle>Objects</CardTitle>
          <div className="flex space-x-2">
            {selectedObjectIds.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                  >
                    <Trash className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Selected Objects</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedObjectIds.length} selected objects? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDeleteSelectedObjects}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onCreateObject}
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </div>
        <CardDescription>
          Create and manage bezier objects
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {objects.length === 0 ? (
            <div className="text-center p-4 text-sm text-gray-500">
              No objects created yet. Click "New" to create your first object, then continue clicking to add more points.
            </div>
          ) : (
            objects.map((object) => (
              <div 
                key={object.id}
                className={`border rounded-md p-2 ${
                  selectedObjectIds.includes(object.id) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200'
                }`}
                onClick={() => onSelectObject(object.id, false)}
              >
                <div className="flex items-center justify-between">
                  {editingObjectId === object.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={handleKeyPress}
                      className="h-7 text-sm"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: object.curveConfig.styles[0].color }}></div>
                      <span className="font-medium text-sm">{object.name}</span>
                      <span className="text-xs text-gray-500">
                        ({object.points.length} points)
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(object);
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Object</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{object.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteObject(object.id);
                            }}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {object.points.length < 2 ? (
                    <div className="text-amber-500">
                      Need at least 2 points. Keep clicking on canvas to add more.
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
      <CardFooter className="text-xs text-gray-500 pt-1">
        {objects.length > 0 ? (
          <p>Click objects to select, Shift+click for multiple. Right-click or double-click to finish drawing.</p>
        ) : (
          <p>Click anywhere on the canvas to start drawing. Add at least 2 points per object.</p>
        )}
      </CardFooter>
    </Card>
  );
};

export default ObjectsPanel;

