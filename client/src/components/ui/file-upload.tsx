import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  acceptedFileTypes: string;
  maxSize: number; // in MB
}

export function FileUpload({ onFileSelect, acceptedFileTypes, maxSize }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    // Check file size
    const fileSizeInMB = file.size / (1024 * 1024);
    if (fileSizeInMB > maxSize) {
      setError(`File is too large. Maximum size is ${maxSize}MB.`);
      return false;
    }

    // Check file type using file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = acceptedFileTypes
      .split(',')
      .map(type => type.trim().replace('.', '').toLowerCase());

    if (!fileExtension || !validExtensions.includes(fileExtension)) {
      setError(`Invalid file type. Accepted types are: ${acceptedFileTypes}`);
      return false;
    }

    setError(null);
    return true;
  };

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        onFileSelect(file);
      } else {
        setSelectedFile(null);
        onFileSelect(null);
      }
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
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

  return (
    <div 
      className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md ${
        dragActive ? 'border-primary' : 'border-gray-300'
      } ${error ? 'border-red-300' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="space-y-1 text-center">
        <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
        <div className="flex text-sm text-gray-600">
          <label
            htmlFor="file-upload"
            className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary"
          >
            <span onClick={handleButtonClick}>Upload a file</span>
            <Input
              ref={inputRef}
              id="file-upload"
              name="file-upload"
              type="file"
              className="sr-only"
              accept={acceptedFileTypes}
              onChange={handleInputChange}
            />
          </label>
          <p className="pl-1">or drag and drop</p>
        </div>
        <p className="text-xs text-gray-500">
          {selectedFile ? (
            <>Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)}MB)</>
          ) : (
            `${acceptedFileTypes.replace(/\./g, '').toUpperCase()} up to ${maxSize}MB`
          )}
        </p>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
