import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ImageFeatureAnalyzerProps {
  image: File;
  className?: string;
  onAnalysisComplete?: (result: {
    featurePoints: number; 
    quality: 'poor' | 'fair' | 'good' | 'excellent'
  }) => void;
}

export function ImageFeatureAnalyzer({ 
  image, 
  className = "",
  onAnalysisComplete
}: ImageFeatureAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [featurePoints, setFeaturePoints] = useState(0);
  const [quality, setQuality] = useState<'poor' | 'fair' | 'good' | 'excellent'>('fair');
  
  // Phân tích chất lượng dựa trên số lượng feature points
  const getQualityFromPoints = (points: number): 'poor' | 'fair' | 'good' | 'excellent' => {
    if (points < 50) return 'poor';
    if (points < 100) return 'fair';
    if (points < 200) return 'good';
    return 'excellent';
  };
  
  // Màu sắc tương ứng với chất lượng
  const getQualityColorClass = (quality: 'poor' | 'fair' | 'good' | 'excellent'): string => {
    switch (quality) {
      case 'poor': return 'bg-red-500';
      case 'fair': return 'bg-yellow-500';
      case 'good': return 'bg-green-500';
      case 'excellent': return 'bg-emerald-500';
      default: return 'bg-gray-500';
    }
  };
  
  // Phần trăm chất lượng dựa trên số điểm
  const getQualityPercentage = (points: number): number => {
    if (points >= 200) return 100;
    return Math.min(Math.floor((points / 200) * 100), 100);
  };

  // Tìm và vẽ các feature points từ ảnh
  const analyzeImage = async () => {
    if (!canvasRef.current || !image) return;
    
    setIsAnalyzing(true);
    setAnalysisComplete(false);
    
    try {
      // Tạo hình ảnh từ file
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        // Đặt kích thước canvas theo hình ảnh
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Vẽ ảnh gốc
        ctx.drawImage(img, 0, 0);
        
        // Chuyển sang grayscale
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        for (let i = 0; i < imgData.data.length; i += 4) {
          const gray = (imgData.data[i] + imgData.data[i + 1] + imgData.data[i + 2]) / 3;
          imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = gray;
        }
        ctx.putImageData(imgData, 0, 0);
        
        // Phát hiện feature points
        console.log("[ImageFeatureAnalyzer] Detecting feature points...");
        const points = detectFeaturePoints(img);
        console.log(`[ImageFeatureAnalyzer] Found ${points.length} feature points`);
        
        // Vẽ điểm feature
        ctx.save();
        points.forEach((point, index) => {
          // Top 20 points màu đỏ, còn lại màu xanh
          const isImportant = index < 20;
          ctx.fillStyle = isImportant ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 0, 0.6)';
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
          ctx.fill();
        });
        ctx.restore();
        
        // Cập nhật kết quả
        setFeaturePoints(points.length);
        const imageQuality = getQualityFromPoints(points.length);
        setQuality(imageQuality);
        setAnalysisComplete(true);
        setIsAnalyzing(false);
        
        // Callback
        onAnalysisComplete?.({
          featurePoints: points.length,
          quality: imageQuality
        });
      };
      
      img.onerror = () => {
        console.error("[ImageFeatureAnalyzer] Error loading image");
        setIsAnalyzing(false);
      };
      
      img.src = URL.createObjectURL(image);
    } catch (error) {
      console.error("[ImageFeatureAnalyzer] Error analyzing image:", error);
      setIsAnalyzing(false);
    }
  };
  
  // Phát hiện feature points (sử dụng thuật toán đơn giản để demo)
  const detectFeaturePoints = (image: HTMLImageElement, threshold = 80, maxPoints = 500) => {
    console.log("[ImageFeatureAnalyzer] Starting feature point detection...");
    const start = performance.now();
    
    // Tạo canvas tạm thời để xử lý ảnh
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    
    ctx.drawImage(image, 0, 0);
    const imgData = ctx.getImageData(0, 0, image.width, image.height);
    
    // Tìm điểm đặc trưng dựa trên gradient
    const points: {x: number, y: number, mag: number}[] = [];
    
    // Dùng phương pháp Sobel để tìm điểm biên
    for (let y = 1; y < image.height - 1; y++) {
      for (let x = 1; x < image.width - 1; x++) {
        const i = (y * image.width + x) * 4;
        
        // Gradient theo x và y
        const gx =
          -imgData.data[i - 4 - image.width * 4] - 2 * imgData.data[i - image.width * 4] - imgData.data[i + 4 - image.width * 4] +
          imgData.data[i - 4 + image.width * 4] + 2 * imgData.data[i + image.width * 4] + imgData.data[i + 4 + image.width * 4];
          
        const gy =
          -imgData.data[i - 4 - image.width * 4] - 2 * imgData.data[i - 4] - imgData.data[i - 4 + image.width * 4] +
          imgData.data[i + 4 - image.width * 4] + 2 * imgData.data[i + 4] + imgData.data[i + 4 + image.width * 4];
          
        const mag = Math.sqrt(gx * gx + gy * gy);
        
        // Chỉ lấy điểm có gradient lớn hơn ngưỡng
        if (mag > threshold) {
          points.push({ x, y, mag });
        }
      }
    }
    
    // Non-maximum suppression (đơn giản)
    const filteredPoints = [];
    const radius = 5;
    for (let i = 0; i < points.length; i++) {
      let isMax = true;
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        
        const dist = Math.sqrt(
          Math.pow(points[i].x - points[j].x, 2) + 
          Math.pow(points[i].y - points[j].y, 2)
        );
        
        if (dist < radius && points[j].mag > points[i].mag) {
          isMax = false;
          break;
        }
      }
      
      if (isMax) {
        filteredPoints.push(points[i]);
      }
    }
    
    // Sắp xếp theo độ mạnh và lấy tối đa maxPoints điểm
    filteredPoints.sort((a, b) => b.mag - a.mag);
    const result = filteredPoints.slice(0, maxPoints);
    
    const duration = performance.now() - start;
    console.log(`[ImageFeatureAnalyzer] Found ${result.length} feature points in ${duration.toFixed(2)}ms`);
    
    return result;
  };
  
  // Tự động phân tích khi hình ảnh thay đổi
  useEffect(() => {
    if (image && canvasRef.current) {
      analyzeImage();
    }
  }, [image]);

  return (
    <div className={`w-full ${className}`}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              Phân tích hình ảnh
            </span>
            {analysisComplete && (
              <Badge className={getQualityColorClass(quality)}>
                {quality === 'poor' && 'Kém'}
                {quality === 'fair' && 'Trung bình'}
                {quality === 'good' && 'Tốt'}
                {quality === 'excellent' && 'Xuất sắc'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isAnalyzing ? (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-500 mb-2">Đang phân tích hình ảnh...</p>
              <Progress className="h-2" value={50} />
            </div>
          ) : (
            <>
              <div className="relative border rounded-md overflow-hidden bg-gray-50">
                <canvas 
                  ref={canvasRef} 
                  className="max-h-64 w-full object-contain"
                />
              </div>
              
              {analysisComplete && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Số điểm đặc trưng:</span>
                    <span className="font-medium">{featurePoints}</span>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Chất lượng</span>
                      <span>{getQualityPercentage(featurePoints)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${getQualityColorClass(quality)}`}
                        style={{ width: `${getQualityPercentage(featurePoints)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2 pt-2 text-xs text-slate-600">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    <p>
                      {quality === 'poor' && 'Hình ảnh có ít điểm đặc trưng, có thể gây khó khăn khi nhận diện trong AR.'}
                      {quality === 'fair' && 'Hình ảnh có lượng điểm đặc trưng trung bình, có thể dùng nhưng không ổn định.'}
                      {quality === 'good' && 'Hình ảnh chứa nhiều điểm đặc trưng, phù hợp cho AR tracking.'}
                      {quality === 'excellent' && 'Hình ảnh có độ phức tạp cao, rất phù hợp cho AR tracking!'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
          
          <div className="pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={analyzeImage} 
              disabled={isAnalyzing || !image}
              className="w-full"
            >
              Phân tích lại
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}