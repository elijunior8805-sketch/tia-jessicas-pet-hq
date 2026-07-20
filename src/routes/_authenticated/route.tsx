import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMyProfile, displayName, initials } from "@/hooks/use-my-profile";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const name = displayName(profile);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Até logo!");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0 flex-1">
          <header className="h-14 border-b border-border bg-card/60 backdrop-blur flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger />
              <span className="font-display text-base sm:text-lg font-semibold text-primary truncate">
                Spa de Pet
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <NotificationBell />

              <div className="hidden sm:flex items-center gap-2 pr-2 border-r border-border/60">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {initials(profile)}
                </div>
                <div className="text-sm font-medium text-foreground truncate max-w-[160px]">{name}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
          <MobileNav />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
