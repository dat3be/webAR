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
 * Tải lên tệp đến API endpoint và trả về URL của tệp từ Wasabi
 * @param file Tệp cần tải lên
 * @returns Promise chứa URL của tệp đã tải lên
 */
export async function uploadFile(file: File): Promise<string> {
  try {
    console.log(`[fileUpload] Bắt đầu tải lên tệp: ${file.name} (${file.type}), kích thước: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);

    // Đối với mô hình 3D và video lớn, sử dụng phương thức server
    if (file.type.startsWith('model/') || 
        file.name.endsWith('.glb') || 
        file.name.endsWith('.gltf') || 
        file.size > 50 * 1024 * 1024) {
      return await uploadViaServer(file);
    }
    
    // Đối với các tệp khác (nhỏ hơn), thử phương thức direct upload
    try {
      console.log('[fileUpload] Thử phương thức direct upload');
      return await uploadDirect(file);
    } catch (error) {
      console.log('[fileUpload] Direct upload thất bại, chuyển sang server upload:', error);
      return await uploadViaServer(file);
    }

  } catch (error: any) {
    console.error('[fileUpload] Lỗi tải lên tệp:', error);
    throw new Error(`Không thể tải lên tệp: ${error.message}`);
  }
}

/**
 * Tải lên tệp trực tiếp đến Wasabi sử dụng Presigned URL
 * @param file Tệp cần tải lên
 * @returns Promise chứa URL của tệp đã tải lên
 */
async function uploadDirect(file: File): Promise<string> {
  // Bước 1: Lấy presigned URL từ server
  console.log('[fileUpload:direct] Bước 1: Lấy presigned URL từ server');
  const presignedResponse = await fetchWithTimeout('/api/presigned-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type
    }),
    credentials: 'include'
  }, 10000);
  
  if (!presignedResponse.ok) {
    const errorData = await presignedResponse.json().catch(() => ({ message: 'Lỗi không xác định' }));
    throw new Error(`Không thể lấy presigned URL: ${errorData.message || presignedResponse.statusText}`);
  }
  
  const presignedData = await presignedResponse.json();
  console.log('[fileUpload:direct] Đã nhận presigned URL:', presignedData.url);
  
  // Bước 2: Tải lên tệp trực tiếp đến Wasabi
  console.log('[fileUpload:direct] Bước 2: Tải lên tệp trực tiếp đến Wasabi');
  const uploadResponse = await fetchWithTimeout(presignedData.url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'x-amz-acl': 'public-read'
    },
    body: file
  }, UPLOAD_TIMEOUT);
  
  if (!uploadResponse.ok) {
    throw new Error(`PUT request thất bại: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }
  
  console.log('[fileUpload:direct] Tải lên thành công đến Wasabi');
  
  // Xác định URL công khai
  let publicUrl;
  if (presignedData.publicUrls && presignedData.publicUrls.url) {
    publicUrl = presignedData.publicUrls.url;
  } else {
    // Region và bucket mặc định nếu không tìm thấy trong dữ liệu
    const region = process.env.WASABI_REGION || 'us-east-2';
    const bucket = presignedData.bucket || 'arwebreplit';
    publicUrl = `https://s3.${region}.wasabisys.com/${bucket}/${presignedData.key}`;
  }
  
  console.log(`[fileUpload:direct] URL công khai: ${publicUrl}`);
  return publicUrl;
}

/**
 * Tải lên tệp qua server truyền thống
 * @param file Tệp cần tải lên
 * @returns Promise chứa URL của tệp đã tải lên
 */
async function uploadViaServer(file: File): Promise<string> {
  console.log('[fileUpload:server] Bắt đầu tải lên qua server API');
  
  // Tạo FormData để gửi tệp
  const formData = new FormData();
  formData.append('file', file);
  
  // Gọi API tải lên
  const response = await fetchWithTimeout('/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include'
  }, UPLOAD_TIMEOUT);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Lỗi không xác định' }));
    throw new Error(`Tải lên thất bại: ${errorData.message || response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`[fileUpload:server] Tải lên thành công, URL: ${data.url}`);
  
  return data.url;
}