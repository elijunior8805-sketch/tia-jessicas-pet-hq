import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CONFIG_DEFAULT = {
  permitir_venda_fracionada: false,
  notificar_vencimento: false,
  notificar_dias_antes: 7,
  validade_padrao_dias: 30,
};

export const getProgramasConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data, error } = await sb
      .from("programas_cuidado_config" as any)
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as any) ?? { id: null, ...CONFIG_DEFAULT };
  });

export const salvarProgramasConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z
      .object({
        permitir_venda_fracionada: z.boolean(),
        notificar_vencimento: z.boolean(),
        notificar_dias_antes: z.number().int().min(1).max(90),
        validade_padrao_dias: z.number().int().min(1).max(3650),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    const { data: podeGerenciar, error: permError } = await sb.rpc(
      "pode_gerenciar_usuarios" as any,
      { _user_id: userId } as any,
    );
    if (permError) throw permError;
    if (!podeGerenciar) {
      throw new Error("Apenas proprietário ou administrador pode alterar estas configurações.");
    }

    const { data: atual } = await sb
      .from("programas_cuidado_config" as any)
      .select("*")
      .limit(1)
      .maybeSingle();

    const payload = { ...data, atualizado_por: userId };

    let saved: any;
    if (atual) {
      const { data: upd, error } = await sb
        .from("programas_cuidado_config" as any)
        .update(payload)
        .eq("id", (atual as any).id)
        .select()
        .single();
      if (error) throw error;
      saved = upd;
    } else {
      const { data: ins, error } = await sb
        .from("programas_cuidado_config" as any)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      saved = ins;
    }

    await sb.from("auditoria_programas" as any).insert({
      acao: "config_atualizada",
      valor_anterior: atual ?? null,
      valor_posterior: saved,
      motivo: "Alteração das configurações do módulo",
      usuario_id: userId,
    });

    return saved;
  });

export const listarAlertasVencimento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data, error } = await sb
      .from("programas_vencimento_alertas" as any)
      .select("*")
      .order("data_de_validade", { ascending: true })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as any[];
  });

export const gerarAlertasVencimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;

    const { data: cfg } = await sb
      .from("programas_cuidado_config" as any)
      .select("*")
      .limit(1)
      .maybeSingle();

    const config = (cfg as any) ?? CONFIG_DEFAULT;
    if (!config.notificar_vencimento) {
      return { criados: 0, ignorados: 0, motivo: "Notificação de vencimento desativada." };
    }

    const hoje = new Date();
    const limite = new Date(hoje.getTime() + config.notificar_dias_antes * 86400000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const { data: contratos, error } = await sb
      .from("programas_contratados" as any)
      .select("id, cliente_id, pet_id, nome_snapshot, data_de_validade, clientes(nome, whatsapp, telefone), pets(nome)")
      .eq("status_do_programa", "ativo")
      .gte("data_de_validade", iso(hoje))
      .lte("data_de_validade", iso(limite));
    if (error) throw error;

    let criados = 0;
    let ignorados = 0;

    for (const c of (contratos ?? []) as any[]) {
      const { data: movs } = await sb
        .from("programas_creditos_movimentacoes" as any)
        .select("tipo, quantidade")
        .eq("programa_contratado_id", c.id);

      let saldo = 0;
      for (const m of (movs ?? []) as any[]) {
        if (["credito_criado", "reserva_liberada", "cancelamento", "estorno", "ajuste_manual"].includes(m.tipo)) saldo += m.quantidade;
        else if (["credito_consumido", "credito_expirado", "credito_reservado"].includes(m.tipo)) saldo -= m.quantidade;
      }
      if (saldo <= 0) {
        ignorados++;
        continue;
      }

      const tutor = c.clientes?.nome ?? "Tutor";
      const pet = c.pets?.nome ?? "seu pet";
      const venc = c.data_de_validade as string;
      const vencBr = venc.split("-").reverse().join("/");
      const mensagem =
        `Olá, ${tutor}! Aqui é do Spa de Pet Tia Jéssica. 🐾\n\n` +
        `O programa "${c.nome_snapshot}" do ${pet} vence em ${vencBr} e ainda restam ${saldo} crédito(s) para usar.\n\n` +
        `Quer que eu já reserve um horário para aproveitar antes do vencimento?`;

      const idem = `venc:${c.id}:${venc}`;

      const { error: insError } = await sb.from("programas_vencimento_alertas" as any).insert({
        contrato_id: c.id,
        cliente_id: c.cliente_id,
        pet_id: c.pet_id,
        cliente_nome: tutor,
        pet_nome: pet,
        programa_nome: c.nome_snapshot,
        telefone: c.clientes?.whatsapp ?? c.clientes?.telefone ?? null,
        data_de_validade: venc,
        saldo_creditos: saldo,
        mensagem_sugerida: mensagem,
        status: "pendente",
        idempotency_key: idem,
      });

      if (insError) {
        if ((insError as any).code === "23505") ignorados++;
        else throw insError;
      } else {
        criados++;
      }
    }

    return { criados, ignorados };
  });

export const atualizarAlertaVencimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pendente", "aprovado", "enviado", "descartado"]),
        mensagem_sugerida: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    const patch: Record<string, unknown> = { status: data.status };
    if (data.mensagem_sugerida) patch['mensagem_sugerida'] = data.mensagem_sugerida;
    if (data.status === "aprovado") {
      patch['aprovado_por'] = userId;
      patch['aprovado_em'] = new Date().toISOString();
    }
    if (data.status === "enviado") patch['enviado_em'] = new Date().toISOString();

    const { data: upd, error } = await sb
      .from("programas_vencimento_alertas" as any)
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return upd;
  });
