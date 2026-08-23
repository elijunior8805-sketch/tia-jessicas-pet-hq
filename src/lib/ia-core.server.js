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
import { sanitizarPromptFinal } from "./ia-seguranca.server";
import { chaveCacheIa, gravarCacheIa, lerCacheIa } from "./ia-cache.server";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const IA_CONFIG_PADRAO = {
    ia_ativa: true,
    provedor: "lovable",
    modelo_principal: "google/gemini-1.5-flash",
    modelo_alternativo: "google/gemini-1.5-flash",
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
export async function carregarIaConfig(sb) {
    try {
        const { data } = await sb.from("ia_config").select("*").maybeSingle();
        if (!data)
            return IA_CONFIG_PADRAO;
        return {
            ...IA_CONFIG_PADRAO,
            ...data,
            palavras_proibidas: Array.isArray(data.palavras_proibidas)
                ? data.palavras_proibidas
                : IA_CONFIG_PADRAO.palavras_proibidas,
        };
    }
    catch {
        return IA_CONFIG_PADRAO;
    }
}
export class IaIndisponivelError extends Error {
    codigo;
    constructor(message, codigo = "ia_indisponivel") {
        super(message);
        this.name = "IaIndisponivelError";
        this.codigo = codigo;
    }
}
/** Registra a métrica da chamada de IA sem nunca quebrar o fluxo principal. */
export async function registrarMetricaIa(sb, m) {
    if (!sb)
        return;
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
    }
    catch {
        /* métricas nunca podem derrubar a geração */
    }
}
async function chamadaUnica(modelo, p, apiKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(5000, p.config.timeout_ms));
    try {
        const body = {
            model: modelo,
            temperature: p.temperatura ?? p.config.criatividade,
            messages: [
                { role: "system", content: p.system },
                { role: "user", content: p.extraContent ? [
                        { type: "text", text: sanitizarPromptFinal(p.prompt) },
                        ...p.extraContent
                    ] : sanitizarPromptFinal(p.prompt) },
            ],
        };
        if (p.json)
            body["response_format"] = { type: "json_object" };
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
            throw new IaIndisponivelError("Limite de uso da IA atingido. Aguarde alguns instantes e tente novamente.", "rate_limit");
        if (res.status === 402)
            throw new IaIndisponivelError("Os créditos de IA do workspace acabaram. Recarregue para voltar a gerar mensagens.", "sem_creditos");
        if (!res.ok) {
            const t = await res.text();
            throw new IaIndisponivelError(`A IA respondeu com erro (${res.status}). ${t.slice(0, 160)}`, "erro_gateway");
        }
        const json = await res.json();
        const texto = json?.choices?.[0]?.message?.content?.trim() ?? "";
        if (!texto)
            throw new IaIndisponivelError("A IA não retornou nenhum texto.", "resposta_vazia");
        return {
            texto,
            modelo,
            usouFallback: false,
            tokens: json?.usage?.total_tokens ?? null,
        };
    }
    catch (e) {
        if (e?.name === "AbortError")
            throw new IaIndisponivelError("A IA demorou demais para responder. Tente novamente ou use um template manual.", "timeout");
        throw e;
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Chamada resiliente com métricas: tenta o modelo principal (com retentativas
 * para falhas transitórias) e cai para o modelo alternativo quando necessário.
 */
export async function chamarIA(p) {
    const inicio = Date.now();
    const origem = p.origem ?? "desconhecida";
    const usaCache = !!p.cacheTtlMs && p.cacheTtlMs > 0;
    const chave = usaCache
        ? `ia:${origem}:${chaveCacheIa(p.config.modelo_principal, p.config.modelo_alternativo, p.temperatura ?? p.config.criatividade, p.json ? "json" : "texto", p.cacheEscopo ?? "", p.system, p.prompt)}`
        : null;
    if (chave) {
        const guardado = lerCacheIa(chave);
        if (guardado) {
            void registrarMetricaIa(p.sb, {
                origem: `${origem}:cache`,
                modelo: guardado.modelo,
                usouFallback: guardado.usouFallback,
                sucesso: true,
                duracaoMs: Date.now() - inicio,
                tokens: 0,
            });
            return { ...guardado, doCache: true };
        }
    }
    try {
        const r = await chamarIaInterno(p);
        if (chave)
            gravarCacheIa(chave, r, p.cacheTtlMs);
        void registrarMetricaIa(p.sb, {
            origem,
            modelo: r.modelo,
            usouFallback: r.usouFallback,
            sucesso: true,
            duracaoMs: Date.now() - inicio,
            tokens: r.tokens,
        });
        return r;
    }
    catch (e) {
        void registrarMetricaIa(p.sb, {
            origem,
            modelo: p.config.modelo_principal,
            sucesso: false,
            codigoErro: e?.codigo ?? "erro",
            duracaoMs: Date.now() - inicio,
        });
        throw e;
    }
}
async function chamarIaInterno(p) {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey)
        throw new IaIndisponivelError("A integração de IA não está configurada neste projeto.", "sem_chave");
    if (!p.config.ia_ativa)
        throw new IaIndisponivelError("As sugestões da IA estão desativadas nas configurações. Use um template manual.", "ia_desativada");
    const tentativas = Math.max(1, Math.min(3, p.config.max_tentativas_ia));
    let ultimo;
    for (let i = 0; i < tentativas; i++) {
        try {
            return await chamadaUnica(p.config.modelo_principal, p, apiKey);
        }
        catch (e) {
            ultimo = e;
            const codigo = e?.codigo;
            // Erros terminais não devem ser repetidos no mesmo modelo.
            if (codigo === "sem_creditos" || codigo === "sem_chave")
                throw e;
            if (i < tentativas - 1)
                await new Promise((r) => setTimeout(r, 600 * (i + 1)));
        }
    }
    // Fallback para o modelo alternativo.
    if (p.config.modelo_alternativo &&
        p.config.modelo_alternativo !== p.config.modelo_principal) {
        try {
            const r = await chamadaUnica(p.config.modelo_alternativo, p, apiKey);
            return { ...r, usouFallback: true };
        }
        catch {
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
function extrairJson(texto) {
    const limpo = texto
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
    try {
        return JSON.parse(limpo);
    }
    catch {
        const i = limpo.indexOf("{");
        const f = limpo.lastIndexOf("}");
        if (i >= 0 && f > i) {
            try {
                return JSON.parse(limpo.slice(i, f + 1));
            }
            catch {
                /* ignore */
            }
        }
        return null;
    }
}
/** Chama a IA exigindo o contrato estruturado e valida antes de devolver. */
export async function chamarIAEstruturada(p) {
    const r = await chamarIA({ ...p, json: true });
    const bruto = extrairJson(r.texto);
    if (!bruto)
        throw new IaIndisponivelError("A IA devolveu um formato inesperado. Tente gerar novamente.", "formato_invalido");
    const parsed = RespostaIaSchema.safeParse(bruto);
    if (!parsed.success)
        throw new IaIndisponivelError("A resposta da IA não passou na validação de segurança. Nenhuma mensagem foi exibida.", "validacao_falhou");
    // Sanitização final: revisão humana é sempre obrigatória neste sistema.
    const dados = { ...parsed.data, requer_revisao_humana: true };
    // Corta pelo limite configurado, sem truncar no meio de uma palavra.
    if (dados.mensagem.length > p.config.limite_caracteres) {
        const corte = dados.mensagem.slice(0, p.config.limite_caracteres);
        dados.mensagem = corte.slice(0, corte.lastIndexOf(" ") > 0 ? corte.lastIndexOf(" ") : corte.length).trim();
    }
    aplicarGuardaSaida(dados.mensagem, p);
    return { ...dados, modelo: r.modelo, usouFallback: r.usouFallback, tokens: r.tokens };
}
/**
 * Guarda central de saída: nenhum texto com palavra proibida chega à tela.
 * Vale para todos os fluxos que passam pelo núcleo.
 */
function aplicarGuardaSaida(texto, p) {
    const guard = verificarPalavrasProibidas(texto, p.config);
    if (guard.ok)
        return;
    void registrarMetricaIa(p.sb, {
        origem: p.origem ?? "desconhecida",
        sucesso: false,
        codigoErro: "conteudo_bloqueado",
    });
    throw new IaIndisponivelError(`A mensagem gerada continha termo(s) não permitido(s): ${guard.encontradas.join(", ")}. Nada foi exibido — gere novamente ou use um template manual.`, "conteudo_bloqueado");
}
/** Chama a IA esperando apenas texto puro (mantém compatibilidade com o legado). */
export async function chamarIATexto(p) {
    const r = await chamarIA(p);
    const texto = r.texto
        .replace(/^```(?:\w+)?/i, "")
        .replace(/```$/i, "")
        .replace(/^["'`]+|["'`]+$/g, "")
        .trim();
    aplicarGuardaSaida(texto, p);
    return { ...r, texto };
}
/* ============================================================
 * Guarda de segurança das mensagens
 * ============================================================ */
export function verificarPalavrasProibidas(texto, config) {
    const alvo = texto.toLowerCase();
    const encontradas = (config.palavras_proibidas ?? []).filter((p) => p && alvo.includes(String(p).toLowerCase()));
    return { ok: encontradas.length === 0, encontradas };
}
/** Verifica se o horário atual (America/Sao_Paulo) está na janela permitida. */
export function dentroDoHorarioPermitido(config, agora = new Date()) {
    const hhmm = agora.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    return hhmm >= config.horario_inicio.slice(0, 5) && hhmm <= config.horario_fim.slice(0, 5);
}
export async function carregarRegrasTom(sb) {
    const { data } = await sb
        .from("ia_regras_tom")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
    return (data ?? []);
}
/** Aplica as regras configuráveis e devolve tom, firmeza e justificativa. */
export function sugerirTom(regras, ctx) {
    const acha = (cond) => regras.find((r) => r.condicao === cond);
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
        .find((r) => ctx.diasAtraso >= (r.dias_min ?? -99999) && ctx.diasAtraso <= (r.dias_max ?? 99999));
    if (faixa)
        return {
            tom: faixa.tom,
            firmeza: faixa.nivel_firmeza,
            motivo: ctx.diasAtraso < 0
                ? `Faltam ${Math.abs(ctx.diasAtraso)} dia(s) para o vencimento.`
                : ctx.diasAtraso === 0
                    ? "Vence hoje."
                    : `${ctx.diasAtraso} dia(s) de atraso.`,
            bloquearIa: faixa.bloquear_ia,
        };
    return { tom: "cordial", firmeza: 2, motivo: "Situação padrão.", bloquearIa: false };
}
/** Pontua de 0 a 100 e converte em rótulo de prioridade. */
export function calcularPrioridade(ctx) {
    let s = 20;
    const d = ctx.diasAtraso ?? 0;
    if (d > 0)
        s += Math.min(30, d * 2);
    if (ctx.valorPendente)
        s += Math.min(20, Math.floor(ctx.valorPendente / 50) * 2);
    if (ctx.tentativas)
        s += Math.min(12, ctx.tentativas * 4);
    // Enriquecimento da prioridade (Part 1 do plano)
    if (ctx.promessaVencida)
        s += 25; // Aumentado (crítico)
    if (ctx.semResposta)
        s += 15;
    if (ctx.riscoPerda)
        s += 12;
    // Analisar silêncio prolongado
    if (ctx.semResposta && (ctx.tentativas || 0) > 1)
        s += 10;
    if (ctx.horasAteAtendimento != null && ctx.horasAteAtendimento <= 24)
        s += ctx.horasAteAtendimento <= 6 ? 25 : 15;
    const score = Math.max(0, Math.min(100, Math.round(s)));
    const label = score >= 80 ? "urgente" : score >= 60 ? "alta" : score >= 35 ? "normal" : "baixa";
    return { score, label };
}
