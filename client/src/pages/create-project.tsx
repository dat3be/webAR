import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModelUpload } from "@/components/ui/model-upload";
import { ImageTargetUpload } from "@/components/ui/image-target-upload";
import { ImageEvaluator } from "@/components/ui/image-evaluator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { uploadFile } from "@/lib/fileUpload";
import { Loader2, Image, Box, Film, Square, AlertCircle, FileUp } from "lucide-react";
import { MindFileGenerator } from "@/components/FixedMindFileGenerator";
import { ImageFeatureAnalyzer } from "@/components/ImageFeatureAnalyzer";
import { Progress } from "@/components/ui/progress";
import { MindARCompiler } from "@/lib/mindar-compiler";

export default function CreateProject() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTab, setCurrentTab] = useState("details");
  const [progress, setProgress] = useState(0);

  // If not authenticated, redirect to login
  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [arType, setARType] = useState<"image-tracking" | "markerless">("image-tracking");
  const [contentType, setContentType] = useState<"3d-model" | "video">("3d-model");
  const [model, setModel] = useState<File | null>(null);
  const [targetImage, setTargetImage] = useState<File | null>(null);

  // Progress validation
  const detailsComplete = name.trim().length > 0;
  const contentComplete = model !== null;
  const imageTrackingComplete = arType === "markerless" || targetImage !== null;
  
  // Calculate overall progress
  useEffect(() => {
    let steps = 2; // Details and content are always required
    if (arType === "image-tracking") steps = 3; // Target image is required for image tracking
    
    let completedSteps = 0;
    if (detailsComplete) completedSteps++;
    if (contentComplete) completedSteps++;
    if (arType === "markerless" || imageTrackingComplete) completedSteps++;
    
    setProgress(Math.floor((completedSteps / steps) * 100));
  }, [name, model, targetImage, arType, detailsComplete, contentComplete, imageTrackingComplete]);

  // State for mind file processing
  const [processingMindFile, setProcessingMindFile] = useState(false);
  const [mindFileProgress, setMindFileProgress] = useState(0);
  const [mindFileUrl, setMindFileUrl] = useState<string | null>(null);
  const [mindFileBlob, setMindFileBlob] = useState<Blob | null>(null);
  const [compiler] = useState<MindARCompiler>(new MindARCompiler());
  
  // Process target image client-side to create .mind file
  const processMindFile = async (imageFile: File): Promise<{ mindFileUrl: string, mindFileBlob: Blob }> => {
    setProcessingMindFile(true);
    setMindFileProgress(10);
    console.log("[CreateProject] Starting client-side mind file processing");
    
    try {
      // Create an object URL from the image file
      const imageUrl = URL.createObjectURL(imageFile);
      setMindFileProgress(30);
      console.log("[CreateProject] Image URL created:", imageUrl);
      
      // Process the image using MindAR compiler
      console.log("[CreateProject] Processing image with MindAR compiler");
      const result = await compiler.processImage(imageUrl);
      setMindFileProgress(70);
      console.log("[CreateProject] Image processed successfully:", {
        imageWidth: result.image.width,
        imageHeight: result.image.height,
        totalFeaturePoints: result.points.length
      });
      
      // Get the mind file as ArrayBuffer
      console.log("[CreateProject] Exporting mind file data");
      const mindBuffer = compiler.exportData();
      const mindBlob = new Blob([mindBuffer]);
      const mindUrl = URL.createObjectURL(mindBlob);
      
      console.log("[CreateProject] Mind file created successfully, size:", mindBlob.size, "bytes");
      setMindFileProgress(100);
      setProcessingMindFile(false);
      
      // Cleanup the image URL
      URL.revokeObjectURL(imageUrl);
      
      return { mindFileUrl: mindUrl, mindFileBlob: mindBlob };
    } catch (error: any) {
      console.error("[CreateProject] Error processing mind file:", error);
      setProcessingMindFile(false);
      setMindFileProgress(0);
      throw new Error(`Failed to process mind file: ${error.message || 'Unknown error'}`);
    }
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tên dự án",
        variant: "destructive",
      });
      setCurrentTab("details");
      return;
    }

    if (!model) {
      toast({
        title: "Lỗi",
        description: `Vui lòng tải lên ${contentType === "3d-model" ? "mô hình 3D" : "video"}`,
        variant: "destructive",
      });
      setCurrentTab("content");
      return;
    }

    if (arType === "image-tracking" && !targetImage) {
      toast({
        title: "Lỗi",
        description: "Vui lòng tải lên hình ảnh mục tiêu cho tracking",
        variant: "destructive",
      });
      setCurrentTab("target");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload files to Wasabi Cloud Storage
      console.log("[CreateProject] Starting file uploads to Wasabi...");
      
      // Upload model file
      console.log("[CreateProject] Uploading model file:", model.name);
      const modelUrl = await uploadFile(model);
      console.log("[CreateProject] Model uploaded successfully, URL:", modelUrl);

      // Process and upload target image if applicable
      let targetImageUrl = "";
      let mindFileUploadUrl = "";
      
      if (arType === "image-tracking" && targetImage) {
        // Upload target image
        console.log("[CreateProject] Uploading target image:", targetImage.name);
        targetImageUrl = await uploadFile(targetImage);
        console.log("[CreateProject] Target image uploaded successfully, URL:", targetImageUrl);
        
        // Generate mind file from target image
        try {
          console.log("[CreateProject] Generating .mind file from target image");
          const { mindFileUrl, mindFileBlob } = await processMindFile(targetImage);
          
          // Upload the mind file
          console.log("[CreateProject] Uploading .mind file to storage");
          
          // Create a File object from the Blob
          const mindFile = new File([mindFileBlob], `${name.replace(/\s+/g, '_')}_target.mind`, { 
            type: 'application/octet-stream' 
          });
          
          mindFileUploadUrl = await uploadFile(mindFile);
          console.log("[CreateProject] Mind file uploaded successfully, URL:", mindFileUploadUrl);
        } catch (error) {
          console.error("[CreateProject] Error processing mind file:", error);
          toast({
            title: "Cảnh báo",
            description: "Không thể tạo file .mind từ hình ảnh. Dự án vẫn được tạo nhưng có thể ảnh hưởng đến hiệu suất AR.",
            variant: "destructive",
          });
        }
      }

      // Create project in our backend
      console.log("[CreateProject] Sending project data to backend:", {
        name,
        description,
        type: arType,
        contentType,
        modelUrl,
        targetImageUrl: targetImageUrl || null,
        mindFileUrl: mindFileUploadUrl || null
      });
      
      // Add status field and mind file URL to the request body
      const response = await apiRequest("POST", "/api/projects", {
        name,
        description,
        type: arType,
        contentType,
        modelUrl,
        targetImageUrl: targetImageUrl || null,
        mindFileUrl: mindFileUploadUrl || null,
        status: "active",
      });
      
      console.log("[CreateProject] Project created successfully:", response);

      toast({
        title: "Thành công",
        description: "Dự án AR đã được tạo thành công",
        variant: "default"
      });

      // Force invalidate the projects query to ensure immediate data update
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      // Redirect to dashboard with refresh flag to force data reload
      navigate("/dashboard?refresh=true");
    } catch (error: any) {
      console.error("[CreateProject] Error creating project:", error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo dự án. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />

      <main className="flex-1 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Create New AR Project</h1>
            <p className="mt-2 text-gray-600">Create your own augmented reality experience in a few simple steps</p>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
            <div 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <div className="bg-white shadow-sm rounded-xl overflow-hidden">
            <Tabs
              value={currentTab}
              onValueChange={setCurrentTab}
              className="w-full"
            >
              <div className="sm:px-6 px-4 pt-6 border-b">
                <TabsList className="grid w-full grid-cols-3 bg-gray-100">
                  <TabsTrigger value="details" className="relative">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs">1</span>
                      <span className="hidden sm:inline">Project Details</span>
                      <span className="sm:hidden">Details</span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="content">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs">2</span>
                      <span className="hidden sm:inline">AR Content</span>
                      <span className="sm:hidden">Content</span>
                    </span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="target" 
                    disabled={arType === "markerless"}
                    className={arType === "markerless" ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs">3</span>
                      <span className="hidden sm:inline">Target Image</span>
                      <span className="sm:hidden">Target</span>
                    </span>
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <form onSubmit={handleSubmit} className="px-4 sm:px-6 pb-6">
                <TabsContent value="details" className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 gap-x-6 gap-y-8">
                    <div className="space-y-2">
                      <Label htmlFor="project-name" className="text-base">
                        Project Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="project-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter a name for your AR project"
                        className="h-12"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="project-description" className="text-base">
                        Project Description <span className="text-gray-400 font-normal">(Optional)</span>
                      </Label>
                      <Textarea
                        id="project-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your AR experience"
                        className="h-24 resize-none"
                      />
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-base">
                          AR Experience Type <span className="text-red-500">*</span>
                        </Label>
                        <p className="text-sm text-gray-500 mt-1 mb-3">
                          Choose how users will interact with your AR experience
                        </p>
                      </div>
                      
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div 
                          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                            arType === "image-tracking" 
                              ? "border-primary bg-primary/5" 
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => setARType("image-tracking")}
                        >
                          <div className="flex gap-3 items-start">
                            <div className={`p-2 rounded-lg ${
                              arType === "image-tracking" ? "bg-primary/10" : "bg-gray-100"
                            }`}>
                              <Image className={`h-6 w-6 ${
                                arType === "image-tracking" ? "text-primary" : "text-gray-500"
                              }`} />
                            </div>
                            <div>
                              <h3 className={`font-medium ${
                                arType === "image-tracking" ? "text-primary" : "text-gray-900"
                              }`}>
                                Image Tracking
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">
                                AR content appears when a specific image is detected by the camera
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div 
                          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                            arType === "markerless" 
                              ? "border-primary bg-primary/5" 
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => setARType("markerless")}
                        >
                          <div className="flex gap-3 items-start">
                            <div className={`p-2 rounded-lg ${
                              arType === "markerless" ? "bg-primary/10" : "bg-gray-100"
                            }`}>
                              <Square className={`h-6 w-6 ${
                                arType === "markerless" ? "text-primary" : "text-gray-500"
                              }`} />
                            </div>
                            <div>
                              <h3 className={`font-medium ${
                                arType === "markerless" ? "text-primary" : "text-gray-900"
                              }`}>
                                Markerless (Surface Detection)
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">
                                AR content is placed on detected surfaces in the real world
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex justify-end">
                    <Button 
                      type="button" 
                      onClick={() => setCurrentTab("content")}
                      disabled={!detailsComplete}
                    >
                      Continue to Content
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="content" className="pt-6 space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base">
                        AR Content Type <span className="text-red-500">*</span>
                      </Label>
                      <p className="text-sm text-gray-500 mt-1 mb-3">
                        Choose what type of content to display in AR
                      </p>
                    </div>
                    
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div 
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          contentType === "3d-model" 
                            ? "border-primary bg-primary/5" 
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setContentType("3d-model")}
                      >
                        <div className="flex gap-3 items-start">
                          <div className={`p-2 rounded-lg ${
                            contentType === "3d-model" ? "bg-primary/10" : "bg-gray-100"
                          }`}>
                            <Box className={`h-6 w-6 ${
                              contentType === "3d-model" ? "text-primary" : "text-gray-500"
                            }`} />
                          </div>
                          <div>
                            <h3 className={`font-medium ${
                              contentType === "3d-model" ? "text-primary" : "text-gray-900"
                            }`}>
                              3D Model
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              Upload a 3D model (.glb or .gltf) to display in AR
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div 
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          contentType === "video" 
                            ? "border-primary bg-primary/5" 
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setContentType("video")}
                      >
                        <div className="flex gap-3 items-start">
                          <div className={`p-2 rounded-lg ${
                            contentType === "video" ? "bg-primary/10" : "bg-gray-100"
                          }`}>
                            <Film className={`h-6 w-6 ${
                              contentType === "video" ? "text-primary" : "text-gray-500"
                            }`} />
                          </div>
                          <div>
                            <h3 className={`font-medium ${
                              contentType === "video" ? "text-primary" : "text-gray-900"
                            }`}>
                              Video
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              Upload a video (.mp4) to display in AR
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-6 space-y-3">
                    <Label className="text-base">
                      {contentType === "3d-model" 
                        ? "Upload 3D Model (.glb or .gltf)" 
                        : "Upload Video (.mp4)"
                      } <span className="text-red-500">*</span>
                    </Label>
                    <ModelUpload
                      onFileSelect={setModel}
                      value={model}
                      contentType={contentType}
                    />
                  </div>
                  
                  <div className="pt-4 flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentTab("details")}
                    >
                      Back
                    </Button>
                    {arType === "image-tracking" ? (
                      <Button 
                        type="button" 
                        onClick={() => setCurrentTab("target")}
                        disabled={!contentComplete}
                      >
                        Continue to Target Image
                      </Button>
                    ) : (
                      <Button 
                        type="submit" 
                        disabled={isSubmitting || !detailsComplete || !contentComplete}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Project"
                        )}
                      </Button>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="target" className="pt-6 space-y-6">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-base">
                        Upload Target Image <span className="text-red-500">*</span>
                      </Label>
                      <p className="text-sm text-gray-500 mt-1">
                        The image that will trigger your AR content when recognized by the camera
                      </p>
                    </div>
                    
                    <ImageTargetUpload
                      onFileSelect={setTargetImage}
                      value={targetImage}
                    />
                  </div>
                  
                  {targetImage && (
                    <div className="flex flex-col items-center my-4 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                        <ImageFeatureAnalyzer 
                          image={targetImage} 
                          onAnalysisComplete={(result) => {
                            console.log("[CreateProject] Image analysis complete:", result);
                          }}
                        />
                        
                        <div className="w-full border rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50">
                          <h3 className="text-base font-medium mb-3 flex items-center gap-2">
                            <FileUp className="h-4 w-4 text-blue-600" />
                            <span>Tạo file .mind từ hình ảnh mục tiêu</span>
                          </h3>
                          
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            File .mind chứa dữ liệu để nhận dạng hình ảnh mục tiêu trong AR. 
                            Bạn có thể tạo file này bằng cách nhấn nút bên dưới, hoặc hệ thống sẽ tự động tạo khi lưu dự án.
                          </p>
                          
                          <MindFileGenerator 
                            targetImage={targetImage} 
                            onMindFileGenerated={(url) => {
                              console.log("[CreateProject] Mind file generated:", url);
                              // Lưu URL của file mind để sử dụng khi tạo dự án
                              setMindFileUrl(url);
                              
                              // Đã có mindFileUrl, không cần tạo lại khi submit
                              setMindFileBlob(null);
                            }}
                            onGenerationStart={() => {
                              console.log("[CreateProject] Mind file generation started");
                            }}
                            onGenerationError={(error) => {
                              console.error("[CreateProject] Mind file generation error:", error);
                              toast({
                                title: "Lỗi",
                                description: "Không thể tạo file .mind: " + error,
                                variant: "destructive",
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-4 flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentTab("content")}
                    >
                      Back
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting || !detailsComplete || !contentComplete || !imageTrackingComplete}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Project"
                      )}
                    </Button>
                  </div>
                </TabsContent>
              </form>
            </Tabs>
          </div>
          
          <div className="mt-4 text-center">
            <Button variant="link" onClick={() => navigate("/dashboard")}>
              Cancel and return to dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}