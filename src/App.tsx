import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { SidebarProvider } from "@/hooks/useSidebar";
import { UploadProvider } from "@/contexts/UploadContext";
import { DownloadProvider } from "@/contexts/DownloadContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { GlobalUploadTray } from "@/components/upload/GlobalUploadTray";
import { GlobalDownloadTray } from "@/components/download/GlobalDownloadTray";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import AuthCallback from "./pages/auth/AuthCallback";
import OAuthInitiateProxy from "./pages/auth/OAuthInitiateProxy";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import JoinClient from "./pages/JoinClient";
import JoinTeam from "./pages/JoinTeam";

import Onboarding from "./pages/Onboarding";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminProjects from "./pages/admin/Projects";
import AdminClients from "./pages/admin/Clients";
import AdminTeam from "./pages/admin/Team";
import AdminEditorPerformance from "./pages/admin/EditorPerformance";
import AdminInvoices from "./pages/admin/Invoices";
import AdminPayroll from "./pages/admin/Payroll";

import ClientDashboard from "./pages/client/Dashboard";
import ClientInvoices from "./pages/client/Invoices";
import ClientProjects from "./pages/client/Projects";

import EditorDashboard from "./pages/editor/Dashboard";
import EditorProjects from "./pages/editor/Projects";
import EditorEarnings from "./pages/editor/Earnings";
import EditorWorkLogs from "./pages/editor/WorkLogs";

import Pricing from "./pages/Pricing";
import Subscribe from "./pages/Subscribe";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import Refund from "./pages/legal/Refund";

// Shared pages
import SettingsPage from "./pages/settings/Settings";
import MessagesPage from "./pages/messages/MessagesPage";
import StoragePage from "./pages/storage/StoragePage";
import CalendarPage from "./pages/Calendar";
import InvoiceDetailPage from "./pages/invoices/InvoiceDetail";
import PublicReview from "./pages/review/PublicReview";
import InternalReview from "./pages/review/InternalReview";
import FoundingMembers from "./pages/FoundingMembers";
import { SuperAdminGuard } from "./components/super-admin/SuperAdminGuard";
import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <HelmetProvider>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <BrandingProvider>
                <UploadProvider>
                <DownloadProvider>
                  <GlobalUploadTray />
                  <GlobalDownloadTray />
                <Routes>
                  {/* Public invite signup routes (must remain unguarded) */}
                  <Route path="/join-client" element={<JoinClient />} />
                  <Route path="/join-team" element={<JoinTeam />} />

                  {/* Other public routes */}
                  <Route path="/auth/login" element={<Login />} />
                  <Route path="/auth/signup" element={<Signup />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                  <Route path="/auth/reset-password" element={<ResetPassword />} />
                  <Route path="/" element={<Index />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/subscribe" element={<Subscribe />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/refund" element={<Refund />} />
                  <Route path="/review/:token" element={<PublicReview />} />
                  <Route path="/review/internal/:projectId/:deliverableId" element={<InternalReview />} />
                  <Route path="/founding-members" element={<FoundingMembers />} />

                  {/* Onboarding */}
                  <Route path="/onboarding" element={<Onboarding />} />

                  {/* Admin */}
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/projects" element={<AdminProjects />} />
                  <Route path="/admin/clients" element={<AdminClients />} />
                  <Route path="/admin/team" element={<AdminTeam />} />
                  <Route path="/admin/team/:editorId" element={<AdminEditorPerformance />} />
                  <Route path="/admin/invoices" element={<AdminInvoices />} />
                  <Route path="/admin/payroll" element={<AdminPayroll />} />
                  <Route path="/admin/storage" element={<StoragePage />} />
                  <Route path="/admin/messages" element={<MessagesPage />} />
                  <Route path="/admin/calendar" element={<CalendarPage />} />
                  <Route path="/admin/settings" element={<SettingsPage />} />

                  {/* Client */}
                  <Route path="/client/dashboard" element={<ClientDashboard />} />
                  <Route path="/client/projects" element={<ClientProjects />} />
                  <Route path="/client/invoices" element={<ClientInvoices />} />
                  <Route path="/client/storage" element={<StoragePage />} />
                  <Route path="/client/messages" element={<MessagesPage />} />
                  <Route path="/client/calendar" element={<CalendarPage />} />
                  <Route path="/client/settings" element={<SettingsPage />} />

                  {/* Invoice detail (shared) */}
                  <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />

                  {/* Editor */}
                  <Route path="/editor/dashboard" element={<EditorDashboard />} />
                  <Route path="/editor/projects" element={<EditorProjects />} />
                  <Route path="/editor/earnings" element={<EditorEarnings />} />
                  <Route path="/editor/work-logs" element={<EditorWorkLogs />} />
                  <Route path="/editor/storage" element={<StoragePage />} />
                  <Route path="/editor/messages" element={<MessagesPage />} />
                  <Route path="/editor/calendar" element={<CalendarPage />} />
                  <Route path="/editor/settings" element={<SettingsPage />} />

                  {/* Super Admin (hidden) */}
                  <Route path="/super-admin" element={<SuperAdminGuard><SuperAdminDashboard /></SuperAdminGuard>} />

                  {/* OAuth broker proxy routes - must be before catch-all */}
                  <Route path="/~oauth/initiate" element={<OAuthInitiateProxy />} />
                  <Route path="/--oauth/initiate" element={<OAuthInitiateProxy />} />

                  {/* Catch-all must be last */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </DownloadProvider>
                </UploadProvider>
                </BrandingProvider>
              </AuthProvider>
            </BrowserRouter>
          </SidebarProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
