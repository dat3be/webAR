import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertProjectSchema, insertUserSchema, updateProjectSchema } from "@shared/schema";
import { checkDatabaseConnection } from "./db";

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
  // Add database connection check middleware to all API routes
  app.use('/api', checkDbConnection);
  
  // Health check route
  app.get("/api/health", async (req, res) => {
    const dbConnected = await checkDatabaseConnection();
    res.json({ 
      status: "ok", 
      database: dbConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString()
    });
  });

  // User routes
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      handleApiError(error, res);
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      handleApiError(error, res);
    }
  });

  app.get("/api/users/by-firebase/:firebaseUid", async (req, res) => {
    try {
      const firebaseUid = req.params.firebaseUid;
      const user = await storage.getUserByFirebaseUid(firebaseUid);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      handleApiError(error, res);
    }
  });

  // Project routes
  app.post("/api/projects", async (req, res) => {
    try {
      // Validate and extract project data 
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      handleApiError(error, res);
    }
  });

  app.get("/api/projects", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const projects = await storage.getProjects(userId);
      res.json(projects);
    } catch (error) {
      handleApiError(error, res);
    }
  });

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
  
  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = updateProjectSchema.parse(req.body);
      const project = await storage.updateProject(id, updates);
      res.json(project);
    } catch (error) {
      handleApiError(error, res);
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (error) {
      handleApiError(error, res);
    }
  });
  
  // Project analytics routes
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
  
  app.get("/api/projects/:id/analytics", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const analytics = await storage.getProjectAnalytics(id);
      if (!analytics) {
        return res.status(404).json({ message: "Analytics not found" });
      }
      res.json(analytics);
    } catch (error) {
      handleApiError(error, res);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
