declare module 'mind-ar' {
  // Empty interface for module to be importable
}

// We're getting duplicate interface errors, so we'll rename this to avoid conflicts
declare module 'mind-ar/dist/mindar-image.prod.js' {
  export class MindARCompiler {
    constructor();
    compileImageTargets(images: HTMLImageElement[], callback?: (progress: number) => void): Promise<void>;
    exportData(): Promise<ArrayBuffer>;
    imageTargets: Array<{
      processedImageBitmap?: ImageBitmap;
      matchingData?: {
        points: Array<{
          x: number;
          y: number;
          score?: number;
        }>;
      };
    }>;
  }
}