import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import { AdminAuthProvider, RequireAdminAuth } from "@/lib/adminAuth";
import { ThemeProvider } from "@/lib/theme";
import { ErrorBoundary } from "@/components/error-boundary";
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
import Plans from "@/pages/plans";
import GroupPage from "@/pages/group";
import InvitePage from "@/pages/invite";
import WhatsOn from "@/pages/whats-on";
import Onboarding from "@/pages/onboarding";

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
      <Route path="/onboarding">
        <RequireAuth><Onboarding /></RequireAuth>
      </Route>
      <Route path="/discover">
        <RequireAuth><Discover /></RequireAuth>
      </Route>
      <Route path="/upload">
        <RequireAuth><Upload /></RequireAuth>
      </Route>
      <Route path="/matches">
        <RequireAuth><Matches /></RequireAuth>
      </Route>
      <Route path="/profile">
        <RequireAuth><Profile /></RequireAuth>
      </Route>
      <Route path="/plans">
        <RequireAuth><Plans /></RequireAuth>
      </Route>
      <Route path="/advertise" component={Advertise} />
      <Route path="/advertise/success" component={AdvertiseSuccess} />
      <Route path="/whats-on">
        <RequireAuth><WhatsOn /></RequireAuth>
      </Route>
      <Route path="/groups">
        <RequireAuth><Roamers /></RequireAuth>
      </Route>
      <Route path="/roamers">
        <RequireAuth><Roamers /></RequireAuth>
      </Route>
      <Route path="/invite/:token" component={InvitePage} />
      <Route path="/groups/:id">
        <RequireAuth><GroupPage /></RequireAuth>
      </Route>
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin">
        <RequireAdminAuth><Admin /></RequireAdminAuth>
      </Route>
      <Route path="/admin/ads">
        <RequireAdminAuth><AdminAds /></RequireAdminAuth>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AuthProvider>
              <AdminAuthProvider>
                <Toaster />
                <ErrorBoundary>
                  <Router />
                </ErrorBoundary>
              </AdminAuthProvider>
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
