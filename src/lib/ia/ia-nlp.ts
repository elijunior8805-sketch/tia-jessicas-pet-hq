/**
 * Pré-interpretador determinístico de comandos em português (voz e texto).
 * Roda ANTES do modelo, no fuso America/Sao_Paulo, e nunca inventa valores.
 */

import { removerAcentos } from "./ia-nomes";

export const TZ = "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no fuso do estabelecimento. */
export function hojeSP(base: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(base);
}

function addDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

function diaDaSemana(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const MESES: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4,
  maio: 5, mai: 5, junho: 6, jun: 6, julho: 7, jul: 7, agosto: 8, ago: 8,
  setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11,
  dezembro: 12, dez: 12,
};

const SEMANA: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};

const NUM_EXTENSO: Record<string, number> = {
  uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20,
};

export function limpar(texto: string): string {
  return removerAcentos((texto || "").toLowerCase()).replace(/\s+/g, " ").trim();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Interpreta a data mencionada. Retorna null quando não houver data explícita. */
export function interpretarData(texto: string, hoje = hojeSP()): string | null {
  const t = limpar(texto);
  const anoAtual = Number(hoje.slice(0, 4));

  if (/\bdepois de amanha\b/.test(t)) return addDias(hoje, 2);
  if (/\bamanha\b/.test(t)) return addDias(hoje, 1);
  if (/\bhoje\b/.test(t)) return hoje;

  // dd/mm ou dd/mm/aaaa ou dd-mm
  const barra = t.match(/\b(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?\b/);
  if (barra) {
    const dia = Number(barra[1]);
    const mes = Number(barra[2]);
    let ano = barra[3] ? Number(barra[3]) : anoAtual;
    if (ano < 100) ano += 2000;
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      return ajustarAno(`${ano}-${pad(mes)}-${pad(dia)}`, hoje, !barra[3]);
    }
  }

  // "28 do 8" / "28 do mes 8"
  const doMes = t.match(/\b(?:dia\s+)?(\d{1,2})\s+do\s+(?:mes\s+)?(\d{1,2})\b/);
  if (doMes) {
    const dia = Number(doMes[1]);
    const mes = Number(doMes[2]);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      return ajustarAno(`${anoAtual}-${pad(mes)}-${pad(dia)}`, hoje, true);
    }
  }

  // "28 de agosto" / "28 agosto"
  const porExtenso = t.match(
    /\b(?:dia\s+)?(\d{1,2})\s*(?:de\s+)?(janeiro|jan|fevereiro|fev|marco|mar|abril|abr|maio|mai|junho|jun|julho|jul|agosto|ago|setembro|set|outubro|out|novembro|nov|dezembro|dez)\b/,
  );
  if (porExtenso) {
    const dia = Number(porExtenso[1]);
    const mes = MESES[porExtenso[2]];
    if (dia >= 1 && dia <= 31 && mes) {
      return ajustarAno(`${anoAtual}-${pad(mes)}-${pad(dia)}`, hoje, true);
    }
  }

  // "próxima terça" / "terça que vem" / "na terça"
  const semana = t.match(
    /\b(?:proxima|proximo|na|no|essa|esta)?\s*(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:\s*-?\s*feira)?(?:\s+que\s+vem)?\b/,
  );
  if (semana) {
    const alvo = SEMANA[semana[1]];
    const atual = diaDaSemana(hoje);
    let delta = (alvo - atual + 7) % 7;
    if (delta === 0) delta = 7;
    return addDias(hoje, delta);
  }

  // "dia 28" isolado
  const soDia = t.match(/\bdia\s+(\d{1,2})\b/);
  if (soDia) {
    const dia = Number(soDia[1]);
    if (dia >= 1 && dia <= 31) {
      const mesAtual = Number(hoje.slice(5, 7));
      const candidato = `${anoAtual}-${pad(mesAtual)}-${pad(dia)}`;
      return candidato < hoje ? proximoMes(candidato) : candidato;
    }
  }

  return null;
}

function proximoMes(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const mes = m === 12 ? 1 : m + 1;
  const ano = m === 12 ? y + 1 : y;
  return `${ano}-${pad(mes)}-${pad(d)}`;
}

/** Sem ano explícito, uma data já passada refere-se ao próximo ano. */
function ajustarAno(iso: string, hoje: string, semAno: boolean): string {
  if (!semAno) return iso;
  if (iso >= hoje) return iso;
  const ano = Number(iso.slice(0, 4)) + 1;
  return `${ano}${iso.slice(4)}`;
}

/** Interpreta o horário mencionado (HH:MM). Retorna null se não houver. */
export function interpretarHora(texto: string): string | null {
  const t = limpar(texto);

  if (/\bmeio[\s-]?dia\b/.test(t)) return "12:00";
  if (/\bmeia[\s-]?noite\b/.test(t)) return "00:00";

  const periodo = /\b(da|de|a)\s+(tarde|noite)\b/.test(t)
    ? "pm"
    : /\b(da|de|a)\s+(manha)\b/.test(t)
      ? "am"
      : null;

  // 14:30 / 14h30 / 14 h 30
  const comMinutos = t.match(/\b(\d{1,2})\s*(?::|h|hs|hrs|horas?)\s*(\d{2})\b/);
  if (comMinutos) {
    let h = Number(comMinutos[1]);
    const m = Number(comMinutos[2]);
    if (periodo === "pm" && h < 12) h += 12;
    if (h <= 23 && m <= 59) return `${pad(h)}:${pad(m)}`;
  }

  // 14h / 14 horas / às 14
  const soHora = t.match(/\b(?:as|às|a)?\s*(\d{1,2})\s*(?:h|hs|hrs|horas?)\b/);
  if (soHora) {
    let h = Number(soHora[1]);
    if (periodo === "pm" && h < 12) h += 12;
    if (h <= 23) return `${pad(h)}:00`;
  }

  // "duas da tarde", "oito da manhã"
  const extenso = t.match(
    /\b(uma|um|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\s+(?:e\s+meia\s+)?(?:da|de)\s+(manha|tarde|noite)\b/,
  );
  if (extenso) {
    let h = NUM_EXTENSO[extenso[1]] ?? 0;
    const parte = extenso[2];
    if ((parte === "tarde" || parte === "noite") && h < 12) h += 12;
    const meia = /e\s+meia/.test(extenso[0]) ? 30 : 0;
    if (h <= 23) return `${pad(h)}:${pad(meia)}`;
  }

  // "às 14" (sem sufixo) apenas quando precedido de "as/às"
  const cru = t.match(/\b(?:as|às)\s+(\d{1,2})\b/);
  if (cru) {
    let h = Number(cru[1]);
    if (periodo === "pm" && h < 12) h += 12;
    if (h <= 23) return `${pad(h)}:00`;
  }

  return null;
}

const SERVICOS_CONHECIDOS = [
  "banho e tosa",
  "banho",
  "tosa higienica",
  "tosa na maquina",
  "tosa na tesoura",
  "tosa",
  "hidratacao",
  "desembolo",
  "escovacao",
  "tosa bebe",
  "spa",
];

export function detectarServico(texto: string): string | null {
  const t = limpar(texto);
  for (const s of SERVICOS_CONHECIDOS) {
    if (t.includes(s)) return s;
  }
  return null;
}

const PALAVRAS_AGENDAR = /\b(agendar|agenda|agendamento|marcar|marca|marque|reservar|encaixar|encaixe)\b/;

const STOP_NOME =
  /\b(dia|dias|para|pra|pro|no|na|em|as|às|a|de|do|da|hoje|amanha|depois|proxima|proximo|banho|tosa|hidratacao|spa|com|cliente|pet|horas?|h|hs|servico|servicos|leva|traz|transporte|segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/;

/** Extrai o provável nome do cliente citado no comando. */
export function extrairNomeCliente(texto: string): string | null {
  const original = (texto || "").replace(/\s+/g, " ").trim();
  const t = limpar(original);

  const capturar = (inicio: number): string | null => {
    const restoNorm = t.slice(inicio).trim();
    const restoOrig = original.slice(inicio).trim();
    const tokensNorm = restoNorm.split(" ");
    const tokensOrig = restoOrig.split(" ");
    const nome: string[] = [];
    for (let i = 0; i < tokensNorm.length && nome.length < 4; i++) {
      const tk = tokensNorm[i];
      if (!tk) continue;
      if (STOP_NOME.test(tk) || /^\d/.test(tk)) break;
      nome.push((tokensOrig[i] || tk).replace(/[,.;]$/, ""));
    }
    const final = nome.join(" ").trim();
    return final.length >= 2 ? final : null;
  };

  // "cliente <nome>"
  const mCliente = t.match(/\bcliente\s+/);
  if (mCliente && mCliente.index !== undefined) {
    const r = capturar(mCliente.index + mCliente[0].length);
    if (r) return r;
  }

  // "para o <nome>" / "pro <nome>" / "para <nome>"
  const mPara = t.match(/\b(?:para\s+(?:o|a)\s+|pro\s+|pra\s+|para\s+)/);
  if (mPara && mPara.index !== undefined) {
    const r = capturar(mPara.index + mPara[0].length);
    if (r) return r;
  }

  // "agendar <nome> ..." / "marca um banho para ..." já tratado acima
  const mAgendar = t.match(PALAVRAS_AGENDAR);
  if (mAgendar && mAgendar.index !== undefined) {
    const r = capturar(mAgendar.index + mAgendar[0].length);
    if (r) return r;
  }

  return null;
}

export interface PreInterpretacao {
  intencao: "criar_agendamento" | null;
  cliente_nome: string | null;
  servico_nome: string | null;
  data: string | null;
  hora: string | null;
  transporte: boolean | null;
  informacoes_faltantes: string[];
  nivel_confianca: number;
}

/**
 * Detecta de forma determinística a intenção de agendar e os dados presentes.
 * Nunca preenche o que não foi dito.
 */
export function preInterpretar(texto: string, hoje = hojeSP()): PreInterpretacao {
  const t = limpar(texto);
  const querAgendar =
    PALAVRAS_AGENDAR.test(t) ||
    /\bnovo agendamento\b/.test(t) ||
    (/\bquero\b/.test(t) && /\bagend/.test(t));

  const data = interpretarData(texto, hoje);
  const hora = interpretarHora(texto);
  const servico_nome = detectarServico(texto);
  const cliente_nome = querAgendar ? extrairNomeCliente(texto) : null;
  const transporte = /\bleva e traz\b|\btransporte\b|\bbuscar\b|\bbusca e entrega\b/.test(t)
    ? true
    : /\bsem transporte\b|\bsem leva e traz\b/.test(t)
      ? false
      : null;

  const faltantes: string[] = [];
  if (querAgendar) {
    if (!cliente_nome) faltantes.push("cliente");
    if (!servico_nome) faltantes.push("servico");
    if (!data) faltantes.push("data");
    if (!hora) faltantes.push("hora");
  }

  const preenchidos = [cliente_nome, servico_nome, data, hora].filter(Boolean).length;

  return {
    intencao: querAgendar ? "criar_agendamento" : null,
    cliente_nome,
    servico_nome,
    data,
    hora,
    transporte,
    informacoes_faltantes: faltantes,
    nivel_confianca: querAgendar ? Math.min(1, 0.6 + preenchidos * 0.1) : 0,
  };
}

/** Interpreta uma escolha do usuário em uma lista ("o primeiro", "final 1234", "o do pet Thor"). */
export function interpretarEscolha(
  texto: string,
  opcoes: { nome: string; telefone?: string | null; pets?: { nome: string }[] }[],
): number | null {
  const t = limpar(texto);
  const ordinais = ["primeiro", "segundo", "terceiro", "quarto", "quinto"];
  for (let i = 0; i < ordinais.length; i++) {
    if (t.includes(ordinais[i]) && opcoes[i]) return i;
  }
  const numero = t.match(/\b(?:opcao\s+)?([1-9])\b/);
  if (numero) {
    const idx = Number(numero[1]) - 1;
    if (opcoes[idx]) return idx;
  }
  const final = t.match(/\bfinal\s*(\d{4})\b/);
  if (final) {
    const idx = opcoes.findIndex((o) => (o.telefone || "").replace(/\D/g, "").endsWith(final[1]));
    if (idx >= 0) return idx;
  }
  const pet = t.match(/\bpet\s+([a-z0-9]+)/);
  if (pet) {
    const idx = opcoes.findIndex((o) =>
      (o.pets || []).some((p) => limpar(p.nome) === pet[1]),
    );
    if (idx >= 0) return idx;
  }
  const idxNome = opcoes.findIndex((o) => limpar(o.nome) === t);
  return idxNome >= 0 ? idxNome : null;
}
