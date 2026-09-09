/**
 * Erros Customizados e Tipados da Jessi V2
 * Desenvolvido pelo Agente 3 (Segurança, Testes e Validação)
 */

export class JessiV2Error extends Error {
  readonly codigo: string;
  readonly detalhes?: Record<string, any>;

  constructor(message: string, codigo = "ERRO_INTERNO_JESSI_V2", detalhes?: Record<string, any>) {
    super(message);
    this.name = "JessiV2Error";
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

export class JessiGuardrailViolationError extends JessiV2Error {
  constructor(message: string, detalhes?: Record<string, any>) {
    super(message, "GUARDRAIL_MUTACAO_NAO_AUTORIZADA", detalhes);
    this.name = "JessiGuardrailViolationError";
  }
}

export class JessiIdempotencyConflictError extends JessiV2Error {
  constructor(idempotencyKey: string) {
    super(`Operação duplicada ou já executada com a chave ${idempotencyKey}.`, "IDEMPOTENCY_CONFLICT", { idempotencyKey });
    this.name = "JessiIdempotencyConflictError";
  }
}

export class JessiReadBackFailedError extends JessiV2Error {
  constructor(tabela: string, recordId: string) {
    super(`Falha crítica de gravação física (Read-Back) na tabela ${tabela} para o registro ${recordId}.`, "READ_BACK_FAILED", { tabela, recordId });
    this.name = "JessiReadBackFailedError";
  }
}

export class JessiTimeoutError extends JessiV2Error {
  constructor(tempoMs: number) {
    super(`Tempo de execução excedeu o limite máximo seguro de ${tempoMs}ms.`, "EXECUTION_TIMEOUT", { tempoMs });
    this.name = "JessiTimeoutError";
  }
}
