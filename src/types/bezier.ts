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
  fill?: string; // Hacer opcional o proporcionar default
  opacity?: number; // Hacer opcional o proporcionar default
  lineCap?: string; // Hacer opcional o proporcionar default ('round', 'butt', 'square')
  lineJoin?: string; // Hacer opcional o proporcionar default ('round', 'bevel', 'miter')
  dashArray?: string; // Hacer opcional o proporcionar default (ej: "5 5")
}

export interface CurveConfig {
  styles: CurveStyle[]; // Array de estilos para curvas paralelas
  parallelCount: number; // Número de curvas paralelas
  spacing: number; // Espaciado entre curvas paralelas
}

export interface BackgroundImage {
  url: string;
  opacity: number; // Ya definido aquí, no es necesario en CurveStyle general
  name?: string; // Opcional: nombre del archivo de imagen
}


export interface TransformSettings {
  rotation: number; // En grados
  scaleX: number; // Factor de escala horizontal
  scaleY: number; // Factor de escala vertical
  // Podría incluir skewX, skewY si es necesario
}

// Interfaz para los objetos Bézier individuales en el canvas
export interface BezierObject {
  id: string; // Identificador único del objeto
  name: string; // Nombre del objeto (ej: "Capa 1")
  points: ControlPoint[]; // Array de puntos de control que definen la curva
  curveConfig: CurveConfig; // Configuración de estilo y paralelas
  transform: TransformSettings; // Transformaciones aplicadas al objeto
  isSelected: boolean; // Estado de selección
  position?: { x: number, y: number }; // Posición global del objeto (si aplica)
  showControlPoints?: boolean; // Para UI: mostrar/ocultar puntos de control
  // Otros metadatos específicos del objeto si son necesarios
}

// Interfaz para la estructura completa de datos de un diseño (lo que se guarda/carga)
export interface DesignData {
  objects: BezierObject[]; // Array de todos los objetos Bézier en el diseño
  backgroundImage?: BackgroundImage | null; // Información de la imagen de fondo (opcional)
  // 'points' aquí es para compatibilidad hacia atrás, el formato nuevo usa 'objects'
  points?: ControlPoint[]; // Solo si necesitas cargar formatos MUY antiguos
  // Podrías añadir aquí metadatos del diseño: versión, dimensiones del canvas guardado, etc.
  // canvasWidth?: number;
  // canvasHeight?: number;
  // version?: string;
}

// Interfaz para representar un diseño tal como se guarda/recupera de la BD (Supabase)
export interface SavedDesign {
  id: string; // ID de la fila en Supabase (UUID)
  name: string; // Nombre del diseño guardado
  user_id?: string; // ID del usuario propietario (si aplica)
  svg_content?: string | null; // Columna antigua o alternativa, si existe
  thumbnail?: string | null; // URL o base64 de la miniatura (opcional)
  created_at?: string; // Timestamp de creación
  updated_at?: string; // Timestamp de última modificación
  shapes_data: string | null; // Cadena JSON representando DesignData (prioriza '{objects:[...]}')
  original_svg: string | null; // <--- ¡CAMBIO APLICADO AQUÍ! Almacena el SVG original si existe
  category?: string; // Campo de categoría añadido
  // Añade cualquier otro campo de tu tabla 'designs'
}


// --- Otros Tipos para la Interfaz y Estado ---

export enum ControlPointType {
  MAIN = "main",
  HANDLE_IN = "handleIn",
  HANDLE_OUT = "handleOut"
}

// Representa un punto específico seleccionado en la interfaz
export interface SelectedPoint {
  objectId: string; // ID del BezierObject al que pertenece el punto
  pointIndex: number; // Índice del ControlPoint dentro del array points del objeto
  type: ControlPointType; // Si es el punto principal o uno de sus manejadores
}

// Para el rectángulo de selección múltiple
export interface SelectionRect {
  startX: number;
  startY: number;
  width: number;
  height: number;
}

// Configuración del zoom y paneo del canvas
export interface ZoomSettings {
  level: number; // Nivel de zoom (1 = 100%)
  offsetX: number; // Desplazamiento horizontal del canvas
  offsetY: number; // Desplazamiento vertical del canvas
}

// Para el portapapeles interno (copiar/pegar objetos)
export interface ClipboardData {
  objects: BezierObject[]; // Objetos copiados
  timestamp: number; // Marca de tiempo de la copia
}

// Para el historial de deshacer/rehacer
export interface HistoryState {
  objects: BezierObject[]; // Estado de los objetos en ese punto del historial
  backgroundImage?: BackgroundImage | null; // Estado de la imagen de fondo
  timestamp: number; // Marca de tiempo del estado
}