import { useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MinimalARViewProps {
  projectId: string;
}

export default function MinimalARView({ projectId }: MinimalARViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Fetch project data
  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
  });

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

  useEffect(() => {
    // Nếu dự án đã được tải, tạo iframe với mã HTML tối thiểu
    if (project && !isLoading) {
      const iframe = iframeRef.current;
      if (!iframe) return;

      // Sử dụng demoMindFile nếu dự án không có targetMindFile
      const mindFileUrl = project.targetMindFile || 
        "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind";
      
      // Sử dụng targetImageUrl của dự án nếu có, nếu không thì dùng mặc định
      const targetImageUrl = project.targetImageUrl || 
        "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.png";
      
      const modelUrl = project.modelUrl || 
        "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/softmind/scene.gltf";

      // Tạo HTML code
      let htmlContent = '';
      
      if (project.contentType === '3d-model') {
        // HTML cho mô hình 3D
        htmlContent = `
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <!-- Sử dụng phiên bản ổn định của aframe và mind-ar -->
              <script src="https://cdn.jsdelivr.net/gh/aframevr/aframe@v1.4.2/dist/aframe-v1.4.2.min.js"></script>
              <script src="https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.2/dist/mindar-image-aframe.prod.js"></script>
              <style>
                body { margin: 0; overflow: hidden; }
                .back-button {
                  position: fixed;
                  top: 20px;
                  left: 20px;
                  z-index: 100;
                  background: rgba(0,0,0,0.5);
                  color: white;
                  border: none;
                  padding: 10px 20px;
                  border-radius: 5px;
                  cursor: pointer;
                }
                .ar-overlay {
                  position: fixed;
                  bottom: 20px;
                  left: 50%;
                  transform: translateX(-50%);
                  background: rgba(255,255,255,0.8);
                  color: black;
                  padding: 10px 20px;
                  border-radius: 20px;
                  font-family: Arial, sans-serif;
                  text-align: center;
                  z-index: 100;
                }
              </style>
            </head>
            <body>
              <div class="ar-overlay">
                Hướng camera vào hình ảnh mục tiêu để kích hoạt AR
              </div>
              <a-scene mindar-image="imageTargetSrc: ${mindFileUrl}; autoStart: true; uiScanning: #scanning-overlay; uiLoading: #loading-overlay;" embedded color-space="sRGB" renderer="colorManagement: true; physicallyCorrectLights: true" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: true">
                <a-assets>
                  <img id="target-image" src="${targetImageUrl}" />
                  <a-asset-item id="model" src="${modelUrl}"></a-asset-item>
                </a-assets>
                
                <a-camera position="0 0 0" look-controls="enabled: false" cursor="fuse: false; rayOrigin: mouse;" raycaster="far: 10000; objects: .clickable"></a-camera>
                
                <a-entity id="example-target" mindar-image-target="targetIndex: 0">
                  <a-plane src="#target-image" position="0 0 0" height="0.552" width="1" rotation="0 0 0" opacity="0.9"></a-plane>
                  <a-gltf-model rotation="0 0 0" position="0 0 0.1" scale="0.005 0.005 0.005" src="#model"
                    animation="property: position; to: 0 0.1 0.1; dur: 1000; easing: easeInOutQuad; loop: true; dir: alternate"></a-gltf-model>
                </a-entity>
              </a-scene>
              
              <!-- UI Elements -->
              <div id="scanning-overlay" style="display: flex; align-items: center; justify-content: center; position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 2;">
                <div style="font-size: 1.25em; color: white; text-align: center; background-color: rgba(0, 0, 0, 0.3); padding: 2em; border-radius: 10px;">
                  Quét hình ảnh mục tiêu<br/>
                  <div style="font-size: 0.85em; margin-top: 1em;">
                    Di chuyển camera đến hình ảnh mục tiêu
                  </div>
                  <img src="${targetImageUrl}" style="max-height: 200px; max-width: 100%; margin-top: 1em; border-radius: 5px; border: 2px solid white;">
                </div>
              </div>
              
              <div id="loading-overlay" style="display: flex; flex-direction: column; align-items: center; justify-content: center; position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: white; z-index: 3;">
                <div style="font-size: 1.25em; font-weight: bold; margin-bottom: 1em;">Đang tải AR Experience</div>
                <div style="width: 50px; height: 50px; border: 5px solid #eee; border-top: 5px solid #888; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <style>
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                </style>
              </div>
            </body>
          </html>
        `;
      } else {
        // HTML cho video
        htmlContent = `
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <!-- Sử dụng phiên bản ổn định của aframe và mind-ar -->
              <script src="https://cdn.jsdelivr.net/gh/aframevr/aframe@v1.4.2/dist/aframe-v1.4.2.min.js"></script>
              <script src="https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.2/dist/mindar-image-aframe.prod.js"></script>
              <style>
                body { margin: 0; overflow: hidden; }
                .back-button {
                  position: fixed;
                  top: 20px;
                  left: 20px;
                  z-index: 100;
                  background: rgba(0,0,0,0.5);
                  color: white;
                  border: none;
                  padding: 10px 20px;
                  border-radius: 5px;
                  cursor: pointer;
                }
                .ar-overlay {
                  position: fixed;
                  bottom: 20px;
                  left: 50%;
                  transform: translateX(-50%);
                  background: rgba(255,255,255,0.8);
                  color: black;
                  padding: 10px 20px;
                  border-radius: 20px;
                  font-family: Arial, sans-serif;
                  text-align: center;
                  z-index: 100;
                }
              </style>
            </head>
            <body>
              <div class="ar-overlay">
                Hướng camera vào hình ảnh mục tiêu để kích hoạt AR
              </div>
              <a-scene mindar-image="imageTargetSrc: ${mindFileUrl}; autoStart: true; uiScanning: #scanning-overlay; uiLoading: #loading-overlay;" embedded color-space="sRGB" renderer="colorManagement: true; physicallyCorrectLights: true" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: true">
                <a-assets>
                  <img id="target-image" src="${targetImageUrl}" />
                  <video id="video" src="${project.modelUrl}" preload="auto" loop="true" muted="true" playsinline webkit-playsinline="true" crossorigin="anonymous"></video>
                </a-assets>
                
                <a-camera position="0 0 0" look-controls="enabled: false" cursor="fuse: false; rayOrigin: mouse;" raycaster="far: 10000; objects: .clickable"></a-camera>
                
                <a-entity id="example-target" mindar-image-target="targetIndex: 0">
                  <a-plane src="#target-image" position="0 0 0" height="0.552" width="1" rotation="0 0 0" opacity="0.9"></a-plane>
                  <a-video src="#video" position="0 0 0.1" width="1" height="0.552" rotation="0 0 0"></a-video>
                </a-entity>
              </a-scene>
              
              <!-- UI Elements -->
              <div id="scanning-overlay" style="display: flex; align-items: center; justify-content: center; position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 2;">
                <div style="font-size: 1.25em; color: white; text-align: center; background-color: rgba(0, 0, 0, 0.3); padding: 2em; border-radius: 10px;">
                  Quét hình ảnh mục tiêu<br/>
                  <div style="font-size: 0.85em; margin-top: 1em;">
                    Di chuyển camera đến hình ảnh mục tiêu
                  </div>
                  <img src="${targetImageUrl}" style="max-height: 200px; max-width: 100%; margin-top: 1em; border-radius: 5px; border: 2px solid white;">
                </div>
              </div>
              
              <div id="loading-overlay" style="display: flex; flex-direction: column; align-items: center; justify-content: center; position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: white; z-index: 3;">
                <div style="font-size: 1.25em; font-weight: bold; margin-bottom: 1em;">Đang tải AR Experience</div>
                <div style="width: 50px; height: 50px; border: 5px solid #eee; border-top: 5px solid #888; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <style>
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                </style>
              </div>
            </body>
          </html>
        `;
      }

      // Thiết lập nội dung cho iframe
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      iframe.src = url;

      // Clean up URL object khi unmount
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [project, isLoading]);

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary/60" />
          <h2 className="text-xl font-medium">Đang tải trải nghiệm AR...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black">
      <iframe 
        ref={iframeRef}
        className="w-full h-full border-0"
        allow="camera; gyroscope; accelerometer; magnetometer; xr-spatial-tracking;"
      />
    </div>
  );
}