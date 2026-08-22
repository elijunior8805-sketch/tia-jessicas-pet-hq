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
    "identificar_pendencia",
    "confirmar_baixa",
    "cancelar_pagamento",
    "solicitar_resumo_operacional",
    "analisar_risco_evasao",
    "sugerir_otimizacao_agenda",
    "disponibilidade",
    "comando_nao_reconhecido"
  ]),
  cliente_nome: z.string().optional().nullable(),
  cliente_telefone: z.string().optional().nullable(),
  cliente_id: z.string().optional().nullable(),
  pet_nome: z.string().optional().nullable(),
  pet_id: z.string().optional().nullable(),
  servicos: z.array(z.string()).optional().nullable(),
  servicos_ids: z.array(z.string()).optional().nullable(),
  data: z.string().optional().nullable(),
  horario: z.string().optional().nullable(),
  profissional: z.string().optional().nullable(),
  valor: z.number().optional().nullable(),
  forma_pagamento: z.string().optional().nullable(),
  transporte: z.boolean().optional().nullable(),
  taxa_transporte: z.number().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  informacoes_faltantes: z.array(z.string()).optional().nullable(),
  nivel_confianca: z.number().min(0).max(1),
  exige_confirmacao: z.boolean().default(false),
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
  
  const systemPrompt = `Você é a Assistente Operacional interna do Spa de Pet Tia Jéssica.

Seu usuário é o proprietário, administrador, gerente ou funcionário autorizado. Você não está conversando com o cliente final do Spa.

Sua função é ajudar o usuário interno a consultar informações e executar tarefas operacionais autorizadas dentro do sistema.

Você deverá compreender comandos relacionados a agenda, atendimentos, clientes, pets, serviços, financeiro, cobranças, pagamentos e gestão.

Você somente deverá falar como atendente para o tutor quando o usuário interno solicitar explicitamente a criação de uma mensagem para um cliente.

Não invente dados. Não afirme que realizou uma consulta ou ação sem utilizar uma ferramenta real do sistema.

CONTEXTO DO AMBIENTE:
- DATA ATUAL: ${dataAtual}
- SISTEMA: ERP Premium Spa de Pet Tia Jéssica.

FERRAMENTAS DISPONÍVEIS (Intenções):
1. CONSULTAS:
   - consulta_agenda: Ver ocupação e horários.
   - consulta_cliente: Buscar dados de tutores.
   - consulta_pet: Buscar dados de animais.
   - consulta_financeira: Faturamento, pendências, devedores.
   - solicitar_resumo_operacional: Visão geral do dia.

2. AÇÕES (Exigem confirmação na UI):
   - criar_agendamento: Montar rascunho de novo atendimento.
   - registrar_pagamento: Vincular comprovante ou dar baixa.
   - analisar_comprovante: IA Vision para ler recibos.

IDENTIDADE OBRIGATÓRIA E REGRAS:
- NUNCA trate o proprietário como tutor/cliente.
- NUNCA ofereça vender banho/tosa para o usuário logado.
- NUNCA peça cadastro do usuário como cliente.
- Se o usuário perguntar "conhecer serviços", pergunte se ele quer ver o cadastro de serviços ou criar uma mensagem para um cliente.
- Se a intenção for criar mensagem para cliente, use um tom profissional e acolhedor (da Tia Jéssica para o Tutor).

REGRAS DE RESPOSTA (JSON):
- Retorne SEMPRE um JSON válido seguindo o IAIntentSchema.
- nivel_confianca: 0 a 1.
- exige_confirmacao: true para qualquer ação de escrita (agendar, pagar, cancelar).
- resposta_ia: Sua resposta amigável e profissional como ASSISTENTE INTERNA.`;

  try {
    const res = await chamarIA({
      system: systemPrompt,
      prompt: texto,
      config,
      json: true,
      origem: "assistente_ia_classificador"
    });

    const parsed = JSON.parse(res.texto);
    
    // Se a intenção for 'registrar_pagamento' mas não houver valor, 
    // e o contexto tiver 'analisar_comprovante', mantemos a intenção original
    // da IA para processamento de comprovante se ela detectar dados de baixa.

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



