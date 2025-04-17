import sharp from 'sharp';
import * as msgpack from '@msgpack/msgpack';

// Constants for feature extraction
const SEARCH_SIZE1 = 10;
const SEARCH_SIZE2 = 3;
const TEMPLATE_SIZE = 10;
const TEMPLATE_SD_THRESH = 10.0;
const MAX_POINTS = 200;
const MAX_SIM_THRESH = 0.95;
const MAX_THRESH = 0.9;
const MIN_THRESH = 0.2;
const SD_THRESH = 8.0;
const OCCUPANCY_SIZE = 24 * 2 / 3;

interface Point {
  x: number;
  y: number;
  score: number;
}

interface TargetImage {
  data: Uint8Array;
  width: number;
  height: number;
}

interface ScaledImage extends TargetImage {
  scale: number;
}

/**
 * Resize an image to a given scale
 */
function resizeImage(image: { image: TargetImage; ratio: number }): TargetImage {
  const { image: sourceImage, ratio } = image;
  const width = Math.floor(sourceImage.width * ratio);
  const height = Math.floor(sourceImage.height * ratio);
  
  // Create new data array for the resized image
  const newData = new Uint8Array(width * height);
  
  // Perform bilinear interpolation for resizing
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = x / ratio;
      const srcY = y / ratio;
      
      const srcX1 = Math.floor(srcX);
      const srcY1 = Math.floor(srcY);
      const srcX2 = Math.min(Math.ceil(srcX), sourceImage.width - 1);
      const srcY2 = Math.min(Math.ceil(srcY), sourceImage.height - 1);
      
      const xWeight = srcX - srcX1;
      const yWeight = srcY - srcY1;
      
      const pixel1 = sourceImage.data[srcY1 * sourceImage.width + srcX1];
      const pixel2 = sourceImage.data[srcY1 * sourceImage.width + srcX2];
      const pixel3 = sourceImage.data[srcY2 * sourceImage.width + srcX1];
      const pixel4 = sourceImage.data[srcY2 * sourceImage.width + srcX2];
      
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

/**
 * Build a list of images with different scales for tracking
 */
function buildTrackingImageList(inputImage: TargetImage): ScaledImage[] {
  const minDimension = Math.min(inputImage.width, inputImage.height);
  const scaleList: number[] = [];
  
  // For tracking, we only need two specific scales
  // 256x256 and 128x128 (relative to the minimum dimension)
  scaleList.push(256.0 / minDimension);
  scaleList.push(128.0 / minDimension);
  
  // Create the scaled images
  const imageList: ScaledImage[] = [];
  for (let i = 0; i < scaleList.length; i++) {
    const scale = scaleList[i];
    const scaledImage = resizeImage({image: inputImage, ratio: scale});
    imageList.push({
      ...scaledImage,
      scale: scale
    });
  }
  
  return imageList;
}

/**
 * Extract features from an image
 */
function extractFeatures(image: { data: Uint8Array; width: number; height: number }): Point[] {
  const { data: imageData, width, height } = image;
  
  // Step 1: Detect interesting points using a simple corner detector
  const isPixelSelected = new Array(width * height).fill(false);
  const dValue = new Float32Array(width * height);
  
  // Initialize borders
  for (let i = 0; i < width; i++) {
    dValue[i] = -1;
    dValue[width * (height - 1) + i] = -1;
  }
  for (let j = 0; j < height; j++) {
    dValue[j * width] = -1;
    dValue[j * width + width - 1] = -1;
  }
  
  // Compute dValue (corner strength) for each pixel
  for (let i = 1; i < width - 1; i++) {
    for (let j = 1; j < height - 1; j++) {
      const pos = i + width * j;
      
      // Compute horizontal and vertical gradients using Sobel-like operators
      const dx = (
        (imageData[pos + 1 - width] - imageData[pos - 1 - width]) +
        (imageData[pos + 1] - imageData[pos - 1]) +
        (imageData[pos + 1 + width] - imageData[pos - 1 + width])
      ) / 255.0 / 3.0;
      
      const dy = (
        (imageData[pos + 1 + width] - imageData[pos + 1 - width]) +
        (imageData[pos + width] - imageData[pos - width]) +
        (imageData[pos - 1 + width] - imageData[pos - 1 - width])
      ) / 255.0 / 3.0;
      
      // Corner strength is the magnitude of the gradient
      dValue[pos] = Math.sqrt(dx * dx + dy * dy) / 2.0;
    }
  }
  
  // Step 2: Find local maxima for corner detection
  for (let i = SEARCH_SIZE1 + 1; i < width - SEARCH_SIZE1 - 1; i++) {
    for (let j = SEARCH_SIZE1 + 1; j < height - SEARCH_SIZE1 - 1; j++) {
      const pos = i + width * j;
      
      // Skip if this pixel is not interesting enough
      if (dValue[pos] < MIN_THRESH) continue;
      
      // Check if this pixel is a local maximum
      let isMax = true;
      for (let k = -SEARCH_SIZE2; k <= SEARCH_SIZE2 && isMax; k++) {
        for (let l = -SEARCH_SIZE2; l <= SEARCH_SIZE2 && isMax; l++) {
          if (k === 0 && l === 0) continue;
          
          const pos2 = pos + k + l * width;
          if (dValue[pos] < dValue[pos2]) {
            isMax = false;
          }
        }
      }
      
      // If it's a local maximum, check its template standard deviation
      if (isMax) {
        let mean = 0;
        for (let k = -TEMPLATE_SIZE; k <= TEMPLATE_SIZE; k++) {
          for (let l = -TEMPLATE_SIZE; l <= TEMPLATE_SIZE; l++) {
            const pos2 = pos + k + l * width;
            mean += imageData[pos2];
          }
        }
        mean /= (2 * TEMPLATE_SIZE + 1) * (2 * TEMPLATE_SIZE + 1);
        
        let sd = 0;
        for (let k = -TEMPLATE_SIZE; k <= TEMPLATE_SIZE; k++) {
          for (let l = -TEMPLATE_SIZE; l <= TEMPLATE_SIZE; l++) {
            const pos2 = pos + k + l * width;
            const diff = imageData[pos2] - mean;
            sd += diff * diff;
          }
        }
        sd = Math.sqrt(sd / ((2 * TEMPLATE_SIZE + 1) * (2 * TEMPLATE_SIZE + 1)));
        
        // Accept the point if its standard deviation is high enough
        if (sd > TEMPLATE_SD_THRESH) {
          isPixelSelected[pos] = true;
        }
      }
    }
  }
  
  // Step 3: Apply occupancy map to ensure even distribution of features
  const occupancySize = Math.max(1, Math.floor(Math.min(width, height) / OCCUPANCY_SIZE));
  const occupancyWidth = Math.floor(width / occupancySize);
  const occupancyHeight = Math.floor(height / occupancySize);
  
  const occupancy: Array<Array<{pos: number; value: number}>> = [];
  for (let i = 0; i < occupancyWidth * occupancyHeight; i++) {
    occupancy[i] = [];
  }
  
  // Populate occupancy grid with selected points
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const pos = i + width * j;
      if (isPixelSelected[pos]) {
        const oi = Math.min(occupancyWidth - 1, Math.floor(i / occupancySize));
        const oj = Math.min(occupancyHeight - 1, Math.floor(j / occupancySize));
        occupancy[oj * occupancyWidth + oi].push({ pos, value: dValue[pos] });
      }
    }
  }
  
  // Select top N points from each occupancy cell
  const MAX_FEATURES_PER_CELL = 5;
  const selectedPoints: Point[] = [];
  
  for (let i = 0; i < occupancyWidth * occupancyHeight; i++) {
    if (occupancy[i]) {
      // Sort by dValue (corner strength) in descending order
      occupancy[i].sort((a: {value: number}, b: {value: number}) => b.value - a.value);
      
      // Select top points
      for (let j = 0; j < Math.min(MAX_FEATURES_PER_CELL, occupancy[i].length); j++) {
        const pos = occupancy[i][j].pos;
        const x = pos % width;
        const y = Math.floor(pos / width);
        
        selectedPoints.push({
          x,
          y,
          score: dValue[pos]
        });
      }
    }
  }
  
  return selectedPoints;
}

/**
 * Extract tracking features from a list of images
 */
function extractTrackingFeatures(imageList: ScaledImage[], progressCallback: (index: number) => void) {
  const featureSets = [];
  
  for (let i = 0; i < imageList.length; i++) {
    const image = imageList[i];
    
    // Extract features from the image
    const points = extractFeatures(image);
    
    // Create feature set with the extracted points
    const featureSet = {
      data: image.data,
      scale: image.scale,
      width: image.width,
      height: image.height,
      points
    };
    
    featureSets.push(featureSet);
    
    // Report progress
    progressCallback(i);
  }
  
  return featureSets;
}

/**
 * A custom MindAR compiler based on the original mind-ar-js implementation
 * Adapted from: https://github.com/hiukim/mind-ar-js/blob/master/src/image-target/compiler.js
 */
export class MindARCompiler {
  private data: any[] = [];

  /**
   * Build a list of images with different scales for tracking
   */
  private buildTrackingImageList(inputImage: TargetImage): ScaledImage[] {
    return buildTrackingImageList(inputImage);
  }

  /**
   * Extract tracking features from a list of images
   */
  private extractTrackingFeatures(imageList: ScaledImage[], progressCallback: (index: number) => void) {
    return extractTrackingFeatures(imageList, progressCallback);
  }

  /**
   * Compile image targets to generate .mind file data
   * @param imageBuffers List of image buffers to compile
   * @returns Promise that resolves when compilation is complete
   */
  async compileImageTargets(imageBuffers: Buffer[]): Promise<void> {
    // Process each image
    const targetImages = [];
    for (let i = 0; i < imageBuffers.length; i++) {
      const imageBuffer = imageBuffers[i];
      
      // Get image metadata
      const metadata = await sharp(imageBuffer).metadata();
      const { width, height } = metadata;
      
      // Convert to grayscale
      const grayscaleBuffer = await sharp(imageBuffer)
        .grayscale()
        .raw()
        .toBuffer();
      
      // Create target image data
      const targetImage = {
        data: new Uint8Array(grayscaleBuffer),
        width: width!,
        height: height!
      };
      
      targetImages.push(targetImage);
    }

    // Track compilation for each image
    this.data = [];
    for (let i = 0; i < targetImages.length; i++) {
      const targetImage = targetImages[i];
      
      // Build the tracking image list (downsampled versions) 
      const imageList = this.buildTrackingImageList(targetImage);
      
      // Extract tracking features - this is where the heavy computation happens
      const trackingData = this.extractTrackingFeatures(imageList, (index: number) => {
        // Progress callback - could be used to report progress
        console.log(`Processing tracking feature extraction: ${index}/${imageList.length}`);
      });
      
      this.data.push({ targetImage, trackingData });
    }
  }

  /**
   * Export the compiled data as a Buffer
   * @returns Buffer containing the compiled .mind file data
   */
  async exportData(): Promise<Buffer> {
    // Process the data array to include only required data
    const dataToExport = {
      version: 2, // Current mind file version
      trackingData: this.data.map(d => d.trackingData)
    };
    
    // Serialize using msgpack for compact binary representation
    const buffer = msgpack.encode(dataToExport);
    return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
}

export default MindARCompiler;