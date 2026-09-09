/**
 * Adaptador Oficial de Comunicação & WhatsApp para a Jessi V2
 * Desenvolvido pelo Agente 2 (Integrações e Regras)
 */

export interface JessiV2WhatsAppPayload {
  telefoneDestino: string;
  nomeCliente: string;
  nomePet?: string;
  tipoMensagem: "lembrete_agenda" | "pet_pronto" | "confirmacao_pix" | "reativacao_carinho";
  detalhes?: Record<string, any>;
}

export class MensagensWhatsAppAdapter {
  /**
   * Gera a mensagem formatada e o link wa.me pronto para disparo supervisionado
   */
  static gerarMensagemWhatsApp(payload: JessiV2WhatsAppPayload): {
    mensagemFormatada: string;
    urlWhatsApp: string;
    telefoneFormatado: string;
  } {
    const telefoneNumeros = (payload.telefoneDestino || "").replace(/\D/g, "");
    const telefoneComPais = telefoneNumeros.startsWith("55") ? telefoneNumeros : `55${telefoneNumeros}`;

    let texto = "";

    switch (payload.tipoMensagem) {
      case "lembrete_agenda":
        texto = `Olá, ${payload.nomeCliente}! 🐾 Passando para lembrar do agendamento do(a) ${payload.nomePet || "seu pet"} no Spa de Pet Tia Jéssica marcado para ${payload.detalhes?.horario || "hoje"}. Estamos ansiosos para recebê-lo!`;
        break;

      case "pet_pronto":
        texto = `Oi, ${payload.nomeCliente}! ✨ O(A) ${payload.nomePet || "seu pet"} já finalizou o banho e tosa e está cheiroso(a) e pronto(a) para voltar para casa! Pode vir buscá-lo(a). 🐶🚿`;
        break;

      case "confirmacao_pix":
        texto = `Olá, ${payload.nomeCliente}! Confirmamos o recebimento do seu pagamento no valor de R$ ${Number(payload.detalhes?.valor || 0).toFixed(2)}. Muito obrigado pela preferência e confiança! 💚`;
        break;

      case "reativacao_carinho":
        texto = `Oi, ${payload.nomeCliente}! Sentimos muita saudade do(a) ${payload.nomePet || "seu pet"} aqui no Spa! Que tal agendarmos um momento especial de cuidados para ele(a) esta semana? 🛁✨`;
        break;

      default:
        texto = `Olá, ${payload.nomeCliente}! Mensagem do Spa de Pet Tia Jéssica.`;
    }

    const url = `https://wa.me/${telefoneComPais}?text=${encodeURIComponent(texto)}`;

    return {
      mensagemFormatada: texto,
      urlWhatsApp: url,
      telefoneFormatado: telefoneComPais,
    };
  }
}
