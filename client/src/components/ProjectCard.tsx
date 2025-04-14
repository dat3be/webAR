import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Project, ProjectAnalytics } from "@shared/schema";
import { Eye, Share2, Trash, BarChart2 } from "lucide-react";
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
    <Card className="overflow-hidden shadow">
      <div className="aspect-w-16 aspect-h-9 bg-gray-200">
        {project.type === "image-tracking" && project.targetImageUrl ? (
          <img 
            src={project.targetImageUrl} 
            alt={`${project.name} target image`} 
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center bg-gray-200 w-full h-full">
            <span className="text-gray-500">
              {project.type === "markerless" ? "Markerless AR" : "No preview available"}
            </span>
          </div>
        )}
      </div>
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {project.type === "image-tracking" ? "Image Tracking" : "Markerless"}
              {project.contentType === "video" && " (Video)"}
            </p>
          </div>
          <Badge 
            variant={project.status === "active" ? "outline" : "destructive"} 
            className={project.status === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
          >
            {project.status === "active" ? "Active" : project.status === "archived" ? "Archived" : "Deleted"}
          </Badge>
        </div>
        
        {/* Analytics section (conditionally rendered) */}
        {showAnalytics && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
            <h4 className="text-sm font-medium mb-2">Analytics</h4>
            {isLoadingAnalytics ? (
              <p className="text-sm text-gray-500">Loading analytics...</p>
            ) : analytics ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-500">Views</p>
                  <p className="text-sm font-medium">{analytics.viewCount || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Shares</p>
                  <p className="text-sm font-medium">{analytics.shareCount || 0}</p>
                </div>
                {analytics.lastViewed && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Last viewed</p>
                    <p className="text-sm">{formatDistanceToNow(new Date(analytics.lastViewed), { addSuffix: true })}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No analytics available</p>
            )}
          </div>
        )}
        
        <div className="mt-4 flex">
          <span className="text-sm text-gray-500">Created: {createdDate}</span>
        </div>
      </div>
      <div className="bg-gray-50 px-4 py-4 sm:px-6 border-t border-gray-200 flex justify-between">
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handlePreview}>
            <Eye className="mr-1.5 h-4 w-4 text-gray-400" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="mr-1.5 h-4 w-4 text-gray-400" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={toggleAnalytics}>
            <BarChart2 className="mr-1.5 h-4 w-4 text-gray-400" />
            Stats
          </Button>
        </div>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash className="mr-1.5 h-4 w-4" />
          Delete
        </Button>
      </div>
    </Card>
  );
}
