import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import CreateProject from "@/pages/create-project";
import ViewProject from "@/pages/view-project";
import { AuthProvider } from "@/hooks/useAuth";
import { useEffect } from "react";

function App() {
  // Set document title
  useEffect(() => {
    document.title = "ARCreate | WebAR Platform";
  }, []);

  return (
    <AuthProvider>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/create-project" component={CreateProject} />
        <Route path="/view/:projectId" component={ViewProject} />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
