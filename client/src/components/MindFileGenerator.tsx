import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, CheckCircle, AlertCircle, RotateCw, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

interface MindFileGeneratorProps {
  projectId: number;
  targetImageUrl: string | null;
  className?: string;
  onEvaluateComplete?: () => void;
}

export function MindFileGenerator({ projectId, targetImageUrl, className, onEvaluateComplete }: MindFileGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Evaluate target image and generate .mind file
  const evaluateTargetImage = async () => {
    if (!targetImageUrl) {
      toast({
        title: "Không có hình ảnh mục tiêu",
        description: "Dự án này không có hình ảnh mục tiêu để đánh giá",
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
        throw new Error(errorData.message || 'Không thể đánh giá hình ảnh và tạo file .mind');
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
          console.warn('Không thể cập nhật thông tin file .mind cho dự án');
        } else {
          // Invalidate query cache to refresh project data
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
          if (onEvaluateComplete) onEvaluateComplete();
        }
      } catch (updateErr) {
        console.error('Lỗi cập nhật dự án:', updateErr);
      }

      toast({
        title: "Đánh giá thành công!",
        description: "Hình ảnh mục tiêu đã được đánh giá và tạo file .mind thành công",
        variant: "default",
      });
    } catch (err) {
      console.error('Lỗi đánh giá hình ảnh:', err);
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      
      toast({
        title: "Đánh giá thất bại",
        description: err instanceof Error ? err.message : 'Không thể đánh giá hình ảnh mục tiêu',
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
                <p className="text-sm font-medium">Không thể đánh giá hình ảnh mục tiêu</p>
                <p className="text-xs text-red-600/70 dark:text-red-500/70">{error}</p>
              </div>
            </div>
          ) : isComplete ? (
            <div className="p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-900/50 flex items-center gap-2 text-green-700 dark:text-green-400 animate-pulse-slow">
              <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-full animate-bounce-subtle">
                <Award size={16} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Đánh giá thành công!</p>
                <p className="text-xs text-green-600/70 dark:text-green-500/70">Hình ảnh đã được đánh giá và tạo file .mind thành công</p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <div className="flex items-start mb-2">
                <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-full mr-2 mt-0.5">
                  <RotateCw size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Đánh giá chất lượng hình ảnh mục tiêu</p>
              </div>
              <p className="text-xs text-blue-700/70 dark:text-blue-400/70 pl-7">
                Đánh giá và xử lý hình ảnh mục tiêu để tạo file .mind, giúp theo dõi nhận diện hình ảnh chính xác hơn. Quá trình này có thể mất vài phút tùy thuộc vào độ phức tạp của hình ảnh.
              </p>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <Button 
          variant={isGenerating ? "outline" : "default"}
          onClick={evaluateTargetImage} 
          disabled={isGenerating || !targetImageUrl}
          className={`${isGenerating 
            ? 'bg-slate-50 text-slate-900 dark:bg-slate-900/50 dark:text-slate-300' 
            : 'bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300'}`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>Đang đánh giá...</span>
            </>
          ) : (
            <>
              <RotateCw className="mr-2 h-4 w-4" />
              <span>Đánh giá hình ảnh</span>
            </>
          )}
        </Button>
        
        {downloadUrl && (
          <Button 
            variant="outline"
            onClick={() => window.open(downloadUrl, '_blank')}
            className="bg-gradient-to-br from-slate-50 to-slate-50 hover:from-slate-100 hover:to-slate-100 border-slate-200 text-slate-700 dark:text-slate-200 dark:border-slate-800 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-900 dark:hover:from-slate-800 dark:hover:to-slate-800 transition-all duration-300"
          >
            <Download className="mr-2 h-4 w-4" />
            Tải xuống file .mind
          </Button>
        )}
      </div>
    </div>
  );
}