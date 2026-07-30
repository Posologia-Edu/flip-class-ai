import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";

export function AppLayout() {
  const { user, loading, isApproved } = useAuth();

  if (loading) return null;

  if (!user) return <Navigate to="/auth" replace />;

  if (!isApproved) return <Navigate to="/pending-approval" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen">
          <header className="h-12 flex items-center border-b border-border px-4 bg-background sticky top-0 z-30">
            <SidebarTrigger />
          </header>
          <div className="flex-1">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
