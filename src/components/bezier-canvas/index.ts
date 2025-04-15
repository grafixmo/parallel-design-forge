
import BezierCanvas from './BezierCanvas';
import BezierCanvasContainer from './BezierCanvasContainer';

// Import from our new SVG utilities
import { 
  importSVG, 
  readSVGFile, 
  exportSVG, 
  downloadSVG,
  fetchSvgFromSupabase, 
  importSVGFromSupabase 
} from '@/utils/svg';

export { 
  BezierCanvas, 
  importSVG, 
  exportSVG, 
  downloadSVG, 
  readSVGFile,
  fetchSvgFromSupabase,
  importSVGFromSupabase
};
export default BezierCanvasContainer;
