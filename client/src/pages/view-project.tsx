import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import * as ReactDOM from "react-dom/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, X, RotateCcw, Camera, Move3d, ZoomIn, ZoomOut, 
  RefreshCw, Maximize2, Info, Share2, Check, Download, Smartphone
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Project } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { MindFileGenerator } from "@/components/MindFileGenerator";
import { MindARViewer } from "@/components/MindARViewer";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";



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
  const [showMindFileDialog, setShowMindFileDialog] = useState(false);
  const [showARModeToast, setShowARModeToast] = useState(false);
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
    // Load base A-Frame for both types
    await loadScript("https://aframe.io/releases/1.4.2/aframe.min.js");
    
    if (project?.type === "image-tracking") {
      // Load MindAR scripts for image tracking
      await loadScript("https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image.prod.js");
      await loadScript("https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image-aframe.prod.js");
    } else {
      // Load MindAR scripts for face/markerless tracking
      await loadScript("https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-face.prod.js");
      await loadScript("https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-face-aframe.prod.js");
    }
    
    if (project?.contentType === "3d-model") {
      // Load GLTF loader and animation extras
      await loadScript("https://cdn.jsdelivr.net/npm/aframe-extras@7.0.0/dist/aframe-extras.min.js");
    }
    
    // Custom gesture handler for touch interactions
    await loadScript("https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.2/examples/image-tracking/assets/gesture-detector.js");
    await loadScript("https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.2/examples/image-tracking/assets/gesture-handler.js");
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
      setStatus("Loading AR experience...");
      
      // Clear previous AR scene if exists
      if (sceneRef.current) {
        sceneRef.current.innerHTML = "";
        
        // Use the direct MindARViewer component for image tracking projects
        if (project.type === "image-tracking" && project.targetMindFile) {
          // Clear and prepare container
          const arContainer = document.createElement('div');
          arContainer.className = 'w-full h-full';
          sceneRef.current.appendChild(arContainer);
          
          // Create React component with MindARViewer
          const root = ReactDOM.createRoot(arContainer);
          root.render(
            <MindARViewer 
              mindFileUrl={project.targetMindFile}
              modelUrl={project.modelUrl || ''}
              contentType={project.contentType as 'video' | '3d-model'}
              onTargetFound={() => {
                setTargetFound(true);
                setShowControls(true);
              }}
              onTargetLost={() => setTargetFound(false)}
            />
          );
          
          setIsLoading(false);
          setStatus("AR experience loaded using MindAR");
          
          // Auto-enter fullscreen on mobile
          if (isMobile && document.documentElement.requestFullscreen) {
            try {
              document.documentElement.requestFullscreen();
            } catch (e) {
              console.warn("Failed to enter fullscreen:", e);
            }
          }
        } else {
          // Fallback to iframe method for other project types or if .mind file not available
          // Create iframe to load server-generated AR HTML
          const iframe = document.createElement('iframe');
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = 'none';
          iframe.allow = "camera; microphone; accelerometer; gyroscope; magnetometer; xr-spatial-tracking";
          iframe.referrerPolicy = "no-referrer";
          iframe.src = `/api/generate-ar-html/${project.id}`;
          
          // Add a loading overlay until iframe loads
          const loadingOverlay = document.createElement('div');
          loadingOverlay.className = 'absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center text-white';
          loadingOverlay.innerHTML = `
            <div class="animate-spin h-10 w-10 border-t-2 border-l-2 border-white rounded-full mb-4"></div>
            <h3 class="text-lg font-medium mb-2">Loading AR Experience</h3>
            <p class="text-sm text-gray-300">Please wait while we prepare your AR experience...</p>
            <p class="text-sm text-gray-300 mt-2">You'll need to allow camera access when prompted</p>
          `;
          
          sceneRef.current.appendChild(iframe);
          sceneRef.current.appendChild(loadingOverlay);
          
          // Remove loading overlay when iframe loads
          iframe.onload = () => {
            loadingOverlay.remove();
            setIsLoading(false);
            setStatus("AR experience loaded");
            
            // Auto-enter fullscreen on mobile
            if (isMobile && document.documentElement.requestFullscreen) {
              try {
                document.documentElement.requestFullscreen();
              } catch (e) {
                console.warn("Failed to enter fullscreen:", e);
              }
            }
            
            setTargetFound(false);
            setShowControls(true);
          };
          
          // Handle iframe load errors
          iframe.onerror = () => {
            loadingOverlay.remove();
            setIsLoading(false);
            setStatus("Failed to load AR experience");
            
            toast({
              title: "Error",
              description: "Failed to load AR experience. Please try again.",
              variant: "destructive",
            });
          };
        }
      }
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

  // Create a scene for markerless AR using MindAR face tracking
  const createMarkerlessScene = () => {
    if (!project || !sceneRef.current) return;
    
    // Create the scene with MindAR face tracking
    const sceneEl = document.createElement("a-scene");
    sceneEl.setAttribute("mindar-face", "autoStart: true; maxDetectedFaces: 1; filterMinCF: 0.0001; filterBeta: 10;");
    sceneEl.setAttribute("color-space", "sRGB");
    sceneEl.setAttribute("renderer", "colorManagement: true; physicallyCorrectLights: true; antialias: true");
    sceneEl.setAttribute("vr-mode-ui", "enabled: false");
    sceneEl.setAttribute("device-orientation-permission-ui", "enabled: false");
    
    // Create the camera
    const camera = document.createElement("a-camera");
    camera.setAttribute("active", "false");
    camera.setAttribute("position", "0 0 0");
    camera.setAttribute("look-controls", "enabled: false");
    sceneEl.appendChild(camera);
    
    // Add light
    const ambientLight = document.createElement("a-light");
    ambientLight.setAttribute("type", "ambient");
    ambientLight.setAttribute("intensity", "0.7");
    ambientLight.setAttribute("color", "#ffffff");
    sceneEl.appendChild(ambientLight);
    
    const directionalLight = document.createElement("a-light");
    directionalLight.setAttribute("type", "directional");
    directionalLight.setAttribute("intensity", "0.5");
    directionalLight.setAttribute("color", "#ffffff");
    directionalLight.setAttribute("position", "0 1 1");
    sceneEl.appendChild(directionalLight);
    
    // Create face anchor
    const anchor = document.createElement("a-entity");
    anchor.setAttribute("mindar-face-target", "anchorIndex: 1"); // Use anchor point 1 (forehead)
    
    // Set target found/lost event handlers
    anchor.addEventListener("targetFound", () => {
      setTargetFound(true);
      setShowControls(true);
    });
    
    anchor.addEventListener("targetLost", () => {
      setTargetFound(false);
    });
    
    // Add gesture detector to the scene
    const gestureDetector = document.createElement("a-entity");
    gestureDetector.setAttribute("gesture-detector", "");
    sceneEl.appendChild(gestureDetector);
    
    // Add content based on content type
    if (project.contentType === "3d-model") {
      // Add 3D model with gesture handler
      const container = document.createElement("a-entity");
      container.setAttribute("position", "0 0 -0.3"); // Position in front of face
      
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
      
      model.appendChild(rotationAnimation);
      container.appendChild(model);
      anchor.appendChild(container);
    } else if (project.contentType === "video") {
      // Add video
      const videoAsset = document.createElement("video");
      videoAsset.setAttribute("id", "ar-video-face");
      videoAsset.setAttribute("src", project.modelUrl);
      videoAsset.setAttribute("preload", "auto");
      videoAsset.setAttribute("loop", "true");
      videoAsset.setAttribute("playsinline", "");
      videoAsset.setAttribute("webkit-playsinline", "");
      videoAsset.setAttribute("crossorigin", "anonymous");
      videoAsset.muted = true;
      
      const assets = document.createElement("a-assets");
      assets.appendChild(videoAsset);
      sceneEl.appendChild(assets);
      
      // Start video when face is detected
      anchor.addEventListener("targetFound", () => {
        videoAsset.play().catch(e => console.error("Error playing video:", e));
      });
      
      // Create container for video positioning
      const container = document.createElement("a-entity");
      container.setAttribute("position", "0 0 -0.5"); // Position in front of face
      
      // Create video plane
      const videoPlane = document.createElement("a-plane");
      videoPlane.setAttribute("position", "0 0 0");
      videoPlane.setAttribute("width", "1");
      videoPlane.setAttribute("height", "0.6");
      videoPlane.setAttribute("material", "src: #ar-video-face; transparent: true; shader: flat");
      videoPlane.setAttribute("class", "clickable");
      videoPlane.setAttribute("gesture-handler", "");
      
      container.appendChild(videoPlane);
      anchor.appendChild(container);
    }
    
    sceneEl.appendChild(anchor);
    sceneRef.current.appendChild(sceneEl);
    
    // Face tracking detected - show success after short delay
    setTimeout(() => {
      setTargetFound(true);
      setShowControls(true);
    }, 3000);
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
  
  const handleARMode = () => {
    // Hiển thị toast và sau đó chuyển hướng đến trang AR experience
    if (project?.id) {
      setShowARModeToast(true);
      // Chuyển hướng sau 1.5 giây
      setTimeout(() => {
        setShowARModeToast(false);
        navigate(`/project-ar/${project.id}`);
      }, 1500);
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
                : "Please allow camera access for face tracking AR"}
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
                Position your face in the center of the screen. The AR content will appear in front of your face. You can rotate your head to see it from different angles.
              </p>
            )}
            <div className="mt-4 flex flex-col space-y-2">
              <Button 
                className="w-full"
                onClick={() => setShowTutorial(false)}
              >
                Got it
              </Button>
              
              {project?.targetMindFile && (
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center"
                  onClick={handleARMode}
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  Open in AR Mode
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UI Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
        <div className={`bg-black/60 backdrop-blur-md rounded-full px-5 py-2.5 flex items-center shadow-xl border border-white/10 transition-all duration-300 animate-fade-in ${targetFound ? 'opacity-100' : 'opacity-80'}`}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full text-white hover:bg-white/20 mr-1"
            onClick={handleRefresh}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          {!targetFound ? (
            <div className="mx-2 flex items-center">
              <div className="w-2 h-2 bg-amber-400 rounded-full mr-2 animate-pulse"></div>
              <span className="text-white font-medium text-sm">
                {project?.type === "image-tracking" ? "Đang quét hình ảnh..." : "Đang phát hiện khuôn mặt..."}
              </span>
            </div>
          ) : (
            <div className="mx-2 flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
              <span className="text-white font-medium text-sm flex items-center">
                <Check className="h-4 w-4 mr-1 text-green-400" />
                {project?.type === "image-tracking" ? "Đã tìm thấy hình ảnh" : "Đã phát hiện khuôn mặt"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Top Controls */}
      <div className="absolute top-4 left-0 right-0 flex justify-between items-center px-4 z-20">
        <Button 
          variant="outline" 
          size="icon" 
          className="rounded-full bg-black/50 backdrop-blur-md border-white/10 hover:bg-black/70 text-white shadow-lg animate-fade-in"
          onClick={handleBack}
        >
          <X className="h-5 w-5" />
        </Button>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full bg-black/50 backdrop-blur-md border-white/10 hover:bg-black/70 text-white shadow-lg animate-fade-in animation-delay-300"
            onClick={handleShare}
            title="Chia sẻ"
          >
            <Share2 className="h-4 w-4" />
          </Button>
          
          {/* Add Mind File Generator button only for image-tracking projects */}
          {project?.type === 'image-tracking' && (
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-full bg-black/50 backdrop-blur-md border-white/10 hover:bg-black/70 text-white shadow-lg animate-fade-in animation-delay-300"
              onClick={() => setShowMindFileDialog(true)}
              title="Tạo mind file"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          
          {/* AR Mode button for projects with mind file */}
          {project?.targetMindFile && (
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-full bg-gradient-to-br from-indigo-500/70 to-purple-500/70 backdrop-blur-md border-white/10 hover:from-indigo-500/90 hover:to-purple-500/90 text-white shadow-lg animate-fade-in animation-delay-500"
              onClick={handleARMode}
              title="Chế độ AR"
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full bg-black/50 backdrop-blur-md border-white/10 hover:bg-black/70 text-white shadow-lg animate-fade-in animation-delay-500"
            onClick={handleFullscreen}
            title="Toàn màn hình"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline"
            size="icon" 
            className="rounded-full bg-black/50 backdrop-blur-md border-white/10 hover:bg-black/70 text-white shadow-lg animate-fade-in animation-delay-700"
            onClick={() => setShowTutorial(true)}
            title="Hướng dẫn"
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Share success toast */}
      {showShareSuccess && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-green-500/80 backdrop-blur-md text-white px-5 py-3 rounded-xl flex items-center z-50 shadow-xl">
          <div className="mr-3 bg-white/20 w-8 h-8 rounded-full flex items-center justify-center">
            <Check className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium">Đã sao chép liên kết</div>
            <div className="text-xs text-white/80 mt-0.5">Chia sẻ với bạn bè của bạn</div>
          </div>
        </div>
      )}
      
      {/* AR Mode toast */}
      {showARModeToast && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-indigo-500/80 backdrop-blur-md text-white px-5 py-3 rounded-xl flex items-center z-50 shadow-xl animate-pulse">
          <div className="mr-3 bg-white/20 w-8 h-8 rounded-full flex items-center justify-center">
            <Smartphone className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium">Đang mở chế độ AR...</div>
            <div className="text-xs text-white/80 mt-0.5">Chuyển sang trải nghiệm đầy đủ</div>
          </div>
        </div>
      )}

      {/* Model Controls (only show when content is 3D model and target is found) */}
      {project?.contentType === "3d-model" && targetFound && showControls && (
        <div className="absolute bottom-16 right-4 flex flex-col gap-2.5 z-20">
          <div className="bg-black/40 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-white/10">
            <div className="flex flex-col gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full bg-gradient-to-br from-purple-500/80 to-indigo-600/80 text-white hover:shadow-lg transition-all duration-300 hover:scale-105"
                onClick={() => rotateModel(45)}
                title="Xoay mô hình"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full bg-gradient-to-br from-blue-500/80 to-cyan-600/80 text-white hover:shadow-lg transition-all duration-300 hover:scale-105"
                onClick={() => scaleModel(0.1)}
                title="Phóng to"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full bg-gradient-to-br from-blue-600/80 to-blue-500/80 text-white hover:shadow-lg transition-all duration-300 hover:scale-105"
                onClick={() => scaleModel(-0.1)}
                title="Thu nhỏ"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Mind File Generator Dialog */}
      <Dialog open={showMindFileDialog} onOpenChange={setShowMindFileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold bg-gradient-to-br from-indigo-500 to-purple-600 bg-clip-text text-transparent">Tạo File .mind</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Tạo file .mind đã biên dịch để sử dụng với thư viện MindAR trong các ứng dụng AR tùy chỉnh.
            </DialogDescription>
          </DialogHeader>
          {project && (
            <MindFileGenerator 
              projectId={project.id} 
              targetImageUrl={project.targetImageUrl} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
