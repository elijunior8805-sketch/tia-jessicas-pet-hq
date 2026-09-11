import React from "react";
import { DollarSign, TrendingUp, AlertCircle, ArrowRight, MessageSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FinanceiroCardProps {
  data: any;
  onActionClick?: (cmd: string) => void;
}

export const FinanceiroCard: React.FC<FinanceiroCardProps> = ({ data, onActionClick }) => {
  const faturamento = Number(data?.faturamentoBruto ?? data?.faturamento ?? data?.faturamento_total ?? data?.receita ?? 0);
  const recebido = Number(data?.valoresRecebidos ?? data?.recebido ?? faturamento);
  const pendente = Number(data?.valoresAReceber ?? data?.pendente ?? data?.a_receber ?? 0);
  const vencidos = Number(data?.valoresVencidosDevedores ?? 0);
  const ticketMedio = Number(data?.ticketMedio ?? 0);
  const formas = data?.formasPagamento || {};
  const itensPendentesRaw = Array.isArray(data?.devedores)
    ? data.devedores
    : Array.isArray(data?.itens_pendentes)
    ? data.itens_pendentes
    : Array.isArray(data?.pendencias)
    ? data.pendencias
    : Array.isArray(data?.registros)
    ? data.registros
    : Array.isArray(data)
    ? data
    : [];

  // Deduplicação por identificador único para prevenir duplicidade caso o relacionamento traga múltiplos itens/serviços
  const itensPendentes = React.useMemo(() => {
    const mapa = new Map<string, any>();
    itensPendentesRaw.forEach((item: any, idx: number) => {
      const key = item.id || `item_${idx}`;
      if (!mapa.has(key)) {
        mapa.set(key, item);
      }
    });
    return Array.from(mapa.values());
  }, [itensPendentesRaw]);

  // 1. Extração do nome real do cliente a partir dos relacionamentos existentes
  const getNomeCliente = (p: any): string => {
    const clienteObj = p.clientes || p.cliente || (Array.isArray(p.clientes) ? p.clientes[0] : null);
    const atendCliente = p.atendimentos?.clientes || p.atendimento?.cliente || p.atendimento?.clientes;
    const atendClienteObj = Array.isArray(atendCliente) ? atendCliente[0] : atendCliente;

    return (
      p.clienteNome ||
      p.cliente_nome ||
      clienteObj?.nome ||
      atendClienteObj?.nome ||
      p.nome ||
      "Cliente"
    );
  };

  // 2. Extração do valor real em aberto da pendência
  const getValorPendente = (p: any): number => {
    if (typeof p.saldo === "number" && !isNaN(p.saldo) && p.saldo > 0) {
      return p.saldo;
    }
    if (typeof p.valor === "number" && !isNaN(p.valor) && p.valor > 0 && p.valor_total === undefined && p.saldo === undefined) {
      return p.valor;
    }
    const total = Number(p.valor_total ?? p.valor_original ?? p.valor ?? 0);
    const pago = Number(p.valor_pago ?? 0);
    return Math.max(0, total - pago);
  };

  // 3. Formatação da data de vencimento real sem distorção de fuso horário
  const formatVencimento = (vencimento?: string | null): string => {
    if (!vencimento) return "Não informado";
    if (typeof vencimento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
      const [ano, mes, dia] = vencimento.split("-");
      return `${dia}/${mes}/${ano}`;
    }
    try {
      const d = new Date(vencimento);
      if (isNaN(d.getTime())) return "Não informado";
      return d.toLocaleDateString("pt-BR");
    } catch {
      return "Não informado";
    }
  };

  // 4. Soma apresentada em "Valores em Aberto" calculada exclusivamente pela soma das pendências únicas da lista
  const totalValoresEmAberto = React.useMemo(() => {
    if (itensPendentes.length > 0) {
      return itensPendentes.reduce((acc: number, p: any) => acc + getValorPendente(p), 0);
    }
    return pendente + vencidos;
  }, [itensPendentes, pendente, vencidos]);

  return (
    <div className="rounded-2xl border border-emerald-800/20 bg-card p-4 space-y-3 text-xs shadow-xs my-2">
      <div className="font-semibold text-emerald-950 flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-emerald-700" />
          <span>Resumo Financeiro Consolidado Oficial</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-emerald-50/70 p-3 border border-emerald-200/80">
          <span className="text-[11px] text-emerald-900 block mb-0.5">Faturamento (Recebido)</span>
          <span className="text-base font-bold text-emerald-900 flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-emerald-700" />
            R$ {recebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          {ticketMedio > 0 && (
            <span className="text-[10px] text-emerald-700 block mt-0.5">
              Ticket Médio: R$ {ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>

        <div className="rounded-xl bg-amber-50/70 p-3 border border-amber-200/80">
          <span className="text-[11px] text-amber-900 block mb-0.5">Valores em Aberto</span>
          <span className="text-base font-bold text-amber-800 flex items-center gap-1">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            R$ {totalValoresEmAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          {vencidos > 0 && (
            <span className="text-[10px] text-red-600 font-medium block mt-0.5">
              Vencidos: R$ {vencidos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </div>

      {formas.pix !== undefined && (
        <div className="p-2.5 rounded-xl bg-muted/40 border border-border/70 text-[11px] flex justify-between items-center">
          <span>Pix: <strong>R$ {Number(formas.pix || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
          <span>Dinheiro: <strong>R$ {Number(formas.dinheiro || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
          <span>Cartões: <strong>R$ {Number((formas.cartaoCredito || 0) + (formas.cartaoDebito || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
        </div>
      )}

      {itensPendentes.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-foreground block">
            Cobranças / Pendências Localizadas ({itensPendentes.length}):
          </span>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {itensPendentes.slice(0, 5).map((p: any, idx: number) => {
              const nome = getNomeCliente(p);
              const val = getValorPendente(p);
              const venc = formatVencimento(p.vencimento);

              return (
                <div
                  key={p.id || idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/70 text-xs"
                >
                  <div>
                    <span className="font-medium text-foreground block">{nome}</span>
                    <span className="text-[10px] text-muted-foreground">
                      Venc: {venc}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-700 block">
                      R$ {val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    {onActionClick && (
                      <button
                        type="button"
                        onClick={() => {
                          const comando = nome && nome !== "Cliente"
                            ? `Gerar mensagem de cobrança para ${nome}`
                            : `Gerar mensagem de cobrança para a pendência de R$ ${val.toFixed(2)}`;
                          onActionClick(comando);
                        }}
                        className="text-[10px] text-emerald-800 hover:underline font-semibold"
                      >
                        Cobrar WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {onActionClick && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onActionClick("consultar valores a receber")}
            className="h-7 px-2.5 text-xs text-emerald-900 border-emerald-300 hover:bg-emerald-50 rounded-lg font-medium"
          >
            Ver Todas Pendências
          </Button>
          <Button
            size="sm"
            onClick={() => onActionClick("Analisar comprovante Pix")}
            className="h-7 px-2.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-medium ml-auto"
          >
            Conciliar Pix
          </Button>
        </div>
      )}
    </div>
  );
};
