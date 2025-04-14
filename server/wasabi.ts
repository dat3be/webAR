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
function getWasabiClient(): S3Client {
  if (!_wasabiClient) {
    console.log("[Wasabi] Creating S3 client with:", {
      region: process.env.WASABI_REGION,
      endpoint: process.env.WASABI_ENDPOINT
    });
    
    _wasabiClient = new S3Client({
      region: process.env.WASABI_REGION!,
      endpoint: `https://${process.env.WASABI_ENDPOINT}`,
      credentials: {
        accessKeyId: process.env.WASABI_ACCESS_KEY_ID!,
        secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true, // Sử dụng path-style URLs cho Wasabi
      // Thêm các tùy chọn bổ sung
      maxAttempts: 5, // Số lần thử lại tối đa
      requestHandler: {
        abortSignal: AbortSignal.timeout(60000), // Timeout dài hơn (60 giây)
      },
    });
  }
  return _wasabiClient;
}

// Hàm để lấy tên bucket
function getBucketName(): string {
  if (!_bucketName) {
    _bucketName = process.env.WASABI_BUCKET_NAME!;
  }
  return _bucketName;
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
  const key = `${folder}/${Date.now()}-${fileName}`;
  
  try {
    console.log(`[Wasabi] Uploading file ${fileName} to ${key} (size: ${fileBuffer.length} bytes)`);
    console.log(`[Wasabi] Bucket: ${bucket}, ContentType: ${contentType}`);
    
    // Kiểm tra credentials
    console.log(`[Wasabi] Using access key ID: ${process.env.WASABI_ACCESS_KEY_ID?.substring(0, 3)}...`);
    
    const upload = new Upload({
      client: client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: 'public-read', // Cho phép đọc công khai, quan trọng để file có thể truy cập từ web
      },
    });

    await upload.done();
    
    // Tạo URL công khai cho file - thử với các định dạng URL khác nhau của Wasabi
    let fileUrl = '';
    
    // Định dạng 1: s3.<region>.wasabisys.com/<bucket>/<key>
    fileUrl = `https://s3.${process.env.WASABI_REGION}.wasabisys.com/${bucket}/${key}`;
    
    // Định dạng 2: <bucket>.s3.<region>.wasabisys.com/<key>
    // fileUrl = `https://${bucket}.s3.${process.env.WASABI_REGION}.wasabisys.com/${key}`;
    
    // Định dạng 3: <bucket>.<endpoint>/<key> 
    // fileUrl = `https://${bucket}.${process.env.WASABI_ENDPOINT}/${key}`;
    
    console.log(`[Wasabi] File uploaded successfully: ${fileUrl}`);
    
    return fileUrl;
  } catch (error: any) {
    console.error(`[Wasabi] Error uploading file ${fileName}:`);
    console.error(`[Wasabi] Error type: ${error.name}, code: ${error.$metadata?.httpStatusCode}`);
    console.error(`[Wasabi] Error message: ${error.message}`);
    
    if (error.$metadata?.httpStatusCode === 403) {
      throw new Error(`403 Forbidden: Không có quyền truy cập bucket. Kiểm tra cấu hình IAM và quyền bucket.`);
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

// Xuất một phiên bản tương thích cho mã cũ sử dụng các biến trực tiếp
// Điều này giúp chúng ta tránh phải viết lại mã ở các nơi khác
export const wasabiClient = {
  send: (command: any) => getWasabiClient().send(command)
};
export const bucketName = getBucketName;