import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, Download, UploadCloud, CheckCircle2 } from "lucide-react";

/**
 * A simpler, fixed implementation of MindAR mind file generator
 * Avoids complex rendering issues and provides a straightforward interface
 */
interface SimpleMindGeneratorProps {
  onMindFileGenerated?: (mindFileUrl: string, fileName: string) => void;
  className?: string;
  showDownloadButton?: boolean;
  buttonText?: string;
}

export function FixedMindGenerator({
  onMindFileGenerated,
  className = '',
  showDownloadButton = true,
  buttonText = 'Tạo file .mind từ ảnh'
}: SimpleMindGeneratorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFileName, setResultFileName] = useState<string>('target.mind');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const clearState = () => {
    setProgress(0);
    setError(null);
    setSuccess(false);
    setResultUrl(null);
    setResultFileName('target.mind');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      clearState();
      
      // Generate a file name based on the original
      const baseName = file.name.split('.')[0] || 'target';
      setResultFileName(`${baseName}.mind`);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const processImage = async () => {
    if (!selectedFile) {
      setError('Vui lòng chọn ảnh trước khi tạo file .mind');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setSuccess(false);
    setResultUrl(null);

    try {
      // Load the image
      const img = await loadImage(selectedFile);
      console.log("Image loaded:", img.width, "x", img.height);
      
      // Thay vì import dynamic, sẽ dùng CDN script
      // Lỗi hiện tại là do server trả về HTML thay vì JavaScript module
      console.log("Importing MindAR compiler via CDN...");
      
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-image.prod.js';
      script.async = true;
      
      await new Promise<void>((resolve, reject) => {
        script.onload = () => {
          console.log("✓ MindAR script loaded via CDN");
          resolve();
        };
        script.onerror = () => {
          console.error("✗ Failed to load MindAR script via CDN");
          reject(new Error("Không thể tải thư viện MindAR"));
        };
        document.head.appendChild(script);
      });
      
      // @ts-ignore - global MINDAR object from CDN script
      if (!window.MINDAR || !window.MINDAR.IMAGE || !window.MINDAR.IMAGE.Compiler) {
        throw new Error("Không thể tìm thấy compiler trong thư viện MindAR");
      }
      
      // @ts-ignore
      const compiler = new window.MINDAR.IMAGE.Compiler();
      console.log("Compiler instance created");
      
      // Start compilation
      await compiler.compileImageTargets([img], (progress: number) => {
        setProgress(progress);
        console.log(`Compilation progress: ${progress.toFixed(2)}%`);
      });
      
      // Export data
      const buffer = await compiler.exportData();
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      setResultUrl(url);
      setSuccess(true);
      
      // Callback
      if (onMindFileGenerated) {
        onMindFileGenerated(url, resultFileName);
      }
    } catch (err: any) {
      console.error("Error creating mind file:", err);
      setError(`Lỗi tạo file .mind: ${err.message || 'Không xác định'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Load an image from a File object
   */
  const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Không thể tải ảnh"));
      img.src = URL.createObjectURL(file);
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Tạo file .mind</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        
        <div className="flex flex-col gap-2">
          <Button 
            variant="outline" 
            onClick={handleClick}
            className="w-full"
          >
            <UploadCloud className="mr-2 h-4 w-4" />
            Chọn ảnh mục tiêu
          </Button>
          
          {selectedFile && (
            <div className="text-sm">
              Đã chọn: <span className="font-medium">{selectedFile.name}</span>
            </div>
          )}
        </div>
        
        <Button 
          onClick={processImage} 
          disabled={!selectedFile || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang xử lý...
            </>
          ) : (
            buttonText
          )}
        </Button>
        
        {isProcessing && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Đang xử lý</span>
              <span>{progress.toFixed(2)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}
        
        {success && (
          <div className="flex items-center text-green-600">
            <CheckCircle2 className="mr-1 h-4 w-4" />
            <span>Tạo file .mind thành công!</span>
          </div>
        )}
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      
      {resultUrl && showDownloadButton && (
        <CardFooter>
          <Button 
            variant="outline" 
            className="w-full" 
            asChild
          >
            <a href={resultUrl} download={resultFileName}>
              <Download className="mr-2 h-4 w-4" />
              Tải file .mind
            </a>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}