import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, RotateCcw } from "lucide-react";

// Define the interface for mindar and THREE to avoid typescript errors
declare global {
  interface Window {
    MINDAR: any;
    AFRAME: any;
    THREE: any;
  }
}

export default function ViewProject() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute<{ projectId: string }>("/view/:projectId");
  const { toast } = useToast();
  const sceneRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("Loading AR experience...");

  // Fetch project data
  const projectId = params?.projectId;
  const { data: project, isLoading: isProjectLoading, error } = useQuery({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId,
  });

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

  useEffect(() => {
    if (!isProjectLoading && project) {
      loadARExperience();
    }
  }, [isProjectLoading, project]);

  const loadScripts = async () => {
    if (project?.type === "image-tracking") {
      // Load MindAR scripts for image tracking
      await loadScript("https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image.prod.js");
      await loadScript("https://aframe.io/releases/1.4.2/aframe.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image-aframe.prod.js");
    } else {
      // Load AR.js scripts for markerless AR
      await loadScript("https://aframe.io/releases/1.4.2/aframe.min.js");
      await loadScript("https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js");
    }
    
    if (project?.contentType === "3d-model") {
      // Load GLTF loader
      await loadScript("https://cdn.jsdelivr.net/npm/aframe-extras@7.0.0/dist/aframe-extras.min.js");
    }
  };

  const loadScript = (src: string): Promise<void> => {
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

  const createImageTrackingScene = () => {
    if (!project || !sceneRef.current) return;
    
    // Create the scene
    const sceneEl = document.createElement("a-scene");
    sceneEl.setAttribute("mindar-image", `imageTargetSrc: ${project.targetImageUrl}; showStats: false; uiScanning: true;`);
    sceneEl.setAttribute("color-space", "sRGB");
    sceneEl.setAttribute("renderer", "colorManagement: true, physicallyCorrectLights: true");
    sceneEl.setAttribute("vr-mode-ui", "enabled: false");
    sceneEl.setAttribute("device-orientation-permission-ui", "enabled: false");
    
    // Create the camera
    const camera = document.createElement("a-camera");
    camera.setAttribute("position", "0 0 0");
    camera.setAttribute("look-controls", "enabled: false");
    sceneEl.appendChild(camera);
    
    // Create target container
    const target = document.createElement("a-entity");
    target.setAttribute("mindar-image-target", "targetIndex: 0");
    
    // Add content based on content type
    if (project.contentType === "3d-model") {
      // Add 3D model
      const model = document.createElement("a-gltf-model");
      model.setAttribute("rotation", "0 0 0");
      model.setAttribute("position", "0 0 0");
      model.setAttribute("scale", "0.5 0.5 0.5");
      model.setAttribute("src", project.modelUrl);
      model.setAttribute("animation-mixer", "");
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
      videoAsset.muted = true;
      
      const assets = document.createElement("a-assets");
      assets.appendChild(videoAsset);
      sceneEl.appendChild(assets);
      
      const videoPlane = document.createElement("a-plane");
      videoPlane.setAttribute("position", "0 0 0");
      videoPlane.setAttribute("rotation", "0 0 0");
      videoPlane.setAttribute("width", "1");
      videoPlane.setAttribute("height", "0.552");
      videoPlane.setAttribute("material", "src: #ar-video; transparent: true;");
      target.appendChild(videoPlane);
      
      // Start video when target is found
      target.addEventListener("targetFound", () => {
        videoAsset.play();
      });
      
      // Pause video when target is lost
      target.addEventListener("targetLost", () => {
        videoAsset.pause();
      });
    }
    
    sceneEl.appendChild(target);
    sceneRef.current.appendChild(sceneEl);
  };

  const createMarkerlessScene = () => {
    if (!project || !sceneRef.current) return;
    
    // Create the scene
    const sceneEl = document.createElement("a-scene");
    sceneEl.setAttribute("arjs", "trackingMethod: best; sourceType: webcam; debugUIEnabled: false;");
    sceneEl.setAttribute("vr-mode-ui", "enabled: false");
    sceneEl.setAttribute("device-orientation-permission-ui", "enabled: false");
    
    // Create the camera
    const camera = document.createElement("a-entity");
    camera.setAttribute("camera", "");
    camera.setAttribute("look-controls", "enabled: false");
    
    // Create marker for placing content
    const marker = document.createElement("a-entity");
    
    if (project.contentType === "3d-model") {
      // Add 3D model
      const model = document.createElement("a-gltf-model");
      model.setAttribute("position", "0 0 0");
      model.setAttribute("rotation", "0 0 0");
      model.setAttribute("scale", "0.5 0.5 0.5");
      model.setAttribute("src", project.modelUrl);
      model.setAttribute("animation-mixer", "");
      marker.appendChild(model);
    } else if (project.contentType === "video") {
      // Add video
      const videoAsset = document.createElement("video");
      videoAsset.setAttribute("id", "ar-video");
      videoAsset.setAttribute("src", project.modelUrl);
      videoAsset.setAttribute("preload", "auto");
      videoAsset.setAttribute("loop", "true");
      videoAsset.setAttribute("playsinline", "");
      videoAsset.setAttribute("webkit-playsinline", "");
      videoAsset.muted = true;
      videoAsset.play();
      
      const assets = document.createElement("a-assets");
      assets.appendChild(videoAsset);
      sceneEl.appendChild(assets);
      
      const videoPlane = document.createElement("a-plane");
      videoPlane.setAttribute("position", "0 0 0");
      videoPlane.setAttribute("rotation", "-90 0 0");
      videoPlane.setAttribute("width", "1");
      videoPlane.setAttribute("height", "0.552");
      videoPlane.setAttribute("material", "src: #ar-video; transparent: true;");
      marker.appendChild(videoPlane);
    }
    
    sceneEl.appendChild(marker);
    sceneEl.appendChild(camera);
    sceneRef.current.appendChild(sceneEl);
  };

  const handleBack = () => {
    navigate("/dashboard");
  };

  const handleRefresh = () => {
    setIsLoading(true);
    loadARExperience();
  };

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative">
      {/* AR Content */}
      <div ref={sceneRef} className="w-full h-full"></div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 z-20">
          <Loader2 className="h-12 w-12 text-white animate-spin mb-4" />
          <p className="text-white">{status}</p>
        </div>
      )}

      {/* UI Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
        <div className="bg-white bg-opacity-80 rounded-full px-4 py-2 flex items-center shadow-lg">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={handleRefresh}>
            <RotateCcw className="h-6 w-6 text-gray-800" />
          </Button>
          <span className="mx-2 text-gray-800 font-medium">
            {project?.type === "image-tracking" ? "Scanning for image..." : "Place on surface"}
          </span>
        </div>
      </div>

      <div className="absolute top-4 left-4 z-10">
        <Button variant="outline" size="icon" className="rounded-full bg-white bg-opacity-80 hover:bg-opacity-100" onClick={handleBack}>
          <X className="h-6 w-6 text-gray-800" />
        </Button>
      </div>
    </div>
  );
}
