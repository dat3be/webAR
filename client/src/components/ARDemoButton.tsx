import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Scan, Smartphone } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

export function ARDemoButton() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);

  const demoUrl = `/demo/ar`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + demoUrl);
      toast({
        title: "URL đã được sao chép",
        description: "Đường dẫn đến ứng dụng demo AR đã được sao chép vào clipboard.",
      });
    } catch (error) {
      toast({
        title: "Lỗi khi sao chép",
        description: "Không thể sao chép URL. Vui lòng thử lại hoặc sao chép thủ công.",
        variant: "destructive",
      });
    }
  };

  const openDemo = () => {
    setLoading(true);
    window.open(demoUrl, "_blank");
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <div className="flex flex-col md:flex-row gap-2 w-full">
      <Button 
        variant="default" 
        className="flex items-center gap-2 w-full md:w-auto"
        onClick={openDemo}
        disabled={loading}
      >
        <Scan size={18} />
        <span>Xem Demo AR</span>
      </Button>
      
      {!isMobile && (
        <Button 
          variant="outline" 
          className="flex items-center gap-2 w-full md:w-auto"
          onClick={copyToClipboard}
        >
          <ExternalLink size={18} />
          <span>Sao chép URL cho thiết bị di động</span>
        </Button>
      )}
    </div>
  );
}