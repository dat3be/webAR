import { 
  users, 
  projects, 
  projectAnalytics,
  type User, 
  type InsertUser, 
  type Project, 
  type InsertProject,
  type ProjectAnalytics,
  type InsertProjectAnalytics
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { pool } from "./db";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getProject(id: number): Promise<Project | undefined>;
  getProjects(userId?: number): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<Project>): Promise<Project>;
  deleteProject(id: number): Promise<void>;
  recordProjectView(projectId: number): Promise<void>;
  recordProjectShare(projectId: number): Promise<void>;
  getProjectAnalytics(projectId: number): Promise<ProjectAnalytics | undefined>;
  
  // Session store for authentication
  sessionStore: session.Store;
}

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'sessions'
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Check if user with this firebase UID already exists
    const existingUser = await this.getUserByFirebaseUid(insertUser.firebaseUid);
    if (existingUser) {
      return existingUser;
    }

    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjects(userId?: number): Promise<Project[]> {
    if (userId) {
      return await db.select()
        .from(projects)
        .where(and(
          eq(projects.userId, userId),
          eq(projects.status, 'active')
        ))
        .orderBy(desc(projects.createdAt));
    }
    
    return await db.select()
      .from(projects)
      .where(eq(projects.status, 'active'))
      .orderBy(desc(projects.createdAt));
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values({
      ...insertProject,
      updatedAt: new Date()
    }).returning();
    
    // Initialize analytics record for the project
    await db.insert(projectAnalytics).values({
      projectId: project.id,
      viewCount: 0,
      shareCount: 0,
      updatedAt: new Date()
    });
    
    return project;
  }

  async updateProject(id: number, updates: Partial<Project>): Promise<Project> {
    const [project] = await db.update(projects)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(projects.id, id))
      .returning();
      
    if (!project) {
      throw new Error(`Project with ID ${id} not found`);
    }
    
    return project;
  }

  async deleteProject(id: number): Promise<void> {
    // Soft delete the project by changing its status
    await db.update(projects)
      .set({ 
        status: 'deleted',
        updatedAt: new Date()
      })
      .where(eq(projects.id, id));
  }

  async recordProjectView(projectId: number): Promise<void> {
    // Get current analytics
    const [analytics] = await db.select()
      .from(projectAnalytics)
      .where(eq(projectAnalytics.projectId, projectId));

    if (analytics) {
      // Update view count and last viewed time
      await db.update(projectAnalytics)
        .set({ 
          viewCount: analytics.viewCount + 1,
          lastViewed: new Date(),
          updatedAt: new Date()
        })
        .where(eq(projectAnalytics.id, analytics.id));
    } else {
      // Create new analytics record if none exists
      await db.insert(projectAnalytics).values({
        projectId,
        viewCount: 1,
        shareCount: 0,
        lastViewed: new Date(),
        updatedAt: new Date()
      });
    }
  }

  async recordProjectShare(projectId: number): Promise<void> {
    // Get current analytics
    const [analytics] = await db.select()
      .from(projectAnalytics)
      .where(eq(projectAnalytics.projectId, projectId));
      
    if (analytics) {
      // Update share count
      await db.update(projectAnalytics)
        .set({ 
          shareCount: analytics.shareCount + 1,
          updatedAt: new Date()
        })
        .where(eq(projectAnalytics.id, analytics.id));
    } else {
      // Create new analytics record if none exists
      await db.insert(projectAnalytics).values({
        projectId,
        viewCount: 0,
        shareCount: 1,
        updatedAt: new Date()
      });
    }
  }

  async getProjectAnalytics(projectId: number): Promise<ProjectAnalytics | undefined> {
    const [analytics] = await db.select()
      .from(projectAnalytics)
      .where(eq(projectAnalytics.projectId, projectId));
      
    return analytics;
  }
}

export const storage = new DatabaseStorage();
