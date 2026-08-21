import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type FilaItemDTO = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  pet_nome: string | null;
  saldo: number;
  dias_atraso: number;
  prioridade: "critica" | "alta" | "media" | "baixa";
  prioridade_justificativa: string | null;
  status: string;
  tentativas: number;
  ultima_resposta_em: string | null;
  score: number;
};

export const filaPriorizada = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("cobrancas")
      .select(`
        id, cliente_id, saldo, vencimento, status, tentativas,
        prioridade, prioridade_justificativa, promessas_quebradas,
        ultima_resposta_em,
        clientes:cliente_id ( nome ),
        atendimentos:atendimento_id ( pets:pet_id ( nome ) )
      `)
      .is("arquivada_em", null)
      .not("status", "eq", "pago")
      .gt("saldo", 0);

    if (error) throw error;

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);

    const itens = (rows ?? []).map((r: any) => {
      const v = new Date(r.vencimento + (r.vencimento.includes('T') ? '' : 'T00:00:00Z')).getTime();
      const dias = Math.max(0, Math.floor((hoje.getTime() - v) / 86400000));
      
      let score = 0;
      score += Math.min(40, dias * 2);
      score += Math.min(30, (Number(r.saldo) / 100) * 5);
      score += (r.promessas_quebradas ?? 0) * 20;
      
      if (r.status === "sem_retorno") score += 10;
      
      let prio = r.prioridade || "media";
      if (score > 80) prio = "critica";
      else if (score > 50) prio = "alta";
      else if (score > 20) prio = "media";
      else prio = "baixa";

      return {
        id: r.id,
        cliente_id: r.cliente_id,
        cliente_nome: r.clientes?.nome ?? "—",
        pet_nome: r.atendimentos?.pets?.nome ?? null,
        saldo: Number(r.saldo),
        dias_atraso: dias,
        prioridade: prio,
        prioridade_justificativa: r.prioridade_justificativa || `Score: ${Math.round(score)}`,
        status: r.status,
        tentativas: r.tentativas ?? 0,
        ultima_resposta_em: r.ultima_resposta_em,
        score: Math.min(100, Math.round(score))
      } as FilaItemDTO;
    });

    return itens.sort((a, b) => b.score - a.score);
  });

export const registrarPromessaAvancada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    cobrancaId: z.string().uuid(),
    valor: z.number().positive(),
    dataPrometida: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    observacao: z.string().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error: eProm } = await supabase
      .from("cobranca_promessas")
      .insert({
        cobranca_id: data.cobrancaId,
        valor: data.valor,
        data_prometida: data.dataPrometida,
        observacao: data.observacao,
        responsavel_id: userId,
        status: 'aguardando'
      });
    
    if (eProm) throw eProm;

    const { error: eUpd } = await supabase
      .from("cobrancas")
      .update({
        status: 'promessa',
        promessa_data: data.dataPrometida
      })
      .eq("id", data.cobrancaId);
    
    if (eUpd) throw eUpd;

    return { ok: true };
  });

export const obterDossieCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cobrancaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [cobRes, histRes, promRes] = await Promise.all([
      supabase.from("cobrancas").select(`
        *,
        clientes:cliente_id ( * ),
        atendimentos:atendimento_id ( *, pets:pet_id ( * ) )
      `).eq("id", data.cobrancaId).single(),
      supabase.from("cobrancas_eventos").select("*").eq("cobranca_id", data.cobrancaId).order("created_at", { ascending: false }),
      supabase.from("cobranca_promessas").select("*").eq("cobranca_id", data.cobrancaId).order("created_at", { ascending: false })
    ]);

    if (cobRes.error) throw cobRes.error;

    return {
      cobranca: cobRes.data,
      historico: histRes.data ?? [],
      promessas: promRes.data ?? []
    };
  });
