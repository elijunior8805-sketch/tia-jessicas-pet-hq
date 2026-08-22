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

export async function classificarComandoIA(texto: string, contexto?: { role: 'user' | 'assistant', content: string }[], sb?: any) {
  const { chamarIA } = await import("../ia-core.server");
  const { carregarIaConfig } = await import("../ia-core.server");
  
  const config = await carregarIaConfig(sb);
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  
  const systemPrompt = `Você é a Assistente Operacional IA do Spa de Pet Tia Jéssica.
Sua função agora é INTERPRETAR comandos e CONSULTAR dados.
Estamos na Fase 2: Consultas Inteligentes.

DATA ATUAL: ${dataAtual}

INTENÇÕES POSSÍVEIS:
- consulta_agenda: Para perguntas sobre horários, quem vem hoje, próximos banhos, leva e traz.
- consulta_cliente: Para buscar dados de tutores, endereços, telefones.
- consulta_pet: Para buscar ficha do pet, raça, comportamento, último atendimento.
- consulta_financeira: Para dívidas, quanto recebeu, pagamentos do dia.
- disponibilidade: Para verificar horários livres.
- comando_nao_reconhecido: Quando não entender.

REGRAS CRÍTICAS:
1. NÃO invente dados. Se não souber, diga que precisa buscar ou que não encontrou.
2. Extraia nomes de pets e clientes com precisão.
3. Se o usuário perguntar "Quem vem hoje?", a intenção é consulta_agenda e a data é ${dataAtual}.
4. Responda SEMPRE em formato JSON seguindo o schema IAIntentSchema.

Exemplo de saída:
{
  "intencao": "consulta_agenda",
  "data": "2026-08-22",
  "resposta_ia": "Vou verificar a agenda de hoje para você.",
  "nivel_confianca": 0.98
}`;

  try {
    const res = await chamarIA({
      system: systemPrompt,
      prompt: texto,
      config,
      json: true,
      origem: "assistente_ia_classificador"
    });

    const parsed = JSON.parse(res.texto);
    return {
      ...parsed,
      nivel_confianca: parsed.nivel_confianca || 0.9
    } as IAIntent;
  } catch (error) {
    console.error("Erro na classificação IA:", error);
    // Fallback para o classificador básico se a IA falhar
    return fallbackClassificador(texto);
  }
}

function fallbackClassificador(texto: string): IAIntent {
  const lowercaseText = texto.toLowerCase();
  let intencao: IAIntent["intencao"] = "comando_nao_reconhecido";
  
  if (lowercaseText.includes("agenda") || lowercaseText.includes("hoje") || lowercaseText.includes("amanhã")) {
    intencao = "consulta_agenda";
  } else if (lowercaseText.includes("cliente")) {
    intencao = "consulta_cliente";
  } else if (lowercaseText.includes("pet")) {
    intencao = "consulta_pet";
  } else if (lowercaseText.includes("financeiro") || lowercaseText.includes("pagamento")) {
    intencao = "consulta_financeira";
  }

  return {
    intencao,
    nivel_confianca: 0.5,
    resposta_ia: "Estou processando sua solicitação..."
  } as IAIntent;
}



