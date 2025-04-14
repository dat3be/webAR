import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Project } from "@shared/schema";
import { Eye, Share2, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface ProjectCardProps {
  project: Project;
  onDelete: () => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const [, navigate] = useLocation();

  const handlePreview = () => {
    navigate(`/view/${project.id}`);
  };

  const handleShare = () => {
    const shareUrl = window.location.origin + `/view/${project.id}`;
    
    // Check if Web Share API is available
    if (navigator.share) {
      navigator.share({
        title: project.name,
        text: 'Check out my AR project: ' + project.name,
        url: shareUrl,
      });
    } else {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
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
          <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
            Active
          </Badge>
        </div>
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
        </div>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash className="mr-1.5 h-4 w-4" />
          Delete
        </Button>
      </div>
    </Card>
  );
}
