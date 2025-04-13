
import React from 'react';
import { Button } from '@/components/ui/button';
import { BezierObject } from '@/types/bezier';
import { Plus, Trash, Edit, ChevronRight, List } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [isExpanded, setIsExpanded] = React.useState(true);
  
  const handleStartRename = (e: React.MouseEvent, object: BezierObject) => {
    e.stopPropagation();
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
    <Card className="w-full shadow-sm border-slate-200">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="px-4 py-3 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center space-x-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <div>
              <CardTitle className="text-base">Objects</CardTitle>
              <CardDescription className="text-xs">
                {objects.length} object{objects.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
          <div className="flex space-x-1 z-10">
            {selectedObjectIds.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="h-7 text-xs px-2"
                  >
                    <Trash className="h-3.5 w-3.5 mr-1" />
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
              className="h-7 text-xs px-2"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New
            </Button>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="p-2">
            <div className="space-y-1">
              {objects.length === 0 ? (
                <div className="text-center p-3 text-sm text-gray-500 bg-gray-50 rounded-md">
                  <List className="h-5 w-5 mx-auto mb-1 text-gray-400" />
                  <p>No objects yet. Click "New" to create your first object.</p>
                </div>
              ) : (
                objects.map((object) => (
                  <div 
                    key={object.id}
                    className={`flex items-center justify-between p-2 rounded-md hover:bg-gray-50 transition-colors ${
                      selectedObjectIds.includes(object.id) 
                        ? 'bg-blue-50 border-l-2 border-blue-500' 
                        : 'border-l-2 border-transparent'
                    }`}
                    onClick={() => onSelectObject(object.id, false)}
                  >
                    {editingObjectId === object.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleFinishRename}
                        onKeyDown={handleKeyPress}
                        className="h-7 text-sm"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex items-center space-x-2 overflow-hidden">
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: object.curveConfig.styles[0].color }}
                        ></div>
                        <span className="font-medium text-sm truncate max-w-[120px]">{object.name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {object.points.length} pt{object.points.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    
                    {editingObjectId !== object.id && (
                      <div className="flex items-center space-x-1 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-500 hover:text-gray-700"
                          onClick={(e) => handleStartRename(e, object)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-gray-500 hover:text-red-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash className="h-3 w-3" />
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
                    )}
                    
                    {object.points.length < 2 && (
                      <div className="absolute right-3 text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full ml-2">
                        Need more points
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
          
          <CardFooter className="px-3 py-2 border-t text-xs text-gray-500">
            {objects.length > 0 ? (
              <p>Shift+click for multiple selection</p>
            ) : (
              <p>Click on canvas to add points</p>
            )}
          </CardFooter>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default ObjectsPanel;
