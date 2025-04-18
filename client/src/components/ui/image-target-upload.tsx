import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon, AlertTriangle, CheckCircle, X, Info, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface ImageTargetUploadProps {
  onFileSelect: (file: File | null) => void;
  value: File | null;
}

export function ImageTargetUpload({ onFileSelect, value }: ImageTargetUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputId = `image-upload-${Math.random().toString(36).substring(2, 9)}`;
  const isMobile = useIsMobile();
  
  const acceptedFileTypes = ".jpg,.jpeg,.png";
  const maxSize = 10; // MB
  
  // Cleanup error message after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Create preview URL when a file is selected
  useEffect(() => {
    // Clean up the preview URL when component unmounts
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);
  
  const validateFile = (file: File): boolean => {
    // Reset error state before validation
    setError(null);
    
    // Check file size
    const fileSizeInMB = file.size / (1024 * 1024);
    if (fileSizeInMB > maxSize) {
      setError(`File is too large. Maximum size is ${maxSize}MB.`);
      setPreviewUrl(null);
      return false;
    }

    // Check file type using file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const validExtensions = acceptedFileTypes
      .split(",")
      .map(type => type.trim().replace(".", "").toLowerCase());

    if (!fileExtension || !validExtensions.includes(fileExtension)) {
      setError(`Invalid file type. Accepted types are: ${acceptedFileTypes.replace(/\./g, " ")}`);
      setPreviewUrl(null);
      return false;
    }

    // Create preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return true;
  };

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      
      // Set uploading state
      setIsUploading(true);
      
      // Use setTimeout to simulate processing (and give UI time to update)
      setTimeout(() => {
        if (validateFile(file)) {
          onFileSelect(file);
        } else {
          onFileSelect(null);
        }
        setIsUploading(false);
      }, 500);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileChange(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files);
  };
  
  const removeFile = () => {
    onFileSelect(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="w-full">
      {!value ? (
        <div 
          className={cn(
            "relative flex flex-col items-center justify-center w-full p-6 transition-all border-2 border-dashed rounded-lg",
            dragActive ? "border-primary bg-primary/5" : "border-gray-300 bg-gray-50",
            error ? "border-red-400 bg-red-50" : "",
            isUploading ? "border-amber-400 bg-amber-50" : ""
          )}
          onDragEnter={!isMobile ? handleDrag : undefined}
          onDragLeave={!isMobile ? handleDrag : undefined}
          onDragOver={!isMobile ? handleDrag : undefined}
          onDrop={!isMobile ? handleDrop : undefined}
        >
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className={cn(
              "p-3 rounded-full transition-all",
              isUploading ? "bg-amber-100" : "bg-primary/10"
            )}>
              {isUploading ? (
                <Upload className="w-8 h-8 text-amber-500 animate-pulse" />
              ) : (
                <ImageIcon className="w-8 h-8 text-primary" />
              )}
            </div>
            
            <div className="space-y-2 text-center">
              <h3 className="text-lg font-medium">
                {isUploading ? "Processing..." : "Upload Target Image"}
              </h3>
              <p className="text-sm text-gray-500">
                {isUploading 
                  ? "Please wait while we validate your image" 
                  : "Upload an image for AR tracking (.jpg, .jpeg, .png)"
                }
              </p>
              <p className="text-xs text-gray-400">
                Max file size: {maxSize}MB
              </p>
            </div>
            
            <label 
              htmlFor={fileInputId}
              className={cn(
                "w-full max-w-xs px-4 py-2 text-sm text-center text-white bg-primary rounded-md cursor-pointer transition-opacity",
                isUploading ? "opacity-50 pointer-events-none" : "hover:opacity-90"
              )}
            >
              {isUploading ? "Processing..." : "Choose Image"}
            </label>
            <input
              id={fileInputId}
              ref={inputRef}
              type="file"
              className="hidden"
              accept={acceptedFileTypes}
              onChange={handleInputChange}
              disabled={isUploading}
            />
            
            {/* Conditionally show drag & drop text only on desktop */}
            {!isMobile && (
              <p className="text-xs text-gray-400 mt-2">Or drag and drop image here</p>
            )}
            
            <div className="flex items-center gap-2 mt-2 text-amber-600 bg-amber-50 p-3 rounded-md text-xs w-full max-w-xs">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span className="text-left">For best results, use high-contrast images with distinct features</span>
            </div>
            
            {error && (
              <div className="flex items-center gap-2 mt-2 text-red-500 bg-red-50 p-2 rounded-md w-full max-w-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs text-left">{error}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <Card className="relative overflow-hidden border-green-200">
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-white/80 hover:bg-white hover:text-red-500"
              onClick={removeFile}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <CardContent className="p-0">
            <div className="flex flex-col">
              {previewUrl && (
                <div className="relative aspect-video bg-gray-100 w-full overflow-hidden rounded-t-lg">
                  <img 
                    src={previewUrl} 
                    alt="Target preview" 
                    className="object-contain w-full h-full" 
                  />
                </div>
              )}
              
              <div className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-100">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium truncate">{value.name}</p>
                    <p className="text-xs text-gray-500">
                      {(value.size / (1024 * 1024)).toFixed(2)} MB • Target Image
                    </p>
                  </div>
                </div>
                <label 
                  htmlFor={fileInputId}
                  className="inline-flex h-8 items-center justify-center rounded-md bg-gray-100 px-3 text-xs font-medium transition-colors hover:bg-gray-200 cursor-pointer"
                >
                  Change
                </label>
                <input
                  id={fileInputId}
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept={acceptedFileTypes}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
