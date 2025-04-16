// Type definitions for MindAR
declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  import * as THREE from 'three';

  export class MindARThree {
    constructor(options: {
      container: HTMLElement;
      imageTargetSrc: string;
      maxTrack?: number;
      uiLoading?: boolean;
      uiScanning?: boolean;
      uiError?: boolean;
      filterMinCF?: number;
      filterBeta?: number;
      warmupTolerance?: number;
      missTolerance?: number;
    });
    
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    
    beforeUpdate: (() => void) | null;
    
    addAnchor(targetIndex: number): {
      group: THREE.Group;
      onTargetFound: () => void;
      onTargetLost: () => void;
    };
    
    start(): Promise<void>;
    stop(): void;
    
    switchCamera(): Promise<void>;
  }
}