import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import RoomManage from "./pages/RoomManage";
import StudentView from "./pages/StudentView";
import AdminPanel from "./pages/AdminPanel";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import Documentation from "./pages/Documentation";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/room/:roomId" element={<RoomManage />} />
          <Route path="/room/:roomId/student/:sessionId" element={<StudentView />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/docs" element={<Documentation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
