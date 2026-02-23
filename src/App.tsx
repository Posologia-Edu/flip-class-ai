import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
        <Routes>
          {/* Public routes - no sidebar */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/room/:roomId/student/:sessionId" element={<StudentView />} />
          <Route path="/pending-approval" element={<PendingApproval />} />

          {/* Authenticated routes - with sidebar */}
          <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/dashboard/rooms" element={<AppLayout><RoomsList /></AppLayout>} />
          <Route path="/dashboard/room/:roomId" element={<AppLayout><RoomManage /></AppLayout>} />
          <Route path="/dashboard/question-bank" element={<AppLayout><QuestionBank /></AppLayout>} />
          <Route path="/dashboard/analytics" element={<AppLayout><AnalyticsPage /></AppLayout>} />
          <Route path="/dashboard/calendar" element={<AppLayout><CalendarPage /></AppLayout>} />
          <Route path="/dashboard/pricing" element={<AppLayout><Pricing /></AppLayout>} />
          <Route path="/admin" element={<AppLayout><AdminPanel /></AppLayout>} />
          <Route path="/docs" element={<AppLayout><Documentation /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
