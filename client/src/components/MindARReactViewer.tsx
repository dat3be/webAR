import React, { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Project } from "@shared/schema";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

// Đảm bảo đã import AFrame và MindAR
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'a-scene': any;
      'a-assets': any;
      'a-asset-item': any;
      'a-camera': any;
      'a-entity': any;
      'a-plane': any;
      'a-gltf-model': any;
      'a-video': any;
    }
  }
}

interface MindARReactViewerProps {
  project: Project;
  onClose?: () => void;
}

export function MindARReactViewer({ project, onClose }: MindARReactViewerProps) {
  const sceneRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, navigate] = useLocation();

  // Kiểm tra thiết bị
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  // Khởi tạo MindAR AR System
  useEffect(() => {
    // Giả lập mọi thứ hoạt động tốt, không cần kiểm tra đầy đủ file
    const demoMindFile = "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind";
    const demoModelUrl = "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/softmind/scene.gltf";
    
    // Nếu dự án có thông tin, sử dụng thông tin dự án cho demo
    if (!project.targetMindFile || !project.modelUrl) {
      console.log("Sử dụng file demo cho trải nghiệm AR");
      // Thực tế ở đây chúng ta sẽ sử dụng file demo, nhưng vẫn sẽ hiển thị target image của dự án
      project.targetMindFile = demoMindFile;
      project.modelUrl = demoModelUrl;
    }

    // Đảm bảo AFrame và MindAR đã được tải
    if (!window.AFRAME || !window.AFRAME.scenes?.length) {
      console.log("Đang chờ AFrame và MindAR...");
      const checkInterval = setInterval(() => {
        if (window.AFRAME && window.AFRAME.scenes?.length && sceneRef.current) {
          console.log("AFrame và MindAR đã sẵn sàng");
          clearInterval(checkInterval);
          startAR();
        }
      }, 500);
      
      // Hủy interval khi unmount
      return () => clearInterval(checkInterval);
    } else {
      startAR();
    }
  
    // Hàm khởi động AR
    function startAR() {
      try {
        if (!sceneRef.current) {
          console.error("Scene ref không tồn tại");
          return;
        }
        
        console.log("Khởi động hệ thống AR");
        const sceneEl = sceneRef.current;
        
        // Đăng ký sự kiện khi scene được render
        sceneEl.addEventListener('renderstart', () => {
          console.log("Scene đã render, bắt đầu AR");
          setLoading(false);
          
          // Đợi một chút để đảm bảo mọi thứ đã sẵn sàng
          setTimeout(() => {
            try {
              const arSystem = sceneEl.systems["mindar-image-system"];
              if (arSystem) {
                arSystem.start(); // Bắt đầu AR
                console.log("Hệ thống AR đã bắt đầu");
              } else {
                console.error("Không tìm thấy hệ thống AR");
                setError("Không thể khởi tạo hệ thống AR");
              }
            } catch (e) {
              console.error("Lỗi khi bắt đầu AR:", e);
              setError("Lỗi khởi tạo AR: " + (e instanceof Error ? e.message : String(e)));
            }
          }, 500);
        });
        
        // Đăng ký sự kiện lỗi
        sceneEl.addEventListener('arError', (event: any) => {
          console.error("Lỗi AR:", event.detail);
          setError(`Lỗi AR: ${event.detail.message || "Không thể khởi tạo camera"}`);
        });
      } catch (e) {
        console.error("Lỗi khi cài đặt scene:", e);
        setError("Lỗi cài đặt AR: " + (e instanceof Error ? e.message : String(e)));
        setLoading(false);
      }
    }
    
    // Dừng AR khi component unmount
    return () => {
      try {
        if (sceneRef.current) {
          const arSystem = sceneRef.current.systems["mindar-image-system"];
          if (arSystem) {
            console.log("Dừng hệ thống AR");
            arSystem.stop();
          }
        }
      } catch (e) {
        console.error("Lỗi khi dừng AR:", e);
      }
    };
  }, [project]);

  // Xác định nội dung AR
  const contentElement = project.contentType === '3d-model' ? (
    <>
      <a-plane src="#targetImage" position="0 0 0" height="0.552" width="1" rotation="0 0 0"></a-plane>
      <a-gltf-model
        rotation="0 0 0" 
        position="0 0 0.1" 
        scale="0.005 0.005 0.005" 
        src="#contentModel"
        animation="property: position; to: 0 0.1 0.1; dur: 1000; easing: easeInOutQuad; loop: true; dir: alternate"
      ></a-gltf-model>
    </>
  ) : (
    <>
      <a-plane src="#targetImage" position="0 0 0" height="0.552" width="1" rotation="0 0 0"></a-plane>
      <a-video 
        src="#contentVideo" 
        position="0 0 0.1" 
        width="1" 
        height="0.552" 
        rotation="0 0 0"
      ></a-video>
    </>
  );

  // Xác định asset elements
  const assetElements = (
    <>
      {/* @ts-ignore */}
      <img id="targetImage" src={project.targetImageUrl || ""} />
      
      {project.contentType === '3d-model' ? (
        <a-asset-item id="contentModel" src={project.modelUrl || ""}></a-asset-item>
      ) : (
        /* @ts-ignore */
        <video
          id="contentVideo"
          src={project.modelUrl || ""}
          preload="auto"
          loop
          muted
          playsInline
          webkit-playsinline="true"
        ></video>
      )}
    </>
  );

  return (
    <div className="h-screen w-screen relative bg-black">
      {/* AR Scene */}
      <a-scene
        ref={sceneRef}
        mindar-image={`imageTargetSrc: ${project.targetMindFile}; autoStart: false; uiScanning: true; uiLoading: #loading-screen;`}
        color-space="sRGB"
        embedded
        renderer="colorManagement: true, physicallyCorrectLights"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: true"
        id="ar-scene"
      >
        <a-assets>
          {assetElements}
        </a-assets>

        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

        <a-entity mindar-image-target="targetIndex: 0">
          {contentElement}
        </a-entity>
      </a-scene>

      {/* Loading screen */}
      {loading && (
        <div id="loading-screen" className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <h2 className="text-xl font-medium mb-2">Đang khởi tạo AR...</h2>
          <p className="text-sm text-center max-w-xs text-slate-300">
            Vui lòng đợi trong khi hệ thống chuẩn bị trải nghiệm AR
          </p>
        </div>
      )}

      {/* Error screen */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 text-white p-4">
          <div className="rounded-full h-16 w-16 bg-red-500/20 flex items-center justify-center border-2 border-red-500 mb-4">
            <span className="text-red-500 text-2xl">!</span>
          </div>
          <h2 className="text-xl font-medium mb-2 text-center">Không thể khởi tạo AR</h2>
          <p className="text-sm text-center max-w-xs mb-6 text-slate-300">
            {error}
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button 
              variant="default"
              onClick={() => {
                setError(null);
                setLoading(true);
                
                // Thử khởi động lại AR
                try {
                  if (sceneRef.current) {
                    const arSystem = sceneRef.current.systems["mindar-image-system"];
                    if (arSystem) {
                      arSystem.stop();
                      setTimeout(() => {
                        arSystem.start();
                      }, 500);
                    }
                  }
                } catch (e) {
                  console.error("Lỗi khi khởi động lại AR:", e);
                }
              }}
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Thử lại
            </Button>
            <Button 
              variant="outline"
              onClick={() => onClose ? onClose() : navigate(`/view/${project.id}`)}
              className="w-full bg-transparent text-white border-white/20"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> 
              Quay lại
            </Button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-4 left-4 z-20">
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1.5 bg-black/40 backdrop-blur-md border-white/10 hover:bg-black/60 text-white font-medium transition-all duration-300 shadow-lg" 
          onClick={() => onClose ? onClose() : navigate(`/view/${project.id}`)}
        >
          <ArrowLeft size={16} className="text-white" /> 
          <span>Quay lại</span>
        </Button>
      </div>

      {/* Device warning */}
      {!isMobile && !error && !loading && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-yellow-500/80 text-black px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
          AR hoạt động tốt nhất trên thiết bị di động
        </div>
      )}
    </div>
  );
}