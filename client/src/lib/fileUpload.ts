import { apiRequest } from "./queryClient";

// Giới hạn thời gian chờ cho việc tải lên (ms)
const UPLOAD_TIMEOUT = 5 * 60 * 1000; // 5 phút

/**
 * Tạo yêu cầu fetch với timeout
 * @param url URL đích
 * @param options Tùy chọn fetch
 * @param timeout Thời gian chờ tối đa (ms)
 * @returns Promise với kết quả fetch hoặc lỗi timeout
 */
const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number): Promise<Response> => {
  const controller = new AbortController();
  const { signal } = controller;
  
  // Tạo promise với timeout
  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new Error(`Timeout sau ${timeout/1000} giây - yêu cầu quá lâu`));
    }, timeout);
  });
  
  // Thực hiện fetch với AbortSignal
  const fetchPromise = fetch(url, {
    ...options,
    signal
  });
  
  // Race giữa fetch và timeout
  return Promise.race([fetchPromise, timeoutPromise]);
};

/**
 * Tạo bản sao tệp với kích thước được tối ưu
 * @param file Tệp gốc
 * @returns File mới đã được tối ưu (nếu cần)
 */
const optimizeFileForUpload = async (file: File): Promise<File> => {
  // Nếu tệp nhỏ hơn 150MB, không cần optimize
  if (file.size <= 150 * 1024 * 1024) {
    return file;
  }
  
  console.log(`[fileUpload] Tệp quá lớn (${(file.size / (1024 * 1024)).toFixed(2)}MB), sẽ tối ưu kích thước`);
  
  // Đối với các tệp 3D model hoặc video, không làm gì - chỉ cảnh báo
  if (file.type.startsWith('model/') || file.type.startsWith('video/')) {
    console.warn(`[fileUpload] Cảnh báo: Tệp lớn (${(file.size / (1024 * 1024)).toFixed(2)}MB). Tệp lớn có thể gặp vấn đề khi tải lên.`);
    return file;
  }
  
  // Đối với các tệp ảnh, có thể thêm mã nén ảnh tối ưu ở đây
  // (không triển khai trong phiên bản này)
  
  return file;
};

/**
 * Tải lên tệp trực tiếp đến Wasabi sử dụng Presigned URL
 * @param file Tệp cần tải lên
 * @returns Promise chứa URL công khai của tệp đã tải lên
 */
export async function uploadFile(file: File): Promise<string> {
  try {
    console.log(`[fileUpload] Bắt đầu tải lên trực tiếp tệp: ${file.name} (${file.type}), kích thước: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
    
    // Tối ưu tệp nếu cần
    const optimizedFile = await optimizeFileForUpload(file);
    
    // Thử upload tối đa 2 lần
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[fileUpload] Đang thử tải lên lần ${attempt}/2...`);
        
        // Bước 1: Lấy presigned URL từ server
        console.log('[fileUpload] Bước 1: Yêu cầu presigned URL từ server');
        const presignedResponse = await fetchWithTimeout('/api/presigned-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: optimizedFile.name,
            contentType: optimizedFile.type
          }),
          credentials: 'include' // Gửi kèm cookie xác thực
        }, 10000); // timeout 10 giây cho bước này
        
        if (!presignedResponse.ok) {
          const errorData = await presignedResponse.json().catch(() => ({ message: 'Lỗi không xác định' }));
          throw new Error(`Không thể lấy presigned URL: ${errorData.message || presignedResponse.statusText}`);
        }
        
        const presignedData = await presignedResponse.json();
        console.log('[fileUpload] Đã nhận presigned URL:', presignedData.url);
        
        // Bước 2: Upload trực tiếp lên Wasabi bằng PUT request
        console.log('[fileUpload] Bước 2: Tải lên tệp trực tiếp đến Wasabi');
        const uploadResponse = await fetchWithTimeout(presignedData.url, {
          method: 'PUT',
          headers: {
            'Content-Type': optimizedFile.type,
            'x-amz-acl': 'public-read',
            ...presignedData.fields
          },
          body: optimizedFile
        }, UPLOAD_TIMEOUT);
        
        if (!uploadResponse.ok) {
          let errorMessage = `HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`;
          try {
            const errorText = await uploadResponse.text();
            if (errorText) {
              errorMessage += ` - ${errorText}`;
            }
          } catch (err) {
            // Ignore errors while getting error details
          }
          
          throw new Error(`Lỗi tải lên trực tiếp đến Wasabi: ${errorMessage}`);
        }
        
        console.log('[fileUpload] Tải lên thành công đến Wasabi');
        
        // Trả về URL công khai
        const publicUrl = presignedData.publicUrls.url;
        console.log(`[fileUpload] URL công khai: ${publicUrl}`);
        
        return publicUrl;
      } catch (err: any) {
        lastError = err;
        console.error(`[fileUpload] Lỗi lần thử ${attempt}:`, err.message);
        
        // Nếu đây là lỗi về abort, không thử lại
        if (err.name === 'AbortError') {
          break;
        }
        
        // Chờ 3 giây trước khi thử lại
        if (attempt < 2) {
          console.log('[fileUpload] Đang chờ 3 giây trước khi thử lại...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    // Nếu không thành công sau các lần thử trực tiếp, thử phương pháp thông qua server
    console.log('[fileUpload] Tải lên trực tiếp thất bại, thử tải lên qua server...');
    return await uploadViaServer(optimizedFile);
    
  } catch (error: any) {
    console.error('[fileUpload] Lỗi tải lên:', error);
    throw new Error(`Không thể tải lên tệp: ${error.message}`);
  }
}

/**
 * Phương pháp dự phòng: Tải lên qua server thay vì trực tiếp
 * @param file Tệp cần tải lên
 * @returns Promise chứa URL của tệp đã tải lên
 */
async function uploadViaServer(file: File): Promise<string> {
  console.log(`[fileUpload] Đang tải lên qua server: ${file.name}`);
  
  // Tạo FormData để gửi tệp
  const formData = new FormData();
  formData.append('file', file);
  
  // Gọi API tải lên với timeout
  const response = await fetchWithTimeout('/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include' // Gửi kèm cookie xác thực
  }, UPLOAD_TIMEOUT);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Lỗi không xác định' }));
    throw new Error(`Lỗi tải lên qua server: ${errorData.message || response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`[fileUpload] Tải lên qua server thành công, URL: ${data.url}`);
  
  return data.url;
}