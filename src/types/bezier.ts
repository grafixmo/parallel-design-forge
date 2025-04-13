
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

// New type to represent a group of points (a single object)
export interface PointGroup {
  id: string;
  points: ControlPoint[];
}

export interface CurveStyle {
  color: string;
  width: number;
}

export interface CurveConfig {
  styles: CurveStyle[];
  parallelCount: number;
  spacing: number;
}

export interface BackgroundImage {
  url: string;
  opacity: number;
}

export interface TransformSettings {
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface DesignData {
  pointGroups: PointGroup[];
  curveConfig: CurveConfig;
  transform: TransformSettings;
  backgroundImage?: BackgroundImage;
}

export interface SavedDesign {
  id?: string;
  name: string;
  category: string;
  shapes_data: string; // JSON stringified DesignData
  created_at?: string;
  updated_at?: string;
}

export enum ControlPointType {
  MAIN = "main",
  HANDLE_IN = "handleIn",
  HANDLE_OUT = "handleOut"
}

export interface SelectedPoint {
  groupIndex: number;
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
  points: ControlPoint[];
  timestamp: number;
}

export interface HistoryState {
  pointGroups: PointGroup[];
  timestamp: number;
}
