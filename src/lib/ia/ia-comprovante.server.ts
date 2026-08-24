import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { compararNome } from "./ia-nomes";

export interface CandidatoConciliacao {
  pagamento_id: string;
  cliente_nome: string;
  pet_nome?: string | null;
  valor_previsto: number;
  vencimento?: string | null;
  status: string;
  score: number;
  motivo: string;
}

export interface ComprovanteAnalise {
  valor: number;
  data: string;
  horario: string;
  pagador: string;
  recebedor: string;
  instituicao: string;
  id_transacao?: string;
  /** 'concluido' = transferência efetivada | 'agendado' = programada para data futura */
  situacao: "concluido" | "agendado" | "indefinido";
  comprovante_hash?: string;
  confianca: number;
  sucesso: boolean;
  success: boolean;
  duplicado?: boolean;
  candidatos?: CandidatoConciliacao[];
  mensagem?: string;
  result?: any;
}

function respostaFalha(mensagem: string, extra: Partial<ComprovanteAnalise> = {}): ComprovanteAnalise {
  return {
    valor: 0,
    data: "",
    horario: "",
    pagador: "",
    recebedor: "",
    instituicao: "",
    situacao: "indefinido",
    confianca: 0,
    sucesso: false,
    success: false,
    mensagem,
    ...extra,
  };
}

async function calcularHash(base64: string): Promise<string> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Sugere pagamentos em aberto compatíveis com o comprovante (valor + nome do pagador). */
async function conciliar(
  sb: SupabaseClient<Database>,
  valor: number,
  pagador: string,
): Promise<CandidatoConciliacao[]> {
  const { data } = await sb
    .from("pagamentos")
    .select("id, valor_previsto, valor_pago, status, data_vencimento, clientes(nome), pets(nome)")
    .in("status", ["pendente", "parcial", "atrasado"])
    .is("arquivado_em", null)
    .limit(300);

  if (!data) return [];

  const candidatos: CandidatoConciliacao[] = [];
  for (const p of data as any[]) {
    const previsto = Number(p.valor_previsto || 0) - Number(p.valor_pago || 0);
    const nomeCliente = p.clientes?.nome || "";
    const matchNome = pagador ? compararNome(pagador, nomeCliente) : null;
    const diff = Math.abs(previsto - valor);

    let score = 0;
    const motivos: string[] = [];
    if (diff < 0.01) {
      score += 0.6;
      motivos.push("valor exato");
    } else if (diff <= Math.max(1, previsto * 0.02)) {
      score += 0.35;
      motivos.push("valor aproximado");
    }
    if (matchNome && matchNome.score >= 0.5) {
      score += matchNome.score * 0.4;
      motivos.push("nome do pagador compatível");
    }

    if (score >= 0.35) {
      candidatos.push({
        pagamento_id: p.id,
        cliente_nome: nomeCliente,
        pet_nome: p.pets?.nome || null,
        valor_previsto: previsto,
        vencimento: p.data_vencimento,
        status: p.status,
        score: Number(score.toFixed(2)),
        motivo: motivos.join(" + "),
      });
    }
  }

  return candidatos.sort((a, b) => b.score - a.score).slice(0, 5);
}

export async function analisarComprovanteIA(
  sb: SupabaseClient<Database>,
  imagemBase64: string,
  contentType: string = "image/jpeg"
): Promise<ComprovanteAnalise> {
  const { chamarIA, carregarIaConfig } = await import("../ia-core.server");
  const config = await carregarIaConfig(sb);

  // 1) Hash do arquivo — bloqueia reimportação do MESMO comprovante
  let hash = "";
  try {
    hash = await calcularHash(imagemBase64);
  } catch {
    hash = "";
  }

  if (hash) {
    const { data: jaUsado } = await sb
      .from("pagamentos")
      .select("id, data_pagamento, valor_pago")
      .eq("comprovante_hash", hash)
      .is("arquivado_em", null)
      .maybeSingle();

    if (jaUsado) {
      return respostaFalha(
        `Este mesmo comprovante já foi importado e usado na baixa do pagamento ${jaUsado.id} em ${jaUsado.data_pagamento}. Nenhum lançamento novo foi feito.`,
        { duplicado: true, comprovante_hash: hash },
      );
    }
  }

  const ehPdf = contentType === "application/pdf" || contentType.includes("pdf");

  const systemPrompt = `Você é um especialista em análise de comprovantes bancários brasileiros (especialmente PIX).
Extraia as informações do documento em JSON:
- valor (number)
- data (string: YYYY-MM-DD) — data em que o dinheiro é/foi transferido
- horario (string: HH:MM)
- pagador (string) — quem enviou
- recebedor (string) — quem recebeu
- instituicao (string)
- id_transacao (string) — Identificador, ID da Transação ou código End-to-End (E2E)
- situacao (string): "concluido" quando a transferência já foi efetivada; "agendado" quando é um Pix agendado/programado para data futura; "indefinido" se não der para saber
- legivel (boolean): false se o documento estiver cortado, borrado ou ilegível

Regras:
1. Nunca invente dados. Campo ausente = null.
2. Se o valor não for legível, retorne legivel: false.
3. Responda APENAS o JSON.`;

  try {
    const res = await chamarIA({
      system: systemPrompt,
      prompt: ehPdf
        ? "Analise este comprovante em PDF e extraia os dados financeiros."
        : "Analise este comprovante e extraia os dados financeiros.",
      config,
      json: true,
      origem: "ia_analise_comprovante",
      sb,
      extraContent: [
        ehPdf
          ? { type: "file", file: { filename: "comprovante.pdf", file_data: `data:application/pdf;base64,${imagemBase64}` } }
          : { type: "image", image_url: { url: `data:${contentType};base64,${imagemBase64}` } },
      ],
    });

    const parsed = JSON.parse(res.texto);

    if (parsed.legivel === false || !parsed.valor) {
      return respostaFalha(
        "O comprovante está ilegível ou incompleto (não consegui ler o valor). Envie a imagem inteira, sem cortes, ou informe os dados manualmente.",
        { comprovante_hash: hash },
      );
    }

    // 2) Duplicidade por ID da transação
    if (parsed.id_transacao) {
      const { data: existente } = await sb
        .from("pagamentos")
        .select("id, status, data_pagamento")
        .eq("id_transacao_bancaria", parsed.id_transacao)
        .is("arquivado_em", null)
        .maybeSingle();

      if (existente) {
        return respostaFalha(
          `Esta transação já consta no sistema (pagamento ${existente.id}, baixado em ${existente.data_pagamento}). Nada foi lançado em duplicidade.`,
          { duplicado: true, comprovante_hash: hash, ...parsed },
        );
      }
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const situacao: ComprovanteAnalise["situacao"] =
      parsed.situacao === "agendado" || (parsed.data && parsed.data > hoje)
        ? "agendado"
        : parsed.situacao === "concluido"
          ? "concluido"
          : "indefinido";

    const candidatos = await conciliar(sb, Number(parsed.valor || 0), String(parsed.pagador || ""));

    return {
      ...parsed,
      valor: Number(parsed.valor || 0),
      situacao,
      comprovante_hash: hash,
      candidatos,
      duplicado: false,
      confianca: 0.95,
      sucesso: true,
      success: true,
      mensagem:
        situacao === "agendado"
          ? "Pix AGENDADO: o dinheiro ainda não caiu. Registrarei apenas como promessa de pagamento, sem baixa."
          : undefined,
      result: parsed,
    };
  } catch (error) {
    console.error("Erro ao analisar comprovante:", error);
    return respostaFalha("Não foi possível processar o comprovante. Tente enviar uma imagem mais nítida ou o PDF original.", {
      comprovante_hash: hash,
    });
  }
}
