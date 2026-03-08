import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";

import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import Index from "@/pages/Index";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import TemplatesPage from "@/pages/TemplatesPage";
import CreateMagazinePage from "@/pages/CreateMagazinePage";
import MagazinesPage from "@/pages/MagazinesPage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";
import AuthCallback from "@/pages/AuthCallback";
import CheckEmailPage from "@/pages/CheckEmailPage";
import { AuthProvider } from '@/context/AuthContext';
import PageJsonGenerator from "@/pages/PageJsonGenerator";
import TemplatePaymentCallbackPage from "@/pages/TemplatePaymentCallbackPage";
import FAQsPage from "@/pages/FAQsPage";
import ContactPage from "@/pages/ContactPage";
import TemplateRequestPage from "@/pages/TemplateRequestPage";
import PartnerPage from "@/pages/PartnerPage";






const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<AppLayout />}>
              {/* Public */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/check-email" element={<CheckEmailPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/faqs" element={<FAQsPage />} />
              <Route path="/page-json-generator" element={<PageJsonGenerator />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/template-request" element={<TemplateRequestPage />} />
              <Route path="/partner" element={<PartnerPage />} />

              {/* Authenticated */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/create/:templateSlug" element={<CreateMagazinePage />} />
              <Route path="/magazines" element={<MagazinesPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/templatepayment/callback" element={<TemplatePaymentCallbackPage />} />

            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>

      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
