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
      await apiRequest("POST", "/api/logout");
      // Also log out from Firebase if we're using it
      if (auth.currentUser) {
        await auth.signOut();
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      // Invalidate all queries
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
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
          
          const res = await apiRequest("POST", "/api/login-with-firebase", {
            firebaseUid: firebaseId
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
            // If login fails, user might not exist in our DB yet, so register them
            console.log("User not found, registering new user");
            const userData: RegisterData = {
              username: firebaseUser.email?.split('@')[0] || `user_${Date.now()}`,
              email: firebaseUser.email || `${Date.now()}@example.com`,
              password: `firebase_${Date.now()}`, // Will not be used for auth
              displayName: firebaseUser.displayName || undefined,
              photoURL: firebaseUser.photoURL || undefined,
              firebaseUid: firebaseId
            };
            
            console.log("Registering Firebase user with data:", userData);
            // Use our dedicated Firebase registration endpoint instead of the regular registration endpoint
            const registerResponse = await apiRequest("POST", "/api/register-with-firebase", userData);
            
            if (!registerResponse.ok) {
              const errorData = await registerResponse.json();
              throw new Error(errorData.message || "Failed to register with Firebase credentials");
            }
            
            const newUser = await registerResponse.json();
            queryClient.setQueryData(["/api/user"], newUser);
            
            toast({
              title: "Account created",
              description: "Your account has been created successfully!",
            });
            return newUser;
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
