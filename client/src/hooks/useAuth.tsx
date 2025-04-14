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
      const result = await firebaseLoginWithGoogle();
      
      if (result?.user) {
        // After successful Firebase auth, register/login the user with our API
        const firebaseUser: FirebaseUser = result.user;
        
        // Try to login with Firebase UID
        try {
          const res = await apiRequest("POST", "/api/login-with-firebase", {
            firebaseUid: firebaseUser.uid
          });
          
          if (res.ok) {
            const user = await res.json();
            queryClient.setQueryData(["/api/user"], user);
            return user;
          } else {
            // If login fails, user might not exist in our DB yet, so register them
            const userData: RegisterData = {
              username: firebaseUser.email?.split('@')[0] || `user_${Date.now()}`,
              email: firebaseUser.email || `${Date.now()}@example.com`,
              password: `firebase_${Date.now()}`, // Will not be used for auth
              displayName: firebaseUser.displayName || undefined,
              photoURL: firebaseUser.photoURL || undefined,
              firebaseUid: firebaseUser.uid
            };
            
            await registerMutation.mutateAsync(userData);
          }
        } catch (error) {
          console.error("Firebase server auth error:", error);
          throw error;
        }
      }
      
      return result;
    } catch (error) {
      console.error("Google login error:", error);
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
