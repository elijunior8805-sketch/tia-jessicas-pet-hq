import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type FaseLiberacao = "observacao" | "teste_controlado" | "piloto" | "producao";

export interface EventoIA {
  command_id?: string;
  correlation_id?: string;
  session_id?: string;
  idempotency_key?: string;
  user_id?: string;
  comando_original: string;
  intencao_detectada?: string;
  especialista?: string;
  ferramenta_utilizada?: string;
  tipo_operacao?: string;
  parametros?: any;
  resposta_ia?: string;
  resultado?: any;
  sucesso?: boolean;
  erro?: string;
  erro_tipo?: string;
  retry_count?: number;
  confirmado?: boolean;
  registro_afetado_id?: string;
  duplicidade_bloqueada?: boolean;
  intencao_incorreta?: boolean;
  correcao_humana?: boolean;
  fase_liberacao?: string;
  simulado?: boolean;
  tempo_resposta_ms?: number;
}

/** Registra um evento completo do ciclo da Assistente IA. Nunca lança erro. */
export async function registrarEventoIA(evento: EventoIA) {
  try {
    const { error } = await supabaseAdmin
      .from("auditoria_ia" as any)
      .insert([evento as any]);
    if (error) console.error("[IA][observabilidade] falha ao registrar evento:", error.message);
  } catch (e) {
    console.error("[IA][observabilidade] exceção ao registrar evento:", e);
  }
}

export async function getFaseLiberacaoIA(): Promise<FaseLiberacao> {
  const { data, error } = await supabaseAdmin
    .from("ia_liberacao" as any)
    .select("fase")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return "observacao";
  return ((data as any).fase as FaseLiberacao) || "observacao";
}

export async function setFaseLiberacaoIA(fase: FaseLiberacao, userId?: string) {
  const { data: existente } = await supabaseAdmin
    .from("ia_liberacao" as any)
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existente) {
    const { error } = await supabaseAdmin
      .from("ia_liberacao" as any)
      .update({ fase, atualizado_por: userId ?? null, updated_at: new Date().toISOString() } as any)
      .eq("id", (existente as any).id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from("ia_liberacao" as any)
      .insert([{ fase, atualizado_por: userId ?? null } as any]);
    if (error) throw error;
  }
  return { fase };
}

/** Painel técnico de qualidade da Assistente IA. */
export async function getPainelQualidadeIA(dias = 7) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("auditoria_ia" as any)
    .select("*")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) throw error;

  const linhas = (data as any[]) || [];
  const total = linhas.length;
  const sucessos = linhas.filter((l) => l.sucesso).length;
  const erros = linhas.filter((l) => l.sucesso === false).length;
  const timeouts = linhas.filter(
    (l) => l.erro_tipo === "timeout" || (l.erro || "").toLowerCase().includes("timeout"),
  ).length;
  const duplicidades = linhas.filter((l) => l.duplicidade_bloqueada).length;
  const intencoesIncorretas = linhas.filter((l) => l.intencao_incorreta).length;
  const correcoesHumanas = linhas.filter((l) => l.correcao_humana).length;
  const acoes = linhas.filter((l) => l.tipo_operacao === "acao");
  const acoesComRegistro = acoes.filter((l) => !!l.registro_afetado_id || l.simulado);
  const tempoMedio =
    total > 0 ? linhas.reduce((a, l) => a + (l.tempo_resposta_ms || 0), 0) / total : 0;

  const porFerramenta = new Map<string, { total: number; erros: number }>();
  for (const l of linhas) {
    const k = l.ferramenta_utilizada || l.intencao_detectada || "nao_classificado";
    const cur = porFerramenta.get(k) || { total: 0, erros: 0 };
    cur.total += 1;
    if (l.sucesso === false) cur.erros += 1;
    porFerramenta.set(k, cur);
  }

  return {
    periodo_dias: dias,
    total_comandos: total,
    sucessos,
    erros,
    timeouts,
    duplicidades_bloqueadas: duplicidades,
    intencoes_incorretas: intencoesIncorretas,
    correcoes_humanas: correcoesHumanas,
    tempo_medio_ms: Math.round(tempoMedio),
    taxa_sucesso: total > 0 ? (sucessos / total) * 100 : 100,
    acerto_intencao: total > 0 ? ((total - intencoesIncorretas) / total) * 100 : 100,
    acoes_total: acoes.length,
    acoes_rastreadas_pct:
      acoes.length > 0 ? (acoesComRegistro.length / acoes.length) * 100 : 100,
    por_ferramenta: [...porFerramenta.entries()]
      .map(([ferramenta, v]) => ({ ferramenta, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15),
    ultimos: linhas.slice(0, 50),
  };
}

/** Marca um comando como intenção incorreta / corrigido por humano. */
export async function marcarCorrecaoHumanaIA(command_id: string, intencao_incorreta: boolean) {
  const { error } = await supabaseAdmin
    .from("auditoria_ia" as any)
    .update({ correcao_humana: true, intencao_incorreta } as any)
    .eq("command_id", command_id);
  if (error) throw error;
  return { ok: true };
}
