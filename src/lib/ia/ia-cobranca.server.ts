import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { createIAResponse } from "./ia-retorno.server";
import { differenceInDays, parseISO } from "date-fns";

/**
 * Consulta a fila de cobrança priorizada
 */
export async function consultarFilaCobrancaIA(sb: SupabaseClient<Database>) {
  const { data: pendentes, error } = await sb
    .from("pagamentos")
    .select(`
      id,
      valor_total,
      valor_pago,
      vencimento,
      cobranca_tentativas,
      cobranca_ultima_tentativa,
      clientes (id, nome, telefone),
      atendimentos (id, data, hora, pets (nome))
    `)
    .neq("status", "pago")
    .neq("status", "cancelado")
    .is("arquivado_em", null);

  if (error) throw error;

  const hoje = new Date();

  // Algoritmo de Priorização
  const filaPriorizada = (pendentes as any[]).map(p => {
    const valorPendente = Number(p.valor_total) - (p.valor_pago || 0);
    const diasAtraso = p.vencimento ? differenceInDays(hoje, parseISO(p.vencimento)) : 0;
    
    let score = (diasAtraso * 1.5) + (valorPendente / 100) - ((p.cobranca_tentativas || 0) * 2);
    
    let motivo = "";
    if (diasAtraso > 30) motivo = "Atraso crítico (>30 dias)";
    else if (valorPendente > 500) motivo = "Alto valor pendente";
    else if (p.cobranca_tentativas === 0) motivo = "Novo inadimplente";
    else motivo = "Acompanhamento de rotina";

    return { ...p, valorPendente, diasAtraso, score, motivo_prioridade: motivo };
  }).sort((a, b) => b.score - a.score);

  return createIAResponse({
    source: 'consultar_fila_cobranca',
    data: {
      total: filaPriorizada.length,
      fila: filaPriorizada.slice(0, 10)
    }
  });
}

/**
 * Gera 3 versões de mensagens de cobrança
 */
export async function gerarMensagensCobrancaIA(
  sb: SupabaseClient<Database>,
  params: { pagamento_id: string; historico_mensagens?: any[] }
) {
  const { chamarIA, carregarIaConfig } = await import("../ia-core.server");
  const config = await carregarIaConfig(sb);
  
  const { data: p } = await sb
    .from("pagamentos")
    .select(`
      valor_total,
      valor_pago,
      vencimento,
      cobranca_tentativas,
      clientes (nome, telefone),
      atendimentos (pets (nome))
    `)
    .eq("id", params.pagamento_id)
    .single();

  if (!p) throw new Error("Pagamento não localizado.");

  const valor = (Number((p as any).valor_total) - ((p as any).valor_pago || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const pet = ((p as any).atendimentos as any)?.pets?.nome || "seu pet";
  const cliente = ((p as any).clientes as any)?.nome;

  const systemPrompt = `Você é um Especialista em Recuperação de Crédito do Spa de Pet Tia Jéssica.
Sua missão é gerar TRÊS versões de mensagens de cobrança para o WhatsApp.

REGRAS GERAIS:
1. NUNCA use "medidas administrativas", "providências cabíveis" ou qualquer ameaça.
2. Seja firme, mas mantenha o profissionalismo.
3. Mencione o valor (${valor}) e o serviço do ${pet}.
4. Se houver tentativas anteriores (${(p as any).cobranca_tentativas}), suba o tom.

VERSÕES OBRIGATÓRIAS (Retorne um JSON com estas 3 chaves):
- direta: Curta, objetiva, lembrete amigável.
- firme: Mais enfática, pede posição concreta, cita vencimento.
- extra_firme: Para casos reincidentes ou sem resposta. Exige comprovante ou data exata. Informa que ignorar não resolve a pendência.`;

  const res = await chamarIA({
    system: systemPrompt,
    prompt: `Gere as mensagens para o cliente ${cliente} sobre a pendência de ${valor} do pet ${pet}.`,
    json: true,
    origem: "ia_gerar_cobranca",
    config
  });

  const mensagens = JSON.parse(res.texto);

  return createIAResponse({
    source: 'gerar_mensagens_cobranca',
    data: {
      pagamento_id: params.pagamento_id,
      cliente: cliente,
      opcoes: mensagens
    }
  });
}

/**
 * Registra uma promessa de pagamento
 */
export async function registrarPromessaPagamentoIA(
  sb: SupabaseClient<Database>,
  params: {
    pagamento_id: string;
    cliente_id: string;
    data_prometida: string;
    valor_prometido: number;
    observacoes?: string;
  }
) {
  const { data, error } = await sb
    .from("cobranca_promessas")
    .insert({
      pagamento_id: params.pagamento_id,
      cliente_id: params.cliente_id,
      data_prometida: params.data_prometida,
      valor_prometido: params.valor_prometido,
      resposta_cliente: params.observacoes
    })
    .select()
    .single();

  if (error) throw error;

  return createIAResponse({
    source: 'registrar_promessa',
    affected_record_id: data.id,
    data: data
  });
}
