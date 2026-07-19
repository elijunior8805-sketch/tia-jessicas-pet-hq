import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSignedUrl(path: string | null | undefined, expiresInSec = 60 * 30) {
  return useQuery({
    queryKey: ["signed-url", path, expiresInSec],
    enabled: !!path,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from("spa-fotos")
        .createSignedUrl(path, expiresInSec);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
