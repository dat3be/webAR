import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { useLocation } from "wouter";

export default function ARDemo() {
  const [, navigate] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneInitialized = useRef(false);

  useEffect(() => {
    // Chỉ khởi tạo scene một lần
    if (sceneInitialized.current || !containerRef.current) return;
    
    // Tạo iframe chứa AR experience
    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.position = "absolute";
    iframe.style.left = "0";
    iframe.style.top = "0";
    iframe.style.zIndex = "10";
    
    // Nội dung HTML cho AR experience
    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MindAR Demo - WebAR Platform</title>
    <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"></script>
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
      <h2 style="font-weight:600;background:linear-gradient(135deg, #6366f1, #8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1.5rem">Demo Trải Nghiệm AR</h2>
      <p>Hướng camera điện thoại của bạn vào hình ảnh mục tiêu bên dưới để xem trải nghiệm AR:</p>
      <img src="https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.png" alt="Target Image" class="target-image" style="box-shadow:0 10px 25px rgba(0,0,0,0.3)">
      <button id="startButton" style="background:linear-gradient(135deg, #6366f1, #8b5cf6);font-weight:500;padding:12px 25px;transition:all 0.3s;box-shadow:0 4px 12px rgba(99,102,241,0.5)">Bắt Đầu Demo AR</button>
    </div>

    <!-- Nút trở về và thông tin -->
    <button class="back-button" id="backButton" style="background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);box-shadow:0 4px 12px rgba(0,0,0,0.15);transform:translateY(-10px);opacity:0;transition:all 0.3s ease-out">←</button>
    <button class="info-button" id="infoButton" style="background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);box-shadow:0 4px 12px rgba(0,0,0,0.15);transform:translateY(-10px);opacity:0;transition:all 0.3s ease-out">i</button>

    <!-- A-Frame Scene -->
    <a-scene mindar-image="imageTargetSrc: https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind; autoStart: false;" color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false">
      <a-assets>
        <img id="card" src="https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.png" />
        <a-asset-item id="avatarModel" src="https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/softmind/scene.gltf"></a-asset-item>
      </a-assets>

      <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

      <a-entity mindar-image-target="targetIndex: 0">
        <a-plane src="#card" position="0 0 0" height="0.552" width="1" rotation="0 0 0"></a-plane>
        <a-gltf-model rotation="0 0 0 " position="0 0 0.1" scale="0.005 0.005 0.005" src="#avatarModel"
          animation="property: position; to: 0 0.1 0.1; dur: 1000; easing: easeInOutQuad; loop: true; dir: alternate"
        >
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
          backButton.style.display = 'none';
          infoButton.style.display = 'none';
        });

        // Xử lý nút Info
        infoButton.addEventListener('click', function() {
          // Tạo modal thông báo tùy chỉnh thay vì dùng alert() mặc định
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
          text.innerHTML = 'Hướng camera của bạn vào hình ảnh mục tiêu để xem mô hình 3D xuất hiện.<br><br>Khi mô hình xuất hiện, nó sẽ chuyển động nhẹ nhàng lên xuống trong trạng thái hình ảnh được nhận diện.';
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

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;

    containerRef.current.appendChild(iframe);
    sceneInitialized.current = true;

    return () => {
      URL.revokeObjectURL(url);
      if (containerRef.current && iframe) {
        containerRef.current.removeChild(iframe);
      }
      sceneInitialized.current = false;
    };
  }, []);

  return (
    <div className="h-screen w-screen relative bg-black">
      <div ref={containerRef} className="h-full w-full relative" />
      
      <div className="absolute top-4 left-4 z-20">
        <Button 
          variant="secondary" 
          size="sm" 
          className="gap-1.5 bg-black/50 hover:bg-black/70 text-white backdrop-blur-md border border-white/10 rounded-full shadow-lg transition-all duration-300" 
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={16} className="text-white" /> Quay lại
        </Button>
      </div>
    </div>
  );
}