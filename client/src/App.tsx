import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import CreateProject from "@/pages/create-project";
import ViewProject from "@/pages/view-project";
import ARDemo from "@/pages/ar-demo";
import ProjectARView from "@/pages/project-ar-view";
import DirectARView from "@/pages/direct-ar-view";
import { AuthProvider } from "@/hooks/useAuth";
import { useEffect } from "react";
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
        <Route path="/project-ar/:projectId">
          {(params) => <ProjectARView projectId={params.projectId} />}
        </Route>
        <Route path="/direct-ar/:projectId">
          {(params) => <DirectARView projectId={params.projectId} />}
        </Route>
        <Route path="/demo/ar">
          <ARDemo />
        </Route>
        <Route>
          <NotFound />
        </Route>
      </Switch>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
