import React, { useState } from "react";
import {
  Sparkles,
  PackageAlert,
  ShoppingCart,
  Copy,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ProdutoEstoqueItem {
  id: string;
  nome: string;
  quantidade: number;
  estoque_minimo: number;
  unidade: string;
  custo_medio: number;
  categoria?: string | null;
}

interface JessiEstoqueCopilotProps {
  produtos: ProdutoEstoqueItem[];
  onFiltrarCriticos?: () => void;
}

export const JessiEstoqueCopilot: React.FC<JessiEstoqueCopilotProps> = ({
  produtos = [],
  onFiltrarCriticos,
}) => {
  const [listaComprasGerada, setListaComprasGerada] = useState<string | null>(null);

  // Produtos abaixo ou no limite do estoque mínimo
  const produtosCriticos = produtos.filter((p) => Number(p.quantidade) <= Number(p.estoque_minimo));
  const produtosZerados = produtos.filter((p) => Number(p.quantidade) <= 0);

  const handleGerarListaCompras = () => {
    if (produtosCriticos.length === 0) {
      toast.info("Todos os produtos estão com estoque em nível seguro!");
      return;
    }

    let texto = `*PEDIDO DE REPOSIÇÃO - SPA DE PET TIA JÉSSICA*\nData: ${new Date().toLocaleDateString("pt-BR")}\n\n`;
    texto += `Olá! Segue a relação de insumos para cotação e reposição do nosso estoque:\n\n`;

    let totalEstimado = 0;
    produtosCriticos.forEach((p, i) => {
      const qtdSugerida = Math.max(1, Number(p.estoque_minimo) * 2 - Number(p.quantidade));
      const custoEst = qtdSugerida * Number(p.custo_medio || 0);
      totalEstimado += custoEst;
      texto += `${i + 1}. *${p.nome}*\n   • Atual: ${p.quantidade} ${p.unidade} (Mín: ${p.estoque_minimo})\n   • Pedido Sugerido: *${qtdSugerida} ${p.unidade}*\n\n`;
    });

    if (totalEstimado > 0) {
      texto += `*Custo Estimado:* ${totalEstimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\n\n`;
    }
    texto += `Favor confirmar disponibilidade e prazo de entrega. Obrigado! 🐾✨`;

    setListaComprasGerada(texto);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#123F2A] via-[#1A5C3D] to-[#0E3322] text-white p-4 shadow-sm border border-[#C8A951]/40 mb-5 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-2.5 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-[#C8A951]/20 border border-[#C8A951]/40 flex items-center justify-center text-[#F5E6BE] shadow-xs">
            <Sparkles className="h-4 w-4 text-[#C8A951] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-white">
                Copiloto de Suprimentos · Jessi
              </span>
              <Badge className="bg-[#C8A951]/30 text-[#F5E6BE] border-[#C8A951]/50 text-[10px] py-0 px-2">
                Previsão Ativa
              </Badge>
            </div>
            <p className="text-[11px] text-white/70">
              Monitoramento preventivo de insumos para garantir o fluxo contínuo de banhos
            </p>
          </div>
        </div>

        {produtosCriticos.length > 0 && !listaComprasGerada && (
          <Button
            size="sm"
            onClick={handleGerarListaCompras}
            className="h-8 text-xs bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold rounded-lg gap-1.5 shadow-2xs self-start sm:self-auto"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Gerar Lista de Compras
          </Button>
        )}
      </div>

      {/* Diagnóstico em Tempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
          <span className="text-[10px] text-white/60 block mb-0.5">Estoque Crítico (Abaixo do Mínimo)</span>
          <span className={`font-bold text-sm flex items-center gap-1.5 ${produtosCriticos.length > 0 ? "text-amber-300" : "text-emerald-300"}`}>
            <PackageAlert className="h-4 w-4" />
            {produtosCriticos.length} produto(s)
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
          <span className="text-[10px] text-white/60 block mb-0.5">Itens Zerados (Esgotados)</span>
          <span className={`font-bold text-sm flex items-center gap-1.5 ${produtosZerados.length > 0 ? "text-red-300" : "text-emerald-300"}`}>
            <AlertTriangle className="h-4 w-4" />
            {produtosZerados.length} item(ns)
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 backdrop-blur-xs">
          <span className="text-[10px] text-white/60 block mb-0.5">Status Geral</span>
          <span className="font-bold text-white text-sm flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-[#C8A951]" />
            {produtosCriticos.length === 0 ? "Nível Seguro" : "Requer Reposição"}
          </span>
        </div>
      </div>

      {/* Lista de Compras Formatada com Revisão Humana */}
      {listaComprasGerada ? (
        <div className="mt-3 p-3.5 rounded-xl bg-white text-zinc-900 border border-[#C8A951]/40 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
            <span className="font-bold text-[#123F2A] text-xs flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5 text-[#C8A951]" />
              Lista de Compras Pronta para Envio (WhatsApp do Fornecedor):
            </span>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(listaComprasGerada);
                  toast.success("Lista de compras copiada para a área de transferência!");
                }}
                className="h-7 px-3 text-xs bg-[#C8A951] hover:bg-[#B59640] text-[#123F2A] font-bold gap-1 shadow-2xs"
              >
                <Copy className="h-3 w-3" /> Copiar Pedido
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setListaComprasGerada(null)}
                className="h-7 px-2 text-xs text-zinc-500"
              >
                Fechar
              </Button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-zinc-800 text-[11px] leading-relaxed font-sans bg-zinc-50 p-2.5 rounded-lg border border-zinc-200">
            {listaComprasGerada}
          </pre>
        </div>
      ) : (
        <div className="mt-3 text-[11px] text-white/80 leading-relaxed">
          {produtosCriticos.length > 0
            ? `Atenção: Existem ${produtosCriticos.length} produto(s) que atingiram o limite mínimo de segurança. Clique em "Gerar Lista de Compras" para criar a mensagem formatada para seus fornecedores.`
            : "Todos os produtos cadastrados estão em quantidade segura para atender os agendamentos da semana sem interrupções."}
        </div>
      )}
    </div>
  );
};
