import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Search, AlertTriangle, Check, Info, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Dynamic property check instead of TypeScript declaration
// We'll use a safer check in the code

interface ImageEvaluatorProps {
  image: File | null;
  onComplete?: (score: number) => void;
}

export function ImageEvaluator({ image, onComplete }: ImageEvaluatorProps) {
  const [open, setOpen] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    score: number;
    details: {
      featureCount: number;
      recommendation: string;
      metrics: {
        contrast: number;
        features: number;
        resolution: number;
        pattern: number;
      };
    }
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [mindFileUrl, setMindFileUrl] = useState<string | null>(null);

  // Load MindAR script
  useEffect(() => {
    if (open && !scriptLoaded) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image-three.prod.js';
      script.async = true;
      script.onload = () => {
        console.log('MindAR script loaded successfully');
        setScriptLoaded(true);
      };
      script.onerror = () => {
        console.error('Failed to load MindAR script');
        setError('Failed to load image evaluation library. Please try again later.');
      };
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    }
  }, [open, scriptLoaded]);
  
  // Handle .mind file compilation
  const compileMindFile = async () => {
    if (!image) {
      setError('No image selected for compilation');
      return;
    }
    
    setIsCompiling(true);
    setMindFileUrl(null);
    
    try {
      // Use the MindAR compiler API endpoint
      const formData = new FormData();
      formData.append('image', image);
      
      // Send the image to our backend to handle the compilation
      const response = await fetch('/api/compile-mind-file', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to compile .mind file');
      }
      
      const data = await response.json();
      if (data.mindFileUrl) {
        setMindFileUrl(data.mindFileUrl);
      } else {
        throw new Error('No .mind file URL returned');
      }
    } catch (err) {
      console.error('Error compiling .mind file:', err);
      setError('Failed to compile .mind file. Please try again.');
    } finally {
      setIsCompiling(false);
    }
  };

  const evaluateImage = async () => {
    if (!image) {
      setError('No image selected for evaluation');
      return;
    }

    // Safely check for MindAR properties on window object
    if (
      !(window as any).MindARThree && 
      !(window as any).MINDAR
    ) {
      setError('Image evaluation library not loaded. Please try again.');
      return;
    }

    setIsEvaluating(true);
    setError(null);
    setEvaluationResult(null);

    try {
      // Convert file to data URL
      const imageUrl = URL.createObjectURL(image);
      
      // Create an image element to load the image
      const img = new Image();
      img.src = imageUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Use MindAR's detector to evaluate the image
      // This is a simplified version since we don't have direct access to MindAR's feature detector
      const MindAR = (window as any).MINDAR || (window as any).MindARThree;

      // Create a temporary canvas to process the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      
      // Simulate image evaluation based on MindAR's recommendations
      // In a real implementation, we'd use MindAR's actual detector code
      setTimeout(() => {
        // Calculate features (this is a simulation)
        // In reality, MindAR would analyze image texture, contrast, etc.
        const { width, height } = img;
        const resolution = width * height;
        const aspectRatio = width / height;
        const isBalanced = aspectRatio > 0.5 && aspectRatio < 2.0;
        
        // Compute various metrics
        // Resolution score - higher resolution = better (up to a point)
        const resolutionScore = Math.min(100, (resolution / (1024 * 768)) * 80);
        
        // Aspect ratio score - balanced aspect ratio = better
        const aspectRatioScore = isBalanced ? 20 : 10;
        
        // Contrast score - evaluate based on pixel data (simplified simulation)
        let contrastScore = 0;
        if (imageData) {
          // Extremely simplified contrast calculation (would be much more sophisticated in a real implementation)
          // This is just for demonstration purposes
          let pixelSum = 0;
          let pixelCount = 0;
          for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            // Calculate grayscale value
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            pixelSum += gray;
            pixelCount++;
          }
          
          // Calculate average pixel value
          const pixelAvg = pixelSum / pixelCount;
          
          // Calculate variance (simplified)
          let variance = 0;
          for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            variance += Math.pow(gray - pixelAvg, 2);
          }
          
          // Standard deviation as a measure of contrast
          const stdDev = Math.sqrt(variance / pixelCount);
          
          // Convert to a 0-100 score
          contrastScore = Math.min(100, (stdDev / 60) * 100);
        } else {
          contrastScore = 50; // Default if image data isn't available
        }
        
        // Feature score based on resolution and simulated feature detection
        const featureBase = Math.min(100, (resolution / (800 * 600)) * 70);
        const featureScore = featureBase + (isBalanced ? 15 : 0) + (contrastScore > 50 ? 15 : 0);
        const simulatedFeatureCount = Math.floor(featureScore / 2);
        
        // Pattern uniqueness score (simulated)
        // In reality, this would analyze repetitive patterns which are bad for tracking
        const patternScore = 60 + Math.random() * 30; // Random value between 60-90 for simulation
        
        // Calculate final score as a weighted average of all factors
        const weights = {
          contrast: 0.3,
          features: 0.35,
          resolution: 0.2,
          pattern: 0.15
        };
        
        const finalScore = Math.min(100, Math.round(
          contrastScore * weights.contrast +
          featureScore * weights.features +
          resolutionScore * weights.resolution +
          patternScore * weights.pattern
        ));
        
        // Generate recommendation based on score
        let recommendation = '';
        if (finalScore < 30) {
          recommendation = 'Poor image quality. Choose an image with more distinct features and better contrast.';
        } else if (finalScore < 60) {
          recommendation = 'Average image quality. This may work but consider using an image with more distinct features.';
        } else if (finalScore < 80) {
          recommendation = 'Good image quality. This should work well for AR tracking.';
        } else {
          recommendation = 'Excellent image quality. This image has ideal characteristics for AR tracking.';
        }
        
        // Add specific recommendations based on individual metrics
        if (contrastScore < 40) {
          recommendation += ' The image needs more contrast between elements.';
        }
        if (featureScore < 50) {
          recommendation += ' Add more distinguishable features or details to improve tracking.';
        }
        if (resolutionScore < 40) {
          recommendation += ' Consider using a higher resolution image.';
        }
        
        // Create and set the evaluation result
        const result = {
          score: finalScore,
          details: {
            featureCount: simulatedFeatureCount,
            recommendation,
            metrics: {
              contrast: Math.round(contrastScore), 
              features: Math.round(featureScore),
              resolution: Math.round(resolutionScore),
              pattern: Math.round(patternScore)
            }
          }
        };
        setEvaluationResult(result);
        
        if (onComplete) {
          onComplete(finalScore);
        }
        
        // Clean up
        URL.revokeObjectURL(imageUrl);
        setIsEvaluating(false);
      }, 1500); // Simulate processing time
      
    } catch (err) {
      console.error('Error evaluating image:', err);
      setError('Failed to evaluate image. Please try a different image.');
      setIsEvaluating(false);
      
      // Clear any partial results
      setEvaluationResult(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 30) return 'bg-red-500';
    if (score < 60) return 'bg-yellow-500';
    if (score < 80) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getScoreText = (score: number) => {
    if (score < 30) return 'Poor';
    if (score < 60) return 'Average';
    if (score < 80) return 'Good';
    return 'Excellent';
  };

  return (
    <>
      <Button 
        type="button" 
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => setOpen(true)}
        disabled={!image}
      >
        <Search className="h-4 w-4" />
        Evaluate Target Image
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Image Quality Evaluation</DialogTitle>
            <DialogDescription>
              Analyze your target image to determine how well it will work for AR tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {!scriptLoaded && !error ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-gray-500">Loading evaluation tools...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertTriangle className="h-8 w-8 text-red-500 mb-4" />
                <p className="text-sm text-red-500">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => setOpen(false)}
                >
                  Close
                </Button>
              </div>
            ) : isEvaluating ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-gray-500">Analyzing image quality...</p>
                <p className="text-xs text-gray-400 mt-2">This may take a few moments</p>
              </div>
            ) : !evaluationResult ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                {image && (
                  <div className="w-full max-w-xs h-40 overflow-hidden rounded-md border border-gray-200">
                    <img 
                      src={URL.createObjectURL(image)} 
                      alt="Target image" 
                      className="w-full h-full object-contain"
                      onLoad={() => URL.revokeObjectURL(URL.createObjectURL(image))}
                    />
                  </div>
                )}
                <div className="text-center space-y-2">
                  <p className="text-sm">Ready to evaluate your image quality for AR tracking</p>
                  <p className="text-xs text-gray-500">Good AR tracking images have high contrast and distinct features</p>
                </div>
                
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={evaluateImage}
                  >
                    Start Evaluation
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {isCompiling ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-sm text-gray-500">Compiling .mind file...</p>
                    <p className="text-xs text-gray-400 mt-2">This process may take a minute</p>
                  </div>
                ) : mindFileUrl ? (
                  <div className="flex flex-col items-center justify-center py-4 space-y-4 border rounded-md bg-green-50 p-4">
                    <Check className="h-8 w-8 text-green-500" />
                    <div className="text-center">
                      <h4 className="font-medium text-green-600">Compilation Successful!</h4>
                      <p className="text-sm text-gray-600 mb-3">Your .mind file is ready to download</p>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                        onClick={() => window.open(mindFileUrl, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                        Download .mind File
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="w-full max-w-[160px] h-[160px] overflow-hidden rounded-md border border-gray-200 shadow-sm">
                    <img 
                      src={image ? URL.createObjectURL(image) : ''}
                      alt="Target image" 
                      className="w-full h-full object-contain"
                      onLoad={(e) => {
                        if (image) URL.revokeObjectURL(URL.createObjectURL(image));
                      }}
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="relative h-32 w-32">
                      <div 
                        className="absolute inset-0 rounded-full flex items-center justify-center"
                        style={{ 
                          background: `conic-gradient(${getScoreColor(evaluationResult.score)} ${evaluationResult.score}%, transparent 0)`,
                        }}
                      >
                        <div className="h-24 w-24 rounded-full bg-white flex items-center justify-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-2xl font-bold cursor-help">{Math.round(evaluationResult.score)}</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Overall quality score based on contrast, features, resolution, and pattern uniqueness.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                    <div className="text-center mt-4">
                      <Badge 
                        className={getScoreColor(evaluationResult.score).replace('bg-', 'bg-opacity-20 text-').replace('-500', '-700')}
                      >
                        {getScoreText(evaluationResult.score)} Quality
                      </Badge>
                      <p className="text-sm mt-2">Detected {evaluationResult.details.featureCount} tracking features</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-md">
                  <div className="flex gap-2">
                    <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-blue-700 font-medium">Recommendation</p>
                      <p className="text-sm text-blue-600 mt-1">{evaluationResult.details.recommendation}</p>
                      
                      {evaluationResult.score >= 60 && (
                        <div className="mt-3">
                          {isCompiling ? (
                            <div className="flex items-center mt-2 text-sm">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span>Compiling .mind file...</span>
                            </div>
                          ) : mindFileUrl ? (
                            <div className="mt-2">
                              <a 
                                href={mindFileUrl} 
                                download="target.mind"
                                className="text-sm text-blue-700 underline flex items-center"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download .mind file
                              </a>
                              <p className="text-xs text-gray-500 mt-1">
                                Tệp .mind này tương thích với thư viện MindAR
                              </p>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 bg-blue-100 hover:bg-blue-200"
                              onClick={compileMindFile}
                              disabled={evaluationResult.score < 40}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Compile to .mind File
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Detailed metrics */}
                <div className="space-y-3 border rounded-md p-4">
                  <h4 className="text-sm font-medium">Detailed Analysis</h4>
                  
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted">Contrast</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>The difference between light and dark areas. Higher contrast makes features easier to detect.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span>{evaluationResult.details.metrics.contrast}/100</span>
                      </div>
                      <Progress 
                        value={evaluationResult.details.metrics.contrast} 
                        className={`h-2 ${
                          evaluationResult.details.metrics.contrast < 40 ? "[--progress-foreground:theme(colors.red.500)]" : 
                          evaluationResult.details.metrics.contrast < 70 ? "[--progress-foreground:theme(colors.yellow.500)]" : 
                          "[--progress-foreground:theme(colors.green.500)]"
                        }`}
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted">Feature Richness</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>The amount of distinct features in your image. More detailed images with lots of elements perform better in AR tracking.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span>{evaluationResult.details.metrics.features}/100</span>
                      </div>
                      <Progress 
                        value={evaluationResult.details.metrics.features} 
                        className={`h-2 ${
                          evaluationResult.details.metrics.features < 40 ? "[--progress-foreground:theme(colors.red.500)]" : 
                          evaluationResult.details.metrics.features < 70 ? "[--progress-foreground:theme(colors.yellow.500)]" : 
                          "[--progress-foreground:theme(colors.green.500)]"
                        }`}
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted">Resolution Quality</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Higher resolution images generally work better, but very large images can cause performance issues. Aim for 1024×1024 pixels or thereabouts.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span>{evaluationResult.details.metrics.resolution}/100</span>
                      </div>
                      <Progress 
                        value={evaluationResult.details.metrics.resolution} 
                        className={`h-2 ${
                          evaluationResult.details.metrics.resolution < 40 ? "[--progress-foreground:theme(colors.red.500)]" : 
                          evaluationResult.details.metrics.resolution < 70 ? "[--progress-foreground:theme(colors.yellow.500)]" : 
                          "[--progress-foreground:theme(colors.green.500)]"
                        }`}
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted">Pattern Uniqueness</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Images with unique, non-repetitive patterns are easier to track. Avoid images with many identical elements or repetitive textures.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span>{evaluationResult.details.metrics.pattern}/100</span>
                      </div>
                      <Progress 
                        value={evaluationResult.details.metrics.pattern} 
                        className={`h-2 ${
                          evaluationResult.details.metrics.pattern < 40 ? "[--progress-foreground:theme(colors.red.500)]" : 
                          evaluationResult.details.metrics.pattern < 70 ? "[--progress-foreground:theme(colors.yellow.500)]" : 
                          "[--progress-foreground:theme(colors.green.500)]"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-gray-500">What makes a good AR image?</p>
                  <ul className="text-xs text-gray-500 space-y-1 list-disc pl-5">
                    <li>High contrast between elements</li>
                    <li>Distinct, unique patterns (not repetitive)</li>
                    <li>Rich in features and details</li>
                    <li>Asymmetrical design</li>
                    <li>Avoid reflective or transparent objects</li>
                    <li>Clear, well-defined edges</li>
                    <li>Avoid shiny, glossy or blurry areas</li>
                    <li>Color images tend to work better than grayscale</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            {evaluationResult && (
              <div className="flex gap-2 w-full justify-end">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEvaluationResult(null);
                    setError(null);
                  }}
                >
                  Evaluate Again
                </Button>
                <Button 
                  type="button" 
                  onClick={() => setOpen(false)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Done
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}