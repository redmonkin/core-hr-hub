import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Landing from "./pages/Landing";
import Features from "./pages/Features";
import HowItWorks from "./pages/HowItWorks";
import Pricing from "./pages/Pricing";
import Index from "./pages/Index";
import Employees from "./pages/Employees";
import Onboarding from "./pages/Onboarding";
import Leaves from "./pages/Leaves";
import LeaveApprovals from "./pages/LeaveApprovals";
import Assets from "./pages/Assets";
import Payroll from "./pages/Payroll";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Performance from "./pages/Performance";
import ReviewsManagement from "./pages/ReviewsManagement";
import TeamAnalytics from "./pages/TeamAnalytics";
import Attendance from "./pages/Attendance";
import Departments from "./pages/Departments";
import CompanyCalendar from "./pages/CompanyCalendar";
import NotificationPreferences from "./pages/NotificationPreferences";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public marketing pages */}
            <Route path="/" element={<Landing />} />
            <Route path="/features" element={<Features />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected app pages */}
            <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/leaves" element={<ProtectedRoute><Leaves /></ProtectedRoute>} />
            <Route path="/leave-approvals" element={<ProtectedRoute><LeaveApprovals /></ProtectedRoute>} />
            <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
            <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
            <Route path="/reviews-management" element={<ProtectedRoute><ReviewsManagement /></ProtectedRoute>} />
            <Route path="/team-analytics" element={<ProtectedRoute><TeamAnalytics /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/departments" element={<ProtectedRoute><Departments /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CompanyCalendar /></ProtectedRoute>} />
            <Route path="/notification-preferences" element={<ProtectedRoute><NotificationPreferences /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
