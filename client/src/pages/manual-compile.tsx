import { useState, useRef } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUp, Download, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ManualCompile() {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Hàm load ảnh thành HTMLImageElement
  const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = URL.createObjectURL(file);
    });
  };

  // Hàm compile sử dụng mind-ar (gọi dynamic import) - giống hệt ví dụ mẫu
  const handleCompile = async () => {
    setError(null);
    setProgress(0);
    setResultUrl(null);
    setIsProcessing(true);
    
    if (!files.length) {
      setIsProcessing(false);
      return;
    }
    
    try {
      console.log("[ManualCompile] Starting compilation with", files.length, "images");
      
      // dynamic import mind-ar để tránh lỗi SSR
      try {
        // First import the base module to initialize
        await import('mind-ar');
        console.log("Successfully imported mind-ar base module");
        
        // Then import the specific module we need
        const { Compiler } = await import('mind-ar/dist/mindar-image.prod.js');
        console.log("Successfully imported mindar-image.prod.js");
        
        const compiler = new Compiler();
        console.log("Successfully created compiler instance");
      } catch (err) {
        console.error("Failed to load MindAR compiler:", err);
        throw new Error("Không thể tải thư viện MindAR: " + (err as any).message);
      }
      
      console.log("[ManualCompile] MindAR compiler loaded");
      
      // Load images
      const images: HTMLImageElement[] = [];
      for (let i = 0; i < files.length; i++) {
        console.log(`[ManualCompile] Loading image ${i+1}/${files.length}`);
        images.push(await loadImage(files[i]));
      }
      
      console.log("[ManualCompile] All images loaded, starting compilation");
      
      // Compile
      await compiler.compileImageTargets(images, (percent: number) => {
        console.log(`[ManualCompile] Compilation progress: ${percent.toFixed(2)}%`);
        setProgress(percent);
      });
      
      console.log("[ManualCompile] Compilation complete, exporting data");
      
      // Export .mind buffer
      const buffer = await compiler.exportData();
      const blob = new Blob([buffer]);
      const url = URL.createObjectURL(blob);
      
      console.log("[ManualCompile] Export complete, result URL created");
      setResultUrl(url);
    } catch (e: any) {
      console.error("[ManualCompile] Compilation error:", e);
      setError('Không thể compile: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      console.log("[ManualCompile] Selected files:", selectedFiles.map(f => f.name).join(", "));
      setFiles(selectedFiles);
      setResultUrl(null);
      setError(null);
      setProgress(0);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="container mx-auto py-10 px-4 flex-1">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-center">Compile Ảnh Thành File .mind</h1>
          
          <Card>
            <CardHeader>
              <CardTitle>Tạo file .mind từ hình ảnh</CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <input
                type="file"
                accept="image/*"
                multiple
                ref={inputRef}
                className="hidden"
                onChange={handleFileChange}
              />
              
              <Button 
                variant="outline" 
                onClick={() => inputRef.current?.click()} 
                className="w-full"
              >
                <FileUp className="mr-2 h-4 w-4" />
                Chọn ảnh
              </Button>
              
              {files.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm font-medium">Đã chọn {files.length} ảnh:</p>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                    {files.map(f => (
                      <p key={f.name} className="text-sm truncate">{f.name}</p>
                    ))}
                  </div>
                </div>
              )}
              
              <Button 
                onClick={handleCompile} 
                disabled={!files.length || isProcessing}
                className="w-full"
              >
                {isProcessing ? 'Đang xử lý...' : 'Compile thành .mind'}
              </Button>
              
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Đang xử lý</span>
                    <span>{progress.toFixed(2)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
              
              {resultUrl && (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  asChild
                >
                  <a href={resultUrl} download="targets.mind">
                    <Download className="mr-2 h-4 w-4" />
                    Tải file .mind
                  </a>
                </Button>
              )}
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}