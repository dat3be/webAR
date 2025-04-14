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

// Wrapper components to fix type issues
const DashboardWrapper = () => <Dashboard />;
const CreateProjectWrapper = () => <CreateProject />;

function App() {
  // Set document title
  useEffect(() => {
    document.title = "ARCreate | WebAR Platform";
  }, []);

  return (
    <AuthProvider>
      <Switch>
        <ProtectedRoute path="/" component={DashboardWrapper} />
        <Route path="/auth">
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
    </AuthProvider>
  );
}

export default App;
