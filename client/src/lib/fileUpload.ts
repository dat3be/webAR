import { apiRequest } from "./queryClient";

/**
 * Tải lên tệp đến API endpoint và trả về URL của tệp từ Wasabi
 * @param file Tệp cần tải lên
 * @returns Promise chứa URL của tệp đã tải lên
 */
export async function uploadFile(file: File): Promise<string> {
  try {
    console.log(`[fileUpload] Bắt đầu tải lên tệp: ${file.name} (${file.type}), kích thước: ${file.size} bytes`);
    
    // Tạo FormData để gửi tệp
    const formData = new FormData();
    formData.append('file', file);
    
    // Gọi API tải lên
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include' // Gửi kèm cookie xác thực
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Lỗi không xác định' }));
      throw new Error(`Lỗi tải lên tệp: ${errorData.message || response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[fileUpload] Tải lên thành công, URL: ${data.url}`);
    
    return data.url;
  } catch (error: any) {
    console.error('[fileUpload] Lỗi:', error);
    throw new Error(`Không thể tải lên tệp: ${error.message}`);
  }
}