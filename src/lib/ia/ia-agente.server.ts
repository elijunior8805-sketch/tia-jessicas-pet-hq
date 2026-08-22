import { z } from "zod";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

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
  // Mock ou implementação real com Gemini via Lovable AI Gateway
  // Por enquanto, vamos retornar uma estrutura baseada no texto
  const lowercaseText = texto.toLowerCase();
  
  let intencao: IAIntent["intencao"] = "comando_nao_reconhecido";
  let resumo = "";

  if (lowercaseText.includes("agenda") || lowercaseText.includes("horário")) {
    intencao = "consulta_agenda";
    resumo = "Consultando a agenda para você.";
  } else if (lowercaseText.includes("cliente")) {
    intencao = "consulta_cliente";
    resumo = "Buscando informações do cliente.";
  }

  return {
    intencao,
    nivel_confianca: 0.9,
    resposta_ia: resumo || "Entendido. Como posso ajudar mais?",
    resumo_acao: resumo
  } as IAIntent;
}

