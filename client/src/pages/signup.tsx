import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { FcGoogle } from "react-icons/fc";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function Signup() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { user, loading, registerMutation, loginWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Use mutation state for loading indicator
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill all the fields",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setAuthError(null);
    
    try {
      // Register user directly with our backend
      await registerMutation.mutateAsync({
        username: name.toLowerCase().replace(/\s+/g, ''),
        email: email,
        password: password,
        displayName: name,
        firebaseUid: 'manual-' + Date.now(), // Manual user signup
      });
      
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Signup error:", error);
      
      let errorMessage = "Failed to create account. Please try again.";
      if (error.message) {
        errorMessage = error.message;
      }
      
      setAuthError(errorMessage);
    }
  };

  const handleGoogleSignup = async () => {
    setAuthError(null);
    
    try {
      const userCredential = await loginWithGoogle();
      const user = userCredential.user;
      
      // Create user in our backend too
      try {
        await registerMutation.mutateAsync({
          username: user.email?.split('@')[0] || user.uid,
          email: user.email || `${user.uid}@example.com`,
          password: `firebase_${Date.now()}`, // Will not be used for auth
          displayName: user.displayName || user.email?.split('@')[0],
          photoURL: user.photoURL,
          firebaseUid: user.uid,
        });
      } catch (error) {
        // User might already exist in our database, that's okay
        console.log("User might already exist:", error);
      }
      
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Google signup error:", error);
      
      let errorMessage = "Failed to sign up with Google. Please try again.";
      if (error.code === "auth/popup-closed-by-user") {
        errorMessage = "Sign up popup was closed. Please try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setAuthError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-extrabold text-center">Create your ARCreate account</CardTitle>
          <CardDescription className="text-center">
            Or{" "}
            <Link href="/" className="font-medium text-primary hover:text-primary/90">
              sign in to existing account
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {authError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}
          
          {/* Google Sign Up Button (Primary method) */}
          <Button 
            variant="outline" 
            type="button" 
            className="w-full h-12 text-base" 
            onClick={handleGoogleSignup} 
            disabled={registerMutation.isPending}
          >
            <FcGoogle className="mr-2 h-6 w-6" />
            Sign up with Google
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or</span>
            </div>
          </div>

          {!showEmailAuth ? (
            <Button 
              variant="secondary" 
              className="w-full" 
              onClick={() => setShowEmailAuth(true)}
            >
              Sign up with Email
            </Button>
          ) : (
            <form className="space-y-4" onSubmit={handleSignup}>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          )}
          
          <div className="text-center mt-4">
            <p className="text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/" className="font-medium text-primary hover:text-primary/90">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
