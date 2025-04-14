import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, X, RotateCcw, Camera, Move3d, ZoomIn, ZoomOut, 
  RefreshCw, Maximize2, Info, Share2, Check
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Project } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";

// Define the interface for mindar and THREE to avoid typescript errors
declare global {
  interface Window {
    MINDAR: any;
    AFRAME: any;
    THREE: any;
  }
}

interface ViewProjectProps {
  projectId?: string;
}

export default function ViewProject({ projectId }: ViewProjectProps) {
  const [, navigate] = useLocation();
  const [match, params] = useRoute<{ projectId: string }>("/view/:projectId");
  const { toast } = useToast();
  const sceneRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("Loading AR experience...");
  const [targetFound, setTargetFound] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  const [showShareSuccess, setShowShareSuccess] = useState(false);
  const isMobile = useIsMobile();
  const [modelOptions, setModelOptions] = useState({
    rotation: 0,
    scale: 0.5,
  });

  // Fetch project data
  const projectIdToUse = projectId || params?.projectId;
  const { data: project, isLoading: isProjectLoading, error } = useQuery<Project>({
    queryKey: [`/api/projects/${projectIdToUse}`],
    enabled: !!projectIdToUse,
  });

  // Hide tutorial after 8 seconds
  useEffect(() => {
    if (showTutorial && !isLoading) {
      const timer = setTimeout(() => {
        setShowTutorial(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [showTutorial, isLoading]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load project data. Please try again.",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  }, [error, navigate, toast]);

  // Track view and load experience
  useEffect(() => {
    if (!isProjectLoading && project) {
      // Track this view in analytics
      try {
        apiRequest("POST", `/api/projects/${projectIdToUse}/view`);
      } catch (error) {
        console.error("Failed to record view:", error);
        // Non-critical error, continue loading the experience
      }
      
      // Request fullscreen on mobile devices
      if (isMobile && document.documentElement.requestFullscreen) {
        try {
          document.documentElement.requestFullscreen().catch(() => {
            // Fullscreen request might be rejected if not from a user gesture
            console.log("Fullscreen request was rejected");
          });
        } catch (err) {
          console.error("Error requesting fullscreen:", err);
        }
      }
      
      loadARExperience();
    }
  }, [isProjectLoading, project, projectIdToUse, isMobile]);

  // Handle model controls
  useEffect(() => {
    if (!isLoading && project?.contentType === "3d-model" && sceneRef.current) {
      let model: HTMLElement | null = null;
      
      if (project.type === "image-tracking") {
        model = sceneRef.current.querySelector("a-gltf-model");
      } else {
        model = sceneRef.current.querySelector("a-gltf-model");
      }
      
      if (model) {
        model.setAttribute("rotation", `0 ${modelOptions.rotation} 0`);
        model.setAttribute("scale", `${modelOptions.scale} ${modelOptions.scale} ${modelOptions.scale}`);
      }
    }
  }, [modelOptions, isLoading, project]);

  // Load all required scripts
  const loadScripts = async () => {
    if (project?.type === "image-tracking") {
      // Load MindAR scripts for image tracking
      await loadScript("https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image.prod.js");
      await loadScript("https://aframe.io/releases/1.4.2/aframe.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image-aframe.prod.js");
    } else {
      // Load AR.js scripts for markerless AR
      await loadScript("https://aframe.io/releases/1.4.2/aframe.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/aframe-ar@0.3.0/index.min.js");
      await loadScript("https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js");
      await loadScript("https://cdn.jsdelivr.net/npm/aframe-environment-component@1.3.2/dist/aframe-environment-component.min.js");
    }
    
    if (project?.contentType === "3d-model") {
      // Load GLTF loader and animation extras
      await loadScript("https://cdn.jsdelivr.net/npm/aframe-extras@7.0.0/dist/aframe-extras.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/aframe-orbit-controls@1.3.0/dist/aframe-orbit-controls.min.js");
    }
    
    // Load gesture handler component for touch interactions
    await loadScript("https://raw.githack.com/AR-js-org/studio-backend/master/src/modules/marker/tools/gesture-handler.js");
  };

  const loadScript = (src: string): Promise<void> => {
    // Check if script is already loaded
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  };

  const loadARExperience = async () => {
    if (!project) return;
    
    try {
      setStatus("Loading AR libraries...");
      await loadScripts();
      
      setStatus("Initializing AR experience...");
      
      // Clear previous AR scene if exists
      if (sceneRef.current) {
        sceneRef.current.innerHTML = "";
        
        // Create new scene based on project type
        if (project.type === "image-tracking") {
          createImageTrackingScene();
        } else {
          createMarkerlessScene();
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error setting up AR:", error);
      toast({
        title: "Error",
        description: "Failed to initialize AR experience. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Create a scene for image tracking AR
  const createImageTrackingScene = () => {
    if (!project || !sceneRef.current) return;
    
    // Create the scene
    const sceneEl = document.createElement("a-scene");
    sceneEl.setAttribute("mindar-image", `imageTargetSrc: ${project.targetImageUrl}; showStats: false; uiScanning: true; uiLoading: false;`);
    sceneEl.setAttribute("color-space", "sRGB");
    sceneEl.setAttribute("renderer", "colorManagement: true; physicallyCorrectLights: true; antialias: true");
    sceneEl.setAttribute("vr-mode-ui", "enabled: false");
    sceneEl.setAttribute("device-orientation-permission-ui", "enabled: false");
    
    // Create the camera
    const camera = document.createElement("a-camera");
    camera.setAttribute("position", "0 0 0");
    camera.setAttribute("look-controls", "enabled: false");
    sceneEl.appendChild(camera);
    
    // Create light
    const light = document.createElement("a-light");
    light.setAttribute("type", "ambient");
    light.setAttribute("intensity", "0.8");
    light.setAttribute("color", "#ffffff");
    sceneEl.appendChild(light);
    
    const directionalLight = document.createElement("a-light");
    directionalLight.setAttribute("type", "directional");
    directionalLight.setAttribute("intensity", "0.6");
    directionalLight.setAttribute("color", "#ffffff");
    directionalLight.setAttribute("position", "1 1 1");
    sceneEl.appendChild(directionalLight);
    
    // Create target container
    const target = document.createElement("a-entity");
    target.setAttribute("mindar-image-target", "targetIndex: 0");
    
    // Target found/lost event handlers
    target.addEventListener("targetFound", () => {
      setTargetFound(true);
      setShowControls(true);
    });
    
    target.addEventListener("targetLost", () => {
      setTargetFound(false);
    });
    
    // Add content based on content type
    if (project.contentType === "3d-model") {
      // Add 3D model
      const model = document.createElement("a-gltf-model");
      model.setAttribute("rotation", `0 ${modelOptions.rotation} 0`);
      model.setAttribute("position", "0 0 0");
      model.setAttribute("scale", `${modelOptions.scale} ${modelOptions.scale} ${modelOptions.scale}`);
      model.setAttribute("src", project.modelUrl);
      model.setAttribute("animation-mixer", "clip: *; loop: repeat; timeScale: 1");
      model.setAttribute("gesture-handler", "minScale: 0.1; maxScale: 2");
      model.setAttribute("class", "clickable");
      
      // Add animations
      const rotationAnimation = document.createElement("a-animation");
      rotationAnimation.setAttribute("attribute", "rotation");
      rotationAnimation.setAttribute("dur", "10000");
      rotationAnimation.setAttribute("fill", "forwards");
      rotationAnimation.setAttribute("to", "0 360 0");
      rotationAnimation.setAttribute("repeat", "indefinite");
      rotationAnimation.setAttribute("easing", "linear");
      
      // Only start animation when target is found
      target.addEventListener("targetFound", () => {
        rotationAnimation.setAttribute("begin", "");
      });
      
      target.addEventListener("targetLost", () => {
        rotationAnimation.setAttribute("begin", "never");
      });
      
      model.appendChild(rotationAnimation);
      target.appendChild(model);
    } else if (project.contentType === "video") {
      // Add video
      const videoAsset = document.createElement("video");
      videoAsset.setAttribute("id", "ar-video");
      videoAsset.setAttribute("src", project.modelUrl);
      videoAsset.setAttribute("preload", "auto");
      videoAsset.setAttribute("loop", "");
      videoAsset.setAttribute("playsinline", "");
      videoAsset.setAttribute("webkit-playsinline", "");
      videoAsset.setAttribute("crossorigin", "anonymous");
      videoAsset.muted = true;
      
      const assets = document.createElement("a-assets");
      assets.appendChild(videoAsset);
      sceneEl.appendChild(assets);
      
      const videoPlane = document.createElement("a-plane");
      videoPlane.setAttribute("position", "0 0 0");
      videoPlane.setAttribute("rotation", "0 0 0");
      videoPlane.setAttribute("width", "1.2");
      videoPlane.setAttribute("height", "0.7");
      videoPlane.setAttribute("material", "src: #ar-video; transparent: true; shader: flat");
      videoPlane.setAttribute("class", "clickable");
      
      // Add shadow plane under video
      const shadowPlane = document.createElement("a-plane");
      shadowPlane.setAttribute("position", "0 -0.01 -0.01");
      shadowPlane.setAttribute("rotation", "0 0 0");
      shadowPlane.setAttribute("width", "1.3");
      shadowPlane.setAttribute("height", "0.8");
      shadowPlane.setAttribute("color", "#000");
      shadowPlane.setAttribute("opacity", "0.5");
      target.appendChild(shadowPlane);
      
      target.appendChild(videoPlane);
      
      // Start video when target is found
      target.addEventListener("targetFound", () => {
        videoAsset.play().catch(e => console.error("Error playing video:", e));
      });
      
      // Pause video when target is lost
      target.addEventListener("targetLost", () => {
        videoAsset.pause();
      });
    }
    
    sceneEl.appendChild(target);
    sceneRef.current.appendChild(sceneEl);
  };

  // Create a scene for markerless AR
  const createMarkerlessScene = () => {
    if (!project || !sceneRef.current) return;
    
    // Create the scene
    const sceneEl = document.createElement("a-scene");
    sceneEl.setAttribute("embedded", "");
    sceneEl.setAttribute("arjs", "sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3;");
    sceneEl.setAttribute("vr-mode-ui", "enabled: false");
    sceneEl.setAttribute("renderer", "logarithmicDepthBuffer: true; antialias: true");
    sceneEl.setAttribute("device-orientation-permission-ui", "enabled: false");
    
    // Create the camera and cursor
    const camera = document.createElement("a-entity");
    camera.setAttribute("camera", "");
    camera.setAttribute("position", "0 0 0");
    
    const cursor = document.createElement("a-entity");
    cursor.setAttribute("cursor", "fuse: false");
    cursor.setAttribute("position", "0 0 -1");
    cursor.setAttribute("geometry", "primitive: ring; radiusInner: 0.02; radiusOuter: 0.03");
    cursor.setAttribute("material", "color: white; shader: flat");
    camera.appendChild(cursor);
    
    // Create anchor for placing content
    const anchor = document.createElement("a-anchor");
    anchor.setAttribute("hit-test-enabled", "true");
    
    // Set anchored status when hit-test detects surface
    anchor.addEventListener("hit-test-select", () => {
      setTargetFound(true);
      setShowControls(true);
    });
    
    // Add content based on content type
    if (project.contentType === "3d-model") {
      // Add 3D model
      const model = document.createElement("a-gltf-model");
      model.setAttribute("position", "0 0 0");
      model.setAttribute("rotation", `0 ${modelOptions.rotation} 0`);
      model.setAttribute("scale", `${modelOptions.scale} ${modelOptions.scale} ${modelOptions.scale}`);
      model.setAttribute("src", project.modelUrl);
      model.setAttribute("gesture-handler", "minScale: 0.1; maxScale: 2");
      model.setAttribute("animation-mixer", "clip: *; loop: repeat;");
      
      // Shadow
      const shadow = document.createElement("a-circle");
      shadow.setAttribute("position", "0 -0.01 0");
      shadow.setAttribute("rotation", "-90 0 0");
      shadow.setAttribute("radius", "0.5");
      shadow.setAttribute("material", "shader: flat; opacity: 0.4; color: #000");
      anchor.appendChild(shadow);
      
      // Add animations
      const pulseAnimation = document.createElement("a-animation");
      pulseAnimation.setAttribute("attribute", "scale");
      pulseAnimation.setAttribute("from", `${modelOptions.scale} ${modelOptions.scale} ${modelOptions.scale}`);
      pulseAnimation.setAttribute("to", `${modelOptions.scale * 1.1} ${modelOptions.scale * 1.1} ${modelOptions.scale * 1.1}`);
      pulseAnimation.setAttribute("direction", "alternate");
      pulseAnimation.setAttribute("dur", "1500");
      pulseAnimation.setAttribute("repeat", "indefinite");
      pulseAnimation.setAttribute("easing", "ease-in-out");
      
      model.appendChild(pulseAnimation);
      anchor.appendChild(model);
    } else if (project.contentType === "video") {
      // Add video
      const videoAsset = document.createElement("video");
      videoAsset.setAttribute("id", "ar-video");
      videoAsset.setAttribute("src", project.modelUrl);
      videoAsset.setAttribute("preload", "auto");
      videoAsset.setAttribute("loop", "true");
      videoAsset.setAttribute("playsinline", "");
      videoAsset.setAttribute("webkit-playsinline", "");
      videoAsset.setAttribute("crossorigin", "anonymous");
      videoAsset.muted = true;
      
      // Autoplay video
      videoAsset.play().catch(e => console.error("Error autoplaying video:", e));
      
      const assets = document.createElement("a-assets");
      assets.appendChild(videoAsset);
      sceneEl.appendChild(assets);
      
      const videoPlane = document.createElement("a-plane");
      videoPlane.setAttribute("position", "0 0.5 0");
      videoPlane.setAttribute("rotation", "-90 0 0");
      videoPlane.setAttribute("width", "1.6");
      videoPlane.setAttribute("height", "0.9");
      videoPlane.setAttribute("material", "src: #ar-video; transparent: true; shader: flat");
      
      // Shadow
      const shadow = document.createElement("a-circle");
      shadow.setAttribute("position", "0 0.01 0");
      shadow.setAttribute("rotation", "-90 0 0");
      shadow.setAttribute("radius", "0.8");
      shadow.setAttribute("material", "shader: flat; opacity: 0.3; color: #000");
      anchor.appendChild(shadow);
      
      anchor.appendChild(videoPlane);
    }
    
    sceneEl.appendChild(anchor);
    sceneEl.appendChild(camera);
    sceneRef.current.appendChild(sceneEl);
  };

  const handleBack = () => {
    // Exit fullscreen if active
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
    }
    navigate("/dashboard");
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setShowTutorial(true);
    setTargetFound(false);
    setShowControls(false);
    loadARExperience();
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    
    try {
      // Record share analytics
      await apiRequest("POST", `/api/projects/${projectIdToUse}/share`);
      
      // Try to use Web Share API if available
      if (navigator.share) {
        await navigator.share({
          title: project?.name || "AR Experience",
          text: `Check out this AR experience: ${project?.name}`,
          url: shareUrl,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        setShowShareSuccess(true);
        setTimeout(() => setShowShareSuccess(false), 2000);
      }
    } catch (error) {
      console.error("Error sharing:", error);
      // Still try clipboard as fallback
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShowShareSuccess(true);
        setTimeout(() => setShowShareSuccess(false), 2000);
      } catch (err) {
        toast({
          title: "Failed to share",
          description: "Could not share this experience",
          variant: "destructive",
        });
      }
    }
  };

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  const rotateModel = (degrees: number) => {
    setModelOptions(prev => ({
      ...prev,
      rotation: (prev.rotation + degrees) % 360,
    }));
  };

  const scaleModel = (factor: number) => {
    setModelOptions(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(2, prev.scale + factor)),
    }));
  };

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative">
      {/* AR Content */}
      <div ref={sceneRef} className="w-full h-full"></div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 z-50">
          <div className="w-full max-w-md px-8 py-10 flex flex-col items-center">
            <div className="relative mb-6">
              <Loader2 className="h-16 w-16 text-white animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Camera className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h2 className="text-white text-xl font-bold mb-3">
              {project?.name || "AR Experience"}
            </h2>
            <div className="bg-white/10 backdrop-blur-sm w-full h-1.5 rounded-full overflow-hidden mt-2">
              <div className="bg-gradient-to-r from-indigo-500 to-primary h-full rounded-full animate-pulse"></div>
            </div>
            <p className="text-white mt-4 text-center">{status}</p>
            <p className="text-white/70 text-sm mt-2 text-center">
              {project?.type === "image-tracking" 
                ? "Please allow camera access when prompted" 
                : "Preparing markerless AR experience"}
            </p>
          </div>
        </div>
      )}

      {/* Tutorial Overlay */}
      {showTutorial && !isLoading && (
        <div className="absolute inset-0 pointer-events-none z-40">
          <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 shadow-xl max-w-sm w-5/6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              {project?.type === "image-tracking" ? (
                <Camera className="h-8 w-8 text-primary" />
              ) : (
                <Move3d className="h-8 w-8 text-primary" />
              )}
            </div>
            <h3 className="font-bold text-lg mb-2">How to use this AR experience</h3>
            {project?.type === "image-tracking" ? (
              <p className="text-gray-700 text-sm">
                Point your camera at the target image to see the AR content appear. Keep the image in view for the best experience.
              </p>
            ) : (
              <p className="text-gray-700 text-sm">
                Move your phone around to detect surfaces. Tap on a surface to place the AR content. You can then move around to view it from different angles.
              </p>
            )}
            <Button 
              className="mt-4 w-full"
              onClick={() => setShowTutorial(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      )}

      {/* UI Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
        <div className={`bg-black bg-opacity-50 backdrop-blur-md rounded-full px-4 py-2 flex items-center shadow-lg transition-all duration-300 ${targetFound ? 'opacity-100' : 'opacity-70'}`}>
          <Button variant="ghost" size="icon" className="rounded-full text-white" onClick={handleRefresh}>
            <RotateCcw className="h-5 w-5" />
          </Button>
          {!targetFound ? (
            <span className="mx-2 text-white font-medium text-sm animate-pulse">
              {project?.type === "image-tracking" ? "Scanning for image..." : "Detecting surfaces..."}
            </span>
          ) : (
            <span className="mx-2 text-white font-medium text-sm flex items-center">
              <Check className="h-4 w-4 mr-1 text-green-400" />
              {project?.type === "image-tracking" ? "Target found" : "Placed on surface"}
            </span>
          )}
        </div>
      </div>

      {/* Top Controls */}
      <div className="absolute top-4 left-0 right-0 flex justify-between items-center px-4 z-20">
        <Button 
          variant="outline" 
          size="icon" 
          className="rounded-full bg-black bg-opacity-50 backdrop-blur-md border-none hover:bg-black hover:bg-opacity-70 text-white"
          onClick={handleBack}
        >
          <X className="h-5 w-5" />
        </Button>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full bg-black bg-opacity-50 backdrop-blur-md border-none hover:bg-black hover:bg-opacity-70 text-white"
            onClick={handleShare}
          >
            <Share2 className="h-5 w-5" />
          </Button>
          
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full bg-black bg-opacity-50 backdrop-blur-md border-none hover:bg-black hover:bg-opacity-70 text-white"
            onClick={handleFullscreen}
          >
            <Maximize2 className="h-5 w-5" />
          </Button>
          
          <Button 
            variant="outline"
            size="icon" 
            className="rounded-full bg-black bg-opacity-50 backdrop-blur-md border-none hover:bg-black hover:bg-opacity-70 text-white"
            onClick={() => setShowTutorial(true)}
          >
            <Info className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Share success toast */}
      {showShareSuccess && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 backdrop-blur-md text-white px-4 py-2 rounded-lg flex items-center z-50">
          <Check className="h-4 w-4 mr-2 text-green-400" />
          <span className="text-sm">Link copied to clipboard</span>
        </div>
      )}

      {/* Model Controls (only show when content is 3D model and target is found) */}
      {project?.contentType === "3d-model" && targetFound && showControls && (
        <div className="absolute bottom-16 right-4 flex flex-col gap-2 z-20">
          <div className="bg-black bg-opacity-50 backdrop-blur-md rounded-lg p-2 shadow-lg">
            <div className="flex flex-col gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full text-white hover:bg-white/20"
                onClick={() => rotateModel(45)}
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full text-white hover:bg-white/20"
                onClick={() => scaleModel(0.1)}
              >
                <ZoomIn className="h-5 w-5" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full text-white hover:bg-white/20"
                onClick={() => scaleModel(-0.1)}
              >
                <ZoomOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
