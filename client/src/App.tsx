import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import CreateProject from "@/pages/create-project";
import ViewProject from "@/pages/view-project";
import { AuthProvider } from "@/hooks/useAuth";
import { useEffect } from "react";
import { ProtectedRoute } from "@/lib/protected-route";

function App() {
  // Set document title
  useEffect(() => {
    document.title = "ARCreate | WebAR Platform";
  }, []);

  return (
    <AuthProvider>
      <Switch>
        <ProtectedRoute path="/" component={Dashboard} />
        <Route path="/auth" component={AuthPage} />
        <ProtectedRoute path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/create-project" component={CreateProject} />
        <Route path="/view/:projectId" component={ViewProject} />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
