import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, ArrowLeft, Share2, Edit, Check, Info, Download, Smartphone,
  ExternalLink, ScanFace
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Project } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { MindFileGenerator } from "@/components/MindFileGenerator";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ViewProjectProps {
  projectId?: string;
}

export default function ViewProject({ projectId }: ViewProjectProps) {
  const [, navigate] = useLocation();
  const [match, params] = useRoute<{ projectId: string }>("/view/:projectId");
  const { toast } = useToast();
  const [showShareSuccess, setShowShareSuccess] = useState(false);
  const [showMindFileDialog, setShowMindFileDialog] = useState(false);
  const isMobile = useIsMobile();

  // Fetch project data
  const projectIdToUse = projectId || params?.projectId;
  const { 
    data: project, 
    isLoading: isProjectLoading, 
    error,
    refetch
  } = useQuery<Project>({
    queryKey: [`/api/projects/${projectIdToUse}`],
    enabled: !!projectIdToUse,
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải thông tin dự án. Vui lòng thử lại sau.",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  }, [error, navigate, toast]);

  // Track view 
  useEffect(() => {
    if (!isProjectLoading && project) {
      // Track this view in analytics
      try {
        apiRequest("POST", `/api/projects/${projectIdToUse}/view`);
      } catch (error) {
        console.error("Failed to record view:", error);
        // Non-critical error, continue loading the experience
      }
    }
  }, [isProjectLoading, project, projectIdToUse]);

  // Share project
  const shareProject = async () => {
    if (!project) return;

    try {
      // Record sharing event
      await apiRequest("POST", `/api/projects/${project.id}/share`);
      
      // Create share URL
      const shareUrl = window.location.origin + `/project-ar/${project.id}`;
      
      // Try to use Web Share API if available
      if (navigator.share) {
        await navigator.share({
          title: `${project.name} - WebAR Experience`,
          text: `Trải nghiệm AR "${project.name}" ngay trên trình duyệt!`,
          url: shareUrl,
        });
        return;
      }
      
      // Fallback to clipboard
      await navigator.clipboard.writeText(shareUrl);
      setShowShareSuccess(true);
      setTimeout(() => setShowShareSuccess(false), 3000);
      
      toast({
        title: "Đã sao chép",
        description: "Đường dẫn đã được sao chép vào clipboard",
      });
    } catch (error) {
      console.error("Error sharing project:", error);
      toast({
        title: "Lỗi chia sẻ",
        description: "Không thể chia sẻ dự án. Vui lòng thử lại sau.",
        variant: "destructive",
      });
    }
  };

  // Handle mind file generation completion
  const handleMindFileGenerationComplete = async () => {
    console.log('[DEBUG] Mind file generation complete callback triggered');
    
    // Close dialog
    setShowMindFileDialog(false);
    
    // Re-fetch project to get updated mindFile URL
    try {
      console.log('[DEBUG] Refetching project data...');
      await refetch();
      console.log('[DEBUG] Project data refetched successfully');
    } catch (error) {
      console.error('[DEBUG] Failed to refetch project data:', error);
    }
    
    toast({
      title: "Đánh giá hoàn tất!",
      description: "Dự án đã sẵn sàng cho trải nghiệm AR",
    });
  };
  
  // Redirect to AR experience
  const viewAR = () => {
    if (!project) return;
    
    // Debug logs
    console.log('[DEBUG] ViewAR: Current project data:', project);
    console.log('[DEBUG] ViewAR: targetMindFile =', project.targetMindFile);
    
    if (project.type === 'image-tracking' && !project.targetMindFile) {
      console.log('[DEBUG] ViewAR: Missing targetMindFile, showing dialog');
      
      toast({
        title: "Chưa có file .mind",
        description: "Vui lòng đánh giá hình ảnh mục tiêu trước khi xem AR",
        variant: "destructive",
      });
      setShowMindFileDialog(true);
      return;
    }
    
    console.log('[DEBUG] ViewAR: Navigating to AR experience');
    navigate(`/project-ar/${project.id}`);
  };
  
  if (isProjectLoading || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary/60" />
          <h2 className="text-xl font-medium">Đang tải thông tin dự án...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="container flex items-center justify-between h-16 px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Quay lại</span>
            </Button>
            <h1 className="text-lg font-semibold">{project.name}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={shareProject}
            >
              <Share2 className="h-4 w-4" />
              <span>Chia sẻ</span>
              {showShareSuccess && (
                <span className="absolute top-0 right-0 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                </span>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => navigate(`/edit-project/${project.id}`)}
            >
              <Edit className="h-4 w-4" />
              <span>Chỉnh sửa</span>
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="container px-4 py-8 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Project Info */}
          <div>
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Thông tin dự án</CardTitle>
                <CardDescription>Chi tiết về dự án {project.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Loại dự án</h3>
                    <p className="mt-1">
                      {project.type === 'image-tracking' ? 'Image Tracking AR' : 'Markerless AR'}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Loại nội dung</h3>
                    <p className="mt-1">
                      {project.contentType === '3d-model' ? 'Mô hình 3D' : 'Video'}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Mô tả</h3>
                    <p className="mt-1">{project.description || 'Không có mô tả'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* MindFile Generator for Image Tracking Projects */}
            {project.type === 'image-tracking' && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Chuẩn bị AR Experience</CardTitle>
                  <CardDescription>
                    {project.targetMindFile 
                      ? 'Hình ảnh mục tiêu đã được đánh giá và sẵn sàng cho AR'
                      : 'Đánh giá hình ảnh mục tiêu để chuẩn bị AR Experience'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {project.targetImageUrl ? (
                    <>
                      {project.targetMindFile ? (
                        <div className="p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-900/50 flex items-center gap-2 text-green-700 dark:text-green-400 mb-4">
                          <Check className="h-5 w-5 text-green-600 dark:text-green-500" />
                          <div>
                            <p className="text-sm font-medium">Hình ảnh đã được đánh giá thành công</p>
                            <p className="text-xs text-green-600/80 dark:text-green-500/80">Dự án đã sẵn sàng cho trải nghiệm AR</p>
                          </div>
                        </div>
                      ) : (
                        <MindFileGenerator 
                          projectId={project.id} 
                          targetImageUrl={project.targetImageUrl} 
                          onEvaluateComplete={handleMindFileGenerationComplete}
                        />
                      )}
                    </>
                  ) : (
                    <div className="p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <Info className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                      <div>
                        <p className="text-sm font-medium">Thiếu hình ảnh mục tiêu</p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-500/80">Vui lòng thêm hình ảnh mục tiêu trong phần chỉnh sửa dự án</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Actions */}
            <div className="flex flex-col space-y-4">
              {project.targetMindFile && project.type === 'image-tracking' ? (
                <>
                  <Button 
                    size="lg" 
                    className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                    onClick={viewAR}
                  >
                    <Smartphone className="h-5 w-5" />
                    <span>Trải nghiệm AR ngay</span>
                  </Button>
                  
                  <Button 
                    size="lg" 
                    className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-md hover:shadow-lg transition-all duration-300"
                    onClick={() => navigate(`/direct-ar/${project.id}`)}
                  >
                    <ExternalLink className="h-5 w-5" />
                    <span>Mở AR trực tiếp (Phiên bản mới)</span>
                  </Button>
                </>
              ) : (
                <Button 
                  size="lg" 
                  className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={viewAR}
                >
                  <ScanFace className="h-5 w-5" />
                  <span>Trải nghiệm AR</span>
                </Button>
              )}
              
              {project.targetMindFile && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => window.open(project.targetMindFile || '', '_blank')}
                >
                  <Download className="h-5 w-5" />
                  <span>Tải xuống file .mind</span>
                </Button>
              )}
            </div>
          </div>
          
          {/* Preview */}
          <div>
            <Card className="overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle>Xem trước</CardTitle>
                <CardDescription>
                  {project.type === 'image-tracking' 
                    ? 'Hình ảnh mục tiêu và nội dung sẽ hiển thị' 
                    : 'Nội dung sẽ hiển thị trong AR'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Target Image Preview for Image Tracking */}
                {project.type === 'image-tracking' && project.targetImageUrl && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Hình ảnh mục tiêu</h3>
                    <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                      <img
                        src={project.targetImageUrl}
                        alt="Target"
                        className="w-full h-full object-contain bg-slate-100 dark:bg-slate-900"
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
                      Sử dụng hình ảnh này để kích hoạt trải nghiệm AR
                    </p>
                  </div>
                )}
                
                {/* Content Preview */}
                <div>
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                    {project.contentType === '3d-model' ? 'Mô hình 3D' : 'Video'}
                  </h3>
                  
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                    {project.modelUrl ? (
                      project.contentType === '3d-model' ? (
                        <div className="flex flex-col items-center justify-center text-center p-4">
                          <img 
                            src="/assets/3d-model-placeholder.svg" 
                            alt="3D Model" 
                            className="w-24 h-24 mb-2 opacity-70"
                          />
                          <p className="text-sm font-medium">Mô hình 3D sẽ hiển thị trong AR</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {project.modelUrl.split('/').pop()}
                          </p>
                        </div>
                      ) : (
                        <video 
                          src={project.modelUrl} 
                          controls 
                          className="w-full h-full object-contain"
                          poster="/assets/video-placeholder.jpg"
                        />
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-4">
                        <Info className="w-10 h-10 mb-2 text-slate-400" />
                        <p className="text-sm">Không có nội dung</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* MindFile Dialog */}
      <Dialog open={showMindFileDialog} onOpenChange={setShowMindFileDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Đánh giá hình ảnh mục tiêu</DialogTitle>
            <DialogDescription>
              Bạn cần đánh giá hình ảnh mục tiêu trước khi có thể sử dụng AR
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <MindFileGenerator 
              projectId={project.id} 
              targetImageUrl={project.targetImageUrl} 
              onEvaluateComplete={handleMindFileGenerationComplete}
            />
          </div>
          
          <DialogClose asChild>
            <Button variant="outline" className="w-full">Đóng</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}