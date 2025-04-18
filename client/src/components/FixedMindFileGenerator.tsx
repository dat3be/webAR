import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, FileUp, Check, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { uploadFile } from "@/lib/fileUpload";

interface MindFileGeneratorProps {
  targetImage: File | null;
  onMindFileGenerated?: (mindFileUrl: string) => void;
  onGenerationStart?: () => void;
  onGenerationError?: (error: string) => void;
  onGenerationComplete?: (mindFileUrl: string, mindFileName: string) => void;
  className?: string;
  showControls?: boolean;
}

export function MindFileGenerator({
  targetImage,
  onMindFileGenerated,
  onGenerationStart,
  onGenerationError,
  onGenerationComplete,
  className = "",
  showControls = true
}: MindFileGeneratorProps) {
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resetState = () => {
    setProgress(0);
    setResultUrl(null);
    setError(null);
    setStatus("idle");
    setIsProcessing(false);
  };

  // Tự động xử lý khi targetImage thay đổi
  useEffect(() => {
    resetState();
  }, [targetImage]);

  // Hàm load ảnh thành HTMLImageElement
  const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Không thể load ảnh: ${e}`));
      img.src = URL.createObjectURL(file);
    });
  };

  // Visualize feature points 
  const visualizeFeaturePoints = (canvas: HTMLCanvasElement, compiler: any) => {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Get data from compiler
      const imageTarget = compiler.imageTargets[0];
      
      if (!imageTarget) return;
      
      // Vẽ ảnh grayscale
      const targetImage = imageTarget.processedImageBitmap;
      if (targetImage) {
        canvas.width = targetImage.width;
        canvas.height = targetImage.height;
        ctx.drawImage(targetImage, 0, 0);
      }
      
      // Get feature points to visualize
      const featurePoints = compiler.imageTargets[0]?.matchingData?.points || [];
      
      if (featurePoints && featurePoints.length > 0) {
        // Vẽ các điểm feature
        featurePoints.forEach((point: any, index: number) => {
          const x = point.x;
          const y = point.y;
          
          // Top 20 points in red, rest in green
          const color = index < 20 ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 0, 0.6)';
          const radius = 3;
          
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        });
        
        console.log(`[MindFileGenerator] Rendered ${featurePoints.length} feature points`);
      }
    } catch (error) {
      console.error("[MindFileGenerator] Error visualizing feature points:", error);
    }
  };

  // Hàm compile sử dụng mind-ar
  const handleCompile = async () => {
    if (!targetImage) return;
    
    try {
      resetState();
      setIsProcessing(true);
      setStatus("processing");
      onGenerationStart?.();
      
      console.log("[MindFileGenerator] Starting mind file compilation");
      setProgress(5);
      
      // Dynamic import mind-ar để tránh lỗi SSR
      console.log("[MindFileGenerator] Importing mind-ar...");
      
      try {
        // We're using dynamic imports to load mind-ar only when needed
        const mindar = await import('mind-ar'); // First import the base module
        console.log("[MindFileGenerator] Successfully imported 'mind-ar' base module");
        
        const mindARModule = await import('mind-ar/dist/mindar-image.prod.js');
        console.log("[MindFileGenerator] Successfully imported 'mind-ar/dist/mindar-image.prod.js'");
        
        if (!mindARModule.Compiler) {
          console.error("[MindFileGenerator] Compiler not found in the imported module!", mindARModule);
          throw new Error("Không thể load mind-ar compiler");
        }
        
        const compiler = new mindARModule.Compiler();
        console.log("[MindFileGenerator] mind-ar compiler loaded");
        setProgress(20);
        
        // Load image
        console.log("[MindFileGenerator] Loading image...");
        const image = await loadImage(targetImage);
        console.log("[MindFileGenerator] Image loaded, size:", image.width, "x", image.height);
        setProgress(30);
        
        // Compile
        console.log("[MindFileGenerator] Starting compilation process");
        await compiler.compileImageTargets([image], (progress: number) => {
          console.log(`[MindFileGenerator] Compilation progress: ${progress.toFixed(2)}%`);
          setProgress(30 + progress * 0.6); // 30-90% range
        });
        console.log("[MindFileGenerator] Compilation complete");
        setProgress(90);
        
        // Visualize feature points if canvas is available
        if (canvasRef.current) {
          visualizeFeaturePoints(canvasRef.current, compiler);
        }
        
        // Export .mind buffer
        console.log("[MindFileGenerator] Exporting data to .mind file");
        const buffer = await compiler.exportData();
        const blob = new Blob([buffer]);
        const blobUrl = URL.createObjectURL(blob);
        setResultUrl(blobUrl);
        setProgress(95);
        
        // Create a File from the blob for uploading
        const fileName = `target_${Date.now()}.mind`;
        const mindFile = new File([blob], fileName, { type: 'application/octet-stream' });
        
        // Upload to server
        console.log("[MindFileGenerator] Uploading .mind file to server");
        const uploadedUrl = await uploadFile(mindFile);
        console.log("[MindFileGenerator] Upload successful:", uploadedUrl);
        
        setProgress(100);
        setStatus("success");
        
        // Notify parent components
        onMindFileGenerated?.(uploadedUrl);
        onGenerationComplete?.(uploadedUrl, fileName);
        
        console.log("[MindFileGenerator] Mind file generation process complete");
        
        return { url: uploadedUrl, fileName };
      } catch (error: any) {
        console.error("[MindFileGenerator] Error in compiler module:", error);
        throw new Error(`Mind-AR compiler error: ${error.message}`);
      }
    } catch (error: any) {
      console.error("[MindFileGenerator] Error during compilation:", error);
      setError(error.message || "Không thể tạo file .mind");
      setStatus("error");
      onGenerationError?.(error.message || "Không thể tạo file .mind");
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler to download the generated file
  const handleDownload = () => {
    if (!resultUrl) return;
    
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `target_${Date.now()}.mind`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {showControls && (
        <div className="flex justify-between">
          <Button
            onClick={handleCompile}
            disabled={!targetImage || isProcessing}
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo file .mind...
              </>
            ) : resultUrl ? (
              <>
                <Check className="h-4 w-4" /> Tạo lại file .mind
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4" /> Tạo file .mind
              </>
            )}
          </Button>
          
          {resultUrl && (
            <Button variant="outline" onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" /> Tải xuống
            </Button>
          )}
        </div>
      )}
      
      {status === "processing" && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Đang xử lý...</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
      
      {status === "success" && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/30 p-3 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/50">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            <p className="font-medium">Thành công</p>
          </div>
          <p className="mt-1 text-sm ml-6">File .mind đã được tạo thành công</p>
        </div>
      )}
      
      {status === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Lỗi</AlertTitle>
          <AlertDescription>
            {error || "Đã có lỗi xảy ra khi tạo file .mind"}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Canvas for feature points visualization */}
      <div className="mt-4">
        <canvas 
          ref={canvasRef} 
          className={`w-full aspect-auto border rounded-md ${status !== 'success' ? 'hidden' : ''}`}
        />
      </div>
    </div>
  );
}