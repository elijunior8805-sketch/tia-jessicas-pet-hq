import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAccessDenial } from "@/lib/log-access-denial";

export type MyAccess = {
  userId: string | null;
  perfil: string | null;
  status: string | null;
  canManageUsers: boolean;
  isProprietario: boolean;
  isAdmin: boolean;
  permissoes: Record<string, Record<string, boolean>>;
};

export function useMyAccess() {
  return useQuery<MyAccess>({
    queryKey: ["me-access"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        return {
          userId: null, perfil: null, status: null,
          canManageUsers: false, isProprietario: false, isAdmin: false, permissoes: {},
        };
      }
      const [{ data: prof }, { data: perms }] = await Promise.all([
        supabase.from("profiles").select("perfil,status").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_permissions").select("modulo,acao,permitido").eq("user_id", u.user.id),
      ]);
      const perfil = (prof as any)?.perfil ?? null;
      const status = (prof as any)?.status ?? null;
      const grid: Record<string, Record<string, boolean>> = {};
      (perms ?? []).forEach((p: any) => {
        grid[p.modulo] = grid[p.modulo] ?? {};
        grid[p.modulo][p.acao] = !!p.permitido;
      });
      return {
        userId: u.user.id,
        perfil,
        status,
        isProprietario: perfil === "proprietario",
        isAdmin: perfil === "admin" || perfil === "proprietario",
        canManageUsers: (perfil === "proprietario" || perfil === "admin") && status === "ativo",
        permissoes: grid,
      };
    },
  });
}

export function hasPermission(access: MyAccess | undefined, modulo: string, acao: string): boolean {
  if (!access) return false;
  if (access.isProprietario) return true;
  const ok = !!access.permissoes[modulo]?.[acao];
  if (!ok && access.userId) {
    void logAccessDenial({ motivo: "permission_check", modulo, acao });
  }
  return ok;
}
