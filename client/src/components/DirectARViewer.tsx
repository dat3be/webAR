import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { ArrowLeft, LayoutTemplate, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DirectARViewerProps {
  projectId: string;
}

export function DirectARViewer({ projectId }: DirectARViewerProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [arUrl, setArUrl] = useState<string>("");
  
  // Fetch project data
  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
  });

  useEffect(() => {
    if (project) {
      if (project.type === 'image-tracking' && !project.targetMindFile) {
        toast({
          title: "Hình ảnh chưa được đánh giá",
          description: "Vui lòng đánh giá hình ảnh mục tiêu trước khi trải nghiệm AR",
          variant: "destructive",
        });
        navigate(`/view/${projectId}`);
        return;
      }
      
      // Generate HTML content for AR viewing
      const arHtml = generateARHTML(project);
      
      // Create a blob with HTML content
      const blob = new Blob([arHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setArUrl(url);
      
      // Clean up on unmount
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [project, projectId, navigate, toast]);

  const generateARHTML = (project: Project): string => {
    const mindFileSrc = project.targetMindFile || "";
    const targetImageSrc = project.targetImageUrl || "";
    const contentSrc = project.modelUrl || "";
    
    // Content element based on project type
    let contentElement = '';
    if (project.contentType === '3d-model') {
      contentElement = `
      <a-plane src="#targetImage" position="0 0 0" height="0.552" width="1" rotation="0 0 0"></a-plane>
      <a-gltf-model
        rotation="0 0 0" 
        position="0 0 0.1" 
        scale="0.005 0.005 0.005" 
        src="#contentModel"
        animation="property: position; to: 0 0.1 0.1; dur: 1000; easing: easeInOutQuad; loop: true; dir: alternate"
      ></a-gltf-model>`;
    } else if (project.contentType === 'video') {
      contentElement = `
      <a-plane src="#targetImage" position="0 0 0" height="0.552" width="1" rotation="0 0 0"></a-plane>
      <a-video 
        src="#contentVideo" 
        position="0 0 0.1" 
        width="1" 
        height="0.552" 
        rotation="0 0 0"
      ></a-video>`;
    }
    
    // Asset definitions
    let assetElements = '';
    if (project.contentType === '3d-model') {
      assetElements = `
      <img id="targetImage" src="${targetImageSrc}" />
      <a-asset-item id="contentModel" src="${contentSrc}"></a-asset-item>`;
    } else if (project.contentType === 'video') {
      assetElements = `
      <img id="targetImage" src="${targetImageSrc}" />
      <video id="contentVideo" src="${contentSrc}" preload="auto" loop="true" playsinline muted></video>`;
    }
    
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${project.name} - AR Experience</title>
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
        background: rgba(0, 0, 0, 0.85);
        color: #fff;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 999;
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
      }
      .overlay-content {
        width: 90%;
        max-width: 440px;
        background: rgba(30, 30, 45, 0.8);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .overlay.hidden {
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.5s ease;
      }
      .overlay h2 {
        font-size: 1.8rem;
        margin-bottom: 16px;
        font-weight: 700;
        text-align: center;
        background: linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      .instruction-container {
        width: 100%;
        margin-bottom: 20px;
      }
      .instruction-step {
        display: flex;
        align-items: flex-start;
        margin-bottom: 12px;
        background: rgba(255, 255, 255, 0.05);
        padding: 10px;
        border-radius: 8px;
      }
      .step-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #6366f1;
        color: white;
        font-weight: 600;
        margin-right: 12px;
        flex-shrink: 0;
      }
      .instruction-step p {
        font-size: 0.9rem;
        margin: 0;
        flex: 1;
        line-height: 1.4;
      }
      .target-container {
        position: relative;
        width: 80%;
        max-width: 250px;
        margin: 16px 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .target-image {
        width: 100%;
        object-fit: contain;
        border-radius: 8px;
        border: 2px solid rgba(255, 255, 255, 0.15);
        z-index: 2;
      }
      .target-image-outline {
        position: absolute;
        top: -5px;
        left: -5px;
        right: -5px;
        bottom: -5px;
        border: 2px dashed rgba(99, 102, 241, 0.6);
        border-radius: 10px;
        animation: pulse 2s infinite ease-in-out;
        z-index: 1;
      }
      .target-scan-line {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, #6366f1, transparent);
        z-index: 3;
        animation: scan 2s infinite ease-in-out;
      }
      .overlay button {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border: none;
        color: white;
        padding: 14px 30px;
        text-align: center;
        font-size: 16px;
        font-weight: 600;
        border-radius: 32px;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        margin-top: 10px;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
      }
      .overlay button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
      }
      @keyframes pulse {
        0% { transform: scale(1); opacity: 0.6; }
        50% { transform: scale(1.03); opacity: 1; }
        100% { transform: scale(1); opacity: 0.6; }
      }
      @keyframes scan {
        0% { top: 0; opacity: 0.8; }
        100% { top: 100%; opacity: 0.2; }
      }
      .control-button {
        position: fixed;
        background: rgba(30, 30, 45, 0.7);
        color: white;
        border: none;
        border-radius: 50%;
        width: 48px;
        height: 48px;
        font-size: 18px;
        cursor: pointer;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        transition: all 0.2s ease;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .control-button:hover, .control-button:focus {
        background: rgba(99, 102, 241, 0.7);
        transform: scale(1.05);
      }
      .control-button:active {
        transform: scale(0.95);
      }
      .back-button {
        top: 16px;
        left: 16px;
      }
      .info-button {
        top: 16px;
        right: 16px;
      }
      .target-indicator {
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(30, 30, 45, 0.7);
        color: white;
        border: none;
        border-radius: 30px;
        padding: 8px 16px;
        font-size: 14px;
        z-index: 10;
        display: none;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .target-indicator.found {
        background: rgba(34, 197, 94, 0.7);
        display: flex;
      }
      .target-indicator.searching {
        display: flex;
        animation: pulse 1.5s infinite ease-in-out;
      }
    </style>
  </head>
  <body>
    <!-- Hướng dẫn -->
    <div id="startOverlay" class="overlay">
      <div class="overlay-content">
        <h2>${project.name}</h2>
        <div class="instruction-container">
          <div class="instruction-step">
            <div class="step-number">1</div>
            <p>Hướng camera điện thoại của bạn vào hình ảnh mục tiêu</p>
          </div>
          <div class="instruction-step">
            <div class="step-number">2</div>
            <p>Giữ thiết bị ổn định và chờ mô hình xuất hiện</p>
          </div>
          <div class="instruction-step">
            <div class="step-number">3</div>
            <p>Di chuyển để xem từ nhiều góc độ khác nhau</p>
          </div>
        </div>
        <div class="target-container">
          <img src="${targetImageSrc}" alt="Target Image" class="target-image">
          <div class="target-image-outline"></div>
          <div class="target-scan-line"></div>
        </div>
        <button id="startButton">Bắt Đầu AR Experience</button>
      </div>
    </div>

    <!-- Nút điều khiển -->
    <button class="control-button back-button" id="backButton">←</button>
    <button class="control-button info-button" id="infoButton">i</button>
    <div class="target-indicator searching" id="targetIndicator">Đang tìm kiếm hình ảnh...</div>

    <!-- A-Frame Scene -->
    <a-scene mindar-image="imageTargetSrc: ${mindFileSrc}; autoStart: false; uiScanning: true; uiLoading: true;" color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: true">
      <a-assets>
        ${assetElements}
      </a-assets>

      <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

      <a-entity mindar-image-target="targetIndex: 0">
        ${contentElement}
      </a-entity>
    </a-scene>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const sceneEl = document.querySelector('a-scene');
        const startOverlay = document.getElementById('startOverlay');
        const startButton = document.getElementById('startButton');
        const backButton = document.getElementById('backButton');
        const infoButton = document.getElementById('infoButton');
        const targetIndicator = document.getElementById('targetIndicator');
        
        // Ẩn nút điều khiển lúc đầu
        backButton.style.display = 'none';
        infoButton.style.display = 'none';
        targetIndicator.style.display = 'none';

        // Kiểm tra hỗ trợ camera
        function checkCameraSupport() {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Trình duyệt của bạn không hỗ trợ WebRTC camera. Vui lòng sử dụng trình duyệt hiện đại như Chrome, Firefox, Safari hoặc Edge.");
            return false;
          }
          return true;
        }
        
        // Kiểm tra truy cập camera
        async function requestCameraPermission() {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            // Đóng stream sau khi lấy quyền
            stream.getTracks().forEach(track => track.stop());
            return true;
          } catch (err) {
            console.error("Lỗi truy cập camera:", err);
            alert("Không thể truy cập camera. Vui lòng cấp quyền truy cập camera trong cài đặt trình duyệt.");
            return false;
          }
        }

        // Xử lý nút Bắt đầu
        startButton.addEventListener('click', async function() {
          // Kiểm tra camera
          if (!checkCameraSupport()) return;
          
          // Yêu cầu quyền truy cập camera
          const hasPermission = await requestCameraPermission();
          if (!hasPermission) return;
          
          startOverlay.classList.add('hidden');
          
          // Hiển thị các nút điều khiển
          backButton.style.display = 'flex';
          infoButton.style.display = 'flex';
          targetIndicator.style.display = 'flex';
          targetIndicator.classList.add('searching');
          targetIndicator.classList.remove('found');
          targetIndicator.textContent = 'Đang tìm kiếm hình ảnh...';
          
          // Bắt đầu AR
          try {
            await sceneEl.systems['mindar-image-system'].start();
            console.log("MindAR started successfully");
          } catch (err) {
            console.error("Failed to start MindAR:", err);
            alert("Lỗi khởi động AR: " + (err.message || "Không thể kết nối camera"));
            startOverlay.classList.remove('hidden');
            backButton.style.display = 'none';
            infoButton.style.display = 'none';
            targetIndicator.style.display = 'none';
            return;
          }
          
          // Bắt đầu video nếu có
          const video = document.querySelector('#contentVideo');
          if (video) {
            video.play().catch(e => console.error("Error playing video:", e));
          }
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
          targetIndicator.style.display = 'none';
          
          // Dừng video nếu có
          const video = document.querySelector('#contentVideo');
          if (video) {
            video.pause();
          }
        });

        // Xử lý nút Info
        infoButton.addEventListener('click', function() {
          alert('${project.name}\\n\\nHướng dẫn: Hướng camera vào hình ảnh mục tiêu để xem ${project.contentType === '3d-model' ? 'mô hình 3D' : 'video'} xuất hiện trên hình ảnh.');
        });
        
        // Xử lý sự kiện khi tìm thấy target
        const target = document.querySelector('a-entity[mindar-image-target]');
        target.addEventListener('targetFound', function() {
          console.log('Target found');
          
          // Cập nhật thông báo trạng thái
          targetIndicator.classList.remove('searching');
          targetIndicator.classList.add('found');
          targetIndicator.textContent = 'Đã tìm thấy hình ảnh!';
          
          // Thông báo sẽ tự động ẩn sau 3 giây
          setTimeout(() => {
            if (targetIndicator.classList.contains('found')) {
              targetIndicator.style.display = 'none';
            }
          }, 3000);
          
          // Bắt đầu video nếu có
          const video = document.querySelector('#contentVideo');
          if (video) {
            video.play().catch(e => console.error("Error playing video:", e));
          }
        });
        
        // Xử lý sự kiện khi mất target
        target.addEventListener('targetLost', function() {
          console.log('Target lost');
          
          // Cập nhật thông báo trạng thái
          targetIndicator.style.display = 'flex';
          targetIndicator.classList.add('searching');
          targetIndicator.classList.remove('found');
          targetIndicator.textContent = 'Đang tìm kiếm hình ảnh...';
          
          // Dừng video nếu có
          const video = document.querySelector('#contentVideo');
          if (video) {
            video.pause();
          }
        });
      });
    </script>
  </body>
</html>`;
  };

  // If loading, show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">Đang chuẩn bị trải nghiệm AR...</h2>
        <p className="text-slate-300 text-center max-w-md">Chúng tôi đang tạo trải nghiệm AR cho bạn. Vui lòng đợi trong giây lát.</p>
      </div>
    );
  }

  // If error, show error state
  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
        <div className="rounded-full h-12 w-12 bg-red-500 flex items-center justify-center mb-4">
          <span className="text-white text-xl">!</span>
        </div>
        <h2 className="text-xl font-semibold mb-2">Không thể tải dự án</h2>
        <p className="text-slate-300 text-center max-w-md">Có lỗi xảy ra khi tải thông tin dự án. Vui lòng thử lại sau.</p>
        <Button 
          variant="outline" 
          className="mt-4 border-white/20 hover:bg-white/10 text-white"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
      <div className="w-full max-w-3xl rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 p-6 shadow-xl border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
            {project.name}
          </h1>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1.5 border-slate-700 hover:bg-slate-800" 
            onClick={() => navigate(`/view/${project.id}`)}
          >
            <ArrowLeft size={16} /> 
            <span>Quay lại</span>
          </Button>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 items-center mb-6">
          <div className="w-full md:w-1/3 aspect-square rounded-lg overflow-hidden border-2 border-dashed border-indigo-400/30 p-1">
            <img 
              src={project.targetImageUrl || ""} 
              alt="Target Image" 
              className="w-full h-full object-contain rounded"
            />
          </div>
          
          <div className="w-full md:w-2/3 space-y-4">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-medium text-white mb-2 flex items-center">
                <LayoutTemplate className="mr-2 h-5 w-5 text-indigo-400" />
                Thông tin dự án
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Loại dự án:</span>
                  <span className="text-white font-medium">
                    {project.type === 'image-tracking' ? 'Theo dõi hình ảnh' : 'Markerless AR'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Loại nội dung:</span>
                  <span className="text-white font-medium">
                    {project.contentType === '3d-model' ? 'Mô hình 3D' : 'Video'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Trạng thái:</span>
                  <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-medium">
                    Sẵn sàng
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-white">Trải nghiệm AR</h3>
              <p className="text-slate-300 text-sm">
                Hướng dẫn camera điện thoại của bạn về phía hình ảnh mục tiêu ở bên trái để xem trải nghiệm AR.
              </p>
              
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium"
                  onClick={() => window.open(arUrl, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Mở trải nghiệm AR trong tab mới
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 mt-6">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Lưu ý quan trọng:</h3>
          <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
            <li>Trải nghiệm AR hoạt động tốt nhất trên thiết bị di động.</li>
            <li>Bạn sẽ cần cấp quyền truy cập camera.</li>
            <li>Đảm bảo môi trường có đủ ánh sáng để nhận diện hình ảnh tốt hơn.</li>
            <li>Nếu sử dụng máy tính, bạn có thể cần sử dụng webcam và in hình ảnh mục tiêu ra.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}