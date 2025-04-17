import React, { useEffect, useRef } from 'react';

interface ModelViewerProps {
  src: string;
  alt?: string;
  poster?: string;
  className?: string;
}

export function ModelViewer({ src, alt, poster, className }: ModelViewerProps) {
  // Reference để kiểm soát model-viewer
  const modelRef = useRef<HTMLElement>(null);

  // Đăng ký event listener khi component mount
  useEffect(() => {
    if (!modelRef.current) return;

    const modelViewer = modelRef.current;
    
    // Ví dụ về xử lý sự kiện
    const handleLoad = () => {
      console.log('Model đã tải xong!');
    };
    
    modelViewer.addEventListener('load', handleLoad);
    
    // Cleanup khi component unmount
    return () => {
      modelViewer.removeEventListener('load', handleLoad);
    };
  }, []);

  return (
    <model-viewer
      ref={modelRef}
      src={src}
      alt={alt || 'Mô hình 3D'}
      camera-controls
      touch-action="pan-y"
      shadow-intensity="1"
      environment-image="neutral"
      auto-rotate
      ar
      ar-modes="webxr scene-viewer quick-look"
      poster={poster}
      loading="lazy"
      reveal="interaction"
      className={className || 'w-full h-80'}
    />
  );
}