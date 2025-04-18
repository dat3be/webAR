declare module '@maherboughdiri/mind-ar-compiler' {
  export interface ImageData {
    buffer: Buffer;
    fileName: string;
  }

  export class MindARCompiler {
    constructor();
    compileImageTargets(images: ImageData[]): Promise<void>;
    exportData(): Promise<Buffer>;
  }
}