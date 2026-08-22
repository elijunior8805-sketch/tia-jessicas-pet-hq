import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Table } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateFinanceiroPDF, type FinPdfData } from "@/lib/financeiro-pdf";
import { generateFinanceiroCSV } from "@/lib/financeiro-csv";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RelatorioFinanceiroExportProps {
  from: string;
  to: string;
  kpis: any;
  auditNote?: string;
}

export function RelatorioFinanceiroExport({ from, to, kpis, auditNote }: RelatorioFinanceiroExportProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async (format: "pdf" | "csv") => {
    setLoading(true);
    try {
      // 1. Buscar dados detalhados para o relatório
      // O hook getFinancialKPIs já traz os totais, mas precisamos das linhas de entrada/saída
      const [pagRes, parcRes] = await Promise.all([
        supabase
          .from("pagamentos")
          .select("*, cliente:clientes(nome, telefone, whatsapp), atendimento:agendamentos(data_inicio, encerrado_em, finalizado, valor_executado, taxa_leva_traz, desconto, pet:pets(nome))")
          .gte("vencimento", from)
          .lte("vencimento", to)
          .order("vencimento", { ascending: false }),
        supabase
          .from("compras_parcelas")
          .select("*, compra:compras(descricao, numero_documento, fornecedor:fornecedor_id(nome, telefone, whatsapp), categoria:categoria_id(nome), centro_custo:centro_custo_id(nome))")
          .gte("vencimento", from)
          .lte("vencimento", to)
          .order("vencimento", { ascending: false }),
      ]);

      if (pagRes.error) throw pagRes.error;
      if (parcRes.error) throw parcRes.error;

      // 2. Formatar dados para as funções de exportação
      const exportData: FinPdfData = {
        periodo: { de: from, ate: to },
        filtrosAtivos: [],
        kpis: {
          receitaBruta: kpis.receitaBruta,
          totalRecebido: kpis.totalRecebido,
          totalAReceber: kpis.aReceber,
          vencidos: kpis.vencido,
          despesas: kpis.despesaTotal,
          lucroEstimado: kpis.lucroEstimado,
          saldoPeriodo: kpis.saldoPeriodo,
          ticketMedio: kpis.ticketMedio,
          qtdPendentes: kpis.pendenciasCount,
          aportesAjustes: kpis.aportes,
        },
        porForma: [], // Poderia ser calculado se necessário, mas os KPIs principais já bastam
        entradas: (pagRes.data || []).map((p: any) => ({
          data: p.data_pagamento,
          vencimento: p.vencimento,
          cliente: p.cliente?.nome || "Avulso",
          descricao: p.descricao || (p.atendimento?.pet?.nome ? `Serviço: ${p.atendimento.pet.nome}` : "Receita"),
          forma: p.forma || "N/A",
          status: p.status,
          valor: p.valor_total,
          valor_pago: p.valor_pago,
        })),
        saidas: (parcRes.data || []).map((p: any) => ({
          data: p.data_pagamento,
          vencimento: p.vencimento,
          fornecedor: (p.compra as any)?.fornecedor?.nome || "N/A",
          descricao: (p.compra as any)?.descricao || "Compra",
          categoria: (p.compra as any)?.categoria?.nome,
          forma: p.forma_pagamento || "N/A",
          status: p.status,
          valor: p.valor,
          valor_pago: p.valor_pago,
        })),
        auditNote,
      };

      if (format === "pdf") {
        await generateFinanceiroPDF(exportData);
        toast.success("PDF gerado com sucesso");
      } else {
        generateFinanceiroCSV(exportData);
        toast.success("CSV gerado com sucesso");
      }
    } catch (error: any) {
      console.error("Erro na exportação:", error);
      toast.error("Erro ao exportar relatório: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={loading}>
          <Download className="h-4 w-4" />
          {loading ? "Exportando..." : "Exportar"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Formato do Relatório</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2">
          <FileText className="h-4 w-4 text-red-500" />
          Relatório em PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2">
          <Table className="h-4 w-4 text-green-600" />
          Planilha (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
