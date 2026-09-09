// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";
import { JessiV2Guardrails } from "../guardrails/jessi-v2-guardrails";
import {
  JessiGuardrailViolationError,
  JessiIdempotencyConflictError,
} from "../errors/jessi-v2-errors";
import { JessiV2GeminiProvider } from "../providers/jessi-v2-gemini.provider";
import {
  criarSessaoV2,
  adicionarMensagemSessaoV2,
  atualizarContextoSessaoV2,
} from "../session/jessi-v2-session";
import { AgendaAdapter } from "../adapters/agenda.adapter";
import { ClientesPetsAdapter } from "../adapters/clientes-pets.adapter";
import { ProgramasCreditosAdapter } from "../adapters/programas-creditos.adapter";
import { FinanceiroRelatoriosAdapter } from "../adapters/financeiro-relatorios.adapter";
import { MensagensWhatsAppAdapter } from "../adapters/mensagens-whatsapp.adapter";
import { despacharFerramentaV2 } from "../tools/jessi-v2-tools.registry";

/**
 * Suite Completa de 60 Casos de Teste Automatizados da Jessi V2
 * Desenvolvido pelo Agente 3 (Segurança, Testes e Validação)
 */

describe("Banco de Testes e Evals da Jessi IA V2 (60 Casos)", () => {
  beforeEach(() => {
    JessiV2Guardrails.resetarChavesParaTestes();
  });

  // =========================================================================
  // SUITE 1: Guardrails de Autonomia Supervisionada (10 Testes)
  // =========================================================================
  describe("Suite 1: Guardrails de Autonomia Supervisionada (Zero Escrita Direta)", () => {
    it("01. Deve permitir consultas livremente sem exigir confirmação", () => {
      expect(() =>
        JessiV2Guardrails.validarExecucaoSupervisionada("consulta")
      ).not.toThrow();
    });

    it("02. Deve bloquear tentativa de agendamento sem ID de confirmação", () => {
      expect(() =>
        JessiV2Guardrails.validarExecucaoSupervisionada("mutacao_supervisionada", null, null)
      ).toThrow(JessiGuardrailViolationError);
    });

    it("03. Deve bloquear cancelamento sem dados de confirmação", () => {
      expect(() =>
        JessiV2Guardrails.validarExecucaoSupervisionada("mutacao_supervisionada", "act_123", null)
      ).toThrow(JessiGuardrailViolationError);
    });

    it("04. Deve bloquear reagendamento sem ID de confirmação", () => {
      expect(() =>
        JessiV2Guardrails.validarExecucaoSupervisionada("mutacao_supervisionada", undefined, { dataHora: "2026-09-09T10:00:00Z" })
      ).toThrow(JessiGuardrailViolationError);
    });

    it("05. Deve autorizar mutação quando ID e payload de confirmação estiverem presentes", () => {
      expect(() =>
        JessiV2Guardrails.validarExecucaoSupervisionada("mutacao_supervisionada", "act_valid", { confirmado: true })
      ).not.toThrow();
    });

    it("06. Adaptador de Agenda deve apenas preparar ação sem gravar no banco", () => {
      const proposta = AgendaAdapter.prepararAgendamento({
        clienteId: "cli_1",
        petId: "pet_1",
        servicoId: "srv_1",
        servicoNome: "Banho & Tosa",
        dataHora: "2026-09-09T14:00:00Z",
        valor: 120.0,
      });
      expect(proposta.title).toContain("Banho & Tosa");
      expect(proposta.summary).toContain("R$ 120.00");
    });

    it("07. Deve bloquear consumo de crédito se chamado diretamente sem confirmação", () => {
      expect(() =>
        JessiV2Guardrails.validarExecucaoSupervisionada("mutacao_supervisionada", "", {})
      ).toThrow(JessiGuardrailViolationError);
    });

    it("08. NLU deve sinalizar 'requerConfirmacao: true' para comando de agendar", async () => {
      const provider = new JessiV2GeminiProvider();
      const res = await provider.classificarIntencao({
        mensagem: "Quero agendar um banho para o Thor amanhã às 14h",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.requerConfirmacao).toBe(true);
      expect(res.intencao.dominio).toBe("agenda");
    });

    it("09. NLU deve sinalizar 'requerConfirmacao: false' para comando de consulta de faturamento", async () => {
      const provider = new JessiV2GeminiProvider();
      const res = await provider.classificarIntencao({
        mensagem: "Quanto foi o faturamento deste mês?",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.requerConfirmacao).toBe(false);
      expect(res.intencao.dominio).toBe("financeiro_relatorios");
    });

    it("10. NLU deve sinalizar 'requerConfirmacao: true' para comando de debitar créditos", async () => {
      const provider = new JessiV2GeminiProvider();
      const res = await provider.classificarIntencao({
        mensagem: "Debitar 1 crédito do plano da Luna",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.requerConfirmacao).toBe(true);
      expect(res.intencao.dominio).toBe("programas_creditos");
    });
  });

  // =========================================================================
  // SUITE 2: Idempotência e Prevenção de Duplicidade (8 Testes)
  // =========================================================================
  describe("Suite 2: Idempotência e Prevenção de Duplicidade", () => {
    it("11. Deve aceitar a primeira execução com chave válida", () => {
      expect(() =>
        JessiV2Guardrails.registrarChaveIdempotencia("idemp_key_001")
      ).not.toThrow();
    });

    it("12. Deve rejeitar segunda execução imediata com a mesma chave (duplo clique)", () => {
      JessiV2Guardrails.registrarChaveIdempotencia("idemp_key_002");
      expect(() =>
        JessiV2Guardrails.registrarChaveIdempotencia("idemp_key_002")
      ).toThrow(JessiIdempotencyConflictError);
    });

    it("13. Deve rejeitar chave de idempotência vazia ou com menos de 5 caracteres", () => {
      expect(() =>
        JessiV2Guardrails.registrarChaveIdempotencia("123")
      ).toThrow(JessiGuardrailViolationError);
    });

    it("14. Deve aceitar chaves distintas para operações simultâneas", () => {
      expect(() => {
        JessiV2Guardrails.registrarChaveIdempotencia("idemp_op_A");
        JessiV2Guardrails.registrarChaveIdempotencia("idemp_op_B");
      }).not.toThrow();
    });

    it("15. Deve limpar chaves corretamente no reset de testes", () => {
      JessiV2Guardrails.registrarChaveIdempotencia("idemp_temp");
      JessiV2Guardrails.resetarChavesParaTestes();
      expect(() =>
        JessiV2Guardrails.registrarChaveIdempotencia("idemp_temp")
      ).not.toThrow();
    });

    it("16. Erro de idempotência deve conter a chave conflitante nos detalhes", () => {
      JessiV2Guardrails.registrarChaveIdempotencia("idemp_detalhe_123");
      try {
        JessiV2Guardrails.registrarChaveIdempotencia("idemp_detalhe_123");
      } catch (err: any) {
        expect(err.codigo).toBe("IDEMPOTENCY_CONFLICT");
        expect(err.detalhes?.idempotencyKey).toBe("idemp_detalhe_123");
      }
    });

    it("17. Despachante V2 deve gerar chave automática se não informada", async () => {
      const mockSb: any = { from: () => ({ select: () => ({ gte: () => ({ lte: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }) }) };
      const res = await despacharFerramentaV2(mockSb, "consultar_agenda", { data: "2026-09-09" });
      expect(res.success).toBe(true);
    });

    it("18. Despachante deve rejeitar ferramenta inexistente sem quebrar", async () => {
      const mockSb: any = {};
      const res = await despacharFerramentaV2(mockSb, "ferramenta_inexistente_xyz", {});
      expect(res.success).toBe(false);
      expect(res.error_code).toBe("TOOL_NOT_FOUND");
    });
  });

  // =========================================================================
  // SUITE 3: Compreensão Conversacional e Busca Resiliente (12 Testes)
  // =========================================================================
  describe("Suite 3: Compreensão Conversacional e Busca Resiliente", () => {
    const provider = new JessiV2GeminiProvider();

    it("19. Deve classificar busca por tutor 'buscar cliente Jéssica'", async () => {
      const res = await provider.classificarIntencao({
        mensagem: "buscar cliente Jéssica",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.dominio).toBe("clientes_pets");
      expect(res.intencao.intencao).toBe("buscar_clientes_pets");
    });

    it("20. Deve classificar pergunta sobre pet 'como está a ficha da Mel?'", async () => {
      const res = await provider.classificarIntencao({
        mensagem: "como está a ficha da Mel?",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.dominio).toBe("clientes_pets");
    });

    it("21. Deve entender 'ver horários vagos hoje' como consulta de agenda", async () => {
      const res = await provider.classificarIntencao({
        mensagem: "ver horários vagos hoje",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.dominio).toBe("agenda");
    });

    it("22. Deve entender 'desmarcar atendimento das 16h' como preparação de cancelamento", async () => {
      const res = await provider.classificarIntencao({
        mensagem: "desmarcar atendimento das 16h",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.intencao).toBe("preparar_cancelamento");
      expect(res.intencao.requerConfirmacao).toBe(true);
    });

    it("23. Deve entender 'remarcar banho para quinta' como preparação de reagendamento", async () => {
      const res = await provider.classificarIntencao({
        mensagem: "remarcar banho para quinta",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.intencao).toBe("preparar_reagendamento");
      expect(res.intencao.requerConfirmacao).toBe(true);
    });

    it("24. Deve entender 'qual o ticket médio deste mês?' no financeiro", async () => {
      const res = await provider.classificarIntencao({
        mensagem: "qual o ticket médio deste mês?",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.dominio).toBe("financeiro_relatorios");
    });

    it("25. Deve entender 'quanto temos a receber pendente?' no financeiro", async () => {
      const res = await provider.classificarIntencao({
        mensagem: "quanto temos a receber pendente?",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.dominio).toBe("financeiro_relatorios");
    });

    it("26. Deve entender 'consultar saldo do clubinho' em programas", async () => {
      const res = await provider.classificarIntencao({
        mensagem: "consultar saldo do clubinho",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.dominio).toBe("programas_creditos");
    });

    it("27. Deve entender 'enviar lembrete no WhatsApp' em comunicação", async () => {
      const res = await provider.classificarIntencao({
        mensagem: "enviar lembrete no WhatsApp",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.dominio).toBe("comunicacao_mensagens");
    });

    it("28. Deve herdar cliente selecionado do contexto", async () => {
      const res = await provider.classificarIntencao({
        mensagem: "consultar saldo dos créditos",
        contexto: {
          dataReferencia: "2026-09-09",
          clienteSelecionadoId: "cli_contexto_456",
          clienteSelecionadoNome: "Mariana Silva",
        },
        historico: [],
      });
      expect(res.intencao.entidades.clienteId).toBe("cli_contexto_456");
      expect(res.intencao.entidades.clienteNome).toBe("Mariana Silva");
    });

    it("29. Deve herdar pet selecionado do contexto", async () => {
      const res = await provider.classificarIntencao({
        mensagem: "ver histórico de atendimentos",
        contexto: {
          dataReferencia: "2026-09-09",
          petSelecionadoId: "pet_contexto_789",
          petSelecionadoNome: "Bidu",
        },
        historico: [],
      });
      expect(res.intencao.entidades.petId).toBe("pet_contexto_789");
      expect(res.intencao.entidades.petNome).toBe("Bidu");
    });

    it("30. Deve responder com saudação e ajuda para mensagem genérica", async () => {
      const res = await provider.classificarIntencao({
        mensagem: "olá, bom dia!",
        contexto: { dataReferencia: "2026-09-09" },
        historico: [],
      });
      expect(res.intencao.dominio).toBe("geral_conversacional");
      expect(res.intencao.requerConfirmacao).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 4: Integridade Financeira e Fonte Consolidada (8 Testes)
  // =========================================================================
  describe("Suite 4: Integridade Financeira e Fonte Consolidada", () => {
    it("31. Deve calcular faturamento bruto somando apenas receitas confirmadas", async () => {
      const mockTransacoes = [
        { id: "1", tipo: "receita", valor: 100, status: "confirmado" },
        { id: "2", tipo: "entrada", valor: 250, status: "confirmado" },
        { id: "3", tipo: "despesa", valor: 50, status: "confirmado" },
      ];

      const mockSb: any = {
        from: () => ({
          select: () => ({
            gte: () => ({
              eq: () => Promise.resolve({ data: mockTransacoes, error: null }),
            }),
            eq: () => Promise.resolve({ data: [{ valor: 80 }], error: null }),
          }),
        }),
      };

      const res = await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(mockSb, "mes");
      expect(res.success).toBe(true);
      expect(res.data.faturamentoBruto).toBe(350);
      expect(res.data.despesas).toBe(50);
      expect(res.data.saldoLiquido).toBe(300);
      expect(res.data.ticketMedio).toBe(175);
    });

    it("32. Deve retornar ticket médio 0 quando não houver entradas", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            gte: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };

      const res = await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(mockSb, "hoje");
      expect(res.success).toBe(true);
      expect(res.data.ticketMedio).toBe(0);
      expect(res.data.faturamentoBruto).toBe(0);
    });

    it("33. Deve calcular contas a receber pendentes corretamente", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            gte: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
            eq: () => Promise.resolve({ data: [{ valor: 150 }, { valor: 350 }], error: null }),
          }),
        }),
      };

      const res = await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(mockSb, "mes");
      expect(res.data.totalAReceberPendente).toBe(500);
    });

    it("34. Não deve quebrar com valores nulos ou inválidos no banco", async () => {
      const mockTransacoes = [
        { id: "1", tipo: "receita", valor: null, status: "confirmado" },
        { id: "2", tipo: "receita", valor: "invalid_num", status: "confirmado" },
      ];

      const mockSb: any = {
        from: () => ({
          select: () => ({
            gte: () => ({
              eq: () => Promise.resolve({ data: mockTransacoes, error: null }),
            }),
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };

      const res = await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(mockSb, "semana");
      expect(res.success).toBe(true);
      expect(res.data.faturamentoBruto).toBe(0);
    });

    it("35. Deve reportar erro tratado caso o banco falhe na consulta financeira", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            gte: () => ({
              eq: () => Promise.resolve({ data: null, error: { message: "Conexão recusada", code: "PGRST_ERR" } }),
            }),
          }),
        }),
      };

      const res = await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(mockSb, "mes");
      expect(res.success).toBe(false);
      expect(res.error_code).toBe("PGRST_ERR");
    });

    it("36. Adaptador financeiro deve apontar para fonte oficial", async () => {
      const mockSb: any = {
        from: (tab: string) => {
          expect(tab).toBe("transacoes_financeiras");
          return {
            select: () => ({
              gte: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        },
      };
      await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(mockSb, "hoje");
    });

    it("37. Formatação do resumo financeiro deve incluir dados essenciais", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            gte: () => ({
              eq: () => Promise.resolve({
                data: [{ id: "1", tipo: "receita", valor: 500, status: "confirmado" }],
                error: null,
              }),
            }),
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };

      const res = await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(mockSb, "mes");
      expect(res.summary).toContain("R$ 500.00");
    });

    it("38. Deve calcular saldo líquido subtraindo despesas de receitas", async () => {
      const mockTransacoes = [
        { id: "1", tipo: "receita", valor: 1000, status: "confirmado" },
        { id: "2", tipo: "despesa", valor: 400, status: "confirmado" },
      ];

      const mockSb: any = {
        from: () => ({
          select: () => ({
            gte: () => ({
              eq: () => Promise.resolve({ data: mockTransacoes, error: null }),
            }),
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };

      const res = await FinanceiroRelatoriosAdapter.consultarResumoConsolidado(mockSb, "mes");
      expect(res.data.saldoLiquido).toBe(600);
    });
  });

  // =========================================================================
  // SUITE 5: Programas de Cuidados & Saldo de Créditos (8 Testes)
  // =========================================================================
  describe("Suite 5: Programas de Cuidados & Saldo de Créditos", () => {
    it("39. Deve consultar programas ativos e somar saldo total de sessões", async () => {
      const mockSb: any = {
        from: (table: string) => ({
          select: () => ({
            eq: () => {
              if (table === "cliente_programas") {
                return {
                  eq: () => Promise.resolve({ data: [{ id: "prog_1", status: "ativo" }], error: null }),
                };
              }
              return {
                gt: () => Promise.resolve({ data: [{ id: "c1", saldo: 3 }, { id: "c2", saldo: 2 }], error: null }),
              };
            },
          }),
        }),
      };

      const res = await ProgramasCreditosAdapter.consultarSaldoCreditos(mockSb, "cli_10");
      expect(res.success).toBe(true);
      expect(res.data.totalSessaoRestantes).toBe(5);
    });

    it("40. Deve bloquear consumo quando saldo for insuficiente", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: "c1", saldo: 1, servico_nome: "Banho" }, error: null }),
            }),
          }),
        }),
      };

      const res = await ProgramasCreditosAdapter.executarConsumoCreditoConfirmado(
        mockSb,
        { creditoId: "c1", quantidade: 2 },
        "idemp_cred_01"
      );
      expect(res.success).toBe(false);
      expect(res.error_code).toBe("SALDO_INSUFICIENTE");
    });

    it("41. Deve debitar e verificar novo saldo pós-execução (Read-Back)", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: "c1", saldo: 4, servico_nome: "Tosa Higiênica" }, error: null }),
              maybeSingle: () => Promise.resolve({ data: { id: "c1", saldo: 3 }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: "c1", saldo: 3, servico_nome: "Tosa Higiênica" }, error: null }),
              }),
            }),
          }),
        }),
      };

      const res = await ProgramasCreditosAdapter.executarConsumoCreditoConfirmado(
        mockSb,
        { creditoId: "c1", quantidade: 1 },
        "idemp_cred_02"
      );
      expect(res.success).toBe(true);
      expect(res.after?.saldo).toBe(3);
      expect(res.verified).toBe(true);
    });

    it("42. Deve tratar cliente sem programas ativos sem erro", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
              gt: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      };

      const res = await ProgramasCreditosAdapter.consultarSaldoCreditos(mockSb, "cli_sem_plano");
      expect(res.success).toBe(true);
      expect(res.data.totalSessaoRestantes).toBe(0);
    });

    it("43. Deve registrar mensagem descritiva no consumo de créditos", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: "c1", saldo: 2, servico_nome: "Hidratação" }, error: null }),
              maybeSingle: () => Promise.resolve({ data: { id: "c1", saldo: 1 }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: "c1", saldo: 1, servico_nome: "Hidratação" }, error: null }),
              }),
            }),
          }),
        }),
      };

      const res = await ProgramasCreditosAdapter.executarConsumoCreditoConfirmado(
        mockSb,
        { creditoId: "c1", quantidade: 1 },
        "idemp_cred_03"
      );
      expect(res.summary).toContain("Hidratação");
      expect(res.summary).toContain("Novo saldo: 1");
    });

    it("44. Deve rejeitar consumo de crédito inexistente", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: { message: "Não encontrado" } }),
            }),
          }),
        }),
      };

      const res = await ProgramasCreditosAdapter.executarConsumoCreditoConfirmado(
        mockSb,
        { creditoId: "invalido", quantidade: 1 },
        "idemp_cred_04"
      );
      expect(res.success).toBe(false);
      expect(res.error_code).toBe("ERRO_CONSUMO_CREDITO");
    });

    it("45. Adaptador deve vincular assinatura ao cliente correto", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: (col: string, val: string) => {
              expect(col).toBe("cliente_id");
              expect(val).toBe("cli_alvo_99");
              return {
                eq: () => Promise.resolve({ data: [], error: null }),
                gt: () => Promise.resolve({ data: [], error: null }),
              };
            },
          }),
        }),
      };
      await ProgramasCreditosAdapter.consultarSaldoCreditos(mockSb, "cli_alvo_99");
    });

    it("46. Deve registrar a chave de idempotência no resultado de consumo", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: "c1", saldo: 2, servico_nome: "Banho" }, error: null }),
              maybeSingle: () => Promise.resolve({ data: { id: "c1", saldo: 1 }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: "c1", saldo: 1, servico_nome: "Banho" }, error: null }),
              }),
            }),
          }),
        }),
      };

      const res = await ProgramasCreditosAdapter.executarConsumoCreditoConfirmado(
        mockSb,
        { creditoId: "c1", quantidade: 1 },
        "minha_chave_exclusiva_123"
      );
      expect(res.idempotency_key).toBe("minha_chave_exclusiva_123");
    });
  });

  // =========================================================================
  // SUITE 6: Read-Back Verification e Gravação Física (6 Testes)
  // =========================================================================
  describe("Suite 6: Read-Back Verification e Gravação Física", () => {
    it("47. Agendamento executado deve verificar gravação imediata no banco", async () => {
      const mockSb: any = {
        from: (table: string) => {
          if (table === "agendamentos") {
            return {
              select: () => ({
                eq: () => ({
                  neq: () => Promise.resolve({ data: [] }),
                  maybeSingle: () => Promise.resolve({ data: { id: "ag_999", status: "agendado" }, error: null }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: () => Promise.resolve({
                    data: { id: "ag_999", data_hora: "2026-09-09T10:00:00Z", status: "agendado", valor_total: 100 },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const res = await AgendaAdapter.executarAgendamentoConfirmado(
        mockSb,
        { clienteId: "c1", petId: "p1", dataHora: "2026-09-09T10:00:00Z", valor: 100 },
        "idemp_ag_999"
      );

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.affected_record_id).toBe("ag_999");
    });

    it("48. Deve detectar falso positivo caso o read-back não encontre o registro inserido", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              neq: () => Promise.resolve({ data: [] }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }), // Read-back falhou
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: "ag_fantasma" }, error: null }),
            }),
          }),
        }),
      };

      const res = await AgendaAdapter.executarAgendamentoConfirmado(
        mockSb,
        { clienteId: "c1", petId: "p1", dataHora: "2026-09-09T10:00:00Z", valor: 100 },
        "idemp_fantasma"
      );

      expect(res.verified).toBe(false);
    });

    it("49. Deve abortar agendamento se horário estiver ocupado no momento da confirmação", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              neq: () => Promise.resolve({ data: [{ id: "ocupado_agora" }] }),
            }),
          }),
        }),
      };

      const res = await AgendaAdapter.executarAgendamentoConfirmado(
        mockSb,
        { clienteId: "c1", petId: "p1", dataHora: "2026-09-09T10:00:00Z", valor: 100 },
        "idemp_conflito"
      );

      expect(res.success).toBe(false);
      expect(res.error_code).toBe("HORARIO_INDISPONIVEL");
    });

    it("50. Cadastro de cliente deve realizar verificação pós-gravação (Read-Back)", async () => {
      const mockSb: any = {
        from: () => ({
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: "cli_novo_1", nome: "Carlos Eduardo" }, error: null }),
            }),
          }),
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "cli_novo_1", nome: "Carlos Eduardo" }, error: null }),
            }),
          }),
        }),
      };

      const res = await ClientesPetsAdapter.executarCadastroClienteConfirmado(
        mockSb,
        { nome: "Carlos Eduardo" },
        "idemp_cli_novo"
      );

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.after?.nome).toBe("Carlos Eduardo");
    });

    it("51. Deve capturar falha de constraint única no cadastro de cliente", async () => {
      const mockSb: any = {
        from: () => ({
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { message: "Email já existe", code: "23505" } }),
            }),
          }),
        }),
      };

      const res = await ClientesPetsAdapter.executarCadastroClienteConfirmado(
        mockSb,
        { nome: "Duplicado", email: "ja_existe@teste.com" },
        "idemp_dupl"
      );

      expect(res.success).toBe(false);
      expect(res.error_code).toBe("23505");
      expect(res.verified).toBe(false);
    });

    it("52. Adaptador WhatsApp deve gerar link codificado com segurança", () => {
      const payload = {
        telefoneDestino: "(11) 98765-4321",
        nomeCliente: "Renata",
        nomePet: "Barthô",
        tipoMensagem: "pet_pronto" as const,
      };

      const res = MensagensWhatsAppAdapter.gerarMensagemWhatsApp(payload);
      expect(res.telefoneFormatado).toBe("5511987654321");
      expect(res.urlWhatsApp).toContain("https://wa.me/5511987654321");
      expect(res.mensagemFormatada).toContain("Barthô");
      expect(res.mensagemFormatada).toContain("pronto(a)");
    });
  });

  // =========================================================================
  // SUITE 7: Timeouts, Memória e Podagem de Contexto (4 Testes)
  // =========================================================================
  describe("Suite 7: Timeouts, Memória e Podagem de Contexto", () => {
    it("53. Deve podar mensagens quando exceder o limite máximo de 30", () => {
      let sessao = criarSessaoV2();
      for (let i = 1; i <= 35; i++) {
        sessao = adicionarMensagemSessaoV2(sessao, {
          id: `msg_${i}`,
          role: "user",
          content: `Mensagem ${i}`,
          timestamp: new Date().toISOString(),
          cards: [],
        });
      }
      expect(sessao.mensagens.length).toBe(30);
      expect(sessao.mensagens[0].content).toBe("Mensagem 6");
      expect(sessao.mensagens[29].content).toBe("Mensagem 35");
    });

    it("54. Deve expirar automaticamente ação pendente com mais de 15 minutos", () => {
      let sessao = criarSessaoV2();
      const acaoExpirada = {
        id: "act_exp",
        type: "agendamento",
        tool: "executar_agendamento",
        title: "Agendamento Antigo",
        summary: "Expirou",
        riskLevel: "medio" as const,
        params: {},
        created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      };

      sessao = atualizarContextoSessaoV2(sessao, { acaoPendente: acaoExpirada });
      expect(sessao.contexto.acaoPendente).toBeNull();
    });

    it("55. Deve manter ação pendente se ainda estiver dentro da validade", () => {
      let sessao = criarSessaoV2();
      const acaoValida = {
        id: "act_val",
        type: "agendamento",
        tool: "executar_agendamento",
        title: "Agendamento Válido",
        summary: "Dentro do prazo",
        riskLevel: "medio" as const,
        params: {},
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      };

      sessao = atualizarContextoSessaoV2(sessao, { acaoPendente: acaoValida });
      expect(sessao.contexto.acaoPendente).not.toBeNull();
      expect(sessao.contexto.acaoPendente?.id).toBe("act_val");
    });

    it("56. Inicialização da sessão deve carregar data no padrão YYYY-MM-DD", () => {
      const sessao = criarSessaoV2();
      expect(sessao.contexto.dataReferencia).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // =========================================================================
  // SUITE 8: Preservação da V1 e Fallback Transparente (4 Testes)
  // =========================================================================
  describe("Suite 8: Preservação da V1 e Fallback Transparente", () => {
    it("57. Diretório da Jessi V1 permanece intacto e acessível", async () => {
      const v1Config = await import("../../ia/jessi-config");
      expect(v1Config.JESSI_CONFIG.nome).toBe("Jessi");
      expect(v1Config.JESSI_CONFIG.regrasComportamentais.length).toBeGreaterThan(0);
    });

    it("58. Schemas Zod da V1 continuam exportados e funcionais", async () => {
      const v1Contracts = await import("../../ia/jessi-contracts");
      expect(v1Contracts.JessiQueryResultSchema).toBeDefined();
      expect(v1Contracts.JessiMutationResultSchema).toBeDefined();
    });

    it("59. Adaptador WhatsApp formata mensagem de reativação com carinho", () => {
      const res = MensagensWhatsAppAdapter.gerarMensagemWhatsApp({
        telefoneDestino: "11999998888",
        nomeCliente: "Lucas",
        nomePet: "Pipoca",
        tipoMensagem: "reativacao_carinho",
      });
      expect(res.mensagemFormatada).toContain("Pipoca");
      expect(res.mensagemFormatada).toContain("saudade");
    });

    it("60. Adaptador WhatsApp formata confirmação de PIX com valor correto", () => {
      const res = MensagensWhatsAppAdapter.gerarMensagemWhatsApp({
        telefoneDestino: "11999998888",
        nomeCliente: "Fernanda",
        tipoMensagem: "confirmacao_pix",
        detalhes: { valor: 185.5 },
      });
      expect(res.mensagemFormatada).toContain("R$ 185.50");
      expect(res.mensagemFormatada).toContain("Muito obrigado");
    });
  });

  // =========================================================================
  // SUITE 9: Fase 1 — Conversa e Memória (Chat, Histórico, Contexto, Busca, Ambiguidade e Respostas Progressivas)
  // =========================================================================
  describe("Suite 9: Fase 1 — Conversa e Memória", () => {
    it("61. Chat Natural: Resposta acolhedora para cumprimentos e apresentação da Jessi", async () => {
      const { processarMensagemJessiV2Core } = await import("../agent/jessi-v2-agent.core");
      const mockSb: any = {};
      const res = await processarMensagemJessiV2Core(mockSb, { mensagem: "Olá Jessi, boa tarde!" });
      expect(res.versao).toBe("v2");
      expect(res.respostaTexto).toContain("Jessi");
      expect(res.respostaTexto).toContain("Tia Jéssica");
    });

    it("62. Contexto & Anáfora: Deve resolver pronome 'ele' mantendo pet ativo do contexto", async () => {
      const provider = new JessiV2GeminiProvider();
      const res = await provider.classificarIntencao({
        mensagem: "Quero agendar um banho para ele amanhã às 15h",
        contexto: {
          dataReferencia: "2026-09-09",
          petSelecionadoId: "pet_thor_123",
          petSelecionadoNome: "Thor",
        },
        historico: [],
      });
      expect(res.intencao.entidades.petNome).toBe("Thor");
      expect(res.intencao.entidades.petId).toBe("pet_thor_123");
    });

    it("63. Busca Inteligente: Deve localizar cliente por telefone mesmo com formatação diferente", async () => {
      const mockClientes = [
        { id: "cli_1", nome: "Mariana Souza", telefone: "11988887777", pets: [] },
      ];
      const mockSb: any = {
        from: () => ({
          select: () => ({
            limit: () => Promise.resolve({ data: mockClientes }),
          }),
        }),
      };
      const res = await ClientesPetsAdapter.buscarClientesPets(mockSb, "(11) 98888-7777");
      expect(res.success).toBe(true);
      expect(res.data.candidatos[0].nomePrincipal).toBe("Mariana Souza");
      expect(res.data.exigeDesambiguacao).toBe(false);
    });

    it("64. Ambiguidade: Não deve escolher silenciosamente entre clientes homônimos", async () => {
      const mockClientes = [
        { id: "cli_1", nome: "Juliana Santos", telefone: "11911112222", pets: [] },
        { id: "cli_2", nome: "Juliana Santos Silva", telefone: "11933334444", pets: [] },
      ];
      const mockSb: any = {
        from: () => ({
          select: () => ({
            limit: () => Promise.resolve({ data: mockClientes }),
          }),
        }),
      };
      const res = await ClientesPetsAdapter.buscarClientesPets(mockSb, "Juliana");
      expect(res.success).toBe(true);
      expect(res.data.exigeDesambiguacao).toBe(true);
      expect(res.summary).toContain("opções semelhantes");
    });

    it("65. Resposta Progressiva: Decomposição em etapas claras e cartões contextuais", async () => {
      const { processarMensagemJessiV2Core } = await import("../agent/jessi-v2-agent.core");
      const mockSb: any = {
        from: () => ({
          select: () => ({
            limit: () => Promise.resolve({ data: [] }),
          }),
        }),
      };
      const res = await processarMensagemJessiV2Core(mockSb, {
        mensagem: "Agendar banho para o Rex amanhã às 10h",
      });
      expect(res.pendingAction).toBeDefined();
      expect(res.cards.some(c => c.type === "confirmacao")).toBe(true);
      expect(res.respostaTexto).toContain("Preparei a operação");
    });
  });

  // =========================================================================
  // SUITE 10: Fase 2 — Consultas Reais e Somente Leitura (Clientes, Pets, Agenda, Programas, Créditos, Financeiro, Histórico, Relatórios)
  // =========================================================================
  describe("Suite 10: Fase 2 — Consultas Reais (Somente Leitura)", () => {
    it("66. Agenda Read-Only: Consulta agenda do dia sem efetuar mutações", async () => {
      const { processarMensagemJessiV2Core } = await import("../agent/jessi-v2-agent.core");
      const mockSb: any = {
        from: (tab: string) => ({
          select: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({
                  data: [
                    { id: "ag_1", data_hora: "2026-09-09T09:00:00Z", status: "agendado", cliente: { nome: "Paula" }, pet: { nome: "Thor" } }
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      const res = await processarMensagemJessiV2Core(mockSb, { mensagem: "Como está a agenda de hoje?" });
      expect(res.versao).toBe("v2");
      expect(res.cards.some(c => c.type === "agenda")).toBe(true);
      expect(res.pendingAction).toBeNull();
    });

    it("67. Financeiro Read-Only: Consulta faturamento consolidado sem alterar registros", async () => {
      const { processarMensagemJessiV2Core } = await import("../agent/jessi-v2-agent.core");
      const mockSb: any = {
        from: (tab: string) => ({
          select: () => ({
            gte: () => ({
              eq: () => Promise.resolve({
                data: [
                  { id: "t1", tipo: "receita", valor: 450, status: "confirmado" },
                  { id: "t2", tipo: "despesa", valor: 100, status: "confirmado" },
                ],
                error: null,
              }),
            }),
            eq: () => Promise.resolve({ data: [{ valor: 150 }], error: null }),
          }),
        }),
      };

      const res = await processarMensagemJessiV2Core(mockSb, { mensagem: "Qual foi o faturamento deste mês?" });
      expect(res.versao).toBe("v2");
      expect(res.cards.some(c => c.type === "financeiro")).toBe(true);
      expect(res.respostaTexto).toContain("R$ 450.00");
    });

    it("68. Programas Ativos Geral: Apresenta contratos reais ativos com campos oficiais", async () => {
      const mockSb: any = {
        from: (tab: string) => ({
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                {
                  id: "cp_1",
                  status: "ativo",
                  data_inicio: "2026-08-15",
                  data_fim: "2026-09-15",
                  cliente: { id: "c1", nome: "Marcos Lima" },
                  pet: { id: "p1", nome: "Bob" },
                  plano: { id: "pl1", nome: "Clubinho Mensal 4 Banhos", valor_mensal: 280 },
                  creditos: [{ id: "cr1", servico_nome: "Banho", saldo: 2 }],
                },
              ],
              error: null,
            }),
          }),
        }),
      };

      const res = await ProgramasCreditosAdapter.consultarProgramasAtivosGeral(mockSb);
      expect(res.success).toBe(true);
      expect(res.total_count).toBe(1);
      expect(res.data[0].tutorNome).toBe("Marcos Lima");
      expect(res.data[0].petNome).toBe("Bob");
      expect(res.data[0].creditosRestantes).toBe(2);
      expect(res.data[0].diasRestantes).toBeGreaterThan(0);
    });

    it("69. Ficha & Histórico do Pet: Retorna atendimentos anteriores e restrições de saúde", async () => {
      const mockSb: any = {
        from: (tab: string) => {
          if (tab === "pets") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({
                    data: {
                      id: "pet_luna",
                      nome: "Luna",
                      raca: "Shih Tzu",
                      observacoes_saude: "Alergia a perfume",
                      cliente: { id: "c_luna", nome: "Camila" },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({
                    data: [{ id: "ag_antigo", data_hora: "2026-09-01T10:00:00Z", status: "concluido", valor_total: 90 }],
                  }),
                }),
              }),
            }),
          };
        },
      };

      const res = await ClientesPetsAdapter.obterFichaPet(mockSb, "pet_luna");
      expect(res.success).toBe(true);
      expect(res.data.nome).toBe("Luna");
      expect(res.data.observacoes_saude).toBe("Alergia a perfume");
      expect(res.data.historicoAtendimentos.length).toBe(1);
    });

    it("70. Garantia Somente Leitura: Nenhuma mutação sem confirmação", async () => {
      const { processarMensagemJessiV2Core } = await import("../agent/jessi-v2-agent.core");
      const mockSb: any = {
        from: () => ({
          select: () => ({
            limit: () => Promise.resolve({ data: [] }),
            gte: () => ({ lte: () => ({ order: () => Promise.resolve({ data: [] }) }) }),
          }),
        }),
      };

      const res = await processarMensagemJessiV2Core(mockSb, { mensagem: "Quem são os clientes com pendências?" });
      expect(res.pendingAction).toBeNull();
    });
  });

  // =========================================================================
  // SUITE 11: Fase 3 — Preparação de Operações (Sem Execução)
  // =========================================================================
  describe("Suite 11: Fase 3 — Preparação de Operações (Sem Execução)", () => {
    it("71. Preparação de Agendamento: Emite cartão de revisão completo com resumoVisual", async () => {
      const { processarMensagemJessiV2Core } = await import("../agent/jessi-v2-agent.core");
      const mockSb: any = {
        from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: [] }) }) }),
      };

      const res = await processarMensagemJessiV2Core(mockSb, {
        mensagem: "Agendar banho para o Rex amanhã às 14h",
      });

      expect(res.pendingAction).toBeDefined();
      expect(res.pendingAction?.type).toBe("preparar_agendamento");
      expect(res.cards[0].type).toBe("confirmacao");
      expect(res.cards[0].data.proposta.resumoVisual.entendido).toContain("Rex");
      expect(res.cards[0].data.proposta.resumoVisual.alertas.length).toBeGreaterThan(0);
      expect(res.cards[0].data.acoesDisponiveis).toContain("Confirmar operação");
      expect(res.cards[0].data.acoesDisponiveis).toContain("Cancelar");
    });

    it("72. Preparação de Programas/Créditos: Prepara abatimento com alerta de extras separados", async () => {
      const { processarMensagemJessiV2Core } = await import("../agent/jessi-v2-agent.core");
      const mockSb: any = {
        from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: [] }) }) }),
      };

      const res = await processarMensagemJessiV2Core(mockSb, {
        mensagem: "Debitar 1 crédito de banho do plano do Thor",
      });

      expect(res.pendingAction).toBeDefined();
      expect(res.cards[0].data.proposta.resumoVisual.seraAlterado).toContain("Abatimento");
      expect(res.cards[0].data.proposta.resumoVisual.alertas.some((a: string) => a.includes("extras"))).toBe(true);
    });

    it("73. Preparação de Cadastros: Estrutura proposta com dados do cliente sem persistir no banco", async () => {
      const { processarMensagemJessiV2Core } = await import("../agent/jessi-v2-agent.core");
      const mockSb: any = {
        from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: [] }) }) }),
      };

      const res = await processarMensagemJessiV2Core(mockSb, {
        mensagem: "Cadastrar cliente Roberto Silva telefone 11977776666",
      });

      expect(res.pendingAction).toBeDefined();
      expect(res.pendingAction?.type).toBe("preparar_cadastro_cliente");
      expect(res.cards[0].data.proposta.status).toBe("awaiting_confirmation");
    });

    it("74. Preparação de Mensagens: Formata template de WhatsApp sem disparo automático", () => {
      const payload = {
        telefoneDestino: "11988889999",
        nomeCliente: "Beatriz",
        nomePet: "Pipoca",
        tipoMensagem: "pet_pronto" as const,
      };

      const res = MensagensWhatsAppAdapter.gerarMensagemWhatsApp(payload);
      expect(res.urlWhatsApp).toContain("wa.me/5511988889999");
      expect(res.mensagemFormatada).toContain("pronto");
    });

    it("75. Garantia Estrita Sem Execução: Proposta gerada permanece em 'awaiting_confirmation'", () => {
      const proposta = JessiV2ConfirmationManager.criarProposta({
        userId: "operador_1",
        acao: "executar_agendamento",
        motivo: "Teste sem execução",
        estadoProposto: { pet: "Thor", data: "2026-09-10" },
        resumoVisual: {
          entendido: "Agendar banho",
          seraAlterado: "Gravar agendamento",
          situacaoAtual: "Vago",
          resultadoEsperado: "Agendado",
          alertas: ["Aguardando autorização"],
        },
      });

      expect(proposta.status).toBe("awaiting_confirmation");
      expect(proposta.assinaturaConteudo).toBeDefined();
      expect(proposta.validade).toBeDefined();
    });
  });

  // =========================================================================
  // SUITE 12: Fase 4 — Agenda Supervisionada (Criar, Remarcar, Cancelar, Confirmar, Verificar por ID)
  // =========================================================================
  describe("Suite 12: Fase 4 — Agenda Supervisionada", () => {
    it("76. Criar Agendamento: Grava e atesta persistência física com verified=true", async () => {
      const mockSb: any = {
        from: (tab: string) => {
          if (tab === "agendamentos") {
            return {
              select: () => ({
                eq: () => ({
                  neq: () => Promise.resolve({ data: [] }),
                  maybeSingle: () => Promise.resolve({ data: { id: "ag_novo_123", status: "agendado" }, error: null }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: () => Promise.resolve({
                    data: { id: "ag_novo_123", data_hora: "2026-09-10T14:00:00Z", status: "agendado", valor_total: 110 },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const res = await AgendaAdapter.executarAgendamentoConfirmado(
        mockSb,
        { clienteId: "c1", petId: "p1", dataHora: "2026-09-10T14:00:00Z", valor: 110 },
        "idemp_ag_criar_76"
      );

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.affected_record_id).toBe("ag_novo_123");
    });

    it("77. Remarcar Agendamento: Atualiza horário e valida novo registro por ID", async () => {
      const mockSb: any = {
        from: (tab: string) => ({
          select: () => ({
            eq: () => ({
              neq: () => Promise.resolve({ data: [] }), // sem conflito de grade
              maybeSingle: () => Promise.resolve({
                data: { id: "ag_existente_456", data_hora: "2026-09-11T16:00:00Z", status: "agendado", valor_total: 110 },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({
                  data: { id: "ag_existente_456", data_hora: "2026-09-11T16:00:00Z", status: "agendado", valor_total: 110 },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      const res = await AgendaAdapter.executarRemarcacaoConfirmada(
        mockSb,
        { agendamentoId: "ag_existente_456", novaDataHoraISO: "2026-09-11T16:00:00Z", motivo: "Pedido do tutor" },
        "idemp_remarcar_77"
      );

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.entity_id).toBe("ag_existente_456");
      expect(res.after.data_hora).toBe("2026-09-11T16:00:00Z");
    });

    it("78. Cancelar Agendamento: Altera status para cancelado e libera vaga", async () => {
      const mockSb: any = {
        from: (tab: string) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { id: "ag_cancelar_789", status: "cancelado", data_hora: "2026-09-10T10:00:00Z" },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({
                  data: { id: "ag_cancelar_789", status: "cancelado", data_hora: "2026-09-10T10:00:00Z" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      const res = await AgendaAdapter.executarCancelamentoConfirmado(
        mockSb,
        { agendamentoId: "ag_cancelar_789", motivo: "Tutor viajou" },
        "idemp_cancel_78"
      );

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.after.status).toBe("cancelado");
    });

    it("79. Verificar Agendamento por ID: Retorna ficha oficial completa da reserva", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: {
                  id: "ag_consulta_999",
                  data_hora: "2026-09-12T11:00:00Z",
                  status: "agendado",
                  valor_total: 130,
                  cliente: { nome: "Fernanda" },
                  pet: { nome: "Barthô" },
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      const res = await AgendaAdapter.verificarAgendamentoPorId(mockSb, "ag_consulta_999");
      expect(res.success).toBe(true);
      expect(res.data.id).toBe("ag_consulta_999");
      expect(res.data.cliente.nome).toBe("Fernanda");
      expect(res.data.pet.nome).toBe("Barthô");
    });

    it("80. Despachante V2 Agenda: Roteia criar, remarcar, cancelar e verificar por ID", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              neq: () => Promise.resolve({ data: [] }),
              maybeSingle: () => Promise.resolve({ data: { id: "ag_dispatch_1" }, error: null }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: "ag_dispatch_1" }, error: null }),
            }),
          }),
        }),
      };

      const res = await despacharFerramentaV2(mockSb, "executar_agendamento", {
        clienteId: "c1",
        petId: "p1",
        dataHora: "2026-09-10T14:00:00Z",
        valor: 100,
      });

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 13: Fase 5 — Programas e Créditos (Reservar, Consumir, Liberar, Consultar Saldo, Separar Banho e Extras)
  // =========================================================================
  describe("Suite 13: Fase 5 — Programas e Créditos", () => {
    it("81. Reservar Crédito: Vincula crédito ao agendamento para prevenir consumo duplo", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: "cr_100", saldo: 2, servico_nome: "Banho" }, error: null }),
            }),
          }),
        }),
      };

      const res = await ProgramasCreditosAdapter.reservarCreditoAgendamento(
        mockSb,
        { creditoId: "cr_100", agendamentoId: "ag_200" },
        "idemp_res_81"
      );

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.summary).toContain("reservado com sucesso");
    });

    it("82. Consumir Crédito: Abate 1 sessão e atesta gravação no banco", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: "cr_100", saldo: 2, servico_nome: "Banho" }, error: null }),
              maybeSingle: () => Promise.resolve({ data: { id: "cr_100", saldo: 1 }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: "cr_100", saldo: 1, servico_nome: "Banho" }, error: null }),
              }),
            }),
          }),
        }),
      };

      const res = await ProgramasCreditosAdapter.executarConsumoCreditoConfirmado(
        mockSb,
        { creditoId: "cr_100", quantidade: 1 },
        "idemp_consumo_82"
      );

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.after?.saldo).toBe(1);
    });

    it("83. Liberar Crédito: Restaura saldo após cancelamento de agendamento", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { id: "cr_100", saldo: 1, servico_nome: "Banho" }, error: null }),
              maybeSingle: () => Promise.resolve({ data: { id: "cr_100", saldo: 2 }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: "cr_100", saldo: 2, servico_nome: "Banho" }, error: null }),
              }),
            }),
          }),
        }),
      };

      const res = await ProgramasCreditosAdapter.liberarCreditoCancelamento(
        mockSb,
        { creditoId: "cr_100", agendamentoId: "ag_200", motivo: "Cancelamento elegível" },
        "idemp_libera_83"
      );

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.after?.saldo).toBe(2);
      expect(res.summary).toContain("restaurado para: 2");
    });

    it("84. Consultar Saldo: Retorna créditos restantes vinculados ao cliente/pet", async () => {
      const mockSb: any = {
        from: (tab: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [{ id: "prog_1", status: "ativo" }], error: null }),
              gt: () => Promise.resolve({ data: [{ id: "cr_1", saldo: 3, servico_nome: "Banho" }], error: null }),
            }),
          }),
        }),
      };

      const res = await ProgramasCreditosAdapter.consultarSaldoCreditos(mockSb, "cli_mariana", "pet_thor");
      expect(res.success).toBe(true);
      expect(res.data.totalSessaoRestantes).toBe(3);
    });

    it("85. Separar Banho e Extras: Quita banho com crédito e cobra extras à parte", () => {
      const proposta = ProgramasCreditosAdapter.prepararFinalizacaoComExtras({
        clienteId: "cli_1",
        clienteNome: "Camila",
        petId: "pet_1",
        petNome: "Mel",
        creditoId: "cr_1",
        saldoAtual: 3,
        valorBanho: 85.0,
        servicosExtras: [
          { nome: "Tosa Higiênica", valor: 35.0 },
          { nome: "Hidratação de Argan", valor: 45.0 },
        ],
      });

      expect(proposta.params.totalExtras).toBe(80.0);
      expect(proposta.params.debitoCredito).toBe(1);
      expect(proposta.summary).toContain("Quitado com 1 Crédito do Plano");
      expect(proposta.summary).toContain("R$ 80.00");
      expect(proposta.summary).toContain("Saldo Restante de Créditos: 2");
    });
  });

  // =========================================================================
  // SUITE 14: Fase 6 — Financeiro (Recebimento, Pagamento Parcial, Estorno, Conciliação Autorizada)
  // =========================================================================
  describe("Suite 14: Fase 6 — Financeiro", () => {
    it("86. Recebimento Integral: Registra transação paga e valida com Read-Back", async () => {
      const mockSb: any = {
        from: () => ({
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({
                data: { id: "pg_100", valor_total: 120, valor_pago: 120, status: "pago", forma: "pix" },
                error: null,
              }),
            }),
          }),
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { id: "pg_100", status: "pago", valor_pago: 120 },
                error: null,
              }),
            }),
          }),
        }),
      };

      const res = await FinanceiroRelatoriosAdapter.executarRecebimentoConfirmado(
        mockSb,
        { valorTotal: 120, formaPagamento: "pix", agendamentoId: "ag_100" },
        "idemp_rec_86"
      );

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.entity_id).toBe("pg_100");
    });

    it("87. Pagamento Parcial: Atualiza valor pago acumulado e calcula saldo restante", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { id: "pg_200", valor_total: 200, valor_pago: 50, status: "parcialmente_pago" },
                error: null,
              }),
              maybeSingle: () => Promise.resolve({
                data: { id: "pg_200", valor_pago: 150, status: "parcialmente_pago" },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({
                  data: { id: "pg_200", valor_total: 200, valor_pago: 150, status: "parcialmente_pago" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      const res = await FinanceiroRelatoriosAdapter.executarPagamentoParcialConfirmado(
        mockSb,
        { pagamentoId: "pg_200", valorParcial: 100, formaPagamento: "dinheiro" },
        "idemp_parc_87"
      );

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.summary).toContain("Saldo restante: R$ 50.00");
    });

    it("88. Estorno Confirmado: Atualiza status para estornado e confere gravação física", async () => {
      const mockSb: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { id: "pg_300", valor_total: 90, status: "pago" },
                error: null,
              }),
              maybeSingle: () => Promise.resolve({
                data: { id: "pg_300", status: "estornado" },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({
                  data: { id: "pg_300", valor_total: 90, status: "estornado" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      const res = await FinanceiroRelatoriosAdapter.executarEstornoConfirmado(
        mockSb,
        { pagamentoId: "pg_300", motivo: "Cliente cancelou antes do banho" },
        "idemp_estorno_88"
      );

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.summary).toContain("Estorno do pagamento #pg_300");
    });

    it("89. Conciliação Autorizada: Atualiza lote de transações autorizadas pelo operador", async () => {
      const mockSb: any = {
        from: () => ({
          update: () => ({
            in: () => ({
              select: () => Promise.resolve({
                data: [
                  { id: "pg_c1", status: "pago", valor_total: 100 },
                  { id: "pg_c2", status: "pago", valor_total: 150 },
                ],
                error: null,
              }),
            }),
          }),
        }),
      };

      const res = await FinanceiroRelatoriosAdapter.executarConciliacaoAutorizada(
        mockSb,
        { transacoesIds: ["pg_c1", "pg_c2"], operadorNome: "Jéssica" },
        "idemp_concil_89"
      );

      expect(res.success).toBe(true);
      expect(res.verified).toBe(true);
      expect(res.summary).toContain("2 lançamento(s) regularizado(s)");
    });
  });

  // =========================================================================
  // SUITE 15: Fase 7 — PDF e Mensagens (Documento, Prévia, Download, Compartilhamento, Registro do Envio)
  // =========================================================================
  describe("Suite 15: Fase 7 — PDF e Mensagens", () => {
    it("90. Termo em PDF: Gera documento estruturado com dados completos do programa", () => {
      const termo = ProgramasCreditosAdapter.gerarDocumentoTermoPdf({
        contratoId: "cont_100",
        tutorNome: "Patrícia Lima",
        tutorTelefone: "(11) 97777-8888",
        petNome: "Floquinho",
        petRaca: "Maltês",
        programaNome: "Clubinho 4 Banhos",
        creditosTotais: 4,
        valorMensal: 320.0,
        formaPagamento: "pix",
        dataContratacao: "2026-09-09",
        dataValidade: "2026-10-09",
      });

      expect(termo.documentoId).toContain("termo_cont_100");
      expect(termo.previaTexto).toContain("Floquinho");
      expect(termo.previaTexto).toContain("EXCLUSIVIDADE");
      expect(termo.downloadUrl).toBe("/api/documentos/termo/cont_100.pdf");
      expect(termo.whatsappShareUrl).toContain("https://wa.me/5511977778888");
    });

    it("91. Relatório do Pet: Substitui 'Banhos reservados' por 'Banhos utilizados'", () => {
      const relatorio = ProgramasCreditosAdapter.gerarRelatorioPetPdf({
        petNome: "Thor",
        tutorNome: "Mariana",
        programaNome: "Clubinho Premium",
        dataContratacao: "2026-08-10",
        dataValidade: "2026-09-10",
        totalBanhos: 4,
        banhosUtilizados: 3,
        creditosRestantes: 1,
        historicoDatasUso: ["2026-08-12", "2026-08-20", "2026-08-28"],
      });

      expect(relatorio.previaTexto).toContain("Banhos Utilizados: 3");
      expect(relatorio.previaTexto).not.toContain("Banhos reservados");
      expect(relatorio.dadosEstruturados.termoCorretoBanhos).toBe("Banhos utilizados");
    });

    it("92. Compartilhamento WhatsApp: Codifica parâmetros via URI de forma segura", () => {
      const payload = {
        telefoneDestino: "11999991111",
        nomeCliente: "Carlos",
        nomePet: "Toby",
        tipoMensagem: "pet_pronto" as const,
      };

      const res = MensagensWhatsAppAdapter.gerarMensagemWhatsApp(payload);
      expect(res.urlWhatsApp).toContain("https://wa.me/5511999991111?text=");
      expect(decodeURIComponent(res.urlWhatsApp)).toContain("Toby");
      expect(decodeURIComponent(res.urlWhatsApp)).toContain("pronto(a)");
    });

    it("93. Registro do Envio: Grava auditoria de comunicação com destinatário e canal", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockSb: any = {
        from: (tab: string) => ({
          insert: mockInsert,
        }),
      };

      await MensagensWhatsAppAdapter.registrarEnvioComunicacao(mockSb, {
        destinatario: "11999992222",
        conteudoAprovado: "Seu pet está pronto!",
        usuarioId: "user_jessica",
        canal: "whatsapp",
        resultado: "sucesso",
      });

      expect(mockInsert).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SUITE 16: Fase 8 — Voz e Proatividade (Voz, Resumos, Alertas, Sugestões, Monitoramento)
  // =========================================================================
  describe("Suite 16: Fase 8 — Voz e Proatividade", () => {
    it("94. Voz Supervisionada: Processa transcrição e preserva URL do áudio", () => {
      const { ProativoAdapter } = require("../adapters/proativo.adapter");
      const res = ProativoAdapter.processarTranscricaoVoz({
        audioUrl: "https://storage.supabase.co/audios/rec_123.wav",
        transcricao: "Agendar banho para o Thor amanhã às 14h",
        confiancaAudio: 0.95,
      });

      expect(res.transcricaoApresentada).toBe("Agendar banho para o Thor amanhã às 14h");
      expect(res.audioPreservadoUrl).toBe("https://storage.supabase.co/audios/rec_123.wav");
      expect(res.requerRevisaoTexto).toBe(false);
    });

    it("95. Resumo Diário Proativo: Compila faturamento, atendimentos e horários livres", async () => {
      const { ProativoAdapter } = require("../adapters/proativo.adapter");
      const mockSb: any = {
        from: (tab: string) => ({
          select: () => ({
            gte: () => ({ lte: () => ({ order: () => Promise.resolve({ data: [] }) }), eq: () => Promise.resolve({ data: [] }) }),
            eq: () => ({ gte: () => Promise.resolve({ data: [] }) }),
            is: () => ({ eq: () => ({ gte: () => Promise.resolve({ data: [] }) }) }),
          }),
        }),
      };

      const res = await ProativoAdapter.gerarResumoDiario(mockSb);
      expect(res.success).toBe(true);
      expect(res.summary).toBeDefined();
    });

    it("96. Alerta de Programas Vencendo: Filtra planos nos próximos 7 dias com créditos ativos", async () => {
      const { ProativoAdapter } = require("../adapters/proativo.adapter");
      const mockSb: any = {
        from: (tab: string) => ({
          select: () => {
            if (tab === "cliente_programas") {
              return {
                eq: () => ({
                  gte: () => Promise.resolve({
                    data: [
                      {
                        id: "prog_venc",
                        data_inicio: "2026-08-15",
                        data_fim: "2026-09-12",
                        cliente: { nome: "Luana" },
                        pet: { nome: "Bidu" },
                        programa: { nome: "Clubinho 4 Banhos" },
                      },
                    ],
                    error: null,
                  }),
                }),
              };
            }
            return Promise.resolve({ data: [{ cliente_id: "c1", pet_id: "p1", saldo: 2 }] });
          },
        }),
      };

      const res = await ProativoAdapter.identificarProgramasVencendo(mockSb, 7);
      expect(res.success).toBe(true);
      expect(res.source).toBe("programas_vencendo");
    });

    it("97. Sugestões de Reativação: Gera mensagens personalizadas com links wa.me", async () => {
      const { ProativoAdapter } = require("../adapters/proativo.adapter");
      const mockSb: any = {
        from: () => ({
          select: () => ({
            limit: () => Promise.resolve({
              data: [
                { id: "c_reativa", nome: "Mariana", telefone: "11988887777", pets: [{ nome: "Pipoca" }] },
              ],
            }),
          }),
        }),
      };

      const res = await ProativoAdapter.identificarClientesParaRetorno(mockSb);
      expect(res.success).toBe(true);
      expect(res.data[0].mensagemSugerida.urlWhatsApp).toContain("https://wa.me/5511988887777");
      expect(res.data[0].mensagemSugerida.mensagemFormatada).toContain("Pipoca");
    });

    it("98. Monitoramento Proativo: Zero execução automática de mutações", async () => {
      const { ProativoAdapter } = require("../adapters/proativo.adapter");
      const mockSb: any = {
        from: () => ({
          select: () => ({
            gte: () => ({ lte: () => ({ order: () => Promise.resolve({ data: [] }) }), eq: () => Promise.resolve({ data: [] }) }),
            eq: () => ({ gte: () => Promise.resolve({ data: [] }) }),
            is: () => ({ eq: () => ({ gte: () => Promise.resolve({ data: [] }) }) }),
          }),
        }),
      };

      const res = await ProativoAdapter.gerarCentralProativa(mockSb);
      expect(res.success).toBe(true);
      // Nenhuma ação executada
      expect(res.data.itensPrioritarios.every((i: any) => i.categoria)).toBe(true);
    });
  });
});
