declare module 'mind-ar/dist/mindar-image.prod.js' {
  // Using a different name to avoid conflicts with other type definitions
  export class CompilerMindAR {
    constructor();
    
    /**
     * Compile image targets
     * @param images Array of HTMLImageElement objects to compile
     * @param callback Progress callback function
     */
    compileImageTargets(images: HTMLImageElement[], callback?: (progress: number) => void): Promise<void>;
    
    /**
     * Export compiled data as ArrayBuffer
     */
    exportData(): Promise<ArrayBuffer>;
    
    /**
     * Internal image targets data
     */
    imageTargets: Array<{
      processedImageBitmap?: ImageBitmap;
      matchingData?: {
        points: Array<{
          x: number;
          y: number;
          scale?: number;
          maxima?: boolean;
          score?: number;
        }>;
      };
    }>;
  }
}

declare module 'mind-ar' {
  export * from 'mind-ar/dist/mindar-image.prod.js';
}