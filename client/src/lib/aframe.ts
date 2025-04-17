/**
 * This file dynamically imports A-Frame and MindAR related dependencies
 * It's designed to lazy load these libraries only when needed in AR views
 */

// Add mindar scripts to head
export async function loadAFrameAndMindAR() {
  return new Promise<void>((resolve, reject) => {
    try {
      // Check if already loaded
      if (document.querySelector('script[data-aframe-loaded="true"]')) {
        console.log("A-Frame and MindAR already loaded");
        resolve();
        return;
      }

      // Create and append a script
      const appendScript = (src: string, onLoad: () => void) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = onLoad;
        script.onerror = reject;
        document.head.appendChild(script);
      }

      // Add A-Frame first (from CDN) - using stable version 1.4.2
      appendScript('https://cdn.jsdelivr.net/gh/aframevr/aframe@v1.4.2/dist/aframe.min.js', () => {
        console.log("A-Frame loaded");
        
        // Then add Mind-AR aframe plugin - using stable version 1.2.2
        appendScript('https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.2/dist/mindar-image-aframe.prod.js', () => {
          console.log("MindAR aframe plugin loaded");
          
          // Mark as loaded
          const loadedScript = document.createElement('script');
          loadedScript.setAttribute('data-aframe-loaded', 'true');
          loadedScript.textContent = '// A-Frame and MindAR loaded marker';
          document.head.appendChild(loadedScript);
          
          // Let React continue
          resolve();
        });
      });
    } catch (error) {
      console.error("Error loading A-Frame and MindAR:", error);
      reject(error);
    }
  });
}