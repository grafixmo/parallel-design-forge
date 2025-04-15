
import { createDesignSVG, downloadSVG } from './svgExporter';

/**
 * Export current design to SVG and download it
 * @param objects The bezier objects to export
 * @param width Canvas width
 * @param height Canvas height
 * @param fileName Optional file name for download
 */
export const exportSVG = (objects: any[], width: number = 800, height: number = 600): string => {
  return createDesignSVG(objects, width, height);
};

export {
  createDesignSVG,
  downloadSVG
};
