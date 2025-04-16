// Type definitions for MindAR and Three.js integration

declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  import * as THREE from 'three';

  interface MindARThreeOptions {
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
  }

  interface MindARThreeAnchor {
    group: THREE.Group;
    onTargetFound: () => void;
    onTargetLost: () => void;
  }

  export class MindARThree {
    constructor(options: MindARThreeOptions);
    
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    
    beforeUpdate: (() => void) | null;
    
    addAnchor(targetIndex: number): MindARThreeAnchor;
    
    start(): Promise<void>;
    stop(): void;
    
    switchCamera(): Promise<void>;
  }
}

declare namespace THREE {
  class GLTFLoader {
    constructor();
    
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (error: ErrorEvent) => void
    ): void;
  }
  
  interface GLTF {
    animations: THREE.AnimationClip[];
    scene: THREE.Group;
    scenes: THREE.Group[];
    cameras: THREE.Camera[];
    asset: {
      copyright?: string;
      generator?: string;
      version?: string;
      minVersion?: string;
      extensions?: any;
      extras?: any;
    };
  }
  
  class AnimationMixer {
    constructor(root: THREE.Object3D);
    
    clipAction(clip: THREE.AnimationClip): THREE.AnimationAction;
    update(deltaTime: number): void;
  }
  
  class AnimationAction {
    play(): THREE.AnimationAction;
    pause(): THREE.AnimationAction;
    stop(): THREE.AnimationAction;
    reset(): THREE.AnimationAction;
  }
  
  class VideoTexture extends THREE.Texture {
    constructor(
      video: HTMLVideoElement,
      mapping?: THREE.Mapping,
      wrapS?: THREE.Wrapping,
      wrapT?: THREE.Wrapping,
      magFilter?: THREE.TextureFilter,
      minFilter?: THREE.TextureFilter,
      format?: THREE.PixelFormat,
      type?: THREE.TextureDataType,
      anisotropy?: number
    );
  }
}