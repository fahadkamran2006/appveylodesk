import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Onboarding from "./pages/Onboarding";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProjects from "./pages/admin/Projects";
import AdminClients from "./pages/admin/Clients";
import AdminInvoices from "./pages/admin/Invoices";
import AdminMessages from "./pages/admin/Messages";
import AdminSettings from "./pages/admin/Settings";
import ClientPortal from "./pages/client/Portal";
import EditorWorkspace from "./pages/editor/Workspace";
import Pricing from "./pages/Pricing";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import Refund from "./pages/legal/Refund";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/signup" element={<Signup />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/projects" element={<AdminProjects />} />
                <Route path="/admin/clients" element={<AdminClients />} />
                <Route path="/admin/invoices" element={<AdminInvoices />} />
                <Route path="/admin/messages" element={<AdminMessages />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/client/portal" element={<ClientPortal />} />
                <Route path="/editor/workspace" element={<EditorWorkspace />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/refund" element={<Refund />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
