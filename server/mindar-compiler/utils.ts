interface Image {
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * Resize an image to a given scale
 * @param image Source image
 * @param scale Scale factor to resize the image
 * @returns Resized image
 */
export function resizeImage(image: Image, scale: number): Image {
  const width = Math.floor(image.width * scale);
  const height = Math.floor(image.height * scale);
  
  // Create new data array for the resized image
  const newData = new Uint8Array(width * height);
  
  // Perform bilinear interpolation for resizing
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = x / scale;
      const srcY = y / scale;
      
      const srcX1 = Math.floor(srcX);
      const srcY1 = Math.floor(srcY);
      const srcX2 = Math.min(Math.ceil(srcX), image.width - 1);
      const srcY2 = Math.min(Math.ceil(srcY), image.height - 1);
      
      const xWeight = srcX - srcX1;
      const yWeight = srcY - srcY1;
      
      const pixel1 = image.data[srcY1 * image.width + srcX1];
      const pixel2 = image.data[srcY1 * image.width + srcX2];
      const pixel3 = image.data[srcY2 * image.width + srcX1];
      const pixel4 = image.data[srcY2 * image.width + srcX2];
      
      // Bilinear interpolation
      const interpolated = 
        pixel1 * (1 - xWeight) * (1 - yWeight) +
        pixel2 * xWeight * (1 - yWeight) +
        pixel3 * (1 - xWeight) * yWeight +
        pixel4 * xWeight * yWeight;
      
      newData[y * width + x] = Math.round(interpolated);
    }
  }
  
  return {
    data: newData,
    width,
    height
  };
}