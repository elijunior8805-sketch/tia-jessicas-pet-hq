import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MyProfile = {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  avatar_url: string | null;
  authEmail: string | null;
};

export function useMyProfile() {
  return useQuery<MyProfile | null>({
    queryKey: ["me-profile"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id,nome,email,telefone,avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      return {
        id: u.user.id,
        nome: data?.nome ?? null,
        email: data?.email ?? null,
        telefone: data?.telefone ?? null,
        avatar_url: (data as any)?.avatar_url ?? null,
        authEmail: u.user.email ?? null,
      };
    },
  });
}

export function displayName(p?: MyProfile | null) {
  const n = p?.nome?.trim();
  if (n) return n;
  const email = p?.authEmail ?? p?.email ?? "";
  return email ? email.split("@")[0] : "Usuária";
}

export function firstName(p?: MyProfile | null) {
  return displayName(p).split(" ")[0];
}

export function initials(p?: MyProfile | null) {
  const name = displayName(p);
  const parts = name.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase() || "?";
}
