import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const registrarAuditoriaPrograma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    acao: z.string(),
    cliente_id: z.string().uuid().optional(),
    pet_id: z.string().uuid().optional(),
    programa_contratado_id: z.string().uuid().optional(),
    valor_anterior: z.any().optional(),
    valor_posterior: z.any().optional(),
    motivo: z.string().optional(),
    metadata: z.any().optional()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    const { error } = await sb
      .from("auditoria_programas" as any)
      .insert({
        ...data,
        usuario_id: userId,
      });

    if (error) throw error;
    return { success: true };
  });

export const contratarPrograma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    programa_id: z.string().uuid(),
    cliente_id: z.string().uuid(),
    pet_id: z.string().uuid(),
    data_de_inicio: z.string(),
    data_de_validade: z.string(),
    preco_vendido: z.number().optional(),
    forma_de_pagamento: z.string().optional(),
    observacoes: z.string().optional(),
    idempotency_key: z.string(),
    fracionado: z.boolean().optional(),
    itens_selecionados: z.array(z.object({
      servico_id: z.string().uuid(),
      quantidade: z.number().int().min(0)
    })).optional()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    const { data: programa, error: pError } = await sb
      .from("programas_de_cuidado" as any)
      .select(`
        *,
        itens:programas_de_cuidado_itens (*)
      `)
      .eq("id", data.programa_id)
      .single();

    if (pError) throw pError;

    const { data: cfg } = await sb
      .from("programas_cuidado_config" as any)
      .select("permitir_venda_fracionada")
      .limit(1)
      .maybeSingle();
    const permiteFracionar = !!(cfg as any)?.permitir_venda_fracionada;

    const itensOriginais = ((programa as any).itens ?? []) as any[];
    let itensVenda = itensOriginais.map((i) => ({ ...i }));
    let fracionado = false;

    if (data.fracionado) {
      if (!permiteFracionar) {
        throw new Error("Venda fracionada está desativada nas configurações do módulo.");
      }
      const mapa = new Map((data.itens_selecionados ?? []).map((i) => [i.servico_id, i.quantidade]));
      itensVenda = itensOriginais
        .map((i) => ({ ...i, quantidade: Math.min(Number(mapa.get(i.servico_id) ?? 0), Number(i.quantidade)) }))
        .filter((i) => i.quantidade > 0);
      if (itensVenda.length === 0) {
        throw new Error("Selecione ao menos um serviço para a venda fracionada.");
      }
      fracionado = itensVenda.some((i, idx) => i.quantidade !== Number(itensOriginais[idx]?.quantidade))
        || itensVenda.length !== itensOriginais.length;
    }

    // Preço sempre calculado no backend
    const precoCheio = Number((programa as any).preco_do_programa ?? 0);
    const totalUnidadesOriginais = itensOriginais.reduce((s, i) => s + Number(i.quantidade || 0), 0) || 1;
    let precoCalculado = precoCheio;

    if (fracionado) {
      const somaAlocada = itensOriginais.reduce(
        (s, i) => s + Number(i.valor_alocado || 0), 0);
      if (somaAlocada > 0) {
        precoCalculado = itensVenda.reduce((s, i) => {
          const orig = itensOriginais.find((o) => o.servico_id === i.servico_id);
          const unit = Number(orig?.valor_alocado || 0) / Math.max(Number(orig?.quantidade || 1), 1);
          return s + unit * i.quantidade;
        }, 0);
      } else {
        const unidades = itensVenda.reduce((s, i) => s + i.quantidade, 0);
        precoCalculado = (precoCheio / totalUnidadesOriginais) * unidades;
      }
      precoCalculado = Math.round(precoCalculado * 100) / 100;
    }

    const { data: contratado, error: cError } = await sb
      .from("programas_contratados" as any)
      .insert({
        programa_id: data.programa_id,
        cliente_id: data.cliente_id,
        pet_id: data.pet_id,
        nome_snapshot: fracionado ? `${(programa as any).nome} (fracionado)` : (programa as any).nome,
        composicao_snapshot: itensVenda,
        regras_snapshot: (programa as any).regras,
        preco_original: precoCheio,
        preco_vendido: precoCalculado,
        desconto: precoCheio - precoCalculado,
        fracionado,
        data_de_inicio: data.data_de_inicio,
        data_de_validade: data.data_de_validade,
        status_do_programa: 'ativo',
        forma_de_pagamento: data.forma_de_pagamento,
        observacoes: data.observacoes,
        criado_por: userId
      })
      .select()
      .single();

    if (cError) throw cError;

    const movimentacoes = itensVenda.map((item: any) => ({
      programa_contratado_id: (contratado as any).id,
      servico_id: item.servico_id,
      quantidade: item.quantidade,
      tipo: 'credito_criado',
      usuario_id: userId,
      motivo: fracionado ? 'Contratação fracionada' : 'Contratação inicial',
      idempotency_key: `${data.idempotency_key}_${item.servico_id}`
    }));

    const { error: mError } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .insert(movimentacoes);

    if (mError) throw mError;

    // Integração com o Financeiro
    const formasValidas = ['pix', 'credito', 'debito', 'dinheiro', 'pendente', 'outras'];
    const forma = formasValidas.includes(String(data.forma_de_pagamento))
      ? String(data.forma_de_pagamento)
      : 'pendente';

    const { error: fError } = await sb
      .from("pagamentos" as any)
      .insert({
        cliente_id: data.cliente_id,
        valor_total: precoCalculado,
        valor_pago: forma === 'pendente' ? 0 : precoCalculado,
        forma,
        status: forma === 'pendente' ? 'pendente' : 'pago',
        data_pagamento: forma === 'pendente' ? null : data.data_de_inicio,
        vencimento: forma === 'pendente' ? data.data_de_inicio : null,
        categoria_receita: 'Programas de Cuidado',
        descricao: `Programa: ${(programa as any).nome}${fracionado ? ' (fracionado)' : ''}`,
        idempotency_key: `programa_${(contratado as any).id}`,
        created_by: userId
      });

    if (fError && (fError as any).code !== '23505') throw fError;

    await sb.from("auditoria_programas" as any).insert({
      acao: fracionado ? 'venda_fracionada' : 'venda',
      cliente_id: data.cliente_id,
      pet_id: data.pet_id,
      programa_contratado_id: (contratado as any).id,
      valor_posterior: contratado as any,
      motivo: 'Contratação de programa',
      usuario_id: userId,
    });

    return contratado;
  });


export const getCreditosDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    pet_id: z.string().uuid()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const { data: movs, error } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .select(`
        *,
        contratado:programas_contratados!inner (*),
        servico:servicos (id, nome)
      `)
      .eq("contratado.pet_id", data.pet_id)
      .eq("contratado.status_do_programa", "ativo");

    if (error) throw error;

    const saldo: Record<string, { nome: string, disponivel: number, reservado: number }> = {};

    (movs as any[]).forEach(m => {
      const sId = m.servico_id;
      if (!saldo[sId]) {
        saldo[sId] = { nome: m.servico?.nome || "Serviço", disponivel: 0, reservado: 0 };
      }

      if (['credito_criado', 'reserva_liberada', 'cancelamento', 'estorno'].includes(m.tipo)) {
        saldo[sId].disponivel += m.quantidade;
      } else if (['credito_consumido', 'credito_expirado'].includes(m.tipo)) {
        saldo[sId].disponivel -= m.quantidade;
      } else if (m.tipo === 'credito_reservado') {
        saldo[sId].disponivel -= m.quantidade;
        saldo[sId].reservado += m.quantidade;
      } else if (m.tipo === 'ajuste_manual') {
        saldo[sId].disponivel += m.quantidade;
      }
    });

    return saldo;
  });

export const getProgramasCatalogo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    
    const { data, error } = await sb
      .from("programas_de_cuidado" as any)
      .select(`
        *,
        itens:programas_de_cuidado_itens (
          *,
          servico:servicos (*)
        )
      `)
      .order("criado_em", { ascending: false });

    if (error) throw error;
    return data;
  });

export const upsertPrograma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().min(1, "Nome é obrigatório"),
    descricao: z.string().optional(),
    status: z.enum(["rascunho", "ativo", "inativo"]),
    preco_do_programa: z.number().min(0),
    valor_normal_dos_servicos: z.number().min(0),
    economia: z.number().min(0),
    validade_em_dias: z.number().min(1),
    permite_parcelamento: z.boolean(),
    inclui_transporte: z.boolean(),
    modalidade_transporte: z.string().optional(),
    quantidade_transportes: z.number().optional(),
    valor_transporte: z.number().optional(),
    regras: z.string().optional(),
    itens: z.array(z.object({
      servico_id: z.string().uuid(),
      quantidade: z.number().min(1),
      valor_unitario_de_referencia: z.number(),
      valor_alocado: z.number(),
      ordem_de_exibicao: z.number().optional()
    }))
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;
    const { itens, ...programaData } = data;

    const { data: programa, error: pError } = await sb
      .from("programas_de_cuidado" as any)
      .upsert({
        ...programaData,
        criado_por: data.id ? undefined : userId,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (pError) throw pError;

    if (data.id) {
      const { error: dError } = await sb
        .from("programas_de_cuidado_itens" as any)
        .delete()
        .eq("programa_id", data.id);
      if (dError) throw dError;
    }

    const { error: iError } = await sb
      .from("programas_de_cuidado_itens" as any)
      .insert(itens.map(item => ({
        ...item,
        programa_id: (programa as any).id
      })));

    if (iError) throw iError;

    return programa;
  });

export const toggleProgramaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    id: z.string().uuid(),
    status: z.enum(["rascunho", "ativo", "inativo"])
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { error } = await sb
      .from("programas_de_cuidado" as any)
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    if (error) throw error;
    return { success: true };
  });

export const duplicarPrograma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    id: z.string().uuid()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    const { data: original, error: oError } = await sb
      .from("programas_de_cuidado" as any)
      .select("*, itens:programas_de_cuidado_itens(*)")
      .eq("id", data.id)
      .single();

    if (oError) throw oError;

    const { id: _, criado_em: __, updated_at: ___, itens, ...cloneData } = original as any;
    const { data: clone, error: cError } = await sb
      .from("programas_de_cuidado" as any)
      .insert({
        ...cloneData,
        nome: `${cloneData.nome} (Cópia)`,
        status: "rascunho",
        criado_por: userId
      })
      .select()
      .single();

    if (cError) throw cError;

    const { error: iError } = await sb
      .from("programas_de_cuidado_itens" as any)
      .insert(itens.map((item: any) => {
        const { id: ____, programa_id: _____, ...itemData } = item;
        return { ...itemData, programa_id: (clone as any).id };
      }));

    if (iError) throw iError;

    return clone;
  });

export const reservarCredito = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    pet_id: z.string().uuid(),
    servico_id: z.string().uuid(),
    agendamento_id: z.string().uuid(),
    quantidade: z.number().default(1)
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    const { data: movs, error: e1 } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .select(`
        *,
        contratado:programas_contratados!inner (*)
      `)
      .eq("contratado.pet_id", data.pet_id)
      .eq("contratado.status_do_programa", "ativo")
      .eq("servico_id", data.servico_id)
      .order("criado_em", { ascending: true });

    if (e1) throw e1;

    const saldosPorPrograma: Record<string, number> = {};
    (movs as any[]).forEach(m => {
      const pcid = m.programa_contratado_id;
      if (!saldosPorPrograma[pcid]) saldosPorPrograma[pcid] = 0;
      
      if (['credito_criado', 'reserva_liberada', 'cancelamento', 'estorno'].includes(m.tipo)) {
        saldosPorPrograma[pcid] += m.quantidade;
      } else if (['credito_consumido', 'credito_expirado', 'credito_reservado'].includes(m.tipo)) {
        saldosPorPrograma[pcid] -= m.quantidade;
      } else if (m.tipo === 'ajuste_manual') {
        saldosPorPrograma[pcid] += m.quantidade;
      }
    });

    const programaComSaldo = Object.entries(saldosPorPrograma).find(([_, saldo]) => saldo >= data.quantidade);
    
    if (!programaComSaldo) {
      throw new Error("Saldo insuficiente para reserva");
    }

    const { error: e2 } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .insert({
        programa_contratado_id: programaComSaldo[0],
        servico_id: data.servico_id,
        quantidade: data.quantidade,
        tipo: 'credito_reservado',
        agendamento_id: data.agendamento_id,
        usuario_id: userId,
        motivo: 'Reserva automática via Agenda',
        idempotency_key: `reserva_${data.agendamento_id}_${data.servico_id}`
      });

    if (e2) throw e2;

    await registrarAuditoriaPrograma({
      data: {
        acao: 'reserva_credito',
        pet_id: data.pet_id,
        programa_contratado_id: programaComSaldo[0],
        metadata: { agendamento_id: data.agendamento_id, servico_id: data.servico_id },
        motivo: 'Reserva via Agenda'
      }
    });

    return { success: true };
  });

export const liberarReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    agendamento_id: z.string().uuid()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    const { data: reservas, error: e1 } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .select("*")
      .eq("agendamento_id", data.agendamento_id)
      .eq("tipo", "credito_reservado");

    if (e1) throw e1;
    if (!reservas || reservas.length === 0) return { success: true, count: 0 };

    const liberacoes = (reservas as any[]).map(res => ({
      programa_contratado_id: res.programa_contratado_id,
      servico_id: res.servico_id,
      quantidade: res.quantidade,
      tipo: 'reserva_liberada',
      agendamento_id: data.agendamento_id,
      usuario_id: userId,
      motivo: 'Liberação de reserva (Cancelamento/Exclusão)',
      idempotency_key: `liberacao_${res.id}`
    }));

    const { error: e2 } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .insert(liberacoes);

    if (e2) throw e2;
    return { success: true, count: liberacoes.length };
  });

export const consumirReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    agendamento_id: z.string().uuid()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    const { data: reservas, error: e1 } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .select("*")
      .eq("agendamento_id", data.agendamento_id)
      .eq("tipo", "credito_reservado");

    if (e1) throw e1;
    if (!reservas || reservas.length === 0) return { success: true, count: 0 };

    const consumos = (reservas as any[]).map(res => ({
      programa_contratado_id: res.programa_contratado_id,
      servico_id: res.servico_id,
      quantidade: res.quantidade,
      tipo: 'credito_consumido',
      agendamento_id: data.agendamento_id,
      usuario_id: userId,
      motivo: 'Consumo definitivo (Finalização)',
      idempotency_key: `consumo_${res.id}`
    }));

    const { error: e2 } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .insert(consumos);

    if (e2) throw e2;
    return { success: true, count: consumos.length };
  });

export const reconciliarCreditosPet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    pet_id: z.string().uuid()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    
    const { data: result, error } = await sb.rpc('reconciliar_creditos_pet' as any, {
      _pet_id: data.pet_id
    });

    if (error) throw error;
    return result;
  });
