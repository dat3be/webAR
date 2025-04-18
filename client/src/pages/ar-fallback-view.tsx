import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface ARFallbackViewProps {
  projectId: string;
}

/**
 * Phiên bản dự phòng đơn giản cho AR view khi MindAR không hoạt động
 * Sử dụng iframe trỏ đến mã HTML trên server thay vì tạo blob trong trình duyệt
 */
export default function ARFallbackView({ projectId }: ARFallbackViewProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [contentLoaded, setContentLoaded] = useState(false);
  
  // Fetch project data
  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId,
  });

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin dự án",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  }, [error, navigate, toast]);

  // Create a simpler AR experience based on user's template
  useEffect(() => {
    // Only run when project is loaded
    if (!project || isLoading) return;
    
    // Setup function to avoid too many nested levels
    const setupARExperience = () => {
      try {
        console.log("[ARFallbackView] Creating AR experience with project:", project.id);
        
        // Use fallback values if needed
        const mindFileUrl = project.targetMindFile || 
          "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind";
        
        const targetImageUrl = project.targetImageUrl || 
          "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.png";
        
        const modelUrl = project.modelUrl || 
          "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/softmind/scene.gltf";
        
        // Explicit type checking with default values
        const contentType = (project.contentType && 
          (project.contentType === '3d-model' || project.contentType === 'video')) 
          ? project.contentType 
          : "3d-model";
          
        console.log("[ARFallbackView] Using values:", {
          contentType,
          mindFileUrl: mindFileUrl.substring(0, 50) + "...",
          modelUrl: modelUrl.substring(0, 50) + "...",
        });
      
        // Create a simple AR HTML based on user's template
        const arHtml = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"></script>
            <style>
              body { margin: 0; }
              .loading {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                color: white;
                flex-direction: column;
              }
              .back-button {
                position: fixed;
                top: 10px;
                left: 10px;
                z-index: 1000;
                padding: 10px;
                background: rgba(0, 0, 0, 0.5);
                color: white;
                border: none;
                border-radius: 5px;
                font-size: 16px;
                cursor: pointer;
              }
            </style>
          </head>
          <body>
            <button class="back-button" id="backButton">⬅️ Quay lại</button>
            
            <a-scene 
              mindar-image="imageTargetSrc: ${mindFileUrl};" 
              color-space="sRGB" 
              renderer="colorManagement: true; physicallyCorrectLights: true" 
              vr-mode-ui="enabled: false" 
              device-orientation-permission-ui="enabled: false">
              
              <a-assets>
                <img id="card" src="${targetImageUrl}" crossorigin="anonymous" />
                ${contentType === '3d-model' ? 
                  `<a-asset-item id="contentModel" src="${modelUrl}" crossorigin="anonymous"></a-asset-item>` : 
                  `<video id="contentVideo" src="${modelUrl}" preload="auto" loop crossorigin="anonymous" playsinline webkit-playsinline></video>`
                }
              </a-assets>
              
              <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
              
              <a-entity mindar-image-target="targetIndex: 0">
                <a-plane src="#card" position="0 0 0" height="0.552" width="1" rotation="0 0 0"></a-plane>
                ${contentType === '3d-model' ? 
                  `<a-gltf-model rotation="0 0 0" position="0 0 0.1" scale="0.005 0.005 0.005" src="#contentModel"
                    animation="property: position; to: 0 0.1 0.1; dur: 1000; easing: easeInOutQuad; loop: true; dir: alternate">
                  </a-gltf-model>` : 
                  `<a-video src="#contentVideo" position="0 0 0.1" width="1" height="0.552" rotation="0 0 0"></a-video>`
                }
              </a-entity>
            </a-scene>
            
            <script>
              // Add simple back button functionality
              document.getElementById('backButton').addEventListener('click', function() {
                window.history.back();
              });
              
              ${contentType === 'video' ? `
                // Handle video playback
                const videoEl = document.getElementById('contentVideo');
                const sceneEl = document.querySelector('a-scene');
                
                sceneEl.addEventListener('targetFound', function() {
                  videoEl.play();
                });
                
                sceneEl.addEventListener('targetLost', function() {
                  videoEl.pause();
                });
              ` : ''}
            </script>
          </body>
        </html>`;
        
        // Create a blob from the HTML and set it as iframe source
        const blob = new Blob([arHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const iframe = document.createElement('iframe');
        iframe.className = "w-full h-full border-0";
        iframe.allow = "camera; gyroscope; accelerometer; magnetometer; xr-spatial-tracking";
        iframe.src = url;
        iframe.onload = () => setContentLoaded(true);
        
        const container = document.getElementById('ar-container');
        if (container) {
          // Clear previous content
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
          container.appendChild(iframe);
        } else {
          console.error("[ARFallbackView] Container element 'ar-container' not found");
        }
        
        // Return cleanup function
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        console.error("[ARFallbackView] Error in AR setup:", err);
        toast({
          title: "Lỗi",
          description: "Đã xảy ra lỗi khi thiết lập trải nghiệm AR. Vui lòng thử lại sau.",
          variant: "destructive",
        });
        return undefined; // No cleanup needed when error occurs
      }
    };
    
    // Call setup function and return its result directly
    return setupARExperience();
  }, [project, isLoading, toast, navigate]);

  // Loading state
  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin mb-4 text-indigo-500" />
          <h2 className="text-lg font-medium text-white">Đang tải thông tin dự án...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative bg-black">
      {!contentLoaded && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 animate-spin mb-4 text-indigo-500" />
            <h2 className="text-lg font-medium text-white">Đang tải trải nghiệm AR...</h2>
          </div>
        </div>
      )}
      
      <div id="ar-container" className="w-full h-full relative" />
      
      <div className="absolute top-4 left-4 z-50">
        <Button 
          variant="secondary" 
          size="sm" 
          className="gap-1.5 bg-black/50 hover:bg-black/70 text-white backdrop-blur-md border border-white/10 rounded-full shadow-lg transition-all duration-300" 
          onClick={() => navigate(`/view/${project.id}`)}
        >
          <ArrowLeft size={16} className="text-white" /> Quay lại
        </Button>
      </div>
    </div>
  );
}