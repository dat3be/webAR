import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertProjectSchema, insertUserSchema, updateProjectSchema } from "@shared/schema";
import { checkDatabaseConnection } from "./db";
import { setupAuth } from "./auth";

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
      // Add the current user's ID to the project data
      const projectData = insertProjectSchema.parse({
        ...req.body,
        userId: req.user?.id || 0 // Set the userId from the authenticated user
      });
      
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
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

  const httpServer = createServer(app);
  return httpServer;
}
