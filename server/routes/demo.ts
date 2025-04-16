import { Request, Response } from "express";

/**
 * Trả về mã HTML demo AR experience mẫu
 */
export function getDemoARExperienceHTML(req: Request, res: Response) {
  // Mã HTML mẫu cho AR experience
  const arDemoHTML = `<!DOCTYPE html>
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
      <h2>Demo AR Experience</h2>
      <p>Hướng camera điện thoại của bạn vào hình ảnh mục tiêu bên dưới để xem trải nghiệm AR:</p>
      <img src="https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.png" alt="Target Image" class="target-image">
      <button id="startButton">Bắt Đầu Demo AR</button>
    </div>

    <!-- Nút trở về và thông tin -->
    <button class="back-button" id="backButton">←</button>
    <button class="info-button" id="infoButton">i</button>

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
          alert('Demo AR Experience\n\nHướng dẫn: Hướng camera vào hình ảnh mục tiêu để xem mô hình 3D xuất hiện trên hình ảnh.');
        });
      });
    </script>
  </body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(arDemoHTML);
}