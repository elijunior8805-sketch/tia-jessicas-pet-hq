/**
 * Provedor de Compatibilidade Jessi V2
 * Redireciona 100% das operações para o motor Groq LLaMA 3.3 70B (jessi-v2-groq.provider.ts)
 */

export * from "./jessi-v2-groq.provider";
export { JessiV2GroqProvider as JessiV2GeminiProvider } from "./jessi-v2-groq.provider";
