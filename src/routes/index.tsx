import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirector,
});

function IndexRedirector() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data?.session) {
          navigate({ to: "/dashboard", replace: true });
        } else {
          navigate({ to: "/auth", replace: true });
        }
      } catch (err) {
        if (!active) return;
        navigate({ to: "/auth", replace: true });
      } finally {
        if (active) setChecking(false);
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm font-medium text-muted-foreground">Carregando Spa de Pet...</span>
      </div>
    </div>
  );
}