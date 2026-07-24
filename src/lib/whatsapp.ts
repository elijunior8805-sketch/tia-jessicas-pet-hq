// Núcleo compartilhado de WhatsApp Web (client-safe).
// Nenhum disparo automático: apenas valida, formata e monta o link wa.me.

export type WhatsAppTipoMensagem =
  | "confirmacao_agendamento"
  | "lembrete_atendimento"
  | "aviso_atraso"
  | "pet_pronto"
  | "agradecimento"
  | "solicitacao_avaliacao"
  | "recomendacao_retorno"
  | "reativacao_cliente"
  | "lembrete_pagamento"
  | "cobranca_vencida"
  | "confirmacao_pagamento"
  | "parabens_cliente"
  | "aniversario_pet"
  | "personalizada";

export const TIPO_LABEL: Record<WhatsAppTipoMensagem, string> = {
  confirmacao_agendamento: "Confirmação de agendamento",
  lembrete_atendimento: "Lembrete do atendimento",
  aviso_atraso: "Aviso de atraso",
  pet_pronto: "Pet pronto para buscar",
  agradecimento: "Agradecimento",
  solicitacao_avaliacao: "Solicitação de avaliação",
  recomendacao_retorno: "Recomendação de retorno",
  reativacao_cliente: "Reativação de cliente",
  lembrete_pagamento: "Lembrete de pagamento",
  cobranca_vencida: "Cobrança de valor vencido",
  confirmacao_pagamento: "Confirmação de pagamento",
  parabens_cliente: "Parabéns para o cliente",
  aniversario_pet: "Aniversário do pet",
  personalizada: "Mensagem personalizada",
};

export type WhatsAppStatusManual =
  | "aberto"
  | "enviado"
  | "respondeu"
  | "sem_resposta"
  | "promessa"
  | "pago";

export const STATUS_LABEL: Record<WhatsAppStatusManual, string> = {
  aberto: "Aberto no WhatsApp",
  enviado: "Enviado",
  respondeu: "Cliente respondeu",
  sem_resposta: "Sem resposta",
  promessa: "Pagamento prometido",
  pago: "Pagamento realizado",
};

export type TelefoneValidado =
  | { ok: true; e164: string; formatado: string; ddd: string; digitos: string }
  | { ok: false; motivo: string };

/**
 * Padroniza para o formato brasileiro: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos).
 * Rejeita números sem DDD, curtos demais ou longos demais.
 */
export function normalizarTelefoneBR(raw: unknown): TelefoneValidado {
  if (raw === null || raw === undefined) {
    return { ok: false, motivo: "Telefone não informado" };
  }
  const somenteDigitos = String(raw).replace(/\D+/g, "");
  if (!somenteDigitos) return { ok: false, motivo: "Telefone não informado" };

  // Remove prefixo 55 quando duplicado
  let n = somenteDigitos;
  if (n.startsWith("55") && (n.length === 12 || n.length === 13)) {
    n = n.slice(2);
  }
  // Alguns cadastros trazem 0 na frente do DDD
  if (n.length === 11 && n.startsWith("0")) n = n.slice(1);
  if (n.length === 12 && n.startsWith("0")) n = n.slice(1);

  if (n.length < 10 || n.length > 11) {
    return {
      ok: false,
      motivo:
        "Número inválido. Informe DDD + telefone (ex.: 11 99999-0000).",
    };
  }
  const ddd = n.slice(0, 2);
  if (Number(ddd) < 11) {
    return { ok: false, motivo: "DDD inválido." };
  }
  const numero = n.slice(2);
  // Celular deve começar com 9 quando tem 9 dígitos
  if (numero.length === 9 && !numero.startsWith("9")) {
    return { ok: false, motivo: "Celular deve iniciar com 9 após o DDD." };
  }
  const e164 = `55${ddd}${numero}`;
  const formatado =
    numero.length === 9
      ? `+55 (${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`
      : `+55 (${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
  return { ok: true, e164, formatado, ddd, digitos: numero };
}

/** Comprimento máximo defensivo para wa.me (o WhatsApp trunca acima disso). */
export const WA_MAX_TEXT = 3500;

export function montarWaUrl(e164: string, texto: string): string {
  const t = (texto ?? "").slice(0, WA_MAX_TEXT);
  return `https://wa.me/${e164}?text=${encodeURIComponent(t)}`;
}

/** Pacote oficial do WhatsApp Business para Android. */
export const WHATSAPP_BUSINESS_PACKAGE = "com.whatsapp.w4b";

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

/** Extrai (e164, texto) de uma URL wa.me/api.whatsapp para reencaminhar ao Business. */
function parseWaUrl(url: string): { e164: string; texto: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "wa.me") {
      const e164 = u.pathname.replace(/\D+/g, "");
      const texto = u.searchParams.get("text") ?? "";
      if (!e164) return null;
      return { e164, texto };
    }
    if (host.endsWith("whatsapp.com")) {
      const e164 = (u.searchParams.get("phone") ?? "").replace(/\D+/g, "");
      const texto = u.searchParams.get("text") ?? "";
      if (!e164) return null;
      return { e164, texto };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Abre uma conversa preferencialmente no WhatsApp Business.
 *
 * - Android: intent:// com package=com.whatsapp.w4b e fallback wa.me.
 * - iOS/Desktop: wa.me em nova aba (o SO/seletor prioriza o Business quando
 *   ambos estão instalados; no desktop abre o WhatsApp Web já logado).
 */
export function abrirWhatsAppBusiness(e164Digits: string, texto: string = ""): void {
  if (typeof window === "undefined") return;
  const e164 = String(e164Digits).replace(/\D+/g, "");
  if (!e164) return;
  const textoTrunc = (texto ?? "").slice(0, WA_MAX_TEXT);
  const waUrl = `https://wa.me/${e164}${textoTrunc ? `?text=${encodeURIComponent(textoTrunc)}` : ""}`;

  if (isAndroid()) {
    const encText = encodeURIComponent(textoTrunc);
    const fallback = encodeURIComponent(waUrl);
    const intentUrl =
      `intent://send?phone=${e164}${encText ? `&text=${encText}` : ""}` +
      `#Intent;scheme=whatsapp;package=${WHATSAPP_BUSINESS_PACKAGE};` +
      `S.browser_fallback_url=${fallback};end`;
    try {
      window.location.href = intentUrl;
      return;
    } catch {
      // se o navegador bloquear intent://, cai no wa.me abaixo
    }
  }

  window.open(waUrl, "_blank", "noopener,noreferrer");
}

/**
 * Compat: aceita uma URL wa.me/api.whatsapp já montada e redireciona
 * para o abridor do Business quando possível.
 */
export function abrirWhatsApp(url: string): void {
  if (typeof window === "undefined") return;
  const parsed = parseWaUrl(url);
  if (parsed) {
    abrirWhatsAppBusiness(parsed.e164, parsed.texto);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Formata um telefone para exibição sem validar (usa o melhor esforço). */
export function formatarTelefoneBR(raw: unknown): string {
  const v = normalizarTelefoneBR(raw);
  return v.ok ? v.formatado : String(raw ?? "");
}
