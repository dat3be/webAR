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
        title: "No target image",
        description: "This project doesn't have a target image to generate a .mind file from",
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

      toast({
        title: ".mind file generated",
        description: "Your .mind file has been generated successfully",
      });
    } catch (err) {
      console.error('Error generating .mind file:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : 'Failed to generate .mind file',
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className={`${className || ''}`}>
      <CardHeader>
        <CardTitle className="text-lg">MindAR File Generator</CardTitle>
        <CardDescription>Generate a .mind file from your target image for offline or custom AR applications</CardDescription>
      </CardHeader>
      <CardContent>
        {!targetImageUrl ? (
          <div className="p-4 border rounded-md bg-yellow-50 dark:bg-yellow-950 flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <AlertCircle size={18} />
            <p className="text-sm">This project doesn't have a target image</p>
          </div>
        ) : error ? (
          <div className="p-4 border rounded-md bg-red-50 dark:bg-red-950 flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle size={18} />
            <p className="text-sm">{error}</p>
          </div>
        ) : isComplete ? (
          <div className="p-4 border rounded-md bg-green-50 dark:bg-green-950 flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle size={18} />
            <p className="text-sm">.mind file generated successfully</p>
          </div>
        ) : (
          <div className="p-4 border rounded-md text-sm">
            <p>Generate a compiled .mind file for this project's target image. You can use this file with the MindAR library for custom AR applications.</p>
            <p className="mt-2 text-muted-foreground">
              Note: This may take a few moments depending on the image complexity.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={generateMindFile} 
          disabled={isGenerating || !targetImageUrl}
        >
          {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {!isGenerating && <Download className="mr-2 h-4 w-4" />}
          Generate .mind File
        </Button>
        
        {downloadUrl && (
          <Button 
            variant="default"
            onClick={() => window.open(downloadUrl, '_blank')}
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}