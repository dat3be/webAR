import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertProjectSchema, insertUserSchema, updateProjectSchema } from "@shared/schema";
import { checkDatabaseConnection } from "./db";
import { setupAuth } from "./auth";
import { uploadFile, wasabiClient, bucketName } from "./wasabi";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import * as path from "path";

// Middleware to check if database is connected
const checkDbConnection = async (req: Request, res: Response, next: NextFunction) => {
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    return res.status(503).json({ message: "Database is currently unavailable" });
  }
  next();
};

// Helper to handle API errors
const handleApiError = (error: unknown, res: Response) => {
  console.error("API Error:", error);
  
  if (error instanceof z.ZodError) {
    return res.status(400).json({ 
      message: "Validation error", 
      errors: error.errors 
    });
  } 
  
  if (error instanceof Error) {
    return res.status(500).json({ message: error.message });
  }
  
  return res.status(500).json({ message: "An unknown error occurred" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  console.log("Starting routes registration...");
  
  // Debug route that doesn't depend on authentication or database
  app.get('/debug', (req, res) => {
    res.json({
      message: 'Debug endpoint is working',
      timestamp: new Date().toISOString(),
      env: {
        wasabi_endpoint: process.env.WASABI_ENDPOINT || 'not set',
        wasabi_region: process.env.WASABI_REGION || 'not set',
        wasabi_bucket: process.env.WASABI_BUCKET_NAME || 'not set'
      }
    });
  });
  
  // Add database connection check middleware to all API routes
  app.use('/api', checkDbConnection);
  
  // Set up authentication routes and middleware
  const { isAuthenticated } = setupAuth(app);
  
  // Health check route
  app.get("/api/health", async (req, res) => {
    const dbConnected = await checkDatabaseConnection();
    res.json({ 
      status: "ok", 
      database: dbConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString()
    });
  });

  // User routes - protected by authentication
  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only allow users to view their own data
      if (req.user && req.user.id !== id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(user);
    } catch (error) {
      handleApiError(error, res);
    }
  });

  // Project routes - most operations require authentication
  app.post("/api/projects", isAuthenticated, async (req, res) => {
    try {
      console.log("Creating project with authenticated user:", req.user);
      
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "User not authenticated or invalid user ID" });
      }
      
      // Add the current user's ID to the project data
      const projectData = insertProjectSchema.parse({
        ...req.body,
        userId: req.user.id // Set the userId from the authenticated user
      });
      
      console.log("Project data to be stored:", projectData);
      
      const project = await storage.createProject(projectData);
      console.log("Project created in database:", project);
      
      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      handleApiError(error, res);
    }
  });

  app.get("/api/projects", isAuthenticated, async (req, res) => {
    try {
      // Get projects for the current authenticated user
      const projects = await storage.getProjects(req.user?.id || 0);
      res.json(projects);
    } catch (error) {
      handleApiError(error, res);
    }
  });

  // Public route - anyone can view a project
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Record project view for analytics
      await storage.recordProjectView(id);
      
      res.json(project);
    } catch (error) {
      handleApiError(error, res);
    }
  });
  
  app.patch("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if the project belongs to the authenticated user
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user?.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updates = updateProjectSchema.parse(req.body);
      const updatedProject = await storage.updateProject(id, updates);
      res.json(updatedProject);
    } catch (error) {
      handleApiError(error, res);
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if the project belongs to the authenticated user
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user?.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (error) {
      handleApiError(error, res);
    }
  });
  
  // Project analytics routes - public for recording views and shares
  app.post("/api/projects/:id/view", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.recordProjectView(id);
      res.status(200).json({ message: "View recorded" });
    } catch (error) {
      handleApiError(error, res);
    }
  });
  
  app.post("/api/projects/:id/share", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.recordProjectShare(id);
      res.status(200).json({ message: "Share recorded" });
    } catch (error) {
      handleApiError(error, res);
    }
  });
  
  // Analytics viewing requires authentication
  app.get("/api/projects/:id/analytics", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if the project belongs to the authenticated user
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.userId !== req.user?.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const analytics = await storage.getProjectAnalytics(id);
      if (!analytics) {
        return res.status(404).json({ message: "Analytics not found" });
      }
      res.json(analytics);
    } catch (error) {
      handleApiError(error, res);
    }
  });

  // Configure multer for file uploads
  const memoryStorage = multer.memoryStorage();
  const upload = multer({
    storage: memoryStorage,
    limits: {
      fileSize: 200 * 1024 * 1024, // Tăng giới hạn lên 200MB
    },
    fileFilter: (req, file, cb) => {
      // Define allowed file types
      const allowedTypes = [
        // 3D models
        'model/gltf-binary', 'model/gltf+json',
        // Videos
        'video/mp4', 'video/webm', 'video/quicktime',
        // Images
        'image/jpeg', 'image/png', 'image/webp'
      ];
      
      // File extensions to MIME types
      const extensionToMime: Record<string, string> = {
        '.glb': 'model/gltf-binary',
        '.gltf': 'model/gltf+json',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp'
      };
      
      // Get extension
      const ext = path.extname(file.originalname).toLowerCase();
      let mimeType = file.mimetype;
      
      // If file's reported mimetype is not recognized, try to determine from extension
      if (!allowedTypes.includes(mimeType) && ext in extensionToMime) {
        mimeType = extensionToMime[ext];
        file.mimetype = mimeType; // Override mimetype
      }
      
      if (allowedTypes.includes(mimeType)) {
        cb(null, true);
      } else {
        cb(new Error(`File type not allowed. Supported formats: 3D models (.glb, .gltf), videos (.mp4, .webm, .mov), images (.jpg, .png, .webp)`));
      }
    }
  });

  // File upload endpoint
  app.post("/api/upload", isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Không có tệp nào được tải lên" });
      }

      if (!req.user) {
        return res.status(401).json({ message: "Người dùng chưa xác thực" });
      }

      // Kiểm tra kích thước tệp
      if (req.file.size > 200 * 1024 * 1024) {
        return res.status(413).json({ 
          message: "Tệp quá lớn", 
          details: "Kích thước tệp vượt quá giới hạn 200MB"
        });
      }

      // Xác định thư mục dựa trên loại tệp
      let folder = 'misc';
      const mimeType = req.file.mimetype;
      
      if (mimeType.startsWith('model/')) {
        folder = 'models';
      } else if (mimeType.startsWith('video/')) {
        folder = 'videos';
      } else if (mimeType.startsWith('image/')) {
        folder = 'images';
      }

      // Thêm ID người dùng vào đường dẫn thư mục để tổ chức
      folder = `${folder}/${req.user.id}`;
      
      console.log(`[API:Upload] Đang tải tệp lên Wasabi: ${req.file.originalname} (${mimeType}) đến thư mục: ${folder}`);
      console.log(`[API:Upload] Kích thước tệp: ${req.file.size} bytes, Độ dài Buffer: ${req.file.buffer.length}`);
      
      try {
        // Tải lên Wasabi với nhiều lần thử lại
        let fileUrl = null;
        let uploadError = null;
        
        // Thử tối đa 3 lần
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`[API:Upload] Đang thử tải lên lần ${attempt}/3`);
            fileUrl = await uploadFile(
              req.file.buffer,
              req.file.originalname,
              req.file.mimetype,
              folder
            );
            // Nếu thành công, thoát khỏi vòng lặp
            break;
          } catch (err: any) {
            console.error(`[API:Upload] Lỗi lần thử ${attempt}:`, err);
            uploadError = err;
            // Chờ 1 giây trước khi thử lại
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        // Nếu tất cả các lần thử đều thất bại
        if (!fileUrl) {
          throw uploadError || new Error("Không thể tải tệp lên sau nhiều lần thử");
        }
        
        console.log(`[API:Upload] Tải lên thành công, trả về URL: ${fileUrl}`);
        
        res.status(200).json({ 
          url: fileUrl,
          originalName: req.file.originalname,
          contentType: req.file.mimetype,
          size: req.file.size
        });
      } catch (error: any) {
        console.error("[API:Upload] Lỗi khi tải lên Wasabi:", error);
        if (error.message && error.message.includes("403")) {
          return res.status(403).json({ 
            message: "403 Forbidden: không thể gửi đến Wasabi", 
            error: error.message,
            details: "Lỗi quyền truy cập Wasabi. Vui lòng kiểm tra cấu hình và quyền bucket."
          });
        }
        throw error;  // Ném lại lỗi để xử lý lỗi chung
      }
    } catch (error) {
      console.error("[API:Upload] Lỗi chung:", error);
      handleApiError(error, res);
    }
  });
  
  // Endpoint để tạo direct URL cho file đã tồn tại
  app.get("/api/file-access/:fileKey", isAuthenticated, async (req, res) => {
    try {
      const fileKey = req.params.fileKey;
      
      if (!fileKey) {
        return res.status(400).json({ message: "Không có khóa tệp được cung cấp" });
      }
      
      console.log(`[API:FileAccess] Tạo URL công khai cho khóa: ${fileKey}`);
      
      try {
        const bucket = bucketName();
        
        // Tạo URL công khai theo các định dạng Wasabi khác nhau
        // Định dạng 1: https://s3.<region>.wasabisys.com/<bucket>/<key>
        const publicUrl = `https://s3.${process.env.WASABI_REGION}.wasabisys.com/${bucket}/${fileKey}`;
        
        // Định dạng 2: https://<bucket>.s3.<region>.wasabisys.com/<key>
        const altUrl = `https://${bucket}.s3.${process.env.WASABI_REGION}.wasabisys.com/${fileKey}`;
        
        // Định dạng 3: https://<bucket>.<endpoint>/<key>
        const altUrl2 = `https://${bucket}.${process.env.WASABI_ENDPOINT}/${fileKey}`;
        
        console.log(`[API:FileAccess] URL công khai đã tạo: ${publicUrl}`);
        
        res.status(200).json({ 
          url: publicUrl,
          altUrl: altUrl,
          altUrl2: altUrl2,
          key: fileKey,
          bucket: bucket
        });
      } catch (error: any) {
        console.error("[API:FileAccess] Lỗi khi tạo URL công khai:", error);
        return res.status(500).json({ 
          message: "Lỗi khi tạo URL công khai", 
          error: error.message,
          details: "Kiểm tra cấu hình bucket và quyền truy cập"
        });
      }
    } catch (error) {
      console.error("[API:FileAccess] Lỗi chung:", error);
      handleApiError(error, res);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
