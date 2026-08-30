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
    desconto: z.number().optional(),
    tipo_desconto: z.enum(['percentual', 'fixo']).optional(),
    valor_desconto: z.number().optional(),
    motivo_desconto: z.string().optional(),
    forma_de_pagamento: z.string().optional(),
    observacoes: z.string().optional(),
    idempotency_key: z.string(),
    fracionado: z.boolean().optional(),
    modo_venda: z.enum(['normal', 'fracionado']).optional(),
    itens_selecionados: z.array(z.object({
      servico_id: z.string().uuid(),
      quantidade: z.number().int().min(0),
      valor_unitario: z.number().optional(),
      nome: z.string().optional()
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
    
    // Identifica se é realmente venda fracionada (opção explícita) ou venda normal/personalizada
    const ehRealmenteFracionado = data.modo_venda === 'fracionado' || (data.fracionado === true && data.modo_venda !== 'normal');
    
    if (ehRealmenteFracionado && !permiteFracionar) {
      throw new Error("Venda fracionada está desativada nas configurações do módulo.");
    }

    let itensVenda: any[] = [];
    if (data.itens_selecionados && data.itens_selecionados.length > 0) {
      itensVenda = data.itens_selecionados
        .filter((i) => i.quantidade > 0)
        .map((i) => {
          const orig = itensOriginais.find((o) => o.servico_id === i.servico_id);
          const vUnit = i.valor_unitario ?? Number(orig?.valor_unitario_de_referencia ?? 0);
          return {
            servico_id: i.servico_id,
            quantidade: i.quantidade,
            valor_unitario_de_referencia: vUnit,
            valor_alocado: vUnit * i.quantidade
          };
        });
    } else {
      itensVenda = itensOriginais.map((i) => ({ ...i }));
    }

    if (itensVenda.length === 0) {
      throw new Error("Selecione ao menos um serviço para compor o programa.");
    }

    const subtotalServicos = itensVenda.reduce((acc, i) => acc + (Number(i.valor_unitario_de_referencia || 0) * Number(i.quantidade || 0)), 0);
    const precoBaseCatalogo = Number((programa as any).preco_do_programa ?? subtotalServicos);
    
    let precoFinal = data.preco_vendido !== undefined 
      ? Number(data.preco_vendido) 
      : (ehRealmenteFracionado ? subtotalServicos : precoBaseCatalogo);

    if (data.desconto !== undefined && data.preco_vendido === undefined) {
      precoFinal = Math.max(0, subtotalServicos - Number(data.desconto));
    }

    precoFinal = Math.round(precoFinal * 100) / 100;
    const descontoCalculado = Math.max(0, (subtotalServicos || precoBaseCatalogo) - precoFinal);
    const fracionado = ehRealmenteFracionado;

    // Idempotência: se esta chave já gerou um contrato, devolve o existente
    const { data: jaExiste } = await sb
      .from("programas_contratados" as any)
      .select("id")
      .eq("idempotency_key", data.idempotency_key)
      .maybeSingle();

    if (jaExiste) {
      const { data: pagExistente } = await sb
        .from("pagamentos" as any)
        .select("id")
        .eq("idempotency_key", `programa_${(jaExiste as any).id}`)
        .maybeSingle();
      return {
        contract_id: (jaExiste as any).id,
        payment_id: (pagExistente as any)?.id ?? null,
        duplicado: true,
      };
    }

    const formasValidas = ['pix', 'credito', 'debito', 'dinheiro', 'pendente', 'outras'];
    const forma = formasValidas.includes(String(data.forma_de_pagamento))
      ? String(data.forma_de_pagamento)
      : 'pendente';

    let contratoId = "";

    // Compensação: se qualquer etapa seguinte falhar, desfaz o que foi criado
    const desfazer = async () => {
      if (!contratoId) return;
      await sb.from("programas_creditos_movimentacoes" as any)
        .delete().eq("programa_contratado_id", contratoId);
      await sb.from("pagamentos" as any)
        .delete().eq("idempotency_key", `programa_${contratoId}`);
      await sb.from("programas_contratados" as any).delete().eq("id", contratoId);
    };

    try {
      const nowIso = new Date().toISOString();
      const dataVenda = data.data_de_inicio || nowIso.slice(0, 10);

      const { data: contratado, error: cError } = await sb
        .from("programas_contratados" as any)
        .insert({
          programa_id: data.programa_id,
          cliente_id: data.cliente_id,
          pet_id: data.pet_id,
          nome_snapshot: fracionado ? `${(programa as any).nome} (fracionado)` : (programa as any).nome,
          composicao_snapshot: itensVenda,
          regras_snapshot: (programa as any).regras,
          preco_original: subtotalServicos || precoBaseCatalogo,
          preco_vendido: precoFinal,
          desconto: descontoCalculado,
          fracionado,
          data_da_venda: dataVenda,
          data_de_inicio: data.data_de_inicio,
          data_de_validade: data.data_de_validade,
          status_do_programa: forma === 'pendente' ? 'aguardando_pagamento' : 'ativo',
          forma_de_pagamento: data.forma_de_pagamento,
          observacoes: data.observacoes,
          idempotency_key: data.idempotency_key,
          criado_por: userId,
          criado_em: nowIso,
        })
        .select()
        .single();

      if (cError) throw cError;

      contratoId = (contratado as any).id as string;

      const movimentacoes = itensVenda.map((item: any) => ({
        programa_contratado_id: contratoId,
        servico_id: item.servico_id,
        quantidade: item.quantidade,
        tipo: 'credito_criado',
        data_hora: nowIso,
        usuario_id: userId,
        motivo: fracionado ? 'Contratação fracionada' : 'Contratação de programa',
        idempotency_key: `${data.idempotency_key}_${item.servico_id}`
      }));

      const { error: mError } = await sb
        .from("programas_creditos_movimentacoes" as any)
        .insert(movimentacoes);

      if (mError) throw mError;

      // Integração com o Financeiro (categoria oficial: programa_cuidado)
      const { data: pagamento, error: fError } = await sb
        .from("pagamentos" as any)
        .insert({
          cliente_id: data.cliente_id,
          valor_total: precoFinal,
          valor_pago: forma === 'pendente' ? 0 : precoFinal,
          forma,
          status: forma === 'pendente' ? 'pendente' : 'pago',
          data_pagamento: forma === 'pendente' ? null : dataVenda,
          vencimento: forma === 'pendente' ? dataVenda : null,
          categoria_receita: 'programa_cuidado',
          descricao: `Programa: ${(programa as any).nome}${fracionado ? ' (fracionado)' : ''}`,
          idempotency_key: `programa_${contratoId}`,
          created_by: userId
        })
        .select("id")
        .single();

      if (fError) throw fError;

      await sb.from("auditoria_programas" as any).insert({
        acao: fracionado ? 'venda_fracionada' : 'venda',
        cliente_id: data.cliente_id,
        pet_id: data.pet_id,
        programa_contratado_id: contratoId,
        valor_posterior: contratado as any,
        motivo: 'Contratação de programa',
        usuario_id: userId,
        created_at: nowIso,
      });

      // Read-back obrigatório
      const { data: conferido, error: rbError } = await sb
        .from("programas_contratados" as any)
        .select("id, status_do_programa, preco_vendido")
        .eq("id", contratoId)
        .single();
      if (rbError || !conferido) throw new Error("Falha na verificação pós-contratação.");

      const { data: creditosConferidos } = await sb
        .from("programas_creditos_movimentacoes" as any)
        .select("id, servico_id, quantidade, tipo")
        .eq("programa_contratado_id", contratoId);

      return {
        contract_id: contratoId,
        payment_id: (pagamento as any)?.id ?? null,
        contrato: conferido,
        creditos: creditosConferidos ?? [],
        duplicado: false,
      };
    } catch (e) {
      await desfazer();
      throw e;
    }
  });



import {
  identificarCategoriaCredito,
  calcularSaldosDoContrato,
  REGRAS_CATEGORIAS_PADRAO,
  type CategoriaCreditoTipo,
} from "./programas-creditos-core";

export const getCreditosDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    pet_id: z.string().uuid()
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    // Busca contratos ativos ou aguardando pagamento do pet
    const { data: contratos, error: cErr } = await sb
      .from("programas_contratados" as any)
      .select(`
        *,
        pets:pet_id (id, nome),
        movimentacoes:programas_creditos_movimentacoes (
          id, servico_id, quantidade, tipo, data_hora, motivo, agendamento_id,
          servicos:servico_id (id, nome, categoria)
        )
      `)
      .eq("pet_id", data.pet_id)
      .in("status_do_programa", ["ativo", "aguardando_pagamento"])
      .order("criado_em", { ascending: false });

    if (cErr) throw cErr;

    // Busca lista de todos os serviços do catálogo para mapeamento de categorias
    const { data: todosServicos } = await sb
      .from("servicos" as any)
      .select("id, nome, categoria, valor")
      .eq("ativo", true);

    const servicosList = (todosServicos as any[]) || [];

    const saldosPorServico: Record<string, { nome: string; categoria: string; disponivel: number; reservado: number; bloqueado: boolean }> = {};
    const saldosPorCategoria: Record<string, {
      categoria: CategoriaCreditoTipo;
      nome_categoria: string;
      descricao_cobertura: string;
      disponivel: number;
      reservado: number;
      bloqueado: boolean;
      servicos_elegiveis: Array<{ id: string; nome: string }>;
    }> = {};

    const contratosResumo = (contratos as any[] || []).map((c) => {
      return calcularSaldosDoContrato(c, c.movimentacoes || []);
    });

    contratosResumo.forEach((cRes) => {
      cRes.itens.forEach((item) => {
        const cat = item.categoria;
        if (!saldosPorCategoria[cat]) {
          const elegiveis = servicosList.filter((s) => identificarCategoriaCredito(s) === cat);
          saldosPorCategoria[cat] = {
            categoria: cat,
            nome_categoria: item.nome_categoria,
            descricao_cobertura: item.descricao_cobertura,
            disponivel: 0,
            reservado: 0,
            bloqueado: item.bloqueado,
            servicos_elegiveis: elegiveis.map((s) => ({ id: s.id, nome: s.nome })),
          };
        }

        saldosPorCategoria[cat].disponivel += item.disponiveis;
        saldosPorCategoria[cat].reservado += item.reservados;
        if (item.bloqueado) saldosPorCategoria[cat].bloqueado = true;

        // Mapeia também para os serviços elegíveis para retrocompatibilidade
        const elegiveis = saldosPorCategoria[cat].servicos_elegiveis;
        elegiveis.forEach((el) => {
          if (!saldosPorServico[el.id]) {
            saldosPorServico[el.id] = {
              nome: el.nome,
              categoria: cat,
              disponivel: 0,
              reservado: 0,
              bloqueado: item.bloqueado,
            };
          }
          saldosPorServico[el.id].disponivel = saldosPorCategoria[cat].disponivel;
          saldosPorServico[el.id].reservado = saldosPorCategoria[cat].reservado;
          saldosPorServico[el.id].bloqueado = saldosPorCategoria[cat].bloqueado;
        });
      });
    });

    return {
      saldos: saldosPorServico, // compatibilidade
      saldos_por_categoria: saldosPorCategoria,
      contratos: contratosResumo,
    };
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

    // 1. Identifica a categoria do serviço solicitado
    const { data: servicoEscolhidoRaw } = await sb
      .from("servicos" as any)
      .select("id, nome, categoria")
      .eq("id", data.servico_id)
      .single();
    const servicoEscolhido = servicoEscolhidoRaw as any;

    const categoriaRequerida = identificarCategoriaCredito(servicoEscolhido || { id: data.servico_id });

    // 2. Busca contratos ativos do pet com suas movimentações
    const { data: contratos, error: e1 } = await sb
      .from("programas_contratados" as any)
      .select(`
        *,
        movimentacoes:programas_creditos_movimentacoes (*)
      `)
      .eq("pet_id", data.pet_id)
      .eq("status_do_programa", "ativo")
      .order("criado_em", { ascending: true });

    if (e1) throw e1;

    let contratoEscolhido: any = null;

    for (const c of (contratos as any[] || [])) {
      const resumo = calcularSaldosDoContrato(c, c.movimentacoes || []);
      const itemCategoria = resumo.itens.find((it) => it.categoria === categoriaRequerida);
      if (itemCategoria && itemCategoria.disponiveis >= data.quantidade && !itemCategoria.bloqueado) {
        contratoEscolhido = c;
        break;
      }
    }

    if (!contratoEscolhido) {
      throw new Error(`Saldo insuficiente na categoria ${REGRAS_CATEGORIAS_PADRAO[categoriaRequerida]?.nome_categoria || categoriaRequerida} para este pet.`);
    }

    const { error: e2 } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .insert({
        programa_contratado_id: contratoEscolhido.id,
        servico_id: data.servico_id,
        quantidade: data.quantidade,
        tipo: 'credito_reservado',
        agendamento_id: data.agendamento_id,
        usuario_id: userId,
        motivo: `Reserva automática via Agenda (${servicoEscolhido?.nome || 'Serviço'})`,
        idempotency_key: `reserva_${data.agendamento_id}_${data.servico_id}`
      });

    if (e2) throw e2;

    await registrarAuditoriaPrograma({
      data: {
        acao: 'reserva_credito',
        pet_id: data.pet_id,
        programa_contratado_id: contratoEscolhido.id,
        metadata: {
          agendamento_id: data.agendamento_id,
          servico_id: data.servico_id,
          servico_nome: servicoEscolhido?.nome,
          categoria_credito: categoriaRequerida,
        },
        motivo: `Reserva de crédito para ${servicoEscolhido?.nome || 'serviço'}`
      }
    });

    return { success: true, categoria: categoriaRequerida, contrato_id: contratoEscolhido.id };
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
      motivo: 'Liberação de reserva (Cancelamento/Exclusão do agendamento)',
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
    agendamento_id: z.string().uuid(),
    atendimento_id: z.string().uuid().optional(),
    servico_executado_id: z.string().uuid().optional(),
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
      servico_id: data.servico_executado_id || res.servico_id,
      quantidade: res.quantidade,
      tipo: 'credito_consumido',
      agendamento_id: data.agendamento_id,
      atendimento_id: data.atendimento_id,
      usuario_id: userId,
      motivo: 'Consumo definitivo (Conclusão do Atendimento)',
      idempotency_key: `consumo_${res.id}`
    }));

    const { error: e2 } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .insert(consumos);

    if (e2) throw e2;
    return { success: true, count: consumos.length };
  });

export const estornarConsumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) => z.object({
    agendamento_id: z.string().uuid(),
    motivo: z.string().min(3, "Informe o motivo do estorno do crédito"),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    const { data: consumos, error: e1 } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .select("*")
      .eq("agendamento_id", data.agendamento_id)
      .eq("tipo", "credito_consumido");

    if (e1) throw e1;
    if (!consumos || consumos.length === 0) return { success: true, count: 0 };

    const estornos = (consumos as any[]).map(c => ({
      programa_contratado_id: c.programa_contratado_id,
      servico_id: c.servico_id,
      quantidade: c.quantidade,
      tipo: 'estorno_consumo',
      agendamento_id: data.agendamento_id,
      usuario_id: userId,
      motivo: `Estorno de consumo: ${data.motivo}`,
      idempotency_key: `estorno_${c.id}_${Date.now()}`
    }));

    const { error: e2 } = await sb
      .from("programas_creditos_movimentacoes" as any)
      .insert(estornos);

    if (e2) throw e2;

    await registrarAuditoriaPrograma({
      data: {
        acao: 'estorno_credito',
        metadata: { agendamento_id: data.agendamento_id, motivo: data.motivo },
        motivo: data.motivo,
      }
    });

    return { success: true, count: estornos.length };
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
