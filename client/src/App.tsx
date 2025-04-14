import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import CreateProject from "@/pages/create-project";
import ViewProject from "@/pages/view-project";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/lib/protected-route";
import { checkRedirectResult } from "@/lib/firebase";


// Wrapper components to fix type issues
const DashboardWrapper = () => <Dashboard />;
const CreateProjectWrapper = () => <CreateProject />;

function App() {
  // Set document title and check for redirect results
  useEffect(() => {
    document.title = "ARCreate | WebAR Platform";
    
    // Check if user was redirected from Google sign-in
    checkRedirectResult().then(result => {
      if (result) {
        console.log("Found redirect result in App.tsx:", result.user.uid);
      }
    });
  }, []);

  // Test login button for development
  const TestLoginButton = () => {
    const { testLoginWithFirebase, user } = useAuth();
    const [, navigate] = useLocation();
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    
    const handleTestLogin = async () => {
      if (isLoggingIn) return;
      try {
        setIsLoggingIn(true);
        await testLoginWithFirebase();
        navigate("/dashboard");
      } catch (error) {
        console.error("Test login failed:", error);
      } finally {
        setIsLoggingIn(false);
      }
    };
    
    // Only show if we're in development and not logged in
    if (user || process.env.NODE_ENV !== 'development') return null;
    
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={handleTestLogin}
          disabled={isLoggingIn}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm shadow-lg flex items-center"
        >
          {isLoggingIn ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </>
          ) : (
            <>
              <span className="mr-1">✓</span>
              Test Login
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <AuthProvider>
      <Switch>
        <ProtectedRoute path="/" component={DashboardWrapper} />
        <Route path="/auth">
          <AuthPage />
        </Route>
        <Route path="/login">
          <AuthPage />
        </Route>
        <Route path="/signup">
          <AuthPage />
        </Route>
        <ProtectedRoute path="/dashboard" component={DashboardWrapper} />
        <ProtectedRoute path="/create-project" component={CreateProjectWrapper} />
        <Route path="/view/:projectId">
          {(params) => <ViewProject projectId={params.projectId} />}
        </Route>
        <Route>
          <NotFound />
        </Route>
      </Switch>
      <Toaster />
      <TestLoginButton />
    </AuthProvider>
  );
}

export default App;
