declare module 'mind-ar' {
  export class MindARCore {
    // Add any core methods or properties here
  }
}

declare module 'mind-ar/dist/mindar-image.prod.js' {
  export class Compiler {
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
      matchingData?: any;
      tracking?: any;
    }>;
  }
}