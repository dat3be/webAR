import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums for better type safety
export const projectTypeEnum = pgEnum('project_type', ['image-tracking', 'markerless']);
export const contentTypeEnum = pgEnum('content_type', ['3d-model', 'video']);
export const statusEnum = pgEnum('status', ['active', 'archived', 'deleted']);

// User table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  photoURL: text("photo_url"),
  firebaseUid: text("firebase_uid").unique(), // Removed notNull to support both traditional and Firebase users
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

// Project table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  type: projectTypeEnum("type").notNull(), // "image-tracking" or "markerless"
  contentType: contentTypeEnum("content_type").notNull(), // "3d-model" or "video"
  modelUrl: text("model_url").notNull(), // URL to the 3D model or video
  targetImageUrl: text("target_image_url"), // URL to the target image (for image tracking)
  mindFileUrl: text("mind_file_url"), // URL to the uploaded .mind file
  status: statusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Project relations
export const projectsRelations = relations(projects, ({ one }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
}));

// Project analytics table to track views and interactions
export const projectAnalytics = pgTable("project_analytics", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  viewCount: integer("view_count").notNull().default(0),
  shareCount: integer("share_count").notNull().default(0),
  lastViewed: timestamp("last_viewed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Project analytics relations
export const projectAnalyticsRelations = relations(projectAnalytics, ({ one }) => ({
  project: one(projects, {
    fields: [projectAnalytics.projectId],
    references: [projects.id],
  }),
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  displayName: true,
  photoURL: true,
  firebaseUid: true,
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  userId: true,
  name: true,
  description: true,
  type: true,
  contentType: true,
  modelUrl: true,
  targetImageUrl: true,
  mindFileUrl: true,
  status: true,
});

export const updateProjectSchema = createInsertSchema(projects).pick({
  name: true,
  description: true,
  type: true,
  contentType: true,
  modelUrl: true,
  targetImageUrl: true,
  mindFileUrl: true,
  status: true,
});

export const insertProjectAnalyticsSchema = createInsertSchema(projectAnalytics).pick({
  projectId: true,
  viewCount: true,
  shareCount: true,
  lastViewed: true,
});

// TypeScript types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type UpdateProject = z.infer<typeof updateProjectSchema>;

export type InsertProjectAnalytics = z.infer<typeof insertProjectAnalyticsSchema>;
export type ProjectAnalytics = typeof projectAnalytics.$inferSelect;
