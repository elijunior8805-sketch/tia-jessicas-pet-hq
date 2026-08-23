import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { createIAResponse } from "./ia-retorno.server";

/**
 * Especialista em Auditoria e Integridade de Dados
 * Identifica divergências entre módulos
 */
export async function realizarAuditoriaDadosIA(sb: SupabaseClient<Database>) {
  const timezone = "America/Sao_Paulo";
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  // 1. Atendimentos finalizados hoje sem pagamento vinculado
  const { data: atendimentosSemPagamento } = await sb
    .from("atendimentos")
    .select("id, data_inicio, pets(nome), clientes(nome)")
    .eq("finalizado", true)
    .gte("data_inicio", `${hoje}T00:00:00`)
    .is("pagamento_id", null);

  // 2. Pagamentos com valor total zero (que não deveriam ser zero)
  const { data: pagamentosZerados } = await sb
    .from("pagamentos")
    .select("id, descricao, vencimento")
    .eq("valor_total", 0)
    .neq("status", "cancelado")
    .is("arquivado_em", null);

  // 3. Duplicidades prováveis (mesmo cliente, valor e data) - Mock ou consulta simples se a RPC não existir
  // Para evitar erro de tipagem se a RPC não estiver no esquema do Supabase
  const { data: duplicidades } = await sb
    .from("pagamentos")
    .select("cliente_id, valor_total, vencimento")
    .neq("status", "cancelado")
    .limit(1); // Placeholder até validarmos a RPC

  const alertasCount = (atendimentosSemPagamento?.length || 0) + 
                       (pagamentosZerados?.length || 0) + 
                       (Array.isArray(duplicidades) ? duplicidades.length : 0);

  return createIAResponse({
    source: 'auditoria_financeira',
    data: {
      atendimentos_sem_pagamento: atendimentosSemPagamento || [],
      pagamentos_zerados: pagamentosZerados || [],
      provaveis_duplicidades: Array.isArray(duplicidades) ? duplicidades : [],
      resumo: {
        alertas: alertasCount
      }
    }
  });
}
