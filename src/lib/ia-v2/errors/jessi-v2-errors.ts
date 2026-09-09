/**
 * Erros Padronizados da Jessi V2 (Seção 19)
 * Desenvolvido pelo Agente 3 (Segurança, Testes e Validação)
 */

export const CODIGOS_ERRO_JESSI = {
  NAO_ENCONTRADO: "NAO_ENCONTRADO",
  AMBIGUIDADE: "AMBIGUIDADE",
  PROGRAMA_VENCIDO: "PROGRAMA_VENCIDO",
  CREDITO_INDISPONIVEL: "CREDITO_INDISPONIVEL",
  HORARIO_INDISPONIVEL: "HORARIO_INDISPONIVEL",
  PERMISSAO_NEGADA: "PERMISSAO_NEGADA",
  CONFIRMACAO_EXPIRADA: "CONFIRMACAO_EXPIRADA",
  DADOS_ALTERADOS: "DADOS_ALTERADOS",
  DUPLICIDADE: "DUPLICIDADE",
  FALHA_DE_REDE: "FALHA_DE_REDE",
  TIMEOUT: "TIMEOUT",
  FALHA_DO_PROVEDOR: "FALHA_DO_PROVEDOR",
  FALHA_DO_BACKEND: "FALHA_DO_BACKEND",
  FALHA_DE_VERIFICACAO: "FALHA_DE_VERIFICACAO",
  FUNCAO_DESATIVADA: "FUNCAO_DESATIVADA",
  FORA_DO_ESCOPO: "FORA_DO_ESCOPO",
} as const;

export type JessiV2ErrorCode = keyof typeof CODIGOS_ERRO_JESSI;

export class JessiV2Error extends Error {
  readonly codigo: JessiV2ErrorCode | string;
  readonly detalhes?: Record<string, any>;
  readonly mensagemUsuario: string;

  constructor(
    message: string,
    codigo: JessiV2ErrorCode | string = "FALHA_DO_BACKEND",
    detalhes?: Record<string, any>,
    mensagemUsuario?: string
  ) {
    super(message);
    this.name = "JessiV2Error";
    this.codigo = codigo;
    this.detalhes = detalhes;
    this.mensagemUsuario = mensagemUsuario || message;
  }
}

export class JessiGuardrailViolationError extends JessiV2Error {
  constructor(message: string, detalhes?: Record<string, any>) {
    super(
      message,
      "PERMISSAO_NEGADA",
      detalhes,
      "Esta operação requer confirmação humana explícita antes de ser gravada."
    );
    this.name = "JessiGuardrailViolationError";
  }
}

export class JessiIdempotencyConflictError extends JessiV2Error {
  constructor(idempotencyKey: string) {
    super(
      `Operação duplicada com chave ${idempotencyKey}.`,
      "DUPLICIDADE",
      { idempotencyKey },
      "Esta ação já foi registrada anteriormente. Nenhuma alteração duplicada foi realizada."
    );
    this.name = "JessiIdempotencyConflictError";
  }
}

export class JessiReadBackFailedError extends JessiV2Error {
  constructor(tabela: string, recordId: string) {
    super(
      `Falha na verificação de gravação real na tabela ${tabela} (ID: ${recordId}).`,
      "FALHA_DE_VERIFICACAO",
      { tabela, recordId },
      "Não foi possível confirmar a gravação física dos dados no sistema. Nenhuma alteração foi concluída."
    );
    this.name = "JessiReadBackFailedError";
  }
}

export class JessiTimeoutError extends JessiV2Error {
  constructor(tempoMs: number) {
    super(
      `Tempo de execução excedeu o limite máximo seguro de ${tempoMs}ms.`,
      "TIMEOUT",
      { tempoMs },
      "A consulta demorou mais que o esperado para responder. Por favor, tente novamente de forma mais específica."
    );
    this.name = "JessiTimeoutError";
  }
}

/**
 * Traduz qualquer código ou erro para uma resposta amigável em Português sem jargões técnicos
 */
export function formatarMensagemErroAmigavel(err: any): string {
  if (err instanceof JessiV2Error && err.mensagemUsuario) {
    return err.mensagemUsuario;
  }

  const msg = err?.message || String(err);
  if (msg.includes("HORARIO_INDISPONIVEL")) {
    return "O horário solicitado não está mais disponível na grade do Spa.";
  }
  if (msg.includes("SALDO_INSUFICIENTE")) {
    return "O cliente não possui saldo suficiente de créditos para esta operação.";
  }
  if (msg.includes("TIMEOUT")) {
    return "A operação atingiu o tempo limite seguro de resposta.";
  }
  return "Tive uma dificuldade temporária na comunicação. Por favor, tente enviar novamente.";
}
