import { z } from "zod";

/**
 * Contratos Zod Rigorosos e Tipagens Padronizadas da Jessi IA V2 (Seção 11)
 * Desenvolvido pelo Agente 1 (Arquitetura e Preservação)
 */

// --- Tipos de Cards Visuais ---
export const JessiV2CardTypeSchema = z.enum([
  "agenda",
  "cliente",
  "pet",
  "financeiro",
  "programa",
  "comprovante",
  "confirmacao",
  "alerta",
  "comparativo",
  "proativo",
]);

export type JessiV2CardType = z.infer<typeof JessiV2CardTypeSchema>;

export const JessiV2CardSchema = z.object({
  type: JessiV2CardTypeSchema,
  title: z.string().optional(),
  subtitle: z.string().optional(),
  data: z.any(),
});

export type JessiV2Card = z.infer<typeof JessiV2CardSchema>;

// --- Ação Pendente para Autonomia Supervisionada ---
export const JessiV2PendingActionSchema = z.object({
  id: z.string(),
  type: z.string(),
  tool: z.string(),
  title: z.string(),
  summary: z.string(),
  riskLevel: z.enum(["baixo", "medio", "alto"]).default("medio"),
  params: z.record(z.any()),
  beforeState: z.any().optional().nullable(),
  created_at: z.string(),
  expires_at: z.string(),
});

export type JessiV2PendingAction = z.infer<typeof JessiV2PendingActionSchema>;

// --- Mensagens do Chat V2 ---
export const JessiV2MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.string(),
  cards: z.array(JessiV2CardSchema).optional().default([]),
  pendingAction: JessiV2PendingActionSchema.optional().nullable(),
  intent: z.record(z.any()).optional().nullable(),
  correlationId: z.string().optional(),
});

export type JessiV2Message = z.infer<typeof JessiV2MessageSchema>;

// --- Contrato Oficial de Consulta / Leitura (Seção 11) ---
export const JessiV2QueryResultSchema = z.object({
  success: z.boolean(),
  data: z.any(),
  source: z.string(),
  filters_applied: z.record(z.any()).optional().nullable(),
  executed_at: z.string(),
  error_code: z.string().optional().nullable(),
  correlation_id: z.string().optional(),
  summary: z.string().optional(),
  total_count: z.number().optional(),
});

export type JessiV2QueryResult<T = any> = z.infer<typeof JessiV2QueryResultSchema> & {
  data: T;
};

// --- Contrato Oficial de Ação / Mutação Supervisionada (Seção 11) ---
export const JessiV2MutationResultSchema = z.object({
  success: z.boolean(),
  entity_id: z.string().optional().nullable(),
  affected_record_id: z.string().optional().nullable(), // Alias para retrocompatibilidade
  before: z.any().optional().nullable(),
  after: z.any().optional().nullable(),
  idempotency_key: z.string().optional(),
  source: z.string().optional(),
  verified: z.boolean().default(true), // Read-Back Verification
  error_code: z.string().optional().nullable(),
  correlation_id: z.string().optional(),
  summary: z.string().optional(),
  executed_at: z.string(),
});

export type JessiV2MutationResult<T = any> = z.infer<typeof JessiV2MutationResultSchema> & {
  before?: T;
  after?: T;
};

// --- Intenção Classificada pelo NLU ---
export const JessiV2IntentSchema = z.object({
  dominio: z.enum([
    "agenda",
    "clientes_pets",
    "programas_creditos",
    "financeiro_relatorios",
    "comunicacao_mensagens",
    "geral_conversacional",
    "confirmacao_operacao",
    "desconhecido",
  ]),
  intencao: z.string(),
  confianca: z.number().min(0).max(1),
  entidades: z.object({
    clienteNome: z.string().optional().nullable(),
    clienteId: z.string().optional().nullable(),
    petNome: z.string().optional().nullable(),
    petId: z.string().optional().nullable(),
    data: z.string().optional().nullable(),
    hora: z.string().optional().nullable(),
    servicoNome: z.string().optional().nullable(),
    servicoId: z.string().optional().nullable(),
    valor: z.number().optional().nullable(),
    profissionalId: z.string().optional().nullable(),
    termoBusca: z.string().optional().nullable(),
    periodo: z.enum(["hoje", "amanha", "semana", "mes", "personalizado"]).optional().nullable(),
  }),
  requerConfirmacao: z.boolean(),
  ferramentaSugerida: z.string().optional().nullable(),
  explicacaoRaciocinio: z.string().optional(),
});

export type JessiV2Intent = z.infer<typeof JessiV2IntentSchema>;

// --- Entrada e Saída do Orquestrador V2 ---
export interface JessiV2ProcessInput {
  mensagem: string;
  contexto?: Record<string, any>;
  historico?: JessiV2Message[];
  confirmacaoAcaoPendenteId?: string | null;
  dadosConfirmacao?: {
    tool: string;
    params: Record<string, any>;
  } | null;
  correlationId?: string;
}

export interface JessiV2ProcessOutput {
  versao: "v2" | "v1_fallback";
  respostaTexto: string;
  cards: JessiV2Card[];
  pendingAction?: JessiV2PendingAction | null;
  novoContexto?: Record<string, any>;
  intencao?: JessiV2Intent;
  tempoProcessamentoMs: number;
  correlationId: string;
  fallbackAcionado?: boolean;
}
