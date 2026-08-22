import { z } from "zod";


export const IAIntentSchema = z.object({
  intencao: z.enum([
    "consulta_agenda",
    "consulta_cliente",
    "consulta_pet",
    "consulta_financeira",
    "criar_agendamento",
    "remarcar",
    "cancelar",
    "cadastrar_cliente",
    "cadastrar_pet",
    "registrar_pagamento",
    "analisar_comprovante",
    "solicitar_resumo_operacional",
    "solicitar_analise_reativacao",
    "comando_nao_reconhecido"
  ]),
  cliente_nome: z.string().optional().nullable(),
  cliente_telefone: z.string().optional().nullable(),
  pet_nome: z.string().optional().nullable(),
  servicos: z.array(z.string()).optional().nullable(),
  data: z.string().optional().nullable(),
  horario: z.string().optional().nullable(),
  profissional: z.string().optional().nullable(),
  valor: z.number().optional().nullable(),
  forma_pagamento: z.string().optional().nullable(),
  transporte: z.boolean().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  informacoes_faltantes: z.array(z.string()).optional().nullable(),
  nivel_confianca: z.number().min(0).max(1),
  resposta_ia: z.string().optional().nullable(),
  resumo_acao: z.string().optional().nullable(),
});

export type IAIntent = z.infer<typeof IAIntentSchema>;

export interface IAMessage {
  role: 'user' | 'assistant';
  content: string;
  intent?: IAIntent;
  timestamp: string;
}

export async function classificarComandoIA(texto: string, contexto?: { role: 'user' | 'assistant', content: string }[]) {
  const lowercaseText = texto.toLowerCase();
  
  let intencao: IAIntent["intencao"] = "comando_nao_reconhecido";
  let resumo = "";
  let resumo_acao = "";

  if (lowercaseText.includes("agenda") || lowercaseText.includes("horário") || lowercaseText.includes("atendimentos")) {
    intencao = "consulta_agenda";
    resumo = "Estou verificando os agendamentos no sistema para você.";
    resumo_acao = "Consultar agenda de hoje";
  } else if (lowercaseText.includes("cliente") || lowercaseText.includes("tutor")) {
    intencao = "consulta_cliente";
    resumo = "Localizando as informações do cliente solicitado.";
    resumo_acao = "Buscar cliente";
  } else if (lowercaseText.includes("pet") || lowercaseText.includes("cachorro") || lowercaseText.includes("gato")) {
    intencao = "consulta_pet";
    resumo = "Buscando a ficha do pet no banco de dados.";
    resumo_acao = "Buscar pet";
  } else if (lowercaseText.includes("pagou") || lowercaseText.includes("receber") || lowercaseText.includes("financeiro")) {
    intencao = "consulta_financeira";
    resumo = "Analisando o status financeiro e pagamentos pendentes.";
    resumo_acao = "Consultar financeiro";
  } else if (lowercaseText.includes("agendar") || lowercaseText.includes("marcar")) {
    intencao = "criar_agendamento";
    resumo = "Preparando para criar um novo agendamento. Preciso confirmar os detalhes.";
    resumo_acao = "Criar novo agendamento";
  } else if (lowercaseText.includes("cadastrar") && (lowercaseText.includes("pet") || lowercaseText.includes("cachorro"))) {
    intencao = "cadastrar_pet";
    resumo = "Iniciando o cadastro de um novo pet.";
    resumo_acao = "Cadastrar pet";
  } else {
    resumo = "Entendi seu comando. Como deseja prosseguir com esta operação?";
  }

  return {
    intencao,
    nivel_confianca: 0.95,
    resposta_ia: resumo,
    resumo_acao: resumo_acao || null
  } as IAIntent;
}


