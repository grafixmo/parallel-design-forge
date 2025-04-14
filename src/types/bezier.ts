
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

// New interfaces for individual bezier objects
export interface BezierObject {
  id: string;
  points: ControlPoint[];
  curveConfig: CurveConfig;
  transform: TransformSettings;
  name: string;
  isSelected: boolean;
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

// Enhanced SVG import/export options
export interface SVGImportOptions {
  replaceExisting: boolean;
  importStyle: boolean;
  simplifyPaths?: boolean;
  preserveViewBox?: boolean;
  fitToCanvas?: boolean; // New option to fit imported SVG to canvas
  centerOnCanvas?: boolean; // New option to center the imported SVG
  targetWidth?: number; // Optional target width for scaling
  targetHeight?: number; // Optional target height for scaling
}

export interface SVGExportOptions {
  includeBackground: boolean;
  includeBorder: boolean;
  embedFonts: boolean;
}
