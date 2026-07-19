import { supabase } from "@/integrations/supabase/client";

export async function uploadPetFoto(petId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
  const path = `pets/${petId}-${Date.now()}.${safeExt}`;
  const { error } = await supabase.storage
    .from("spa-fotos")
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function removePetFoto(path: string) {
  await supabase.storage.from("spa-fotos").remove([path]).catch(() => {});
}
