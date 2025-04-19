export interface Point {
  x: number;
  y: number;
}

export interface ControlPoint {
  x: number;
  y: number;
  handleIn: Point;
  handleOut: Point;
  id: string;
}

export interface CurveStyle {
  color: string;
  width: number;
  // Add missing properties referenced in the code
  fill?: string;
  opacity?: number;
  lineCap?: string;
  lineJoin?: string;
  dashArray?: string;
}

export interface CurveConfig {
  styles: CurveStyle[];
  parallelCount: number;
  spacing: number;
}

export interface BackgroundImage {
  url: string;
  opacity: number;
  format?: 'jpg' | 'png' | 'svg';  // Added format field
}

export interface TransformSettings {
  rotation: number;
  scaleX: number;
  scaleY: number;
}

// New interfaces for individual bezier objects
export interface BezierObject {
  id: string;
  points: ControlPoint[];
  curveConfig: CurveConfig;
  transform: TransformSettings;
  name: string;
  isSelected: boolean;
  // Add missing properties referenced in the code
  position?: { x: number, y: number };
  showControlPoints?: boolean;
}

export interface DesignData {
  objects: BezierObject[];
  backgroundImage?: BackgroundImage;
  points?: ControlPoint[]; // Added for backward compatibility with old format
}

export interface SavedDesign {
  id?: string;
  name: string;
  category: string;
  shapes_data: string; // JSON stringified DesignData
  svg_content?: string; // Added missing property
  created_at?: string;
  updated_at?: string;
}

export enum ControlPointType {
  MAIN = "main",
  HANDLE_IN = "handleIn",
  HANDLE_OUT = "handleOut"
}

export interface SelectedPoint {
  objectId: string;
  pointIndex: number;
  type: ControlPointType;
}

export interface SelectionRect {
  startX: number;
  startY: number;
  width: number;
  height: number;
}

export interface ZoomSettings {
  level: number;
  offsetX: number;
  offsetY: number;
}

export interface ClipboardData {
  objects: BezierObject[];
  timestamp: number;
}

export interface HistoryState {
  objects: BezierObject[];
  timestamp: number;
}

// New interfaces for grouped objects
export interface ObjectGroup {
  id: string;
  objectIds: string[];
  name: string;
  isSelected: boolean;
}

// Add the missing SelectionTool type that's being imported
export type SelectionTool = 'none' | 'rectangle' | 'lasso' | 'direct';
