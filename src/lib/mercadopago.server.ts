/**
 * Serviço de Integração com a API do Mercado Pago
 * Spa de Pet Tia Jéssica
 * 
 * Suporte a:
 * - Emissão de Pix Dinâmico com QR Code e Copia-e-Cola
 * - Geração de Link de Pagamento no Cartão de Crédito (Checkout Pro)
 * - Consulta de Status de Pagamento
 * - Processamento de Notificações Webhook com Baixa Automática
 */

const MERCADOPAGO_API_URL = "https://api.mercadopago.com";

// Token padrão fornecido pelo usuário com fallback para variável de ambiente
const DEFAULT_ACCESS_TOKEN = "APP_USR-2280844207590542-092821-f8cb33a17ab3ec64dc2a33d5c44ef817-1030414891";

export function obterMercadoPagoAccessToken(): string {
  if (typeof process !== "undefined" && process.env) {
    return (
      process.env.MERCADOPAGO_ACCESS_TOKEN ||
      process.env.MP_ACCESS_TOKEN ||
      process.env.VITE_MERCADOPAGO_ACCESS_TOKEN ||
      DEFAULT_ACCESS_TOKEN
    );
  }
  return DEFAULT_ACCESS_TOKEN;
}

export interface CriarPixMercadoPagoInput {
  valor: number;
  descricao: string;
  clienteNome?: string;
  clienteEmail?: string;
  clienteCpf?: string;
  clienteTelefone?: string;
  agendamentoId?: string;
  cobrancaId?: string;
  clienteId?: string;
}

export interface CriarPixMercadoPagoOutput {
  sucesso: boolean;
  paymentId?: number | string;
  status?: string;
  statusDetail?: string;
  valor?: number;
  qrCode?: string; // Código Pix Copia-e-Cola
  qrCodeBase64?: string; // Imagem Base64 do QR Code para renderizar na tela
  ticketUrl?: string;
  expiraEm?: string;
  mensagemErro?: string;
}

/**
 * Cria uma cobrança Pix dinâmica com QR Code e Copia-e-Cola via Mercado Pago Payments API
 */
export async function criarCobrancaPixMercadoPago(
  input: CriarPixMercadoPagoInput
): Promise<CriarPixMercadoPagoOutput> {
  const token = obterMercadoPagoAccessToken();

  if (!token) {
    return {
      sucesso: false,
      mensagemErro: "Token de acesso do Mercado Pago não configurado.",
    };
  }

  const valorFormatado = Math.round(input.valor * 100) / 100;
  if (valorFormatado <= 0) {
    return {
      sucesso: false,
      mensagemErro: "O valor do pagamento deve ser maior que zero.",
    };
  }

  // Monta dados do pagador com fallbacks seguros
  const nomeCompleto = (input.clienteNome || "Cliente Spa de Pet").trim();
  const partesNome = nomeCompleto.split(" ");
  const primeiroNome = partesNome[0] || "Cliente";
  const sobrenome = partesNome.slice(1).join(" ") || "Tia Jessica";
  const emailValido = (input.clienteEmail && input.clienteEmail.includes("@"))
    ? input.clienteEmail.trim()
    : `cliente_${Date.now()}@spadepet.com.br`;

  const externalReference = JSON.stringify({
    agendamentoId: input.agendamentoId || null,
    cobrancaId: input.cobrancaId || null,
    clienteId: input.clienteId || null,
    origem: "spa_de_pet_tia_jessica",
  });

  const body: any = {
    transaction_amount: valorFormatado,
    description: input.descricao.slice(0, 100),
    payment_method_id: "pix",
    payer: {
      email: emailValido,
      first_name: primeiroNome,
      last_name: sobrenome,
    },
    external_reference: externalReference,
    notification_url: "https://tia-jessicas-pet-hq.lovable.app/api/public/hooks/mercadopago",
  };

  // Se houver CPF informado
  if (input.clienteCpf && input.clienteCpf.replace(/\D/g, "").length >= 11) {
    body.payer.identification = {
      type: "CPF",
      number: input.clienteCpf.replace(/\D/g, ""),
    };
  }

  try {
    const idempotencyKey = `pix_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const response = await fetch(`${MERCADOPAGO_API_URL}/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    const data: any = await response.json();

    if (!response.ok) {
      console.error("[MercadoPago] Erro ao criar pagamento Pix:", data);
      const msgErro = data?.message || data?.cause?.[0]?.description || "Erro na API do Mercado Pago.";
      return {
        sucesso: false,
        mensagemErro: msgErro,
      };
    }

    const pointOfInteraction = data?.point_of_interaction?.transaction_data;
    const qrCode = pointOfInteraction?.qr_code || "";
    const qrCodeBase64 = pointOfInteraction?.qr_code_base64 || "";
    const ticketUrl = pointOfInteraction?.ticket_url || "";

    return {
      sucesso: true,
      paymentId: data.id,
      status: data.status,
      statusDetail: data.status_detail,
      valor: data.transaction_amount,
      qrCode,
      qrCodeBase64,
      ticketUrl,
      expiraEm: data.date_of_expiration,
    };
  } catch (err: any) {
    console.error("[MercadoPago] Exceção na chamada de Pix:", err);
    return {
      sucesso: false,
      mensagemErro: err?.message || "Falha de conexão com o Mercado Pago.",
    };
  }
}

export interface CriarLinkPagamentoInput {
  titulo: string;
  valor: number;
  quantidade?: number;
  clienteNome?: string;
  clienteEmail?: string;
  agendamentoId?: string;
  cobrancaId?: string;
  clienteId?: string;
}

export interface CriarLinkPagamentoOutput {
  sucesso: boolean;
  preferenceId?: string;
  initPoint?: string; // Link de pagamento oficial Mercado Pago
  sandboxInitPoint?: string;
  mensagemErro?: string;
}

/**
 * Cria um link de pagamento (Checkout Pro) com suporte a Cartão de Crédito e Parcelamento
 */
export async function criarLinkPagamentoMercadoPago(
  input: CriarLinkPagamentoInput
): Promise<CriarLinkPagamentoOutput> {
  const token = obterMercadoPagoAccessToken();

  if (!token) {
    return {
      sucesso: false,
      mensagemErro: "Token do Mercado Pago não configurado.",
    };
  }

  const valorFormatado = Math.round(input.valor * 100) / 100;
  const externalReference = JSON.stringify({
    agendamentoId: input.agendamentoId || null,
    cobrancaId: input.cobrancaId || null,
    clienteId: input.clienteId || null,
    origem: "spa_de_pet_link",
  });

  const body = {
    items: [
      {
        title: input.titulo.slice(0, 100),
        unit_price: valorFormatado,
        quantity: input.quantidade || 1,
        currency_id: "BRL",
      },
    ],
    payer: {
      name: input.clienteNome || "Cliente",
      email: input.clienteEmail || "cliente@spadepet.com.br",
    },
    external_reference: externalReference,
    back_urls: {
      success: "https://tia-jessicas-pet-hq.lovable.app/jessi?status=sucesso",
      failure: "https://tia-jessicas-pet-hq.lovable.app/jessi?status=falha",
      pending: "https://tia-jessicas-pet-hq.lovable.app/jessi?status=pendente",
    },
    auto_return: "approved",
    statement_descriptor: "SPA DE PET",
    notification_url: "https://tia-jessicas-pet-hq.lovable.app/api/public/hooks/mercadopago",
  };

  try {
    const response = await fetch(`${MERCADOPAGO_API_URL}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data: any = await response.json();

    if (!response.ok) {
      console.error("[MercadoPago] Erro ao criar preferência de checkout:", data);
      return {
        sucesso: false,
        mensagemErro: data?.message || "Erro ao gerar link de pagamento.",
      };
    }

    return {
      sucesso: true,
      preferenceId: data.id,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
    };
  } catch (err: any) {
    console.error("[MercadoPago] Exceção ao gerar link:", err);
    return {
      sucesso: false,
      mensagemErro: err?.message || "Falha na conexão com o Mercado Pago.",
    };
  }
}

/**
 * Consulta os últimos pagamentos aprovados da conta Mercado Pago
 */
export async function consultarUltimosPagamentosAprovadosMercadoPago(): Promise<any[]> {
  const token = obterMercadoPagoAccessToken();
  try {
    const response = await fetch(
      `${MERCADOPAGO_API_URL}/v1/payments/search?sort=date_created&criteria=desc&limit=15`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data: any = await response.json();
    return data?.results || [];
  } catch {
    return [];
  }
}

/**
 * Consulta o status atual de um pagamento diretamente na API do Mercado Pago
 */
export async function consultarPagamentoMercadoPago(
  paymentId: string | number
): Promise<{
  sucesso: boolean;
  status?: "pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back";
  statusDetail?: string;
  valor?: number;
  metodoPagamento?: string;
  dataAprovacao?: string;
  externalReference?: any;
  mensagemErro?: string;
}> {
  const token = obterMercadoPagoAccessToken();

  try {
    const response = await fetch(`${MERCADOPAGO_API_URL}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data: any = await response.json();

    if (!response.ok) {
      return {
        sucesso: false,
        mensagemErro: data?.message || "Pagamento não localizado.",
      };
    }

    let parsedRef: any = null;
    try {
      if (data.external_reference) {
        parsedRef = JSON.parse(data.external_reference);
      }
    } catch {
      parsedRef = data.external_reference;
    }

    return {
      sucesso: true,
      status: data.status,
      statusDetail: data.status_detail,
      valor: data.transaction_amount,
      metodoPagamento: data.payment_method_id,
      dataAprovacao: data.date_approved,
      externalReference: parsedRef,
    };
  } catch (err: any) {
    return {
      sucesso: false,
      mensagemErro: err?.message || "Erro ao consultar pagamento.",
    };
  }
}
