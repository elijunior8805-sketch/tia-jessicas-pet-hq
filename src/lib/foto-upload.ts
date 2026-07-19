import { supabase } from "@/integrations/supabase/client";

/**
 * Upload genérico para o bucket privado `spa-fotos`.
 * Retorna o path salvo (usar `useSignedUrl` para exibir).
 */
export async function uploadFoto(folder: string, id: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
  const cleanFolder = folder.replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "misc";
  const path = `${cleanFolder}/${id}-${Date.now()}.${safeExt}`;
  const { error } = await supabase.storage
    .from("spa-fotos")
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function removeFoto(path: string) {
  await supabase.storage.from("spa-fotos").remove([path]).catch(() => {});
}
