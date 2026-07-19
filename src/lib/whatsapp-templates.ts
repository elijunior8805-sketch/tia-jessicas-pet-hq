// Templates de mensagem para WhatsApp. Renderização puramente client-safe.
import type { WhatsAppTipoMensagem } from "./whatsapp";

export type TemplateCtx = {
  tutor?: string | null;
  pet?: string | null;
  servico?: string | null;
  data?: string | null;
  hora?: string | null;
  valor?: string | null;
  vencimento?: string | null;
  pix?: string | null;
  empresa?: string | null;
  extra?: string | null;
};

function primeiroNome(nome?: string | null): string {
  if (!nome) return "tudo bem";
  const n = String(nome).trim().split(/\s+/)[0];
  return n || "tudo bem";
}

function preencher(t: string, ctx: TemplateCtx): string {
  const map: Record<string, string> = {
    "{tutor}": primeiroNome(ctx.tutor),
    "{tutor_completo}": (ctx.tutor ?? "").trim(),
    "{pet}": (ctx.pet ?? "seu pet").trim() || "seu pet",
    "{servico}": (ctx.servico ?? "atendimento").trim() || "atendimento",
    "{data}": (ctx.data ?? "").trim(),
    "{hora}": (ctx.hora ?? "").trim(),
    "{valor}": (ctx.valor ?? "").trim(),
    "{vencimento}": (ctx.vencimento ?? "").trim(),
    "{pix}": (ctx.pix ?? "").trim(),
    "{empresa}": (ctx.empresa ?? "Spa da Tia Jéssica").trim() || "Spa da Tia Jéssica",
    "{extra}": (ctx.extra ?? "").trim(),
  };
  return t
    .replace(/\{[a-z_]+\}/g, (m) => (m in map ? map[m] : m))
    // remove linhas que ficaram só com "R$ " ou "()" quando faltou dado
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const TEMPLATES: Record<WhatsAppTipoMensagem, string> = {
  confirmacao_agendamento:
    "Olá, {tutor}! Aqui é do {empresa} 🐾\n" +
    "Passando para confirmar o atendimento do {pet} no dia {data} às {hora}.\n" +
    "Pode confirmar por aqui, por favor?",

  lembrete_atendimento:
    "Oi, {tutor}! Lembrete carinhoso: o atendimento do {pet} está marcado para {data} às {hora}.\n" +
    "Se precisar remarcar, é só nos avisar. 💛",

  aviso_atraso:
    "Olá, {tutor}. Tudo bem?\n" +
    "Estamos com um pequeno atraso na agenda de hoje. Assim que estivermos prontos para receber o {pet}, avisamos por aqui.\n" +
    "Obrigado pela compreensão!",

  pet_pronto:
    "Oi, {tutor}! O {pet} já está pronto e cheiroso para buscar. ✨\n" +
    "Estamos te esperando!",

  agradecimento:
    "Obrigado pela confiança, {tutor}! Foi um prazer receber o {pet} hoje.\n" +
    "Qualquer coisa, é só chamar por aqui. 🐾",

  solicitacao_avaliacao:
    "Oi, {tutor}! Esperamos que o {pet} tenha adorado o atendimento. 💛\n" +
    "Se puder, deixa uma avaliação para a gente? Isso ajuda muito o nosso trabalho.",

  recomendacao_retorno:
    "Olá, {tutor}! Já faz um tempinho desde o último banho/tosa do {pet}.\n" +
    "Que tal agendarmos um retorno? Temos horários disponíveis nos próximos dias.",

  reativacao_cliente:
    "Oi, {tutor}! Sentimos saudade do {pet} por aqui. 🐾\n" +
    "Se quiser, podemos reservar um horário especial para vocês esta semana.",

  lembrete_pagamento:
    "Olá, {tutor}. Tudo bem?\n" +
    "Passando para lembrar do pagamento de R$ {valor} referente ao atendimento do {pet} em {data}.\n" +
    "Vencimento: {vencimento}.\n" +
    "{pix}\n" +
    "Se já efetuou, por favor desconsidere. 💛",

  cobranca_vencida:
    "Olá, {tutor}. Tudo bem?\n" +
    "Identificamos que o pagamento de R$ {valor}, referente ao atendimento do {pet} realizado em {data}, ainda está pendente.\n" +
    "Caso já tenha efetuado, por favor desconsidere esta mensagem.\n" +
    "Se precisar da chave Pix ou quiser conversar sobre o pagamento, estamos à disposição.\n" +
    "{pix}",

  confirmacao_pagamento:
    "Oi, {tutor}! Confirmamos o recebimento do pagamento de R$ {valor} referente ao atendimento do {pet}. ✅\n" +
    "Muito obrigado pela confiança!",

  parabens_cliente:
    "Olá, {tutor}! O {empresa} deseja um feliz aniversário para você. 🎉\n" +
    "Que seu dia seja tão especial quanto o carinho que você dedica ao {pet}. 💛",

  aniversario_pet:
    "🎂 Feliz aniversário para o(a) {pet}! 🐾\n" +
    "O {empresa} deseja um dia cheio de carinho, petiscos e passeios. Um beijo para toda a família!",

  personalizada: "",
};

export function renderTemplate(
  tipo: WhatsAppTipoMensagem,
  ctx: TemplateCtx = {}
): string {
  const base = TEMPLATES[tipo] ?? "";
  const texto = preencher(base, ctx);
  // Remove a linha do Pix se não houver chave
  if (!ctx.pix) return texto.replace(/^\{pix\}\s*$/gim, "").trim();
  const pixLinha = `Chave Pix: ${ctx.pix}`;
  return texto.replace(/\{pix\}/g, pixLinha);
}

export const TOM_OPCOES = [
  { value: "amigavel", label: "Amigável" },
  { value: "profissional", label: "Profissional" },
  { value: "acolhedor", label: "Acolhedor" },
  { value: "cobranca_educada", label: "Cobrança educada" },
  { value: "confirmacao_objetiva", label: "Confirmação objetiva" },
] as const;

export type TomIA = (typeof TOM_OPCOES)[number]["value"];
