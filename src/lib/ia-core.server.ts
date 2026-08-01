/**
 * Núcleo centralizado de IA — Spa de Pet Tia Jéssica.
 *
 * Todos os pontos do sistema que chamam IA passam por aqui.
 * Responsabilidades:
 *  - ler a configuração (modelo principal / alternativo, criatividade, limites);
 *  - timeout e número máximo de tentativas;
 *  - fallback automático para o modelo alternativo;
 *  - saída estruturada validada por schema;
 *  - erros legíveis em português;
 *  - registro do modelo efetivamente utilizado.
 *
 * Este arquivo é server-only (sufixo .server.ts).
 */
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type IaConfig = {
  ia_ativa: boolean;
  provedor: string;
  modelo_principal: string;
  modelo_alternativo: string;
  criatividade: number;
  limite_caracteres: number;
  timeout_ms: number;
  max_tentativas_ia: number;
  horario_inicio: string;
  horario_fim: string;
  intervalo_min_horas: number;
  max_tentativas_contato: number;
  instrucoes_empresa: string;
  assinatura: string;
  pix_chave: string | null;
  link_pagamento: string | null;
  palavras_proibidas: string[];
  permitir_mencao_juridica: boolean;
};

export const IA_CONFIG_PADRAO: IaConfig = {
  ia_ativa: true,
  provedor: "lovable",
  modelo_principal: "google/gemini-3.6-flash",
  modelo_alternativo: "google/gemini-3.1-flash-lite",
  criatividade: 0.6,
  limite_caracteres: 600,
  timeout_ms: 25000,
  max_tentativas_ia: 2,
  horario_inicio: "08:00",
  horario_fim: "20:00",
  intervalo_min_horas: 24,
  max_tentativas_contato: 4,
  instrucoes_empresa: "",
  assinatura: "",
  pix_chave: null,
  link_pagamento: null,
  palavras_proibidas: [
    "inadimplente",
    "devedor",
    "caloteiro",
    "protesto",
    "negativação",
    "judicial",
    "serasa",
    "spc",
  ],
  permitir_mencao_juridica: false,
};

/** Lê a configuração da IA usando qualquer client Supabase já autenticado. */
export async function carregarIaConfig(sb: any): Promise<IaConfig> {
  try {
    const { data } = await sb.from("ia_config").select("*").maybeSingle();
    if (!data) return IA_CONFIG_PADRAO;
    return {
      ...IA_CONFIG_PADRAO,
      ...data,
      palavras_proibidas: Array.isArray(data.palavras_proibidas)
        ? data.palavras_proibidas
        : IA_CONFIG_PADRAO.palavras_proibidas,
    } as IaConfig;
  } catch {
    return IA_CONFIG_PADRAO;
  }
}

export class IaIndisponivelError extends Error {
  readonly codigo: string;
  constructor(message: string, codigo = "ia_indisponivel") {
    super(message);
    this.name = "IaIndisponivelError";
    this.codigo = codigo;
  }
}

type ChamadaParams = {
  system: string;
  prompt: string;
  config: IaConfig;
  /** Força resposta em JSON. */
  json?: boolean;
  /** Sobrescreve a criatividade da config. */
  temperatura?: number;
  /** Rótulo do fluxo que originou a chamada (métricas). */
  origem?: string;
  /** Client Supabase autenticado, usado para registrar a métrica. */
  sb?: any;
};

/** Registra a métrica da chamada de IA sem nunca quebrar o fluxo principal. */
export async function registrarMetricaIa(
  sb: any,
  m: {
    origem: string;
    modelo?: string | null;
    usouFallback?: boolean;
    sucesso: boolean;
    codigoErro?: string | null;
    duracaoMs?: number | null;
    tokens?: number | null;
  },
): Promise<void> {
  if (!sb) return;
  try {
    await sb.from("ia_metricas").insert({
      origem: m.origem,
      modelo: m.modelo ?? null,
      usou_fallback: !!m.usouFallback,
      sucesso: m.sucesso,
      codigo_erro: m.codigoErro ?? null,
      duracao_ms: m.duracaoMs ?? null,
      tokens: m.tokens ?? null,
    });
  } catch {
    /* métricas nunca podem derrubar a geração */
  }
}


type ChamadaResultado = {
  texto: string;
  modelo: string;
  usouFallback: boolean;
  tokens: number | null;
};

async function chamadaUnica(
  modelo: string,
  p: ChamadaParams,
  apiKey: string,
): Promise<ChamadaResultado> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, p.config.timeout_ms));

  try {
    const body: Record<string, unknown> = {
      model: modelo,
      temperature: p.temperatura ?? p.config.criatividade,
      messages: [
        { role: "system", content: p.system },
        { role: "user", content: p.prompt },
      ],
    };
    if (p.json) body["response_format"] = { type: "json_object" };

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 429)
      throw new IaIndisponivelError(
        "Limite de uso da IA atingido. Aguarde alguns instantes e tente novamente.",
        "rate_limit",
      );
    if (res.status === 402)
      throw new IaIndisponivelError(
        "Os créditos de IA do workspace acabaram. Recarregue para voltar a gerar mensagens.",
        "sem_creditos",
      );
    if (!res.ok) {
      const t = await res.text();
      throw new IaIndisponivelError(
        `A IA respondeu com erro (${res.status}). ${t.slice(0, 160)}`,
        "erro_gateway",
      );
    }

    const json: any = await res.json();
    const texto: string = json?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!texto) throw new IaIndisponivelError("A IA não retornou nenhum texto.", "resposta_vazia");

    return {
      texto,
      modelo,
      usouFallback: false,
      tokens: json?.usage?.total_tokens ?? null,
    };
  } catch (e: any) {
    if (e?.name === "AbortError")
      throw new IaIndisponivelError(
        "A IA demorou demais para responder. Tente novamente ou use um template manual.",
        "timeout",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chamada resiliente: tenta o modelo principal (com retentativas para falhas
 * transitórias) e cai para o modelo alternativo quando necessário.
 */
export async function chamarIA(p: ChamadaParams): Promise<ChamadaResultado> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey)
    throw new IaIndisponivelError(
      "A integração de IA não está configurada neste projeto.",
      "sem_chave",
    );
  if (!p.config.ia_ativa)
    throw new IaIndisponivelError(
      "As sugestões da IA estão desativadas nas configurações. Use um template manual.",
      "ia_desativada",
    );

  const tentativas = Math.max(1, Math.min(3, p.config.max_tentativas_ia));
  let ultimo: unknown;

  for (let i = 0; i < tentativas; i++) {
    try {
      return await chamadaUnica(p.config.modelo_principal, p, apiKey);
    } catch (e: any) {
      ultimo = e;
      const codigo = e?.codigo;
      // Erros terminais não devem ser repetidos no mesmo modelo.
      if (codigo === "sem_creditos" || codigo === "sem_chave") throw e;
      if (i < tentativas - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }

  // Fallback para o modelo alternativo.
  if (
    p.config.modelo_alternativo &&
    p.config.modelo_alternativo !== p.config.modelo_principal
  ) {
    try {
      const r = await chamadaUnica(p.config.modelo_alternativo, p, apiKey);
      return { ...r, usouFallback: true };
    } catch {
      /* cai para o erro original */
    }
  }

  throw ultimo instanceof Error
    ? ultimo
    : new IaIndisponivelError("A IA está indisponível no momento.");
}

/* ============================================================
 * Resposta estruturada
 * ============================================================ */
export const RespostaIaSchema = z.object({
  tipo_comunicacao: z.string().default("cobranca"),
  tom_sugerido: z.string().default("cordial"),
  nivel_firmeza: z.coerce.number().int().min(1).max(5).default(2),
  mensagem: z.string().min(1),
  motivo_do_tom: z.string().default(""),
  prioridade: z.enum(["baixa", "normal", "alta", "urgente"]).catch("normal").default("normal"),
  risco_comunicacao: z.enum(["baixo", "medio", "alto"]).catch("baixo").default("baixo"),
  requer_revisao_humana: z.boolean().default(true),
  incluir_pix: z.boolean().default(false),
  incluir_link_pagamento: z.boolean().default(false),
  proxima_acao: z.string().default("Aguardar resposta"),
  prazo_proxima_acao_horas: z.coerce.number().int().min(1).max(720).default(48),
});
export type RespostaIa = z.infer<typeof RespostaIaSchema>;

function extrairJson(texto: string): unknown {
  const limpo = texto
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(limpo);
  } catch {
    const i = limpo.indexOf("{");
    const f = limpo.lastIndexOf("}");
    if (i >= 0 && f > i) {
      try {
        return JSON.parse(limpo.slice(i, f + 1));
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}

/** Chama a IA exigindo o contrato estruturado e valida antes de devolver. */
export async function chamarIAEstruturada(
  p: ChamadaParams,
): Promise<RespostaIa & { modelo: string; usouFallback: boolean; tokens: number | null }> {
  const r = await chamarIA({ ...p, json: true });
  const bruto = extrairJson(r.texto);
  if (!bruto)
    throw new IaIndisponivelError(
      "A IA devolveu um formato inesperado. Tente gerar novamente.",
      "formato_invalido",
    );

  const parsed = RespostaIaSchema.safeParse(bruto);
  if (!parsed.success)
    throw new IaIndisponivelError(
      "A resposta da IA não passou na validação de segurança. Nenhuma mensagem foi exibida.",
      "validacao_falhou",
    );

  // Sanitização final: revisão humana é sempre obrigatória neste sistema.
  const dados: RespostaIa = { ...parsed.data, requer_revisao_humana: true };

  // Corta pelo limite configurado, sem truncar no meio de uma palavra.
  if (dados.mensagem.length > p.config.limite_caracteres) {
    const corte = dados.mensagem.slice(0, p.config.limite_caracteres);
    dados.mensagem = corte.slice(0, corte.lastIndexOf(" ") > 0 ? corte.lastIndexOf(" ") : corte.length).trim();
  }

  return { ...dados, modelo: r.modelo, usouFallback: r.usouFallback, tokens: r.tokens };
}

/** Chama a IA esperando apenas texto puro (mantém compatibilidade com o legado). */
export async function chamarIATexto(p: ChamadaParams): Promise<ChamadaResultado> {
  const r = await chamarIA(p);
  const texto = r.texto
    .replace(/^```(?:\w+)?/i, "")
    .replace(/```$/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  return { ...r, texto };
}

/* ============================================================
 * Guarda de segurança das mensagens
 * ============================================================ */
export function verificarPalavrasProibidas(
  texto: string,
  config: IaConfig,
): { ok: boolean; encontradas: string[] } {
  const alvo = texto.toLowerCase();
  const encontradas = (config.palavras_proibidas ?? []).filter((p) =>
    p && alvo.includes(String(p).toLowerCase()),
  );
  return { ok: encontradas.length === 0, encontradas };
}

/** Verifica se o horário atual (America/Sao_Paulo) está na janela permitida. */
export function dentroDoHorarioPermitido(config: IaConfig, agora = new Date()): boolean {
  const hhmm = agora.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return hhmm >= config.horario_inicio.slice(0, 5) && hhmm <= config.horario_fim.slice(0, 5);
}

/* ============================================================
 * Regras de tom
 * ============================================================ */
export type RegraTom = {
  id: string;
  ordem: number;
  nome: string;
  condicao: string;
  dias_min: number | null;
  dias_max: number | null;
  tom: string;
  nivel_firmeza: number;
  bloquear_ia: boolean;
  ativo: boolean;
  observacao: string | null;
};

export async function carregarRegrasTom(sb: any): Promise<RegraTom[]> {
  const { data } = await sb
    .from("ia_regras_tom")
    .select("*")
    .eq("ativo", true)
    .order("ordem");
  return (data ?? []) as RegraTom[];
}

export type ContextoTom = {
  diasAtraso: number;
  promessaProxima?: boolean;
  promessaVencida?: boolean;
  tentativas?: number;
  maxTentativas?: number;
  clienteIrritado?: boolean;
  dificuldadeFinanceira?: boolean;
  bomHistorico?: boolean;
};

/** Aplica as regras configuráveis e devolve tom, firmeza e justificativa. */
export function sugerirTom(
  regras: RegraTom[],
  ctx: ContextoTom,
): { tom: string; firmeza: number; motivo: string; bloquearIa: boolean } {
  const acha = (cond: string) => regras.find((r) => r.condicao === cond);

  if (ctx.clienteIrritado) {
    const r = acha("irritado");
    if (r)
      return {
        tom: r.tom,
        firmeza: r.nivel_firmeza,
        motivo: "Cliente demonstrou irritação — atendimento humano recomendado.",
        bloquearIa: r.bloquear_ia,
      };
  }
  if (ctx.tentativas != null && ctx.maxTentativas != null && ctx.tentativas >= ctx.maxTentativas) {
    const r = acha("sem_resposta");
    if (r)
      return {
        tom: r.tom,
        firmeza: r.nivel_firmeza,
        motivo: `${ctx.tentativas} tentativas sem resposta — encaminhar para revisão humana.`,
        bloquearIa: r.bloquear_ia,
      };
  }
  if (ctx.dificuldadeFinanceira) {
    const r = acha("dificuldade");
    if (r)
      return {
        tom: r.tom,
        firmeza: r.nivel_firmeza,
        motivo: "Cliente relatou dificuldade financeira.",
        bloquearIa: r.bloquear_ia,
      };
  }
  if (ctx.promessaVencida) {
    const r = acha("promessa_vencida");
    if (r)
      return {
        tom: r.tom,
        firmeza: r.nivel_firmeza,
        motivo: "Promessa de pagamento vencida.",
        bloquearIa: r.bloquear_ia,
      };
  }
  if (ctx.promessaProxima) {
    const r = acha("promessa_proxima");
    if (r)
      return {
        tom: r.tom,
        firmeza: r.nivel_firmeza,
        motivo: "Promessa de pagamento próxima do vencimento.",
        bloquearIa: r.bloquear_ia,
      };
  }
  if (ctx.bomHistorico && ctx.diasAtraso <= 7) {
    const r = acha("bom_historico");
    if (r)
      return {
        tom: r.tom,
        firmeza: r.nivel_firmeza,
        motivo: "Cliente antigo com bom histórico — preservar relacionamento.",
        bloquearIa: r.bloquear_ia,
      };
  }

  const faixa = regras
    .filter((r) => r.condicao === "atraso")
    .find(
      (r) =>
        ctx.diasAtraso >= (r.dias_min ?? -99999) && ctx.diasAtraso <= (r.dias_max ?? 99999),
    );
  if (faixa)
    return {
      tom: faixa.tom,
      firmeza: faixa.nivel_firmeza,
      motivo:
        ctx.diasAtraso < 0
          ? `Faltam ${Math.abs(ctx.diasAtraso)} dia(s) para o vencimento.`
          : ctx.diasAtraso === 0
            ? "Vence hoje."
            : `${ctx.diasAtraso} dia(s) de atraso.`,
      bloquearIa: faixa.bloquear_ia,
    };

  return { tom: "cordial", firmeza: 2, motivo: "Situação padrão.", bloquearIa: false };
}

/* ============================================================
 * Motor de prioridade da fila
 * ============================================================ */
export type PrioridadeLabel = "baixa" | "normal" | "alta" | "urgente";

export type ContextoPrioridade = {
  diasAtraso?: number;
  valorPendente?: number;
  tentativas?: number;
  promessaVencida?: boolean;
  semResposta?: boolean;
  horasAteAtendimento?: number;
  riscoPerda?: boolean;
};

/** Pontua de 0 a 100 e converte em rótulo de prioridade. */
export function calcularPrioridade(ctx: ContextoPrioridade): {
  score: number;
  label: PrioridadeLabel;
} {
  let s = 20;

  const d = ctx.diasAtraso ?? 0;
  if (d > 0) s += Math.min(30, d * 2);
  if (ctx.valorPendente) s += Math.min(20, Math.floor(ctx.valorPendente / 50) * 2);
  if (ctx.tentativas) s += Math.min(12, ctx.tentativas * 4);
  if (ctx.promessaVencida) s += 18;
  if (ctx.semResposta) s += 10;
  if (ctx.riscoPerda) s += 12;
  if (ctx.horasAteAtendimento != null && ctx.horasAteAtendimento <= 24)
    s += ctx.horasAteAtendimento <= 6 ? 25 : 15;

  const score = Math.max(0, Math.min(100, Math.round(s)));
  const label: PrioridadeLabel =
    score >= 80 ? "urgente" : score >= 60 ? "alta" : score >= 35 ? "normal" : "baixa";
  return { score, label };
}
