import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface MindFileGeneratorProps {
  projectId: number;
  targetImageUrl: string | null;
  className?: string;
}

export function MindFileGenerator({ projectId, targetImageUrl, className }: MindFileGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Generate .mind file from target image
  const generateMindFile = async () => {
    if (!targetImageUrl) {
      toast({
        title: "Không có hình ảnh mục tiêu",
        description: "Dự án này không có hình ảnh mục tiêu để tạo file .mind",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      setIsComplete(false);
      setDownloadUrl(null);

      // Make request to generate .mind file
      const response = await apiRequest('POST', `/api/generate-mind-file/${projectId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate .mind file');
      }

      const data = await response.json();
      setDownloadUrl(data.mindFileUrl);
      setIsComplete(true);
      
      // Update the project with the mind file URL
      try {
        const updateResponse = await apiRequest('PATCH', `/api/projects/${projectId}`, {
          targetMindFile: data.mindFileUrl
        });
        
        if (!updateResponse.ok) {
          console.warn('Failed to update project with mind file URL');
        }
      } catch (updateErr) {
        console.error('Error updating project:', updateErr);
      }

      toast({
        title: "Tạo thành công",
        description: "File .mind đã được tạo thành công và sẵn sàng để tải xuống",
        variant: "default",
      });
    } catch (err) {
      console.error('Error generating .mind file:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      
      toast({
        title: "Tạo thất bại",
        description: err instanceof Error ? err.message : 'Không thể tạo file .mind',
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`${className || ''} mt-2`}>
      <div className="mb-6 flex items-center">
        {targetImageUrl && (
          <div className="relative mr-4 w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
            <img 
              src={targetImageUrl} 
              alt="Target" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
          </div>
        )}
        
        <div className="flex-1">
          {!targetImageUrl ? (
            <div className="p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <div className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Dự án này không có hình ảnh mục tiêu</p>
                <p className="text-xs text-amber-600/70 dark:text-amber-500/70">Thêm hình ảnh mục tiêu trong phần chỉnh sửa dự án</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-red-700 dark:text-red-400">
              <div className="p-1 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Không thể tạo file .mind</p>
                <p className="text-xs text-red-600/70 dark:text-red-500/70">{error}</p>
              </div>
            </div>
          ) : isComplete ? (
            <div className="p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-900/50 flex items-center gap-2 text-green-700 dark:text-green-400 animate-pulse-slow">
              <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-full animate-bounce-subtle">
                <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Đã tạo thành công file .mind</p>
                <p className="text-xs text-green-600/70 dark:text-green-500/70">Bạn có thể tải xuống ngay bây giờ</p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <div className="flex items-start mb-2">
                <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-full mr-2 mt-0.5">
                  <Download size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Tạo file .mind cho dự án của bạn</p>
              </div>
              <p className="text-xs text-blue-700/70 dark:text-blue-400/70 pl-7">
                File .mind được tạo từ hình ảnh mục tiêu, giúp thuật toán theo dõi nhận diện hình ảnh tốt hơn. Quá trình này có thể mất vài phút tùy thuộc vào độ phức tạp của hình ảnh.
              </p>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <Button 
          variant={isGenerating ? "outline" : "default"}
          onClick={generateMindFile} 
          disabled={isGenerating || !targetImageUrl}
          className={`${isGenerating 
            ? 'bg-slate-50 text-slate-900 dark:bg-slate-900/50 dark:text-slate-300' 
            : 'bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300'}`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>Đang xử lý...</span>
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              <span>Tạo file .mind</span>
            </>
          )}
        </Button>
        
        {downloadUrl && (
          <Button 
            variant="default"
            onClick={() => window.open(downloadUrl, '_blank')}
            className="bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white animate-fade-in animate-pulse-slow shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
          >
            <Download className="mr-2 h-4 w-4 animate-bounce-subtle" />
            Tải xuống
          </Button>
        )}
      </div>
    </div>
  );
}