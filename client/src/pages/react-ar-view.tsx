import { useQuery } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Loader2 } from "lucide-react";

interface ReactARViewProps {
  projectId: string;
}

export default function ReactARView({ projectId }: ReactARViewProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneInitialized = useRef(false);

  // Fetch project data
  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
  });

  // Handle error
  useEffect(() => {
    if (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin dự án. Vui lòng thử lại sau.",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  }, [error, toast, navigate]);

  // Initialize AR scene
  useEffect(() => {
    // Đảm bảo project đã load xong và scene chưa được khởi tạo
    if (isLoading || !project || sceneInitialized.current || !containerRef.current) return;
    
    console.log("Initializing AR Scene with project:", project);
    
    // Tạo iframe chứa AR experience
    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.position = "absolute";
    iframe.style.left = "0";
    iframe.style.top = "0";
    iframe.style.zIndex = "10";
    
    // Demo fallback URLs nếu project không có URL
    const demoMindFile = "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind";
    const demoImageUrl = "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.png";
    const demoModelUrl = "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/softmind/scene.gltf";
    
    // Use project data or fallback to demo
    const mindFileUrl = project.targetMindFile || demoMindFile;
    const targetImageUrl = project.targetImageUrl || demoImageUrl;
    const modelUrl = project.modelUrl || demoModelUrl;
    const projectName = project.name || "Demo AR";
    const contentType = project.contentType || "3d-model";
    
    // Nội dung HTML cho AR experience
    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${project.name} - WebAR Experience</title>
    <script src="https://cdn.jsdelivr.net/gh/aframevr/aframe@v1.4.2/dist/aframe-v1.4.2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.2/dist/mindar-image-aframe.prod.js"></script>
    <style>
      body {
        margin: 0;
        padding: 0;
        width: 100vw;
        height: 100vh;
        position: relative;
        overflow: hidden;
      }
      .overlay {
        position: fixed;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 999;
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
      }
      .overlay.hidden {
        display: none;
      }
      .overlay h2 {
        font-size: 1.5rem;
        margin-bottom: 10px;
      }
      .overlay p {
        font-size: 1rem;
        max-width: 320px;
        text-align: center;
        margin-bottom: 20px;
      }
      .overlay button {
        background: #4CAF50;
        border: none;
        color: white;
        padding: 10px 20px;
        text-align: center;
        font-size: 16px;
        border-radius: 5px;
        cursor: pointer;
      }
      .back-button {
        position: fixed;
        top: 10px;
        left: 10px;
        background: rgba(0,0,0,0.5);
        color: white;
        border: none;
        border-radius: 50%;
        width: 44px;
        height: 44px;
        font-size: 16px;
        cursor: pointer;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .info-button {
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.5);
        color: white;
        border: none;
        border-radius: 50%;
        width: 44px;
        height: 44px;
        font-size: 20px;
        cursor: pointer;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .target-image {
        max-width: 80%;
        max-height: 200px;
        object-fit: contain;
        border-radius: 8px;
        margin-bottom: 20px;
        border: 2px solid #fff;
      }
    </style>
  </head>
  <body>
    <!-- Hướng dẫn -->
    <div id="startOverlay" class="overlay">
      <h2 style="font-weight:600;background:linear-gradient(135deg, #6366f1, #8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1.5rem">${projectName}</h2>
      <p>Hướng camera điện thoại của bạn vào hình ảnh mục tiêu bên dưới để xem trải nghiệm AR:</p>
      <img src="${targetImageUrl}" alt="Target Image" class="target-image" style="box-shadow:0 10px 25px rgba(0,0,0,0.3)">
      <button id="startButton" style="background:linear-gradient(135deg, #6366f1, #8b5cf6);font-weight:500;padding:12px 25px;transition:all 0.3s;box-shadow:0 4px 12px rgba(99,102,241,0.5)">Bắt Đầu Trải Nghiệm AR</button>
    </div>

    <!-- Nút trở về và thông tin -->
    <button class="back-button" id="backButton" style="background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);box-shadow:0 4px 12px rgba(0,0,0,0.15);transform:translateY(-10px);opacity:0;transition:all 0.3s ease-out">←</button>
    <button class="info-button" id="infoButton" style="background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);box-shadow:0 4px 12px rgba(0,0,0,0.15);transform:translateY(-10px);opacity:0;transition:all 0.3s ease-out">i</button>

    <!-- A-Frame Scene -->
    <a-scene mindar-image="imageTargetSrc: ${mindFileUrl}; autoStart: false;" color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false">
      <a-assets>
        <img id="card" src="${targetImageUrl}" />
        ${contentType === '3d-model' ? 
          `<a-asset-item id="contentModel" src="${modelUrl}"></a-asset-item>` : 
          `<video id="contentVideo" src="${modelUrl}" preload="auto" loop muted playsinline webkit-playsinline="true" crossorigin="anonymous"></video>`
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
      document.addEventListener('DOMContentLoaded', function() {
        const sceneEl = document.querySelector('a-scene');
        const startOverlay = document.getElementById('startOverlay');
        const startButton = document.getElementById('startButton');
        const backButton = document.getElementById('backButton');
        const infoButton = document.getElementById('infoButton');
        
        // Ẩn nút Back và Info lúc đầu
        backButton.style.display = 'none';
        infoButton.style.display = 'none';
        
        // Xử lý với video nếu có
        ${contentType === 'video' ? 
          `const videoEl = document.getElementById('contentVideo');
          if (videoEl) {
            // Kích hoạt video khi target được tìm thấy
            const videoEntity = document.querySelector('a-video');
            videoEntity.addEventListener('targetFound', function() {
              videoEl.play();
            });
            // Tạm dừng video khi target bị mất
            videoEntity.addEventListener('targetLost', function() {
              videoEl.pause();
            });
          }` : ''
        }

        // Xử lý nút Bắt đầu
        startButton.addEventListener('click', function() {
          startOverlay.classList.add('hidden');
          
          // Hiển thị các nút điều khiển
          backButton.style.display = 'flex';
          infoButton.style.display = 'flex';
          
          // Hiệu ứng hiển thị
          setTimeout(() => {
            backButton.style.transform = 'translateY(0)';
            backButton.style.opacity = '1';
            
            setTimeout(() => {
              infoButton.style.transform = 'translateY(0)';
              infoButton.style.opacity = '1';
            }, 100);
          }, 300);
          
          // Bắt đầu AR
          sceneEl.systems['mindar-image-system'].start();
        });

        // Xử lý nút Back
        backButton.addEventListener('click', function() {
          // Dừng AR
          sceneEl.systems['mindar-image-system'].stop();
          
          // Hiển thị lại hướng dẫn
          startOverlay.classList.remove('hidden');
          
          // Ẩn nút điều khiển
          backButton.style.opacity = '0';
          infoButton.style.opacity = '0';
          
          setTimeout(() => {
            backButton.style.display = 'none';
            infoButton.style.display = 'none';
          }, 300);
        });

        // Xử lý nút Info
        infoButton.addEventListener('click', function() {
          // Tạo modal thông báo tùy chỉnh
          const modal = document.createElement('div');
          modal.style.position = 'fixed';
          modal.style.top = '0';
          modal.style.left = '0';
          modal.style.width = '100%';
          modal.style.height = '100%';
          modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
          modal.style.display = 'flex';
          modal.style.justifyContent = 'center';
          modal.style.alignItems = 'center';
          modal.style.zIndex = '1000';
          modal.style.backdropFilter = 'blur(5px)';
          
          const content = document.createElement('div');
          content.style.backgroundColor = 'rgba(15, 15, 15, 0.95)';
          content.style.color = 'white';
          content.style.padding = '25px';
          content.style.borderRadius = '12px';
          content.style.maxWidth = '80%';
          content.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
          content.style.border = '1px solid rgba(255, 255, 255, 0.1)';
          content.style.transform = 'translateY(20px)';
          content.style.opacity = '0';
          content.style.transition = 'all 0.3s ease-out';
          
          const title = document.createElement('h3');
          title.textContent = 'Hướng Dẫn Sử Dụng AR';
          title.style.margin = '0 0 15px 0';
          title.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
          title.style.WebkitBackgroundClip = 'text';
          title.style.WebkitTextFillColor = 'transparent';
          title.style.fontSize = '20px';
          title.style.fontWeight = '600';
          
          const text = document.createElement('p');
          text.innerHTML = 'Hướng camera của bạn vào hình ảnh mục tiêu để xem ${contentType === '3d-model' ? 'mô hình 3D' : 'video'} xuất hiện.<br><br>${contentType === '3d-model' ? 'Khi mô hình xuất hiện, nó sẽ chuyển động nhẹ nhàng lên xuống trong trạng thái hình ảnh được nhận diện.' : 'Khi video xuất hiện, nó sẽ tự động phát và tạm dừng khi hình ảnh mục tiêu bị mất.'}';
          text.style.margin = '0 0 20px 0';
          text.style.lineHeight = '1.5';
          text.style.fontSize = '15px';
          
          const closeBtn = document.createElement('button');
          closeBtn.textContent = 'Đã hiểu';
          closeBtn.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
          closeBtn.style.border = 'none';
          closeBtn.style.color = 'white';
          closeBtn.style.padding = '10px 20px';
          closeBtn.style.borderRadius = '8px';
          closeBtn.style.fontWeight = '500';
          closeBtn.style.cursor = 'pointer';
          closeBtn.style.width = '100%';
          closeBtn.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
          
          closeBtn.addEventListener('click', function() {
            content.style.transform = 'translateY(20px)';
            content.style.opacity = '0';
            
            setTimeout(() => {
              document.body.removeChild(modal);
            }, 300);
          });
          
          content.appendChild(title);
          content.appendChild(text);
          content.appendChild(closeBtn);
          modal.appendChild(content);
          document.body.appendChild(modal);
          
          // Hiệu ứng hiển thị
          setTimeout(() => {
            content.style.transform = 'translateY(0)';
            content.style.opacity = '1';
          }, 10);
        });
      });
    </script>
  </body>
</html>`;

    // Create blob and set as iframe src
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;

    // Add iframe to container
    containerRef.current.appendChild(iframe);
    sceneInitialized.current = true;

    // Cleanup on unmount
    return () => {
      URL.revokeObjectURL(url);
      if (containerRef.current && iframe) {
        containerRef.current.removeChild(iframe);
      }
      sceneInitialized.current = false;
    };
  }, [project, isLoading]);

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
      <div ref={containerRef} className="h-full w-full relative" />
      
      <div className="absolute top-4 left-4 z-20">
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