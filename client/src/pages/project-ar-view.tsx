import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ProjectARViewer } from "@/components/ProjectARViewer";
import { Project } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface ProjectARViewProps {
  projectId?: string;
}

export default function ProjectARView({ projectId }: ProjectARViewProps) {
  const [location, navigate] = useLocation();

  // Lấy projectId từ URL nếu không có trong props
  // Format của URL: /project-ar/123
  const idFromUrl = location.split('/').pop();
  const projectIdToUse = projectId || idFromUrl;

  // Lấy thông tin project
  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: [`/api/projects/${projectIdToUse}`],
    enabled: !!projectIdToUse,
  });

  // Tự động quay về trang dashboard nếu có lỗi
  useEffect(() => {
    if (error) {
      console.error("Error loading project:", error);
      navigate("/dashboard");
    }
  }, [error, navigate]);

  // Để việc xem được tính trong analytics
  useEffect(() => {
    if (project?.id) {
      try {
        // Record view
        fetch(`/api/projects/${project.id}/view`, {
          method: 'POST'
        }).catch(err => console.error("Failed to record view:", err));

        // Request fullscreen on mobile for better experience
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(err => {
            console.warn("Failed to enter fullscreen:", err);
          });
        }
      } catch (error) {
        console.error("Error in view effect:", error);
      }
    }
  }, [project]);

  // Hiển thị loading
  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <h2 className="text-xl font-medium">Đang tải AR Experience...</h2>
        </div>
      </div>
    );
  }

  // Kiểm tra xem project có targetMindFile không
  if (!project.targetMindFile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md text-center">
          <h2 className="text-2xl font-semibold mb-4 text-red-600">Thiếu File AR</h2>
          <p className="mb-6">
            Dự án này chưa có file .mind cần thiết cho AR. Vui lòng quay lại trang xem dự án và tạo file mind từ hình ảnh mục tiêu.
          </p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            onClick={() => navigate(`/view/${project.id}`)}
          >
            Quay lại Dự án
          </button>
        </div>
      </div>
    );
  }

  // Render AR viewer
  return <ProjectARViewer project={project} />;
}