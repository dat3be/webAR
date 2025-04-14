import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { uploadFile } from "@/lib/firebase";

export default function CreateProject() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      toast({
        title: "Error",
        description: "Please enter a project name",
        variant: "destructive",
      });
      return;
    }

    if (!model) {
      toast({
        title: "Error",
        description: `Please upload a ${contentType === "3d-model" ? "3D model" : "video"}`,
        variant: "destructive",
      });
      return;
    }

    if (arType === "image-tracking" && !targetImage) {
      toast({
        title: "Error",
        description: "Please upload a target image for image tracking",
        variant: "destructive",
      });
      return;
    }

    // Validate file types
    if (contentType === "3d-model" && !model.name.match(/\.(glb|gltf)$/i)) {
      toast({
        title: "Invalid File",
        description: "Please upload a valid 3D model (.glb or .gltf)",
        variant: "destructive",
      });
      return;
    }

    if (contentType === "video" && !model.name.match(/\.(mp4)$/i)) {
      toast({
        title: "Invalid File",
        description: "Please upload a valid video file (.mp4)",
        variant: "destructive",
      });
      return;
    }

    if (arType === "image-tracking" && !targetImage?.name.match(/\.(jpg|jpeg|png)$/i)) {
      toast({
        title: "Invalid File",
        description: "Please upload a valid image file (.jpg, .jpeg, or .png)",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload files to Firebase Storage
      const modelPath = `models/${user?.uid}/${Date.now()}_${model.name}`;
      const modelUrl = await uploadFile(model, modelPath);

      let targetImageUrl = "";
      if (arType === "image-tracking" && targetImage) {
        const imagePath = `target-images/${user?.uid}/${Date.now()}_${targetImage.name}`;
        targetImageUrl = await uploadFile(targetImage, imagePath);
      }

      // Create project in our backend
      const response = await apiRequest("POST", "/api/projects", {
        name,
        description,
        type: arType,
        contentType,
        modelUrl,
        targetImageUrl: targetImageUrl || null,
      });

      toast({
        title: "Success",
        description: "Project created successfully",
      });

      // Redirect to dashboard
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error creating project:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create project. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />

      <main className="flex-1 overflow-auto py-6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Create New AR Project</CardTitle>
              <CardDescription>
                Fill out the form below to create your AR experience.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter project name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-description">Project Description (Optional)</Label>
                  <Input
                    id="project-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter project description"
                  />
                </div>

                <div className="space-y-2">
                  <Label>AR Experience Type</Label>
                  <RadioGroup value={arType} onValueChange={(value) => setARType(value as "image-tracking" | "markerless")}>
                    <div className="bg-white border rounded-lg shadow-sm p-4 flex cursor-pointer hover:border-primary/50">
                      <RadioGroupItem value="image-tracking" id="ar-type-1" className="mr-2" />
                      <div>
                        <Label htmlFor="ar-type-1" className="text-base font-medium">
                          Image Tracking
                        </Label>
                        <p className="text-sm text-gray-500">
                          AR content will appear when a specific image is detected by the camera.
                        </p>
                      </div>
                    </div>
                    <div className="bg-white border rounded-lg shadow-sm p-4 flex cursor-pointer hover:border-primary/50">
                      <RadioGroupItem value="markerless" id="ar-type-2" className="mr-2" />
                      <div>
                        <Label htmlFor="ar-type-2" className="text-base font-medium">
                          Markerless (Surface Detection)
                        </Label>
                        <p className="text-sm text-gray-500">
                          AR content will be placed on detected surfaces in the real world.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>AR Content Type</Label>
                  <RadioGroup value={contentType} onValueChange={(value) => setContentType(value as "3d-model" | "video")}>
                    <div className="bg-white border rounded-lg shadow-sm p-4 flex cursor-pointer hover:border-primary/50">
                      <RadioGroupItem value="3d-model" id="content-type-1" className="mr-2" />
                      <div>
                        <Label htmlFor="content-type-1" className="text-base font-medium">
                          3D Model
                        </Label>
                        <p className="text-sm text-gray-500">
                          Upload a 3D model (.glb or .gltf) to display in AR.
                        </p>
                      </div>
                    </div>
                    <div className="bg-white border rounded-lg shadow-sm p-4 flex cursor-pointer hover:border-primary/50">
                      <RadioGroupItem value="video" id="content-type-2" className="mr-2" />
                      <div>
                        <Label htmlFor="content-type-2" className="text-base font-medium">
                          Video
                        </Label>
                        <p className="text-sm text-gray-500">
                          Upload a video (.mp4) to display in AR.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>
                    {contentType === "3d-model" ? "Upload 3D Model (.glb or .gltf)" : "Upload Video (.mp4)"}
                  </Label>
                  <FileUpload
                    onFileSelect={setModel}
                    acceptedFileTypes={contentType === "3d-model" ? ".glb,.gltf" : ".mp4"}
                    maxSize={contentType === "3d-model" ? 50 : 100}
                  />
                </div>

                {arType === "image-tracking" && (
                  <div className="space-y-2">
                    <Label>Upload Target Image (.jpg, .jpeg, .png)</Label>
                    <FileUpload
                      onFileSelect={setTargetImage}
                      acceptedFileTypes=".jpg,.jpeg,.png"
                      maxSize={10}
                    />
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create Project"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
