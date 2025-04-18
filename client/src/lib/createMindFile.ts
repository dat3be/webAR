/**
 * Utility function to create .mind file from image
 * 
 * Handles dynamic import of mind-ar/dist/mindar-image.prod.js
 * and wraps compilation process
 */
export async function createMindFile(imageFile: File): Promise<{
  buffer: ArrayBuffer;
  blob: Blob;
  url: string;
}> {
  if (!imageFile) {
    throw new Error("No image file provided");
  }
  
  console.log("[createMindFile] Starting mind file creation for", imageFile.name);
  
  try {
    // Load the image first
    const image = await loadImage(imageFile);
    console.log("[createMindFile] Image loaded:", image.width, "x", image.height);
    
    // Import MindAR - this is the critical part that was failing
    console.log("[createMindFile] Dynamically importing MindAR");
    
    // Try alternate ways of importing MindAR
    let compiler;
    let error = null;
    
    try {
      // First try - import the base module first to initialize
      const mindar = await import('mind-ar');
      const { Compiler } = await import('mind-ar/dist/mindar-image.prod.js');
      compiler = new Compiler();
      console.log("[createMindFile] Successfully loaded MindAR compiler");
    } catch (err) {
      error = err;
      console.error("[createMindFile] Error importing mind-ar:", err);
      
      // Second try - direct import
      try {
        const mindARModule = await import('mind-ar/dist/mindar-image.prod.js');
        if (mindARModule && mindARModule.Compiler) {
          compiler = new mindARModule.Compiler();
          console.log("[createMindFile] Successfully loaded MindAR compiler via direct import");
          error = null;
        }
      } catch (err2: any) {
        console.error("[createMindFile] Second attempt failed:", err2);
        throw new Error(`Cannot load MindAR compiler. First error: ${error?.message}, Second error: ${err2?.message || String(err2)}`);
      }
    }
    
    if (!compiler) {
      throw new Error("Failed to initialize MindAR compiler");
    }
    
    // Compile the image
    console.log("[createMindFile] Starting compilation");
    await compiler.compileImageTargets([image], (progress: number) => {
      console.log(`[createMindFile] Compilation progress: ${progress.toFixed(2)}%`);
    });
    console.log("[createMindFile] Compilation complete");
    
    // Export data
    console.log("[createMindFile] Exporting .mind file data");
    const buffer = await compiler.exportData();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    console.log("[createMindFile] .mind file created successfully, size:", blob.size, "bytes");
    
    return { buffer, blob, url };
  } catch (error: any) {
    console.error("[createMindFile] Error:", error);
    throw new Error(`Failed to create .mind file: ${error.message || error}`);
  }
}

/**
 * Load an image from a File object
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // To avoid CORS issues
    
    img.onload = () => {
      console.log("[loadImage] Image loaded successfully:", img.width, "x", img.height);
      resolve(img);
    };
    
    img.onerror = (err) => {
      console.error("[loadImage] Error loading image:", err);
      reject(new Error("Failed to load image"));
    };
    
    const url = URL.createObjectURL(file);
    img.src = url;
    
    // Add extra handler for really large images
    setTimeout(() => {
      if (!img.complete) {
        console.log("[loadImage] Loading large image...");
      }
    }, 1000);
  });
}