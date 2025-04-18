import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Using Postgres for session storage
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "developmentsecret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === "production",
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure local passport strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password",
      },
      async (username, password, done) => {
        try {
          const user = await storage.getUserByUsername(username);
          if (!user) {
            return done(null, false, { message: "Incorrect username" });
          }
          
          // Skip password check for Firebase users
          if (user.firebaseUid && user.firebaseUid.startsWith('firebase-')) {
            return done(null, false, { message: "Please use Google login for this account" });
          }
          
          const passwordValid = await comparePasswords(password, user.password);
          if (!passwordValid) {
            return done(null, false, { message: "Incorrect password" });
          }
          
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // User serialization for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Auth middleware
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Registration endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if email already exists
      // Assume we've added this method to storage
      const existingEmail = await storage.getUserByEmail(req.body.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }

      // Hash password for new users (only for non-Firebase users)
      if (req.body.firebaseUid && !req.body.firebaseUid.startsWith('firebase-')) {
        req.body.password = await hashPassword(req.body.password);
      } else if (!req.body.firebaseUid) {
        // If no firebase UID is provided, this is a regular user
        req.body.password = await hashPassword(req.body.password);
      }

      // Create user
      const user = await storage.createUser(req.body);
      
      // Log in the new user
      req.login(user, (err) => {
        if (err) return next(err);
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // Firebase login endpoint
  app.post("/api/login-with-firebase", async (req, res, next) => {
    try {
      console.log("Firebase login attempt with body:", req.body);
      const { firebaseUid, email, displayName, photoURL } = req.body;
      if (!firebaseUid) {
        console.log("Firebase login failed: Missing Firebase UID");
        return res.status(400).json({ message: "Missing Firebase UID" });
      }

      console.log("Looking up user with Firebase UID:", firebaseUid);
      
      // First try to find the user by Firebase UID
      let user = await storage.getUserByFirebaseUid(firebaseUid);
      
      // If no user found with that Firebase UID but email is provided,
      // check if there's a user with that email and update their Firebase UID
      if (!user && email) {
        console.log(`User not found with Firebase UID. Checking if user exists with email: ${email}`);
        const userByEmail = await storage.getUserByEmail(email);
        
        if (userByEmail) {
          console.log(`Found user with email ${email}. Updating their Firebase UID from ${userByEmail.firebaseUid || 'null'} to ${firebaseUid}`);
          
          // Update the user's Firebase UID
          user = await storage.updateUserFirebaseUid(userByEmail.id, firebaseUid);
          console.log("User Firebase UID updated successfully:", user.id, user.username, user.firebaseUid);
        } else {
          // No user found by email either - create a new user
          console.log(`No user found with email: ${email}. Creating new user automatically.`);
          
          // Generate a username from email
          const emailPrefix = email.split('@')[0];
          const randomSuffix = Math.floor(Math.random() * 10000);
          const username = `${emailPrefix}_${randomSuffix}`;
          
          // Generate a random secure password (won't be used for login)
          const randomPassword = `firebase_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          
          // Create the new user
          try {
            user = await storage.createUser({
              username,
              email,
              password: await hashPassword(randomPassword), // Hash the random password
              displayName: displayName || username,
              photoURL,
              firebaseUid
            });
            console.log("New user created successfully from Firebase login:", user.id, user.username);
          } catch (createError) {
            console.error("Error creating new user from Firebase data:", createError);
            return res.status(500).json({ message: "Failed to create user account" });
          }
        }
      }
      
      // If still no user found (unlikely at this point), return 404
      if (!user) {
        console.log("Firebase login failed: User not found with UID:", firebaseUid, "or email:", email);
        return res.status(404).json({ message: "User not found and could not be created" });
      }

      console.log("Firebase user found or created:", user.id, user.username);
      req.login(user, (err) => {
        if (err) {
          console.log("Firebase login session error:", err);
          return next(err);
        }
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        console.log("Firebase login successful for user:", user.id);
        res.json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Firebase login error:", error);
      next(error);
    }
  });
  
  // Register with Firebase UID endpoint (for new Firebase users)
  app.post("/api/register-with-firebase", async (req, res, next) => {
    try {
      console.log("Firebase registration attempt:", req.body);
      const { username, email, password, displayName, photoURL, firebaseUid } = req.body;
      
      if (!firebaseUid) {
        console.log("Firebase registration failed: Missing Firebase UID");
        return res.status(400).json({ message: "Missing Firebase UID" });
      }

      // Check if user with this Firebase UID already exists
      const existingUser = await storage.getUserByFirebaseUid(firebaseUid);
      if (existingUser) {
        console.log("Firebase registration failed: User already exists with this UID");
        return res.status(400).json({ message: "User with this Firebase UID already exists" });
      }
      
      // Check if username is taken
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        console.log("Firebase registration failed: Username already taken");
        return res.status(400).json({ message: "Username already taken" });
      }

      // Create the user
      console.log("Creating new user with Firebase UID:", firebaseUid);
      const user = await storage.createUser({
        username,
        email,
        password,
        displayName,
        photoURL,
        firebaseUid
      });

      // Log the user in
      req.login(user, (err) => {
        if (err) {
          console.log("Firebase registration session error:", err);
          return next(err);
        }
        
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        console.log("Firebase registration successful, created user:", user.id);
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Firebase registration error:", error);
      next(error);
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    console.log("Logout request received from user:", req.user?.id);
    
    // First logout the user from session
    req.logout((err) => {
      if (err) {
        console.error("Session logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      
      // Then destroy the session completely
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({ message: "Failed to destroy session" });
        }
        
        console.log("User logged out successfully, session destroyed");
        res.clearCookie("connect.sid"); // Clear the session cookie
        return res.json({ message: "Logged out successfully" });
      });
    });
  });

  // Current user endpoint
  app.get("/api/user", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    // Return user without password
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Return middleware for protected routes
  return { isAuthenticated };
}