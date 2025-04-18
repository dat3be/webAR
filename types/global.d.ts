/**
 * Global declaration file for extending Window interface
 * to support the MindAR library loaded from CDN
 */
interface Window {
  MINDAR?: {
    IMAGE?: {
      Compiler?: new () => {
        compileImageTargets: (images: HTMLImageElement[], callback?: (progress: number) => void) => Promise<void>;
        exportData: () => Promise<ArrayBuffer>;
      };
    };
  };
}