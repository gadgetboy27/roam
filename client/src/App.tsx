import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import { AdminAuthProvider } from "@/lib/adminAuth";
import { ThemeProvider } from "@/lib/theme";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Privacy from "@/pages/privacy";
import DataDeletion from "@/pages/data-deletion";
import Terms from "@/pages/terms";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import AuthCallback from "@/pages/auth-callback";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Discover from "@/pages/discover";
import Upload from "@/pages/upload";
import Matches from "@/pages/matches";
import Profile from "@/pages/profile";
import Advertise from "@/pages/advertise";
import AdvertiseSuccess from "@/pages/advertise-success";
import AdminAds from "@/pages/admin-ads";
import Admin from "@/pages/admin";
import AdminLogin from "@/pages/admin-login";
import Roamers from "@/pages/roamers";
import GroupPage from "@/pages/group";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/data-deletion" component={DataDeletion} />
      <Route path="/discover" component={Discover} />
      <Route path="/upload">
        <RequireAuth><Upload /></RequireAuth>
      </Route>
      <Route path="/matches">
        <RequireAuth><Matches /></RequireAuth>
      </Route>
      <Route path="/profile">
        <RequireAuth><Profile /></RequireAuth>
      </Route>
      <Route path="/advertise" component={Advertise} />
      <Route path="/advertise/success" component={AdvertiseSuccess} />
      <Route path="/roamers" component={Roamers} />
      <Route path="/groups/:id">
        {(params) => <GroupPage />}
      </Route>
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/ads" component={AdminAds} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <AdminAuthProvider>
              <Toaster />
              <Router />
            </AdminAuthProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
