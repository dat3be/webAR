declare module '@maherboughdiri/mind-ar-compiler' {
  export interface ImageData {
    buffer: Buffer;
    fileName: string;
  }

  class MindARCompiler {
    constructor();
    compileImageTargets(images: any[]): Promise<void>;
    exportData(): Promise<Buffer>;
  }

  export default MindARCompiler;
}