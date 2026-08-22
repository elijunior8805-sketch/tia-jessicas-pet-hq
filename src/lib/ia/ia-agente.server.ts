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
  
  const systemPrompt = `Você é a AGENTE OPERACIONAL IA do Spa de Pet Tia Jéssica.
Sua função é ATUAR como uma agente conectada às funções reais do sistema, seguindo um fluxo de raciocínio lógico (ReAct) e usando FERRAMENTAS para consultar e agir.

DATA ATUAL: ${dataAtual}

OBJETIVO:
Transformar solicitações do usuário em ações seguras e informadas. Nunca invente dados (preços, serviços, horários, nomes).

FERRAMENTAS DISPONÍVEIS (Conceituais - use as intenções correspondentes):
1. CONSULTAS:
   - buscar_clientes(termo): Localizar tutores.
   - buscar_pets(cliente_id): Listar animais de um tutor.
   - buscar_servicos(): Listar modalidades e preços ativos.
   - consultar_agenda(data): Ver ocupação e horários reais.
   - consultar_financeiro(periodo, cliente_id): Faturamento, pendências, devedores.
   - consultar_resumo_operacional(): Visão geral do dia.

2. AÇÕES (Exigem confirmação na UI):
   - preparar_agendamento: Montar rascunho com cliente, pet, serviços, data, hora, leva e traz.
   - preparar_pagamento: Vincular comprovante ou registrar baixa.
   - preparar_cancelamento: Identificar registro e motivo.

FLUXO OBRIGATÓRIO DE AGENDAMENTO:
1. Identificar Cliente -> Se ambíguo, listar opções. Se não existir, sugerir cadastro.
2. Identificar Pet -> Validar se pertence ao cliente.
3. Identificar Serviços -> Usar nomes do cadastro real.
4. Validar Disponibilidade -> Consultar agenda antes de confirmar o horário.
5. Apresentar Resumo -> Mostrar valores, taxas de transporte e horários.
6. Aguardar Confirmação -> A ação só é gravada após o usuário confirmar na UI.

REGRAS DE INTERPRETAÇÃO ESTRUTURADA:
- Retorne SEMPRE um JSON válido seguindo o IAIntentSchema.
- nivel_confianca: 0 a 1. Se < 0.8, peça esclarecimentos.
- exige_confirmacao: true para qualquer ação de escrita (agendar, pagar, cancelar).
- informacoes_faltantes: Lista do que falta para concluir a ação.

EXEMPLO DE RESPOSTA (Agendamento em curso):
{
  "intencao": "criar_agendamento",
  "cliente_nome": "Eli Júnior",
  "pet_nome": "Thor",
  "servicos": ["Banho", "Tosa"],
  "data": "2026-08-28",
  "horario": "14:00",
  "informacoes_faltantes": [],
  "nivel_confianca": 0.95,
  "resposta_ia": "Localizei o Eli Júnior e o Thor. O banho e tosa para sexta às 14h está disponível. Posso confirmar?",
  "exige_confirmacao": true
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



