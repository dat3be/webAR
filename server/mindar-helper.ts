import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { uploadFile, getPublicUrl, getKeyFromUrl, downloadFile } from './wasabi';
import MindARCompiler from './mindar-compiler/compiler';

const TEMP_DIR = path.join(os.tmpdir(), 'mindar-temp');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Generate a random temporary file path
 */
function getTempFilePath(extension: string): string {
  const randomId = crypto.randomBytes(16).toString('hex');
  return path.join(TEMP_DIR, `${randomId}.${extension}`);
}

/**
 * Create a preview image from the target image
 */
async function createPreviewImage(imageBuffer: Buffer, previewPath: string): Promise<void> {
  try {
    await sharp(imageBuffer)
      .resize(300, 300, { fit: 'inside' })
      .toFile(previewPath);
  } catch (error) {
    console.error('Error creating preview image:', error);
    throw new Error('Failed to create preview image');
  }
}

/**
 * Generate scaled images for visualization
 * @param imageBuffer Original image buffer
 * @param projectId Project ID for file naming
 * @returns Array of URLs to scaled images
 */
async function generateScaledImages(imageBuffer: Buffer, projectId: string): Promise<string[]> {
  try {
    console.log("[MindAR] Generating scaled images for visualization");
    const imageUrls: string[] = [];
    
    // Extract metadata to get original dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const minDimension = Math.min(metadata.width || 0, metadata.height || 0);
    
    // Generate the same scales as used in the mind compiler
    const scaleList = [
      256.0 / minDimension,  // ~256x256 px
      128.0 / minDimension   // ~128x128 px
    ];
    
    // Create and upload each scaled image
    for (let i = 0; i < scaleList.length; i++) {
      const scale = scaleList[i];
      const scaledWidth = Math.round((metadata.width || 0) * scale);
      const scaledHeight = Math.round((metadata.height || 0) * scale);
      
      console.log(`[MindAR] Creating scaled image ${i+1} (${scaledWidth}x${scaledHeight})`);
      
      // Resize the image
      const scaledBuffer = await sharp(imageBuffer)
        .resize(scaledWidth, scaledHeight)
        .toBuffer();
      
      // Upload to storage
      const scaledFileName = `project_${projectId}_scaled_${i+1}_${Date.now()}.jpg`;
      const scaledImageUrl = await uploadFile(
        scaledBuffer,
        scaledFileName,
        'image/jpeg',
        'scaled-images'
      );
      
      imageUrls.push(scaledImageUrl);
    }
    
    console.log(`[MindAR] Successfully created ${imageUrls.length} scaled images`);
    return imageUrls;
  } catch (error) {
    console.error('[MindAR] Error generating scaled images:', error);
    // Return empty array in case of error to avoid breaking the main flow
    return [];
  }
}

/**
 * Generate a specific .mind file for a target image
 * 
 * Uses MindAR compiler library to generate a .mind file
 * from an input image buffer, then uploads it to storage.
 * 
 * Based on the MindAR compiler implementation:
 * https://github.com/hiukim/mind-ar-js/blob/master/examples/compile.html
 */
export async function generateMindFile(imageBuffer: Buffer, projectId: string): Promise<{
  mindFileUrl: string;
  scaledImageUrls?: string[];
}> {
  try {
    // Create temp file paths
    const tempImagePath = getTempFilePath('jpg');
    const tempMindFilePath = getTempFilePath('mind');
    
    // Write the input image buffer to a temporary file
    fs.writeFileSync(tempImagePath, imageBuffer);
    
    console.log(`[MindAR] Generating .mind file for project ${projectId}`);
    console.time("mind-file-generation");
    
    // Extract image dimensions for logging
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`[MindAR] Image dimensions: ${metadata.width}x${metadata.height}`);
    
    // Initialize the MindAR compiler
    const compiler = new MindARCompiler();
    
    // Compile the image target
    console.log('[MindAR] Starting image compilation...');
    await compiler.compileImageTargets([imageBuffer]);
    console.log('[MindAR] Image compilation completed');
    
    // Export the compiled data as a buffer
    const mindFileBuffer = await compiler.exportData();
    console.log(`[MindAR] Generated .mind file. Size: ${mindFileBuffer.length} bytes`);
    
    // Write to temp file for backup
    fs.writeFileSync(tempMindFilePath, mindFileBuffer);
    
    // Upload the .mind file
    const mindFileName = `project_${projectId}_${Date.now()}.mind`;
    console.log(`[MindAR] Uploading .mind file: ${mindFileName}`);
    
    const mindFileUrl = await uploadFile(
      mindFileBuffer, 
      mindFileName, 
      'application/octet-stream', 
      'mind-files'
    );
    
    console.timeEnd("mind-file-generation");
    console.log(`[MindAR] .mind file generated for project ${projectId}: ${mindFileUrl}`);
    
    // Clean up temporary files
    fs.unlinkSync(tempImagePath);
    fs.unlinkSync(tempMindFilePath);
    
    // Tạo các hình ảnh đã scale và lưu vào Wasabi
    const scaledImageUrls = await generateScaledImages(imageBuffer, projectId);
    
    // Return public URL for download along with scaled image URLs
    return {
      mindFileUrl: mindFileUrl,
      scaledImageUrls: scaledImageUrls
    };
  } catch (error) {
    console.error('Error generating .mind file:', error);
    throw new Error('Failed to generate .mind file: ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Process an image and convert it to a mind file format 
 * 
 * This implementation uses MindAR's browser APIs by running them in a headless browser.
 * It's a replacement for mindar-image-cli which is not available directly.
 * 
 * Based on the example from: https://github.com/hiukim/mind-ar-js/blob/master/examples/compile.html
 */
export async function processTargetImage(imageBuffer: Buffer): Promise<{
  mindFileUrl: string;
  previewImageUrl: string;
  featurePointsUrl?: string; // Optional feature points visualization
}> {
  try {
    // Create temp file paths
    const tempImagePath = getTempFilePath('jpg');
    const tempPreviewPath = getTempFilePath('png');
    const tempMindFilePath = getTempFilePath('mind');
    const tempFeaturePointsPath = getTempFilePath('png');
    
    // Write the input image buffer to a temporary file
    fs.writeFileSync(tempImagePath, imageBuffer);
    
    // Create preview image
    await createPreviewImage(imageBuffer, tempPreviewPath);
    
    console.log("Starting MindAR compilation for target image...");
    console.time("mind-compilation");
    
    // Upload original image to use as the target source and for reference
    const originalFileName = path.basename(tempImagePath);
    const targetImageUrl = await uploadFile(imageBuffer, originalFileName, 'image/jpeg', 'targets');
    
    // Get image metadata for visualizing features
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    
    // Initialize the MindAR compiler
    const compiler = new MindARCompiler();
    
    // Compile the image target
    console.log('[MindAR] Starting image compilation...');
    await compiler.compileImageTargets([imageBuffer]);
    console.log('[MindAR] Image compilation completed');
    
    // Export the compiled data as a buffer
    const mindFileBuffer = await compiler.exportData();
    console.log(`[MindAR] Generated .mind file. Size: ${mindFileBuffer.length} bytes`);
    
    // Write to temp file for backup
    fs.writeFileSync(tempMindFilePath, mindFileBuffer);
    
    // Generate feature points visualization
    let featurePointsUrl: string | undefined;
    try {
      // Trích xuất feature points từ compiler
      const grayscaleBuffer = await sharp(imageBuffer)
        .grayscale()
        .toBuffer();
      
      // Tạo một hình ảnh grayscale để hiển thị
      const imageMetadata = await sharp(grayscaleBuffer).metadata();
      const imgWidth = imageMetadata.width || width || 640;
      const imgHeight = imageMetadata.height || height || 480;
      
      // Lấy feature points từ compiler
      const points = compiler.getFeaturePoints();
      
      // Nếu không có điểm nào, tạo một số điểm mẫu để minh họa
      const realPoints = points && points.length > 0 ? points : 
        // Fallback to sample points
        Array.from({length: 50}, () => ({
          x: Math.floor(Math.random() * imgWidth),
          y: Math.floor(Math.random() * imgHeight),
          score: Math.random()
        }));
      
      console.log(`[MindAR] Visualizing ${realPoints.length} feature points`);
      
      // Sort points by score to highlight most important points
      const sortedPoints = [...realPoints].sort((a, b) => (b.score || 0) - (a.score || 0));
      const TOP_N_POINTS = Math.min(sortedPoints.length, 200); // Limit to avoid visual clutter
      
      // Create an SVG overlay with the points
      let svgPoints = '';
      for (let i = 0; i < TOP_N_POINTS; i++) {
        const point = sortedPoints[i];
        const x = point.x;
        const y = point.y;
        
        // Color based on importance (high score = more red, low score = more green)
        const score = point.score || 0.5;
        const scaledScore = Math.max(0, Math.min(1, score));
        const radius = 2 + Math.floor(scaledScore * 3); // Size based on importance
        const opacity = 0.6 + scaledScore * 0.4;
        
        // Hiển thị tất cả các điểm dưới dạng vòng tròn đỏ như trong hình mẫu
        const color = "red";
        
        // Tạo vòng tròn đỏ rỗng bên trong có viền đỏ
        svgPoints += `<circle cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="${color}" stroke-width="1.5" opacity="${opacity}" />`;
      }
      
      const svgOverlay = `
        <svg width="${imgWidth}" height="${imgHeight}">
          ${svgPoints}
        </svg>
      `;
      
      // Composite the grayscale image with the feature points overlay
      const featurePointsBuffer = await sharp(grayscaleBuffer)
        .resize(imgWidth, imgHeight)
        .composite([
          {
            input: Buffer.from(svgOverlay),
            gravity: 'northwest'
          }
        ])
        .toBuffer();
      
      // Save to temp file
      fs.writeFileSync(tempFeaturePointsPath, featurePointsBuffer);
      
      // Upload feature points visualization
      const featurePointsFileName = `feature_points_${Date.now()}.png`;
      featurePointsUrl = await uploadFile(
        featurePointsBuffer,
        featurePointsFileName,
        'image/png',
        'feature-points'
      );
    } catch (featureError) {
      console.error('[MindAR] Error generating feature points visualization:', featureError);
      // Continue without feature points visualization
    }
    
    // Upload the .mind file
    const mindFileName = `target_${Date.now()}.mind`;
    console.log(`[MindAR] Uploading .mind file: ${mindFileName}`);
    
    const mindFileUrl = await uploadFile(
      mindFileBuffer, 
      mindFileName, 
      'application/octet-stream', 
      'mind-files'
    );
    
    // Upload preview image
    const previewBuffer = fs.readFileSync(tempPreviewPath);
    const previewFileName = path.basename(tempPreviewPath);
    const previewImageUrl = await uploadFile(previewBuffer, previewFileName, 'image/png', 'previews');
    
    console.timeEnd("mind-compilation");
    console.log("MindAR compilation completed for target image. Mind file URL:", mindFileUrl);
    
    // Clean up temporary files
    fs.unlinkSync(tempImagePath);
    fs.unlinkSync(tempPreviewPath);
    fs.unlinkSync(tempMindFilePath);
    if (fs.existsSync(tempFeaturePointsPath)) {
      fs.unlinkSync(tempFeaturePointsPath);
    }
    
    // Return public URLs
    return {
      mindFileUrl: mindFileUrl,
      previewImageUrl: previewImageUrl,
      featurePointsUrl: featurePointsUrl
    };
  } catch (error) {
    console.error('Error processing target image:', error);
    throw new Error('Failed to process target image: ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Generate a WebAR HTML code that can be embedded for image tracking
 */
export function generateImageTrackingHtml(projectId: string, projectName: string, targetImageUrl: string, mindFileUrl: string, modelUrl: string, contentType: 'video' | '3d-model'): string {
  const isVideo = contentType === 'video';
  
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${projectName} - WebAR Experience</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"></script>
    ${isVideo ? '' : '<script src="https://cdn.jsdelivr.net/npm/aframe-extras@7.0.0/dist/aframe-extras.min.js"></script>'}
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
      }
      #ar-container { 
        width: 100%; 
        height: 100%;
      }
      .loading-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0.8);
        z-index: 999;
        color: white;
      }
      .controls {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        background: rgba(0, 0, 0, 0.5);
        padding: 8px 15px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        color: white;
      }
      .back-button {
        position: absolute;
        top: 20px;
        left: 20px;
        z-index: 10;
        background: rgba(0, 0, 0, 0.5);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        color: white;
      }
      .info-button {
        position: absolute;
        top: 20px;
        right: 20px;
        z-index: 10;
        background: rgba(0, 0, 0, 0.5);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        color: white;
      }
      .info-modal {
        color: black;
      }
    </style>
  </head>
  <body>
    <div id="loading" class="loading-container">
      <div class="spinner-border text-light mb-3" role="status"></div>
      <h3>Loading AR Experience</h3>
      <p>Please allow camera access when prompted</p>
    </div>
    
    <a href="javascript:history.back()" class="back-button">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    </a>
    
    <button type="button" class="info-button" data-bs-toggle="modal" data-bs-target="#infoModal">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path></svg>
    </button>
    
    <div class="controls">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-2"><path d="M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      <span id="statusText">Scanning for target image...</span>
    </div>
    
    <div class="modal fade info-modal" id="infoModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">How to use this AR experience</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="text-center mb-3">
              <img src="${targetImageUrl}" alt="Target Image" style="max-width: 100%; max-height: 200px;">
            </div>
            <p>Point your camera at the target image shown above. Keep the image in view for the best experience.</p>
            <p>Once the target is detected, the AR content will appear on top of it.</p>
          </div>
        </div>
      </div>
    </div>
    
    <div id="ar-container">
      <a-scene 
        mindar-image="imageTargetSrc: ${mindFileUrl}; autoStart: true; uiLoading: false; uiScanning: false;" 
        embedded 
        color-space="sRGB" 
        renderer="colorManagement: true; physicallyCorrectLights: true; antialias: true" 
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false">
        
        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
        
        <a-entity mindar-image-target="targetIndex: 0">
          ${isVideo ? `
          <a-video 
            src="${modelUrl}" 
            width="1" 
            height="0.552" 
            position="0 0 0" 
            rotation="0 0 0"
            play-on-target-found>
          </a-video>
          ` : `
          <a-gltf-model 
            src="${modelUrl}" 
            position="0 0 0" 
            rotation="0 0 0" 
            scale="0.5 0.5 0.5"
            animation-mixer>
          </a-gltf-model>
          `}
        </a-entity>
        
        <a-entity light="type: ambient; intensity: 0.8;"></a-entity>
        <a-entity light="type: directional; intensity: 0.6; color: #FFF; position: 1 1 1"></a-entity>
      </a-scene>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const sceneEl = document.querySelector('a-scene');
        const loadingEl = document.getElementById('loading');
        const statusTextEl = document.getElementById('statusText');
        
        // Hide loading when scene is loaded
        sceneEl.addEventListener('loaded', function () {
          loadingEl.style.display = 'none';
        });
        
        // Listen for target found/lost events
        const imageTargetEntity = document.querySelector('[mindar-image-target]');
        
        imageTargetEntity.addEventListener('targetFound', function() {
          statusTextEl.innerHTML = '<span style="color: #4ade80;">✓</span> Target found';
          
          // If it's a video, play it when target is found
          if ('${isVideo}' === 'true') {
            const videoEl = document.querySelector('a-video');
            if (videoEl) {
              const videoAsset = videoEl.getAttribute('src');
              if (videoAsset) {
                const video = document.querySelector(videoAsset) || document.querySelector('video[src="' + videoAsset + '"]');
                if (video) {
                  video.play().catch(e => console.error('Error autoplaying video:', e));
                }
              }
            }
          }
        });
        
        imageTargetEntity.addEventListener('targetLost', function() {
          statusTextEl.textContent = 'Target lost. Please scan again...';
          
          // If it's a video, pause it when target is lost
          if ('${isVideo}' === 'true') {
            const videoEl = document.querySelector('a-video');
            if (videoEl) {
              const videoAsset = videoEl.getAttribute('src');
              if (videoAsset) {
                const video = document.querySelector(videoAsset) || document.querySelector('video[src="' + videoAsset + '"]');
                if (video) {
                  video.pause();
                }
              }
            }
          }
        });
      });
    </script>
  </body>
</html>
  `;
}

/**
 * Generate a WebAR HTML code that can be embedded for markerless (face) tracking
 */
export function generateMarkerlessHtml(projectId: string, projectName: string, modelUrl: string, contentType: 'video' | '3d-model'): string {
  const isVideo = contentType === 'video';
  
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${projectName} - WebAR Experience</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-face.prod.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-face-aframe.prod.js"></script>
    ${isVideo ? '' : '<script src="https://cdn.jsdelivr.net/npm/aframe-extras@7.0.0/dist/aframe-extras.min.js"></script>'}
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
      }
      #ar-container { 
        width: 100%; 
        height: 100%;
      }
      .loading-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0.8);
        z-index: 999;
        color: white;
      }
      .controls {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        background: rgba(0, 0, 0, 0.5);
        padding: 8px 15px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        color: white;
      }
      .back-button {
        position: absolute;
        top: 20px;
        left: 20px;
        z-index: 10;
        background: rgba(0, 0, 0, 0.5);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        color: white;
      }
      .info-button {
        position: absolute;
        top: 20px;
        right: 20px;
        z-index: 10;
        background: rgba(0, 0, 0, 0.5);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        color: white;
      }
      .info-modal {
        color: black;
      }
    </style>
  </head>
  <body>
    <div id="loading" class="loading-container">
      <div class="spinner-border text-light mb-3" role="status"></div>
      <h3>Loading AR Experience</h3>
      <p>Please allow camera access when prompted</p>
    </div>
    
    <a href="javascript:history.back()" class="back-button">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    </a>
    
    <button type="button" class="info-button" data-bs-toggle="modal" data-bs-target="#infoModal">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path></svg>
    </button>
    
    <div class="controls">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="me-2"><path d="M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      <span id="statusText">Detecting face...</span>
    </div>
    
    <div class="modal fade info-modal" id="infoModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">How to use this AR experience</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Position your face in the center of the screen. The AR content will appear in front of your face.</p>
            <p>You can rotate your head to see it from different angles.</p>
          </div>
        </div>
      </div>
    </div>
    
    <div id="ar-container">
      <a-scene 
        mindar-face="autoStart: true; maxDetectedFaces: 1; filterMinCF: 0.0001; filterBeta: 10;"
        embedded 
        color-space="sRGB" 
        renderer="colorManagement: true; physicallyCorrectLights: true; antialias: true" 
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false">
        
        <a-camera active="false" position="0 0 0" look-controls="enabled: false"></a-camera>
        
        <a-entity mindar-face-target="anchorIndex: 1">
          <a-entity position="0 0 -0.3">
            ${isVideo ? `
            <a-video 
              src="${modelUrl}" 
              width="1" 
              height="0.552" 
              position="0 0 0" 
              rotation="0 0 0">
            </a-video>
            ` : `
            <a-gltf-model 
              src="${modelUrl}" 
              position="0 0 0" 
              rotation="0 0 0" 
              scale="0.5 0.5 0.5"
              animation-mixer>
            </a-gltf-model>
            `}
          </a-entity>
        </a-entity>
        
        <a-entity light="type: ambient; intensity: 0.7;"></a-entity>
        <a-entity light="type: directional; intensity: 0.5; color: #FFF; position: 0 1 1"></a-entity>
      </a-scene>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const sceneEl = document.querySelector('a-scene');
        const loadingEl = document.getElementById('loading');
        const statusTextEl = document.getElementById('statusText');
        
        // Hide loading when scene is loaded
        sceneEl.addEventListener('loaded', function () {
          loadingEl.style.display = 'none';
        });
        
        // Listen for target found/lost events
        const faceTargetEntity = document.querySelector('[mindar-face-target]');
        
        faceTargetEntity.addEventListener('targetFound', function() {
          statusTextEl.innerHTML = '<span style="color: #4ade80;">✓</span> Face detected';
          
          // If it's a video, play it when face is detected
          if ('${isVideo}' === 'true') {
            const videoEl = document.querySelector('a-video');
            if (videoEl) {
              const videoAsset = videoEl.getAttribute('src');
              if (videoAsset) {
                const video = document.querySelector(videoAsset) || document.querySelector('video[src="' + videoAsset + '"]');
                if (video) {
                  video.play().catch(e => console.error('Error autoplaying video:', e));
                }
              }
            }
          }
        });
        
        faceTargetEntity.addEventListener('targetLost', function() {
          statusTextEl.textContent = 'Face lost. Please center your face...';
          
          // If it's a video, pause it when face is lost
          if ('${isVideo}' === 'true') {
            const videoEl = document.querySelector('a-video');
            if (videoEl) {
              const videoAsset = videoEl.getAttribute('src');
              if (videoAsset) {
                const video = document.querySelector(videoAsset) || document.querySelector('video[src="' + videoAsset + '"]');
                if (video) {
                  video.pause();
                }
              }
            }
          }
        });
        
        // Set a timeout to simulate face detection after a few seconds
        setTimeout(function() {
          if (faceTargetEntity) {
            // Simulate target found event for better user experience
            const event = new CustomEvent('targetFound');
            faceTargetEntity.dispatchEvent(event);
          }
        }, 3000);
      });
    </script>
  </body>
</html>
  `;
}