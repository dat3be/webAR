import { useEffect, useRef, useState } from 'react';
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import * as THREE from 'three';
import { Loader2, AlertCircle } from 'lucide-react';

// We'll use the built-in loader from MindAR for compatibility
// @ts-ignore
const GLTFLoader = window.THREE?.GLTFLoader || THREE.GLTFLoader;

interface MindARViewerProps {
  mindFileUrl: string;
  modelUrl: string; 
  contentType: 'video' | '3d-model';
  onTargetFound?: () => void;
  onTargetLost?: () => void;
}

export function MindARViewer({ 
  mindFileUrl, 
  modelUrl, 
  contentType,
  onTargetFound,
  onTargetLost
}: MindARViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const arSystemRef = useRef<MindARThree | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Initialize MindAR
  useEffect(() => {
    // Clean up function to stop AR when component unmounts
    const cleanup = () => {
      if (arSystemRef.current) {
        arSystemRef.current.stop();
      }
      
      if (rendererRef.current && rendererRef.current.domElement) {
        try {
          rendererRef.current.dispose();
          
          // Remove any canvas elements added to the container
          if (containerRef.current) {
            const canvases = containerRef.current.querySelectorAll('canvas');
            canvases.forEach(canvas => canvas.remove());
          }
        } catch (e) {
          console.error('Error during cleanup:', e);
        }
      }
    };

    // Don't attempt to initialize if already loading or there's an error
    if (!isLoading && error) {
      return cleanup;
    }

    // Initialize AR scene
    const initAR = async () => {
      if (!containerRef.current) return;
      setIsLoading(true);
      setError(null);

      try {
        // Clean up any previous instances
        cleanup();

        console.log('Initializing MindAR with mind file:', mindFileUrl);

        // Create AR system
        const mindarThree = new MindARThree({
          container: containerRef.current,
          imageTargetSrc: mindFileUrl,
          uiLoading: false,
          uiScanning: true,
          uiError: true
        });

        const { renderer, scene, camera } = mindarThree;
        arSystemRef.current = mindarThree;
        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;

        // Create target anchor
        const anchor = mindarThree.addAnchor(0);

        // Setup target found/lost events
        anchor.onTargetFound = () => {
          console.log('Target found');
          onTargetFound?.();
        };

        anchor.onTargetLost = () => {
          console.log('Target lost');
          onTargetLost?.();
        };

        // Add appropriate content based on content type
        if (contentType === '3d-model') {
          // Load and add 3D model
          const loader = new GLTFLoader();
          loader.load(
            modelUrl,
            (gltf: any) => {
              // Center and scale the model
              const model = gltf.scene;
              model.scale.set(0.5, 0.5, 0.5);
              model.position.set(0, 0, 0);
              
              // Add model to anchor
              anchor.group.add(model);
              
              // Setup animation if available
              if (gltf.animations && gltf.animations.length > 0) {
                const mixer = new THREE.AnimationMixer(model);
                const action = mixer.clipAction(gltf.animations[0]);
                action.play();
                
                // Update animation in render loop
                mindarThree.beforeUpdate = () => {
                  mixer.update(0.016); // Approx 60fps
                };
              }
            },
            undefined,
            (error: any) => {
              console.error('Error loading 3D model:', error);
              setError('Failed to load 3D model. Please try again.');
            }
          );
        } else if (contentType === 'video') {
          // Create video element and texture
          const video = document.createElement('video');
          video.src = modelUrl;
          video.muted = true;
          video.autoplay = false;
          video.playsInline = true;
          video.loop = true;
          video.crossOrigin = 'anonymous';
          
          // Create video texture
          const texture = new THREE.VideoTexture(video);
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          
          // Create material and geometry for video plane
          const material = new THREE.MeshBasicMaterial({ 
            map: texture,
            side: THREE.DoubleSide
          });
          
          // Calculate aspect ratio for proper sizing
          const aspectRatio = 16/9; // Default if we can't determine
          video.onloadedmetadata = () => {
            const videoAspect = video.videoWidth / video.videoHeight;
            plane.scale.set(videoAspect, 1, 1);
          };
          
          // Create plane with temporary aspect ratio
          const geometry = new THREE.PlaneGeometry(1, 1);
          const plane = new THREE.Mesh(geometry, material);
          
          // Add plane to anchor
          anchor.group.add(plane);
          
          // Start video when target is found
          anchor.onTargetFound = () => {
            console.log('Target found - starting video');
            video.play().catch(e => console.error('Error playing video:', e));
            onTargetFound?.();
          };
          
          // Pause video when target is lost
          anchor.onTargetLost = () => {
            console.log('Target lost - pausing video');
            video.pause();
            onTargetLost?.();
          };
        }

        // Add lights
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 1);
        scene.add(light);

        // Start AR
        await mindarThree.start();
        setIsLoading(false);
        console.log('MindAR started successfully');
      } catch (err) {
        console.error('Error initializing MindAR:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize AR');
        setIsLoading(false);
      }
    };

    initAR();

    return cleanup;
  }, [mindFileUrl, modelUrl, contentType, onTargetFound, onTargetLost]);

  return (
    <div className="relative w-full h-full">
      {/* AR Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full"
      />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center z-50 text-white">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <h3 className="text-lg font-medium mb-2">Loading AR Experience</h3>
          <p className="text-sm text-gray-300">Please wait while we prepare your experience...</p>
        </div>
      )}
      
      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center z-50 text-white">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium mb-2 text-red-400">AR Error</h3>
          <p className="text-sm text-center px-4">{error}</p>
        </div>
      )}
    </div>
  );
}