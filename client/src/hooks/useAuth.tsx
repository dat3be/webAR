import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as UserType } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { auth, loginWithGoogle as firebaseLoginWithGoogle } from "@/lib/firebase";
import { User as FirebaseUser } from "firebase/auth";

type AuthContextType = {
  user: UserType | null;
  loading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<UserType, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<UserType, Error, RegisterData>;
  loginWithGoogle: () => Promise<any>;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  photoURL?: string;
  firebaseUid: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const {
    data: user,
    error,
    isLoading: loading,
  } = useQuery<UserType | null>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Login failed");
      }
      return await res.json();
    },
    onSuccess: (user: UserType) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      // Validate data against schema
      const validated = insertUserSchema.parse(userData);
      
      const res = await apiRequest("POST", "/api/register", validated);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Registration failed");
      }
      return await res.json();
    },
    onSuccess: (user: UserType) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("Starting logout process...");
      // Always sign out of Firebase first (whether we're logged in with it or not)
      try {
        if (auth.currentUser) {
          console.log("Signing out of Firebase...");
          await auth.signOut();
          console.log("Firebase sign out successful");
        }
      } catch (firebaseError) {
        console.error("Firebase logout error:", firebaseError);
        // Continue with server logout even if Firebase logout fails
      }
      
      // Then logout from the server
      console.log("Sending logout request to server...");
      const response = await apiRequest("POST", "/api/logout");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Logout failed");
      }
      
      console.log("Server logout successful");
      return response.json();
    },
    onSuccess: () => {
      console.log("Logout mutation successful, clearing local data");
      // Clear user data from query client
      queryClient.setQueryData(["/api/user"], null);
      
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      console.error("Logout error:", error);
      toast({
        title: "Logout Failed",
        description: error.message || "There was a problem logging out",
        variant: "destructive",
      });
    },
  });

  // Google sign-in function
  const loginWithGoogle = async () => {
    try {
      // Start Firebase Google auth flow
      console.log("Starting Firebase Google auth flow...");
      const result = await firebaseLoginWithGoogle();
      console.log("Firebase login result:", result);
      
      if (result?.user) {
        // After successful Firebase auth, register/login the user with our API
        const firebaseUser: FirebaseUser = result.user;
        console.log("Firebase user authenticated:", firebaseUser.uid);
        
        // Try to login with Firebase UID
        try {
          const firebaseId = `firebase-${firebaseUser.uid}`;
          console.log("Attempting to login with Firebase UID:", firebaseId);
          
          try {
            // Try logging in first
            console.log("Attempting to login with Firebase UID:", firebaseId, "and email:", firebaseUser.email);
            const res = await apiRequest("POST", "/api/login-with-firebase", {
              firebaseUid: firebaseId,
              email: firebaseUser.email
            });
            
            if (res.ok) {
              console.log("Firebase login successful");
              const user = await res.json();
              queryClient.setQueryData(["/api/user"], user);
              toast({
                title: "Login successful",
                description: `Welcome, ${user.displayName || user.username}!`,
              });
              return user;
            } else {
              const responseText = await res.text();
              console.log("Login failed with status:", res.status, "Response:", responseText);
              
              // If login fails, user might not exist in our DB yet, so register them
              console.log("User not found, registering new user with Firebase credentials");
              
              // Generate a username that's email prefix + random digits to avoid conflicts
              const emailPrefix = firebaseUser.email?.split('@')[0] || 'user';
              const randomSuffix = Math.floor(Math.random() * 10000);
              const username = `${emailPrefix}_${randomSuffix}`;
              
              const userData: RegisterData = {
                username: username,
                email: firebaseUser.email || `${username}@example.com`,
                password: `firebase_${Date.now()}`, // Will not be used for auth
                displayName: firebaseUser.displayName || username,
                photoURL: firebaseUser.photoURL || undefined,
                firebaseUid: firebaseId
              };
              
              console.log("Registering Firebase user with data:", userData);
              
              // Use our dedicated Firebase registration endpoint instead of the regular registration endpoint
              const registerResponse = await apiRequest("POST", "/api/register-with-firebase", userData);
              
              if (!registerResponse.ok) {
                const errorText = await registerResponse.text();
                console.error("Registration failed:", registerResponse.status, errorText);
                try {
                  const errorData = JSON.parse(errorText);
                  throw new Error(errorData.message || "Failed to register with Firebase credentials");
                } catch (e) {
                  throw new Error(`Failed to register: ${errorText}`);
                }
              }
              
              const newUser = await registerResponse.json();
              console.log("Registration successful, user created:", newUser);
              queryClient.setQueryData(["/api/user"], newUser);
              
              toast({
                title: "Account created",
                description: "Your account has been created successfully!",
              });
              return newUser;
            }
          } catch (error) {
            console.error("Error during Firebase authentication flow:", error);
            throw error;
          }
        } catch (error: any) {
          console.error("Firebase server auth error:", error);
          toast({
            title: "Authentication Error",
            description: error.message || "Error authenticating with server",
            variant: "destructive",
          });
          throw error;
        }
      } else {
        console.error("No user returned from Firebase");
        toast({
          title: "Login Failed",
          description: "No user data returned from Google authentication",
          variant: "destructive",
        });
        throw new Error("No user data returned from Google authentication");
      }
    } catch (error: any) {
      console.error("Google login error:", error);
      // Only show toast if it's not a user-canceled operation
      if (error.code !== "auth/cancelled-popup-request" && 
          error.code !== "auth/popup-closed-by-user") {
        toast({
          title: "Google Login Failed",
          description: error.message || "Failed to authenticate with Google",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        loading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        loginWithGoogle
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
