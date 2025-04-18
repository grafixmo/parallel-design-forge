// src/types/bezier.ts

export interface Point {
    x: number;
    y: number;
  }
  
  export interface ControlPoint {
    x: number;
    y: number;
    handleIn: Point;
    handleOut: Point;
    id: string; // Identificador único para cada punto de control
  }
  
  export interface CurveStyle {
    color: string;
    width: number;
    fill?: string;
    opacity?: number;
    lineCap?: CanvasLineCap; // Usar tipos de Canvas directamente
    lineJoin?: CanvasLineJoin;
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
    name?: string;
  }
  
  export interface TransformSettings {
    rotation: number;
    scaleX: number;
    scaleY: number;
  }
  
  export interface BezierObject {
    id: string;
    name: string;
    points: ControlPoint[];
    curveConfig: CurveConfig;
    transform: TransformSettings;
    isSelected: boolean;
    position?: { x: number, y: number };
    showControlPoints?: boolean;
  }
  
  export interface DesignData {
    objects: BezierObject[];
    backgroundImage?: BackgroundImage | null;
    points?: ControlPoint[]; // Para compatibilidad hacia atrás
  }
  
  // Interfaz para Diseños Guardados (Tabla 'designs')
  export interface SavedDesign {
    id: string;
    name: string;
    user_id?: string; // Puede que no lo necesites si es personal
    svg_content?: string | null;
    thumbnail?: string | null;
    created_at?: string;
    updated_at?: string;
    shapes_data: string | null; // JSON stringified DesignData ('{objects:[...]}')
    original_svg: string | null; // SVG original si existe
    category?: string | null; // Hacer nullable si puede no tener categoría
  }
  
  // Interfaz para Plantillas (Tabla 'templates')
  export interface Template {
    id: string;
    name: string;
    design_data: string; // JSON stringified DesignData
    category?: string | null; // Hacer nullable
    created_at?: string;
    description?: string | null; // Hacer nullable
    thumbnail?: string | null; // Hacer nullable
    is_liked?: boolean | null; // <--- ¡CAMBIO APLICADO AQUÍ! (Nullable por si acaso)
  }
  
  
  // --- Otros Tipos para la Interfaz y Estado ---
  
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
    backgroundImage?: BackgroundImage | null;
    timestamp: number;
  }