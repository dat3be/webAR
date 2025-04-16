import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Project, ProjectAnalytics } from "@shared/schema";
import { Eye, Share2, Trash, BarChart2, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ProjectCardProps {
  project: Project;
  onDelete: () => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Fetch analytics data if needed
  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery<ProjectAnalytics>({
    queryKey: [`/api/projects/${project.id}/analytics`],
    enabled: showAnalytics,
  });

  const handlePreview = () => {
    navigate(`/view/${project.id}`);
  };
  
  const handleARExperience = () => {
    // Chuyển hướng đến trang AR experience của project này
    navigate(`/project-ar/${project.id}`);
  };

  const handleShare = async () => {
    const shareUrl = window.location.origin + `/view/${project.id}`;
    
    try {
      // Record share analytics
      await apiRequest("POST", `/api/projects/${project.id}/share`);
      
      // Check if Web Share API is available
      if (navigator.share) {
        navigator.share({
          title: project.name,
          text: 'Check out my AR project: ' + project.name,
          url: shareUrl,
        });
      } else {
        // Fallback to copying to clipboard
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link Copied",
          description: "Project link copied to clipboard",
        });
      }
    } catch (error) {
      console.error("Error sharing project:", error);
      // Still copy the link even if analytics fails
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied",
        description: "Project link copied to clipboard",
      });
    }
  };

  // Toggle analytics view
  const toggleAnalytics = () => {
    setShowAnalytics(!showAnalytics);
  };

  // Format creation date
  const createdDate = project.createdAt ? formatDistanceToNow(new Date(project.createdAt), { addSuffix: true }) : 'Recently';

  return (
    <Card className="overflow-hidden shadow transition-all duration-300 hover:shadow-md">
      <div className="aspect-w-16 aspect-h-9 bg-gray-200 relative overflow-hidden group">
        {project.type === "image-tracking" && project.targetImageUrl ? (
          <>
            <img 
              src={project.targetImageUrl} 
              alt={`${project.name} target image`} 
              className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </>
        ) : (
          <div className="flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-300 w-full h-full">
            <span className="text-gray-500 font-medium px-3 py-1.5 rounded-full bg-white/80 shadow-sm">
              {project.type === "markerless" ? "Markerless AR" : "No preview available"}
            </span>
          </div>
        )}
      </div>
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium text-gray-900 line-clamp-1">{project.name}</h3>
            <p className="mt-1 text-sm text-gray-500 flex items-center">
              <span className={`w-2 h-2 rounded-full mr-1.5 ${
                project.type === "image-tracking" ? "bg-indigo-500" : "bg-purple-500"
              }`}></span>
              {project.type === "image-tracking" ? "Image Tracking" : "Markerless"}
              {project.contentType === "video" && " (Video)"}
            </p>
          </div>
          <Badge 
            variant={project.status === "active" ? "outline" : "destructive"} 
            className={project.status === "active" ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" : ""}
          >
            {project.status === "active" ? "Active" : project.status === "archived" ? "Archived" : "Deleted"}
          </Badge>
        </div>
        
        {/* Analytics section (conditionally rendered) */}
        {showAnalytics && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200 animate-in fade-in slide-in-from-top-1 duration-300">
            <h4 className="text-sm font-medium mb-2 flex items-center">
              <BarChart2 className="h-4 w-4 mr-1.5 text-gray-500" />
              Analytics
            </h4>
            {isLoadingAnalytics ? (
              <p className="text-sm text-gray-500 flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading analytics...
              </p>
            ) : analytics ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 bg-white rounded border border-gray-100">
                  <p className="text-xs text-gray-500">Views</p>
                  <p className="text-sm font-medium">{analytics.viewCount || 0}</p>
                </div>
                <div className="p-2 bg-white rounded border border-gray-100">
                  <p className="text-xs text-gray-500">Shares</p>
                  <p className="text-sm font-medium">{analytics.shareCount || 0}</p>
                </div>
                {analytics.lastViewed && (
                  <div className="col-span-2 p-2 bg-white rounded border border-gray-100">
                    <p className="text-xs text-gray-500">Last viewed</p>
                    <p className="text-sm">{formatDistanceToNow(new Date(analytics.lastViewed), { addSuffix: true })}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No analytics available yet</p>
            )}
          </div>
        )}
        
        <div className="mt-4 flex">
          <span className="text-sm text-gray-500 flex items-center">
            <span className="w-1 h-1 rounded-full bg-gray-300 mr-1.5"></span>
            Created {createdDate}
          </span>
        </div>
      </div>
      <div className="bg-gray-50 px-4 py-4 sm:px-6 border-t border-gray-200">
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handlePreview}
              className="transition-colors hover:bg-primary hover:text-white">
              <Eye className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
            {project.targetMindFile && (
              <Button variant="outline" size="sm" onClick={handleARExperience}
                className="transition-colors hover:bg-primary hover:text-white">
                <Smartphone className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">AR Mode</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleShare}
              className="transition-colors hover:bg-primary hover:text-white">
              <Share2 className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button variant={showAnalytics ? "secondary" : "outline"} size="sm" onClick={toggleAnalytics}
              className={showAnalytics ? "bg-primary/10" : "transition-colors hover:bg-primary hover:text-white"}>
              <BarChart2 className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Stats</span>
            </Button>
          </div>
          <Button variant="destructive" size="sm" onClick={onDelete}
            className="transition-opacity hover:opacity-90">
            <Trash className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
