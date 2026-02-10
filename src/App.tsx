import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/components/NotificationProvider";
import { CallProvider } from "@/contexts/CallContext";
import { GlobalCallManager } from "@/components/video/GlobalCallManager";

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/auth/AuthPage";

// Patient pages
import PatientDashboard from "./pages/patient/PatientDashboard";
import ConsultationsPage from "./pages/patient/ConsultationsPage";
import PrescriptionsPage from "./pages/patient/PrescriptionsPage";
import OrdersPage from "./pages/patient/OrdersPage";
import MessagesPage from "./pages/patient/MessagesPage";

// Doctor pages
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import SchedulePage from "./pages/doctor/SchedulePage";
import PatientsPage from "./pages/doctor/PatientsPage";
import DoctorPrescriptionsPage from "./pages/doctor/DoctorPrescriptionsPage";
import DoctorMessagesPage from "./pages/doctor/DoctorMessagesPage";

// Pharmacy pages
import PharmacyDashboard from "./pages/pharmacy/PharmacyDashboard";
import PharmacyPrescriptionsPage from "./pages/pharmacy/PharmacyPrescriptionsPage";
import InventoryPage from "./pages/pharmacy/InventoryPage";
import PharmacyOrdersPage from "./pages/pharmacy/PharmacyOrdersPage";
import PharmacyMessagesPage from "./pages/pharmacy/PharmacyMessagesPage";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UsersPage from "./pages/admin/UsersPage";
import AnalyticsPage from "./pages/admin/AnalyticsPage";
import LogsPage from "./pages/admin/LogsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <CallProvider>
          <Toaster />
          <Sonner />
          <GlobalCallManager />
          <BrowserRouter>
            <NotificationProvider>
              <Routes>
                {/* ... existing routes ... */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<AuthPage />} />

                {/* Patient routes */}
                <Route path="/patient" element={<PatientDashboard />} />
                <Route path="/patient/consultations" element={<ConsultationsPage />} />
                <Route path="/patient/prescriptions" element={<PrescriptionsPage />} />
                <Route path="/patient/orders" element={<OrdersPage />} />
                <Route path="/patient/messages" element={<MessagesPage />} />

                {/* Doctor routes */}
                <Route path="/doctor" element={<DoctorDashboard />} />
                <Route path="/doctor/schedule" element={<SchedulePage />} />
                <Route path="/doctor/patients" element={<PatientsPage />} />
                <Route path="/doctor/prescriptions" element={<DoctorPrescriptionsPage />} />
                <Route path="/doctor/messages" element={<DoctorMessagesPage />} />

                {/* Pharmacy routes */}
                <Route path="/pharmacy" element={<PharmacyDashboard />} />
                <Route path="/pharmacy/prescriptions" element={<PharmacyPrescriptionsPage />} />
                <Route path="/pharmacy/inventory" element={<InventoryPage />} />
                <Route path="/pharmacy/orders" element={<PharmacyOrdersPage />} />
                <Route path="/pharmacy/messages" element={<PharmacyMessagesPage />} />

                {/* Admin routes */}
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/analytics" element={<AnalyticsPage />} />
                <Route path="/admin/logs" element={<LogsPage />} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </NotificationProvider>
          </BrowserRouter>
        </CallProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
