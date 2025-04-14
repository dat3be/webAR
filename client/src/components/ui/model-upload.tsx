import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Box, Film, AlertTriangle, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelUploadProps {
  onFileSelect: (file: File | null) => void;
  value: File | null;
  contentType: "3d-model" | "video";
}

export function ModelUpload({ onFileSelect, value, contentType }: ModelUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const acceptedFileTypes = contentType === "3d-model" ? ".glb,.gltf" : ".mp4";
  const maxSize = contentType === "3d-model" ? 50 : 100; // MB
  
  const validateFile = (file: File): boolean => {
    // Check file size
    const fileSizeInMB = file.size / (1024 * 1024);
    if (fileSizeInMB > maxSize) {
      setError(`File is too large. Maximum size is ${maxSize}MB.`);
      return false;
    }

    // Check file type using file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const validExtensions = acceptedFileTypes
      .split(",")
      .map(type => type.trim().replace(".", "").toLowerCase());

    if (!fileExtension || !validExtensions.includes(fileExtension)) {
      setError(`Invalid file type. Accepted types are: ${acceptedFileTypes.replace(/\./g, " ")}`);
      return false;
    }

    setError(null);
    return true;
  };

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      } else {
        onFileSelect(null);
      }
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

  const handleButtonClick = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files);
  };
  
  const removeFile = () => {
    onFileSelect(null);
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
            error ? "border-red-400 bg-red-50" : ""
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-3 rounded-full bg-primary/10">
              {contentType === "3d-model" ? (
                <Box className="w-8 h-8 text-primary" />
              ) : (
                <Film className="w-8 h-8 text-primary" />
              )}
            </div>
            
            <div className="space-y-2 text-center">
              <h3 className="text-lg font-medium">
                {contentType === "3d-model" ? "Upload 3D Model" : "Upload Video"}
              </h3>
              <p className="text-sm text-gray-500">
                {contentType === "3d-model" 
                  ? "Upload your 3D model in .glb or .gltf format" 
                  : "Upload your video in .mp4 format"}
              </p>
              <p className="text-xs text-gray-400">
                Max file size: {maxSize}MB
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Button
                type="button"
                onClick={handleButtonClick}
                variant="default"
                className="relative"
              >
                Choose File
                <Input
                  ref={inputRef}
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept={acceptedFileTypes}
                  onChange={handleInputChange}
                />
              </Button>
              <Button type="button" variant="outline">
                Drag & Drop
              </Button>
            </div>
            
            {error && (
              <div className="flex items-center gap-2 mt-2 text-red-500">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs">{error}</span>
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
              className="h-8 w-8 rounded-full"
              onClick={removeFile}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col">
                  <p className="text-sm font-medium truncate">{value.name}</p>
                  <p className="text-xs text-gray-500">
                    {(value.size / (1024 * 1024)).toFixed(2)} MB • {
                      contentType === "3d-model" ? "3D Model" : "Video"
                    }
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleButtonClick}>
                Change
                <Input
                  ref={inputRef}
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept={acceptedFileTypes}
                  onChange={handleInputChange}
                />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
