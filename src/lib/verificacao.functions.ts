import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PeriodoSchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function toLocalDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function shiftDay(iso: string, delta: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type FonteResumo = {
  fonte: "painel" | "relatorios" | "financeiro";
  label: string;
  faturamento: number;
  atendimentos_finalizados: number;
  ticket_medio: number;
  taxa_leva_traz: number;
  descontos: number;
};

export type Divergencia = {
  metrica: string;
  valores: Record<string, number>;
  diferenca: number;
  ok: boolean;
};

export type VerificacaoDTO = {
  periodo: { de: string; ate: string };
  fontes: FonteResumo[];
  divergencias: Divergencia[];
  atendimentos_conferencia: Array<{
    id: string;
    dia: string;
    cliente: string;
    valor_executado: number;
    taxa_leva_traz: number;
    desconto: number;
    total: number;
  }>;
};

const TOLERANCIA = 0.01;

export const carregarVerificacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PeriodoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { de, ate } = data;
    const deWide = shiftDay(de, -1);
    const ateWide = shiftDay(ate, 1);

    // Query base — mesmos campos que cada tela usa
    const { data: raw, error } = await supabase
      .from("atendimentos")
      .select(
        "id, cliente_id, data_inicio, encerrado_em, finalizado, valor_executado, taxa_leva_traz, desconto, clientes:cliente_id(nome)",
      )
      .or(
        `and(data_inicio.gte.${deWide}T00:00:00.000Z,data_inicio.lte.${ateWide}T23:59:59.999Z),and(encerrado_em.gte.${deWide}T00:00:00.000Z,encerrado_em.lte.${ateWide}T23:59:59.999Z)`,
      )
      .returns<any[]>();
    if (error) throw new Error("Falha ao carregar atendimentos");

    const rows = (raw ?? []).map((r) => ({
      ...r,
      __dia: toLocalDay(r.encerrado_em ?? r.data_inicio),
    }));

    // === PAINEL (Dashboard) ===
    // Filtra por encerrado_em local, finalizado, valor_executado > 0
    const painelExec = rows.filter(
      (r) =>
        r.finalizado === true &&
        !!r.encerrado_em &&
        Number(r.valor_executado ?? 0) > 0 &&
        toLocalDay(r.encerrado_em) >= de &&
        toLocalDay(r.encerrado_em) <= ate,
    );
    const painelFat = painelExec.reduce(
      (s, r) =>
        s +
        Math.max(
          0,
          Number(r.valor_executado ?? 0) +
            Number(r.taxa_leva_traz ?? 0) -
            Number(r.desconto ?? 0),
        ),
      0,
    );

    // === FINANCEIRO ===
    // Mesma lógica; usa encerrado_em local
    const finExec = rows.filter(
      (r) =>
        r.finalizado === true &&
        !!r.encerrado_em &&
        Number(r.valor_executado ?? 0) > 0 &&
        toLocalDay(r.encerrado_em) >= de &&
        toLocalDay(r.encerrado_em) <= ate,
    );
    const finFat = finExec.reduce(
      (s, r) =>
        s +
        Math.max(
          0,
          Number(r.valor_executado ?? 0) +
            Number(r.taxa_leva_traz ?? 0) -
            Number(r.desconto ?? 0),
        ),
      0,
    );

    // === RELATÓRIOS ===
    // Filtra por __dia (encerrado_em quando finalizado, senão data_inicio)
    const relExec = rows.filter(
      (r) =>
        r.finalizado === true &&
        !!r.encerrado_em &&
        Number(r.valor_executado ?? 0) > 0 &&
        r.__dia >= de &&
        r.__dia <= ate,
    );
    const relFat = relExec.reduce(
      (s, r) =>
        s +
        Math.max(
          0,
          Number(r.valor_executado ?? 0) +
            Number(r.taxa_leva_traz ?? 0) -
            Number(r.desconto ?? 0),
        ),
      0,
    );

    const build = (
      fonte: FonteResumo["fonte"],
      label: string,
      list: any[],
      fat: number,
    ): FonteResumo => ({
      fonte,
      label,
      faturamento: fat,
      atendimentos_finalizados: list.length,
      ticket_medio: list.length ? fat / list.length : 0,
      taxa_leva_traz: list.reduce(
        (s, r) => s + Number(r.taxa_leva_traz ?? 0),
        0,
      ),
      descontos: list.reduce((s, r) => s + Number(r.desconto ?? 0), 0),
    });

    const fontes: FonteResumo[] = [
      build("painel", "Painel Principal", painelExec, painelFat),
      build("financeiro", "Financeiro", finExec, finFat),
      build("relatorios", "Relatórios", relExec, relFat),
    ];

    const cmp = (
      metrica: string,
      pick: (f: FonteResumo) => number,
    ): Divergencia => {
      const valores: Record<string, number> = {};
      for (const f of fontes) valores[f.label] = pick(f);
      const arr = Object.values(valores);
      const diff = Math.max(...arr) - Math.min(...arr);
      return { metrica, valores, diferenca: diff, ok: diff <= TOLERANCIA };
    };

    const divergencias: Divergencia[] = [
      cmp("Faturamento", (f) => f.faturamento),
      cmp("Atendimentos finalizados", (f) => f.atendimentos_finalizados),
      cmp("Ticket médio", (f) => f.ticket_medio),
      cmp("Taxa Leva e Traz", (f) => f.taxa_leva_traz),
      cmp("Descontos", (f) => f.descontos),
    ];

    // Conferência linha a linha (união dos 3 conjuntos)
    const union = new Map<string, any>();
    for (const r of [...painelExec, ...finExec, ...relExec]) {
      if (!union.has(r.id)) union.set(r.id, r);
    }
    const atendimentos_conferencia = Array.from(union.values())
      .map((r) => {
        const exec = Number(r.valor_executado ?? 0);
        const taxa = Number(r.taxa_leva_traz ?? 0);
        const desc = Number(r.desconto ?? 0);
        return {
          id: r.id as string,
          dia: r.__dia as string,
          cliente: r.clientes?.nome ?? "—",
          valor_executado: exec,
          taxa_leva_traz: taxa,
          desconto: desc,
          total: Math.max(0, exec + taxa - desc),
        };
      })
      .sort((a, b) => a.dia.localeCompare(b.dia));

    const dto: VerificacaoDTO = {
      periodo: { de, ate },
      fontes,
      divergencias,
      atendimentos_conferencia,
    };
    return dto;
  });
