import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import RoomManage from "./pages/RoomManage";
import RoomsList from "./pages/RoomsList";
import QuestionBank from "./pages/QuestionBank";
import AnalyticsPage from "./pages/AnalyticsPage";
import CalendarPage from "./pages/CalendarPage";
import StudentView from "./pages/StudentView";
import AdminPanel from "./pages/AdminPanel";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import Documentation from "./pages/Documentation";
import Pricing from "./pages/Pricing";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes - no sidebar */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/room/:roomId/student/:sessionId" element={<StudentView />} />
            <Route path="/pending-approval" element={<PendingApproval />} />

            {/* Authenticated routes - single persistent sidebar */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/rooms" element={<RoomsList />} />
              <Route path="/dashboard/room/:roomId" element={<RoomManage />} />
              <Route path="/dashboard/activity-bank" element={<QuestionBank />} />
              <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
              <Route path="/dashboard/calendar" element={<CalendarPage />} />
              <Route path="/dashboard/pricing" element={<Pricing />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/docs" element={<Documentation />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
