import { useState, useEffect } from "react";
import {
  BookOpen,
  LayoutDashboard,
  FileText,
  CreditCard,
  Shield,
  LogOut,
  LogIn,
  Library,
  Users,
  BarChart3,
  CalendarDays,
  Settings,
  Globe,
  UserCog,
  Building2,
  MessageSquare,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { user, isAdmin, isApproved, fullName } = useAuth();
  const { canUseMultiTeacher } = useFeatureGate();
  const navigate = useNavigate();
  const [institutionLogo, setInstitutionLogo] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);

  // Load institution settings for white-label
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("institution_settings" as any)
        .select("logo_url, institution_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setInstitutionLogo((data as any).logo_url || null);
        setInstitutionName((data as any).institution_name || null);
      }
    };
    loadSettings();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const mainMenuItems = [
    { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
    { title: "Banco de Atividades", url: "/dashboard/activity-bank", icon: Library },
    { title: "Minhas Salas", url: "/dashboard/rooms", icon: BookOpen },
    { title: "Análises", url: "/dashboard/analytics", icon: BarChart3 },
    { title: "Calendário", url: "/dashboard/calendar", icon: CalendarDays },
    { title: "Planos", url: "/dashboard/pricing", icon: CreditCard },
    ...(canUseMultiTeacher() ? [{ title: "Institucional", url: "/dashboard/institutional", icon: Building2 }] : []),
  ];

  const bottomItems = [
    { title: "Minha Conta", url: "/dashboard/account", icon: UserCog },
    { title: "Documentação", url: "/docs", icon: FileText },
    { title: "Contato", url: "/dashboard/contact", icon: MessageSquare },
  ];

  const adminItems = [
    { title: "Administração", url: "/admin", icon: Shield },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center gap-3">
          {institutionLogo ? (
            <img src={institutionLogo} alt="Logo" className="w-9 h-9 rounded-lg object-contain shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="font-display text-lg font-bold text-sidebar-foreground leading-none">
              {institutionName || "FlipClass"}
            </span>
            {user && (
              <p className="text-xs text-sidebar-foreground/60 truncate mt-0.5">
                {fullName || user.email}
              </p>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {user && isApproved && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
              Menu
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2 space-y-0.5">
        <SidebarMenu>
          {bottomItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <NavLink
                  to={item.url}
                  className="hover:bg-sidebar-accent text-sidebar-foreground/70"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          {user && isAdmin && adminItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <NavLink
                  to={item.url}
                  className="hover:bg-sidebar-accent text-sidebar-foreground/70"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          {user ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Sair"
                onClick={handleLogout}
                className="text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Entrar"
                onClick={() => navigate("/auth")}
                className="cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                <span>Entrar</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
