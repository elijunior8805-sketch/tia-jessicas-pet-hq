import { useEffect, useRef, useState } from "react";
import { Camera, Upload, X, PawPrint, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignedUrl } from "@/lib/use-signed-url";

type Props = {
  /** Storage path já salvo (pets/xxx.jpg) — opcional */
  currentPath?: string | null;
  /** Notifica pai sobre a foto escolhida (File) ou remoção (null significa remover foto atual) */
  onFileChange: (file: File | null) => void;
  /** Marca "remover foto atual" quando o usuário clica em remover */
  onRemoveExisting?: () => void;
  size?: "md" | "lg";
};

const MAX_MB = 10;
const ACCEPT = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

export function PetFotoPicker({ currentPath, onFileChange, onRemoveExisting, size = "lg" }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);

  const { data: signedUrl } = useSignedUrl(!removed && !preview ? currentPath ?? null : null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pick(f: File | null) {
    if (!f) return;
    const nameLower = f.name.toLowerCase();
    const extOk = /\.(jpe?g|png|webp|heic|heif)$/i.test(nameLower);
    if (!ACCEPT.includes(f.type) && !extOk) {
      alert("Formato de imagem não aceito. Escolha uma foto JPG, PNG, WEBP ou HEIC.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      alert(`A imagem excede o limite permitido (${MAX_MB} MB). Escolha outra foto ou reduza o tamanho.`);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setRemoved(false);
    onFileChange(f);
  }

  function remove() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (currentPath) {
      setRemoved(true);
      onRemoveExisting?.();
    }
    onFileChange(null);
  }

  const showUrl = preview ?? signedUrl ?? null;
  const dim = size === "lg" ? "h-40 w-40" : "h-28 w-28";

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`relative ${dim} rounded-2xl overflow-hidden border-2 border-dashed border-primary/30 bg-muted/30 flex items-center justify-center`}
      >
        {showUrl ? (
          <img src={showUrl} alt="Foto do pet" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <PawPrint className="h-10 w-10" />
            <span className="text-[10px] uppercase tracking-wider">Sem foto</span>
          </div>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      <input
        ref={camInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => camInput.current?.click()} className="gap-1">
          <Camera className="h-3.5 w-3.5" /> Tirar foto
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} className="gap-1">
          {showUrl ? <RefreshCw className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
          {showUrl ? "Substituir" : "Da galeria"}
        </Button>
        {(showUrl || file) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={remove}
            className="gap-1 text-destructive hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" /> Remover
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground text-center">JPG, PNG, WEBP ou HEIC · até {MAX_MB} MB</p>
    </div>
  );
}
