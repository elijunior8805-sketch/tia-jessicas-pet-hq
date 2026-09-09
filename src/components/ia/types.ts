import { IAMessage, IAIntent } from "@/lib/ia/jessi-contracts";

export type IAStatus =
  | "idle"
  | "requesting_permission"
  | "listening"
  | "reviewing_transcription"
  | "ready_to_send"
  | "sending"
  | "processing"
  | "interpretando"
  | "pesquisando"
  | "aguardando_informacao"
  | "aguardando_confirmacao"
  | "executando"
  | "verificando"
  | "concluido"
  | "cancelado"
  | "error";

export interface AssistenteIaSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface IAResults {
  clientes: any[];
  pets: any[];
}
