import type { SupabaseClient } from "@supabase/supabase-js";

type SB = SupabaseClient<any, any, any>;

export type SaldoServico = {
  servico_id: string;
  criado: number;
  consumido: number;
  reservado: number;
  disponivel: number;
};

/** Saldo por serviço de UM contrato específico (pacote comprado). */
export function calcularSaldoContrato(movs: any[]): Record<string, SaldoServico> {
  const mapa: Record<string, SaldoServico> = {};
  const get = (sid: string) => {
    if (!mapa[sid]) {
      mapa[sid] = { servico_id: sid, criado: 0, consumido: 0, reservado: 0, disponivel: 0 };
    }
    return mapa[sid];
  };

  for (const m of movs) {
    const s = get(m.servico_id);
    const q = Number(m.quantidade || 0);
    switch (m.tipo) {
      case "credito_criado":
        s.criado += q;
        break;
      case "ajuste_manual":
        s.criado += q;
        break;
      case "credito_consumido":
        s.consumido += q;
        s.reservado = Math.max(0, s.reservado - q);
        break;
      case "credito_reservado":
        s.reservado += q;
        break;
      case "reserva_liberada":
        s.reservado = Math.max(0, s.reservado - q);
        break;
      case "credito_expirado":
      case "cancelamento":
        s.criado -= q;
        break;
      case "estorno":
        s.criado += q;
        break;
      default:
        break;
    }
  }

  Object.values(mapa).forEach((s) => {
    s.disponivel = s.criado - s.consumido - s.reservado;
  });

  return mapa;
}

export async function carregarContrato(sb: SB, contratoId: string) {
  const { data: contrato, error } = await sb
    .from("programas_contratados")
    .select("*, clientes(nome), pets(nome, raca)")
    .eq("id", contratoId)
    .single();
  if (error) throw error;

  const { data: movs, error: mErr } = await sb
    .from("programas_creditos_movimentacoes")
    .select("*")
    .eq("programa_contratado_id", contratoId)
    .order("data_hora", { ascending: true });
  if (mErr) throw mErr;

  const saldos = calcularSaldoContrato(movs ?? []);
  const servicoIds = Array.from(
    new Set([
      ...Object.keys(saldos),
      ...(((contrato as any).composicao_snapshot ?? []) as any[]).map((i) => i.servico_id),
    ])
  ).filter(Boolean);

  const { data: servicos } = servicoIds.length
    ? await sb.from("servicos").select("id, nome, categoria, valor, duracao_min, ativo").in("id", servicoIds)
    : { data: [] as any[] };

  const nomeDe = (id: string) =>
    (servicos as any[])?.find((s) => s.id === id)?.nome ?? "Serviço";

  const itens = (((contrato as any).composicao_snapshot ?? []) as any[]).map((i) => ({
    servico_id: i.servico_id,
    nome: nomeDe(i.servico_id),
    quantidade: Number(i.quantidade || 0),
    valor_alocado: Number(i.valor_alocado || 0),
    valor_unitario_de_referencia: Number(i.valor_unitario_de_referencia || 0),
    saldo: saldos[i.servico_id] ?? { servico_id: i.servico_id, criado: 0, consumido: 0, reservado: 0, disponivel: 0 },
  }));

  const { data: pagamento } = await sb
    .from("pagamentos")
    .select("id, valor_total, valor_pago, status, forma, data_pagamento, vencimento")
    .eq("idempotency_key", `programa_${contratoId}`)
    .maybeSingle();

  return { contrato, itens, movimentos: movs ?? [], saldos, pagamento, servicos: servicos ?? [] };
}

/** Valida a nova composição contra o que já foi consumido/reservado. */
export function validarNovaComposicao(
  atuais: { servico_id: string; nome: string; saldo: SaldoServico }[],
  novos: { servico_id: string; quantidade: number }[]
): string[] {
  const erros: string[] = [];
  const mapaNovo = new Map(novos.map((n) => [n.servico_id, Number(n.quantidade || 0)]));

  for (const item of atuais) {
    const nova = mapaNovo.has(item.servico_id) ? Number(mapaNovo.get(item.servico_id)) : 0;
    const consumido = item.saldo.consumido;
    const reservado = item.saldo.reservado;

    if (!mapaNovo.has(item.servico_id) && consumido > 0) {
      erros.push(`Não é possível remover "${item.nome}": já existem ${consumido} crédito(s) consumido(s).`);
      continue;
    }
    if (!mapaNovo.has(item.servico_id) && reservado > 0) {
      erros.push(`"${item.nome}" possui ${reservado} crédito(s) reservado(s). Libere a reserva antes de remover.`);
      continue;
    }
    if (nova < consumido) {
      erros.push(`"${item.nome}" não pode ficar abaixo de ${consumido} (total já consumido).`);
      continue;
    }
    if (nova < consumido + reservado) {
      erros.push(
        `"${item.nome}" não pode ficar abaixo de ${consumido + reservado} (consumido + reservado). Libere as reservas primeiro.`
      );
    }
  }

  return erros;
}
