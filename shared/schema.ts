import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  photoURL: text("photo_url"),
  firebaseUid: text("firebase_uid").notNull().unique(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // "image-tracking" or "markerless"
  contentType: text("content_type").notNull(), // "3d-model" or "video"
  modelUrl: text("model_url"), // URL to the 3D model or video
  targetImageUrl: text("target_image_url"), // URL to the target image (for image tracking)
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
  status: true,
});

export const updateProjectSchema = createInsertSchema(projects).pick({
  name: true,
  description: true,
  type: true,
  contentType: true,
  modelUrl: true,
  targetImageUrl: true,
  status: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
