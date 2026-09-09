import { z } from "zod";

/**
 * Contratos e Tipagens Padronizadas para a Jessi
 */

export const JessiQueryResultSchema = z.object({
  success: z.boolean(),
  source: z.string(),
  data: z.any(),
  summary: z.string().optional(),
  filters_applied: z.record(z.any()).optional(),
  total_count: z.number().optional(),
  executed_at: z.string(),
  error_code: z.string().optional().nullable(),
  correlation_id: z.string().optional(),
});

export type JessiQueryResult<T = any> = z.infer<typeof JessiQueryResultSchema> & {
  data: T;
};

export const JessiMutationResultSchema = z.object({
  success: z.boolean(),
  source: z.string(),
  affected_record_id: z.string().optional().nullable(),
  before: z.any().optional().nullable(),
  after: z.any().optional().nullable(),
  summary: z.string().optional(),
  executed_at: z.string(),
  verified: z.boolean().default(true),
  idempotency_key: z.string().optional(),
  error_code: z.string().optional().nullable(),
});

export type JessiMutationResult<T = any> = z.infer<typeof JessiMutationResultSchema> & {
  after?: T;
  before?: T;
};

export interface JessiPendingAction {
  id: string;
  type: string;
  tool: string;
  title: string;
  summary: string;
  params: Record<string, any>;
  beforeState?: any;
  created_at: string;
  expires_at: string;
}

export interface JessiMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  cards?: Array<{
    type: "agenda" | "cliente" | "financeiro" | "programa" | "comprovante" | "confirmacao" | "alerta";
    data: any;
  }>;
  pendingAction?: JessiPendingAction | null;
  intent?: any;
}

export interface BlocoHoje {
  totalAgendamentos: number;
  proximoAtendimento?: {
    hora: string;
    pet: string;
    tutor: string;
    servico: string;
  } | null;
  emAtendimento: number;
  concluidos: number;
  levaTrazCount: number;
  faturamentoPrevisto: number;
  horariosLivres: string[];
}

export interface BlocoAmanha {
  totalAgendamentos: number;
  primeiroHorario?: string | null;
  levaTrazCount: number;
  naoConfirmados: number;
  horariosDisponiveisCount: number;
}

export interface ItemAtencao {
  id: string;
  tipo: "urgente" | "aviso" | "info";
  titulo: string;
  descricao: string;
  acaoSugerida: string;
  comando: string;
}

export interface ItemOportunidade {
  id: string;
  titulo: string;
  descricao: string;
  acaoSugerida: string;
  comando: string;
}

export interface JessiProactiveCentral {
  saudacaoPersonalizada: string;
  dataReferencia: string;
  proprietarioNome: string;
  hoje: BlocoHoje;
  amanha: BlocoAmanha;
  precisaAtencao: ItemAtencao[];
  oportunidades: ItemOportunidade[];
}
