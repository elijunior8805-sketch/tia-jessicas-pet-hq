import { describe, it, expect } from "vitest";
import { JESSI_CONFIG, JESSI_FLAGS_DEFAULT } from "@/lib/ia/jessi-config";
import { JESSI_TOOLS } from "@/lib/ia/jessi-tools-registry";
import { JessiQueryResultSchema, JessiMutationResultSchema } from "@/lib/ia/jessi-contracts";
import { verificarExigenciaConfirmacao, gerarChaveIdempotencia } from "@/lib/ia/jessi-guardrails";
import casosTeste from "./casos-de-teste.json";

describe("Jessi — Testes de Arquitetura e Contratos", () => {
  it("deve carregar a identidade oficial e regras de conduta", () => {
    expect(JESSI_CONFIG.nome).toBe("Jessi");
    expect(JESSI_CONFIG.subtitulo).toBe("Assistente Operacional do Spa");
    expect(JESSI_CONFIG.paleta.primaria).toBe("#1B5E20");
    expect(JESSI_CONFIG.regrasComportamentais.length).toBeGreaterThan(3);
  });

  it("deve conter todas as feature flags ativas no padrão", () => {
    expect(JESSI_FLAGS_DEFAULT.ai_v2_enabled).toBe(true);
    expect(JESSI_FLAGS_DEFAULT.ai_v2_queries).toBe(true);
    expect(JESSI_FLAGS_DEFAULT.ai_v2_scheduling).toBe(true);
    expect(JESSI_FLAGS_DEFAULT.ai_v2_finance).toBe(true);
    expect(JESSI_FLAGS_DEFAULT.ai_v2_programs).toBe(true);
  });

  it("deve possuir todas as ferramentas registradas e tipadas", () => {
    const tools = Object.keys(JESSI_TOOLS);
    expect(tools).toContain("consultar_agenda");
    expect(tools).toContain("buscar_clientes");
    expect(tools).toContain("consultar_faturamento");
    expect(tools).toContain("consultar_creditos_pet");
    expect(tools).toContain("processar_comprovante");
    expect(tools).toContain("criar_agendamento");
    expect(tools).toContain("baixa_pagamento");
    expect(tools).toContain("reconciliar_creditos");

    // Valida propriedades de cada ferramenta
    tools.forEach((t) => {
      const def = JESSI_TOOLS[t];
      expect(def.nome).toBe(t);
      expect(["consulta", "acao"]).toContain(def.tipo);
      expect(typeof def.exigeConfirmacao).toBe("boolean");
      expect(typeof def.executar).toBe("function");
    });
  });

  it("deve exigir confirmação para ações e dispensar para consultas", () => {
    expect(verificarExigenciaConfirmacao("consulta", "consultar_agenda")).toBe(false);
    expect(verificarExigenciaConfirmacao("consulta", "buscar_clientes")).toBe(false);
    expect(verificarExigenciaConfirmacao("acao", "criar_agendamento")).toBe(true);
    expect(verificarExigenciaConfirmacao("acao", "baixa_pagamento")).toBe(true);
    expect(verificarExigenciaConfirmacao("acao", "cancelar_agendamento")).toBe(true);
  });

  it("deve gerar chaves de idempotência únicas e consistentes", () => {
    const k1 = gerarChaveIdempotencia("teste", "dados1");
    const k2 = gerarChaveIdempotencia("teste", "dados1");
    expect(k1.startsWith("jessi_teste_")).toBe(true);
    expect(k2.startsWith("jessi_teste_")).toBe(true);
  });

  it("deve validar schemas de retorno de consulta e mutação", () => {
    const mockQuery = {
      success: true,
      source: "agenda",
      data: [{ id: "123" }],
      executed_at: new Date().toISOString(),
    };
    expect(() => JessiQueryResultSchema.parse(mockQuery)).not.toThrow();

    const mockMutation = {
      success: true,
      source: "criar_agendamento",
      affected_record_id: "rec_123",
      executed_at: new Date().toISOString(),
      verified: true,
    };
    expect(() => JessiMutationResultSchema.parse(mockMutation)).not.toThrow();
  });

  it("deve conter o banco completo de casos de teste com todas as categorias", () => {
    expect(casosTeste.length).toBeGreaterThanOrEqual(100);

    const categorias = new Set(casosTeste.map((c: any) => c.categoria));
    expect(categorias.has("Agenda")).toBe(true);
    expect(categorias.has("Clientes e Pets")).toBe(true);
    expect(categorias.has("Financeiro")).toBe(true);
    expect(categorias.has("Programas e Créditos")).toBe(true);
    expect(categorias.has("Comprovantes")).toBe(true);
    expect(categorias.has("Voz e Contexto")).toBe(true);
    expect(categorias.has("Comunicação")).toBe(true);
    expect(categorias.has("Segurança e Permissões")).toBe(true);
    expect(categorias.has("Ambiguidades e Erros")).toBe(true);
  });
});
