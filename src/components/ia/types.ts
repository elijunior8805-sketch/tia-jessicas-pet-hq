import { IAMessage, IAIntent } from "@/lib/ia/ia-agente.server";

export type IAStatus =
  | "idle"
  | "interpretando"
  | "pesquisando"
  | "aguardando_informacao"
  | "validando"
  | "aguardando_confirmacao"
  | "executando"
  | "verificando"
  | "concluido"
  | "cancelado"
  | "erro";

export interface AssistenteIaSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface IAResults {
  clientes: any[];
  pets: any[];
}
