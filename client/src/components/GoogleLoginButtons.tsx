import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";

interface GoogleLoginButtonsProps {
  isGoogleLoading: boolean;
  setIsGoogleLoading: (loading: boolean) => void;
  loginWithGoogle: () => Promise<any>;
}

export function GoogleLoginButtons({ 
  isGoogleLoading, 
  setIsGoogleLoading,
  loginWithGoogle
}: GoogleLoginButtonsProps) {
  const [, navigate] = useLocation();

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    if (isGoogleLoading) return; // Prevent multiple clicks
    
    try {
      setIsGoogleLoading(true);
      console.log("Starting Google sign-in process");
      await loginWithGoogle();
      console.log("Google sign-in successful, navigating to dashboard");
      navigate("/dashboard");
    } catch (error) {
      console.log("Google sign-in failed", error);
      // Error handling is done in useAuth hook via toast notifications
    } finally {
      setIsGoogleLoading(false);
    }
  };
  
  // Temporary function to manually simulate Firebase auth for testing
  const handleTestGoogleSignIn = async () => {
    if (isGoogleLoading) return;
    
    try {
      setIsGoogleLoading(true);
      // Create a fake UUID for testing - IMPORTANT: Use exactly this UID from the logs
      const testFirebaseUid = `firebase-Wp9YXNspKfPMAFWlqhZ4duggDT23`;
      const testEmail = "test@example.com";
      const testDisplayName = "Test User";
      
      console.log("Manually registering user with Firebase UID:", testFirebaseUid);
      
      // First, try logging in with the test Firebase UID
      try {
        console.log("Trying to login with Firebase UID first...");
        const loginResponse = await fetch('/api/login-with-firebase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firebaseUid: testFirebaseUid }),
          credentials: 'include'
        });
        
        if (loginResponse.ok) {
          console.log("Firebase login successful, user already exists");
          const user = await loginResponse.json();
          console.log("Logged in user:", user);
          navigate("/dashboard");
          return;
        }
        
        console.log("Login failed, will try to register a new user");
      } catch (loginError) {
        console.log("Login attempt failed, will register instead:", loginError);
      }
      
      // If login fails, register the user
      // Generate username from email + random suffix
      const emailPrefix = testEmail.split('@')[0];
      const randomSuffix = Math.floor(Math.random() * 10000);
      const username = `${emailPrefix}_${randomSuffix}`;
      
      // Prepare user data
      const userData = {
        username,
        email: testEmail,
        password: `firebase_${Date.now()}`,
        displayName: testDisplayName,
        firebaseUid: testFirebaseUid
      };
      
      console.log("Registering new test user with data:", userData);
      
      // Register new user directly
      const registerResponse = await fetch('/api/register-with-firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
        credentials: 'include'
      });
      
      if (!registerResponse.ok) {
        const text = await registerResponse.text();
        throw new Error(`Registration failed: ${text}`);
      }
      
      const newUser = await registerResponse.json();
      console.log("Test user registered successfully:", newUser);
      
      toast({
        title: "Success",
        description: "Test user created and logged in successfully",
      });
      
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Test registration failed:", error);
      toast({
        title: "Test Registration Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading}
      >
        {isGoogleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg
            className="mr-2 h-4 w-4"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
              <path
                fill="#4285F4"
                d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
              />
              <path
                fill="#34A853"
                d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"
              />
              <path
                fill="#FBBC05"
                d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
              />
              <path
                fill="#EA4335"
                d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"
              />
            </g>
          </svg>
        )}
        Continue with Google
      </Button>
      
      {/* Test button for debugging */}
      <Button
        variant="secondary"
        className="w-full mt-2 text-xs"
        onClick={handleTestGoogleSignIn}
        disabled={isGoogleLoading}
      >
        {isGoogleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <span className="mr-2">✓</span>
        )}
        Test Login (Dev Only)
      </Button>
    </div>
  );
}