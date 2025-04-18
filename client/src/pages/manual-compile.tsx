import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileImage, Download, RefreshCw, CheckCircle2, AlertCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ManualCompile() {
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressState, setProgressState] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [mindFileUrl, setMindFileUrl] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [featurePointsUrl, setFeaturePointsUrl] = useState<string | null>(null);
  
  // For direct download
  const [mindFileBuffer, setMindFileBuffer] = useState<ArrayBuffer | null>(null);
  
  // Canvas reference for showing feature points
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Lỗi",
          description: "Vui lòng chọn file ảnh (JPG, PNG)",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedImage(file);
      
      // Create preview URL
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        if (event.target?.result) {
          setPreviewUrl(event.target.result as string);
        }
      };
      fileReader.readAsDataURL(file);
      
      // Reset state
      setMindFileUrl(null);
      setPreviewImageUrl(null);
      setFeaturePointsUrl(null);
      setMindFileBuffer(null);
      setProgressState("idle");
      setProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn một hình ảnh để xử lý",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgressState("processing");
    
    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (Math.random() * 5);
        return newProgress > 95 ? 95 : newProgress;
      });
    }, 500);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', selectedImage);

      console.log(`[ManualCompile] Uploading image ${selectedImage.name} (${selectedImage.size} bytes)`);
      
      // Process image using the backend API
      const response = await fetch('/api/process-target-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('[ManualCompile] Processing complete:', result);
      
      // Set results
      setMindFileUrl(result.mindFileUrl);
      setPreviewImageUrl(result.previewImageUrl);
      setFeaturePointsUrl(result.featurePointsUrl);
      
      // Download the mind file buffer for direct download option
      if (result.mindFileUrl) {
        try {
          const mindFileResponse = await fetch(result.mindFileUrl);
          if (mindFileResponse.ok) {
            const arrayBuffer = await mindFileResponse.arrayBuffer();
            setMindFileBuffer(arrayBuffer);
          }
        } catch (err) {
          console.error("Could not fetch mind file for direct download:", err);
        }
      }
      
      setProgressState("done");
      setProgress(100);
      
      toast({
        title: "Thành công",
        description: "Đã chuyển đổi hình ảnh thành .mind file",
      });
    } catch (error) {
      console.error('[ManualCompile] Error processing image:', error);
      clearInterval(progressInterval);
      setProgressState("error");
      setProgress(0);
      
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xử lý hình ảnh",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (mindFileUrl) {
      window.open(mindFileUrl, '_blank');
    }
  };
  
  const handleDirectDownload = () => {
    if (mindFileBuffer) {
      // Create a blob from the buffer
      const blob = new Blob([mindFileBuffer]);
      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `target_${Date.now()}.mind`;
      document.body.appendChild(a);
      a.click();
      // Cleanup
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Tải xuống hoàn tất",
        description: "File .mind đã được tải xuống thiết bị của bạn",
      });
    }
  };

  const resetForm = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setMindFileUrl(null);
    setPreviewImageUrl(null);
    setFeaturePointsUrl(null);
    setMindFileBuffer(null);
    setProgressState("idle");
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto p-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Công cụ chuyển đổi hình ảnh sang .mind file</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Tạo .mind file từ hình ảnh mục tiêu</CardTitle>
          <CardDescription>
            Công cụ này cho phép bạn chuyển đổi một hình ảnh mục tiêu thành file .mind sử dụng cho Image Tracking trong MindAR.
            Quá trình này có thể mất tới 30 giây tùy vào kích thước hình ảnh.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="image-upload">Chọn hình ảnh mục tiêu</Label>
            <Input 
              id="image-upload" 
              type="file" 
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageChange} 
              disabled={isProcessing}
              className="cursor-pointer"
            />
            <p className="text-sm text-muted-foreground">Hình ảnh phải rõ ràng, có độ tương phản cao, không bị mờ để nhận dạng tốt.</p>
          </div>
          
          {previewUrl && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Hình ảnh đã chọn:</h3>
              <div className="aspect-video bg-black/10 rounded-lg overflow-hidden flex items-center justify-center">
                <img src={previewUrl} alt="Preview" className="max-h-full object-contain" />
              </div>
            </div>
          )}
          
          {progressState !== "idle" && (
            <div className="space-y-2 mt-4">
              <div className="flex justify-between items-center">
                <Label>Tiến trình xử lý</Label>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              
              {progressState === "processing" && (
                <div className="flex items-center text-yellow-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm">Đang xử lý hình ảnh...</span>
                </div>
              )}
              
              {progressState === "done" && (
                <div className="flex items-center text-green-500">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  <span className="text-sm">Xử lý hoàn tất</span>
                </div>
              )}
              
              {progressState === "error" && (
                <div className="flex items-center text-red-500">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span className="text-sm">Xử lý thất bại</span>
                </div>
              )}
            </div>
          )}
          
          {mindFileUrl && (
            <div className="rounded-lg border p-4 mt-4">
              <h3 className="text-lg font-medium mb-2">Kết quả:</h3>
              
              <Tabs defaultValue="preview">
                <TabsList className="mb-4">
                  <TabsTrigger value="preview">Hình ảnh gốc</TabsTrigger>
                  {featurePointsUrl && (
                    <TabsTrigger value="features">Đặc trưng hình ảnh</TabsTrigger>
                  )}
                </TabsList>
                
                <TabsContent value="preview">
                  {previewImageUrl && (
                    <div className="aspect-video bg-black/10 rounded-lg overflow-hidden mb-4 flex items-center justify-center">
                      <img src={previewImageUrl} alt="Preview" className="max-h-full object-contain" />
                    </div>
                  )}
                </TabsContent>
                
                {featurePointsUrl && (
                  <TabsContent value="features">
                    <div className="aspect-video bg-black/10 rounded-lg overflow-hidden mb-4 flex items-center justify-center">
                      <img src={featurePointsUrl} alt="Feature Points" className="max-h-full object-contain" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Các điểm xanh biểu thị các đặc trưng được trích xuất từ hình ảnh để sử dụng trong theo dõi AR.
                      Hình ảnh với nhiều điểm đặc trưng phân bố đều sẽ có hiệu suất theo dõi tốt hơn.
                    </p>
                  </TabsContent>
                )}
              </Tabs>
              
              <div className="flex flex-col gap-2 mt-4">
                <p className="text-sm break-all">
                  <span className="font-medium">Mind File URL:</span> {mindFileUrl}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button 
                    onClick={handleDownload} 
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" /> Xem .mind file
                  </Button>
                  
                  {mindFileBuffer && (
                    <Button 
                      onClick={handleDirectDownload} 
                      className="gap-2"
                      variant="secondary"
                    >
                      <Download className="h-4 w-4" /> Tải .mind file
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={resetForm} 
            disabled={isProcessing}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Làm mới
          </Button>
          
          <Button 
            onClick={handleUpload} 
            disabled={!selectedImage || isProcessing} 
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý...
              </>
            ) : (
              <>
                <FileImage className="h-4 w-4" /> Xử lý hình ảnh
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <div className="bg-muted/50 p-4 rounded-lg">
        <h2 className="text-xl font-medium mb-2">Sử dụng .mind file trong WebAR</h2>
        <p className="text-sm mb-3">
          Sau khi tạo .mind file, bạn có thể sử dụng URL của nó trong các dự án AR của mình hoặc 
          tải về để sử dụng trong các ứng dụng AR khác. Mind file chỉ hoạt động với hình ảnh mục tiêu ban đầu.
        </p>
        <div className="bg-slate-800 text-white p-3 rounded-md text-sm">
          <pre className="whitespace-pre-wrap break-all">
{`<!-- Sử dụng .mind file trong A-Frame + MindAR -->
<script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"></script>

<a-scene mindar-image="imageTargetSrc: YOUR_MIND_FILE_URL" vr-mode-ui="enabled: false">
  <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
  <a-entity mindar-image-target="targetIndex: 0">
    <!-- Thêm các đối tượng 3D, video, v.v. ở đây -->
  </a-entity>
</a-scene>`}
          </pre>
        </div>
      </div>
    </div>
  );
}