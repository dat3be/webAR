import { apiRequest } from "./queryClient";

/**
 * Upload a file to the server's storage (Wasabi)
 * @param file File to upload
 * @returns Promise with the URL of the uploaded file
 */
export async function uploadFile(file: File): Promise<string> {
  // Step 1: Get a presigned post URL from the server
  console.log("[FileUpload] Requesting presigned post URL for", file.name);
  const contentType = file.type || "application/octet-stream";
  
  const presignedResponse = await apiRequest(
    "POST", 
    "/api/uploads/presigned-url", 
    {
      fileName: file.name,
      contentType
    }
  );
  
  const presignedData = await presignedResponse.json();
  console.log("[FileUpload] Received presigned post data");
  
  // Step 2: Upload directly to Wasabi using the presigned URL
  console.log("[FileUpload] Uploading to Wasabi storage...");
  const formData = new FormData();
  
  // Add all fields from the presigned post data
  Object.entries(presignedData.fields).forEach(([key, value]) => {
    formData.append(key, value as string);
  });
  
  // Add the file last
  formData.append("file", file);
  
  // Upload to Wasabi
  const uploadResponse = await fetch(presignedData.url, {
    method: "POST",
    body: formData,
  });
  
  if (!uploadResponse.ok) {
    console.error("[FileUpload] Upload failed:", await uploadResponse.text());
    throw new Error(`Upload failed with status ${uploadResponse.status}`);
  }
  
  console.log("[FileUpload] Upload successful");
  
  // Return the public URL
  return presignedData.publicUrl;
}