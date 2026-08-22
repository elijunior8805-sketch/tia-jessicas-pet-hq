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
    "disponibilidade",
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
Sua função agora é INTERPRETAR comandos, CONSULTAR dados e PREPARAR ações.
Estamos na Fase 3: Agenda e Cadastros Inteligentes.

DATA ATUAL: ${dataAtual}

INTENÇÕES POSSÍVEIS:
- consulta_agenda: Perguntas sobre horários, quem vem hoje, próximos banhos, leva e traz.
- consulta_cliente: Buscar dados de tutores, endereços, telefones.
- consulta_pet: Buscar ficha do pet, raça, comportamento, último atendimento.
- consulta_financeira: Dívidas, quanto recebeu, pagamentos do dia.
- disponibilidade: Verificar horários livres.
- criar_agendamento: Quando o usuário quer marcar um novo serviço.
- remarcar: Quando o usuário quer mudar a data ou hora de um agendamento.
- cancelar: Quando o usuário quer desmarcar um serviço.
- cadastrar_cliente: Iniciar fluxo de novo tutor.
- cadastrar_pet: Iniciar fluxo de novo animal.
- comando_nao_reconhecido: Quando não entender.

REGRAS CRÍTICAS DE AGENDAMENTO:
1. NÃO invente dados. Se o cliente não existir, retorne intencao 'consulta_cliente' com o nome para busca.
2. Para 'criar_agendamento', extraia: cliente_nome, pet_nome, servicos, data, horario, transporte.
3. Se faltar a data, assuma a data atual (${dataAtual}) se o contexto sugerir, ou peça.
4. Se o usuário disser "sem taxa", marque transporte=true mas valor_transporte=0.
5. Sempre retorne 'informacoes_faltantes' se dados obrigatórios (cliente, pet, serviço, data, hora) não puderem ser extraídos.
6. Não escolha nomes de clientes ou pets automaticamente se houver ambiguidade; a UI tratará a escolha.


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



