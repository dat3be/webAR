import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from 'stream';

// Kiểm tra các biến môi trường cần thiết
const requiredEnvVars = [
  'WASABI_ACCESS_KEY_ID',
  'WASABI_SECRET_ACCESS_KEY',
  'WASABI_BUCKET_NAME',
  'WASABI_REGION',
  'WASABI_ENDPOINT'
];

// Kiểm tra và log các biến môi trường
console.log("[Wasabi] Checking environment variables...");
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`[Wasabi] ERROR: Missing required environment variable: ${envVar}`);
  } else {
    console.log(`[Wasabi] ${envVar} is set`);
  }
}

// Lazy loading của S3 client để tránh khởi tạo khi import module
console.log("[Wasabi] Configuring S3 client (lazy loading)");

let _wasabiClient: S3Client | null = null;
let _bucketName: string | null = null;

// Hàm để lấy S3 client khi cần
export function getWasabiClient(): S3Client {
  if (!_wasabiClient) {
    console.log("[Wasabi] Creating S3 client with:", {
      region: process.env.WASABI_REGION,
      endpoint: process.env.WASABI_ENDPOINT
    });
    
    // Xóa bất kỳ client cũ nào nếu có
    _wasabiClient = null;
    
    // Tạo client mới với cấu hình hiện tại
    _wasabiClient = new S3Client({
      region: process.env.WASABI_REGION!,
      endpoint: `https://${process.env.WASABI_ENDPOINT}`,
      credentials: {
        accessKeyId: process.env.WASABI_ACCESS_KEY_ID!,
        secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true, // Sử dụng path-style URLs cho Wasabi
      // Cấu hình timeout và retry tối ưu
      maxAttempts: 5, // Số lần thử lại tối đa
      requestHandler: {
        abortSignal: AbortSignal.timeout(60000), // Timeout dài hơn (60 giây)
      },
    });
    
    // Ghi log chi tiết để debug
    console.log(`[Wasabi] Client created successfully. Using region: ${process.env.WASABI_REGION}, bucket: ${process.env.WASABI_BUCKET_NAME}`);
  }
  return _wasabiClient;
}

// Hàm để lấy tên bucket
export function getBucketName(): string {
  if (!_bucketName) {
    _bucketName = process.env.WASABI_BUCKET_NAME!;
    console.log(`[Wasabi] Using bucket: ${_bucketName}`);
  }
  return _bucketName;
}

// Hàm tạo URL công khai từ thông tin tệp
function generatePublicUrl(bucketName: string, key: string): {
  url: string,
  altUrl: string,
  altUrl2: string,
} {
  const region = process.env.WASABI_REGION!;
  const endpoint = process.env.WASABI_ENDPOINT!;
  
  // Format 1: https://s3.<region>.wasabisys.com/<bucket>/<key>
  const url = `https://s3.${region}.wasabisys.com/${bucketName}/${key}`;
  
  // Format 2: https://<bucket>.s3.<region>.wasabisys.com/<key>
  const altUrl = `https://${bucketName}.s3.${region}.wasabisys.com/${key}`;
  
  // Format 3: https://<bucket>.<endpoint>/<key>
  const altUrl2 = `https://${bucketName}.${endpoint}/${key}`;
  
  return { url, altUrl, altUrl2 };
}

// Hàm tải file lên Wasabi
export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folder: string = 'uploads'
): Promise<string> {
  const client = getWasabiClient();
  const bucket = getBucketName();
  // Tạo key với encoding tên file để tránh các ký tự đặc biệt
  const safeFileName = encodeURIComponent(fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  // Tạo timestamp chính xác đến millisecond để đảm bảo tên file là duy nhất
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `${folder}/${timestamp}-${safeFileName}`;
  
  try {
    console.log(`[Wasabi] Uploading file ${fileName} to ${key} (size: ${fileBuffer.length} bytes)`);
    console.log(`[Wasabi] Bucket: ${bucket}, ContentType: ${contentType}`);
    
    // Kiểm tra credentials (chỉ log 3 ký tự đầu tiên của key để bảo mật)
    console.log(`[Wasabi] Using access key ID: ${process.env.WASABI_ACCESS_KEY_ID?.substring(0, 3)}...`);
    
    // Thêm metadata để theo dõi
    const metadata = {
      'x-amz-meta-uploaded-at': new Date().toISOString(),
      'x-amz-meta-content-type': contentType,
      'x-amz-meta-original-name': fileName,
    };
    
    const upload = new Upload({
      client: client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: 'public-read', // Cho phép đọc công khai, quan trọng để file có thể truy cập từ web
        Metadata: metadata,
        // Đảm bảo không có caching cho tệp
        CacheControl: 'no-cache, no-store, must-revalidate',
      },
    });

    await upload.done();
    console.log(`[Wasabi] Upload completed successfully for key: ${key}`);
    
    // Tạo URL công khai theo các định dạng khác nhau
    const { url, altUrl, altUrl2 } = generatePublicUrl(bucket, key);
    
    console.log(`[Wasabi] Public URL: ${url}`);
    console.log(`[Wasabi] Alternative URLs: ${altUrl}, ${altUrl2}`);
    
    // Trả về URL công khai thay vì presigned URL
    return url;
  } catch (error: any) {
    console.error(`[Wasabi] Error uploading file ${fileName}:`);
    console.error(`[Wasabi] Error type: ${error.name}, code: ${error.$metadata?.httpStatusCode}`);
    console.error(`[Wasabi] Error message: ${error.message}`);
    console.error(`[Wasabi] Error details:`, error);
    
    if (error.$metadata?.httpStatusCode === 403) {
      throw new Error(`403 Forbidden: Không có quyền truy cập bucket. Kiểm tra cấu hình IAM và quyền bucket.`);
    }
    
    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      throw new Error(`Timeout: Tải lên tệp quá lâu. Kiểm tra kết nối mạng hoặc giảm kích thước tệp.`);
    }
    
    if (error.name === 'EntityTooLarge' || error.$metadata?.httpStatusCode === 413) {
      throw new Error(`413 Payload Too Large: Tệp quá lớn. Giới hạn là 200MB.`);
    }
    
    throw new Error(`Failed to upload file to Wasabi: ${error.message}`);
  }
}

// Hàm tải file xuống từ Wasabi
export async function downloadFile(key: string): Promise<Buffer> {
  const client = getWasabiClient();
  const bucket = getBucketName();
  
  try {
    console.log(`[Wasabi] Downloading file with key: ${key}`);
    
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty response body');
    }
    
    // Chuyển đổi stream thành buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  } catch (error) {
    console.error(`[Wasabi] Error downloading file with key ${key}:`, error);
    throw new Error(`Failed to download file from Wasabi: ${(error as Error).message}`);
  }
}

// Hàm xóa file từ Wasabi
export async function deleteFile(key: string): Promise<void> {
  const client = getWasabiClient();
  const bucket = getBucketName();
  
  try {
    console.log(`[Wasabi] Deleting file with key: ${key}`);
    
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    console.log(`[Wasabi] File deleted successfully: ${key}`);
  } catch (error) {
    console.error(`[Wasabi] Error deleting file with key ${key}:`, error);
    throw new Error(`Failed to delete file from Wasabi: ${(error as Error).message}`);
  }
}

// Hàm trích xuất key từ URL
export function getKeyFromUrl(url: string): string {
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  // Format của URL: /{bucket_name}/{key}
  // Cần bỏ bucket name và dấu / đầu tiên
  const parts = path.split('/');
  if (parts.length >= 3) {
    // Bỏ phần tử đầu tiên (rỗng) và phần tử thứ hai (bucket name)
    return parts.slice(2).join('/');
  }
  return path.substring(1); // Trường hợp không đúng định dạng, trả về toàn bộ đường dẫn
}

// Tạo pre-signed URL cho việc upload trực tiếp từ client
export async function createPresignedPost(fileName: string, contentType: string, folder: string = 'uploads'): Promise<{
  url: string;
  fields: Record<string, string>;
  key: string;
  bucket?: string;
  publicUrls?: {
    url: string;
    altUrl: string;
    altUrl2: string;
  };
}> {
  const client = getWasabiClient();
  const bucket = getBucketName();
  // Tạo key với encoding tên file để tránh các ký tự đặc biệt
  const safeFileName = encodeURIComponent(fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  // Tạo timestamp chính xác đến millisecond để đảm bảo tên file là duy nhất
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `${folder}/${timestamp}-${safeFileName}`;
  
  console.log(`[Wasabi] Creating presigned post for ${fileName} (${contentType}), key: ${key}`);
  
  try {
    // Tạo pre-signed URL cho PUT operation với các tùy chọn bổ sung
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read',
      // Thêm các tùy chọn để xử lý tệp đặc biệt
      CacheControl: 'max-age=31536000', // Cache 1 năm cho tệp tĩnh
      Metadata: {
        'x-amz-meta-uploaded-at': new Date().toISOString(),
        'x-amz-meta-original-name': fileName
      }
    });
    
    // Mở rộng thời gian hết hạn của URL lên 30 phút
    const signedUrl = await getSignedUrl(client, command, { 
      expiresIn: 30 * 60 // 30 phút
    });
    
    console.log(`[Wasabi] Created presigned URL for direct upload: ${signedUrl}`);
    
    // Tạo URL công khai cho tệp sau khi tải lên
    const publicUrls = generatePublicUrl(bucket, key);
    
    return {
      url: signedUrl,
      fields: {
        'Content-Type': contentType,
        'x-amz-acl': 'public-read',  // Đảm bảo ACL đúng định dạng
      },
      key,
      bucket: bucket,
      publicUrls: publicUrls // Trả về URLs
    };
  } catch (error) {
    console.error(`[Wasabi] Error creating presigned post:`, error);
    throw new Error(`Không thể tạo URL cho tải lên: ${(error as Error).message}`);
  }
}

// Lấy công khai URL của một tệp dựa trên key
export function getPublicUrl(key: string): {
  url: string;
  altUrl: string;
  altUrl2: string;
} {
  const bucket = getBucketName();
  return generatePublicUrl(bucket, key);
}

// Xuất một phiên bản tương thích cho mã cũ sử dụng các biến trực tiếp
// Điều này giúp chúng ta tránh phải viết lại mã ở các nơi khác
export const wasabiClient = {
  send: (command: any) => getWasabiClient().send(command)
};
export const bucketName = getBucketName;