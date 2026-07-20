import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import {
  Download,
  Eye,
  MessageCircle,
  ShieldCheck,
  Loader2,
  PawPrint,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateReciboPDF } from "@/lib/recibo-pdf";


type ReciboPublico = {
  codigo: string;
  tipo: "receita" | "despesa";
  numero_recibo: string;
  contraparte: string;
  valor: number;
  enviado_em: string;
  cancelado: boolean;
  pet_nome: string | null;
  servico: string | null;
  data_atendimento: string | null;
  forma_pagamento: string | null;
  data_pagamento: string | null;
  empresa_nome: string | null;
  empresa_telefone: string | null;
  empresa_whatsapp: string | null;
  empresa_logo: string | null;
};

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDate(iso: string | null | undefined, pattern = "dd/MM/yyyy") {
  if (!iso) return null;
  try {
    return format(parseISO(iso), pattern, { locale: ptBR });
  } catch {
    return null;
  }
}

function digits(v: string) {
  return v.replace(/\D/g, "");
}

function ReciboPublicoPage() {
  const { codigo } = Route.useParams();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gerandoPreview, setGerandoPreview] = useState(false);


  const { data, isLoading, error } = useQuery({
    queryKey: ["recibo-publico", codigo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_recibo_publico", {
        _codigo: codigo,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as ReciboPublico | null;
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F2EA]">
        <Loader2 className="h-6 w-6 animate-spin text-[#123F2A]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F2EA] px-6">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-lg p-8 border border-[#E7E1D3]">
          <PawPrint className="h-10 w-10 mx-auto text-[#C99845]" />
          <h1 className="mt-4 text-xl font-semibold text-[#123F2A]">
            Recibo não encontrado
          </h1>
          <p className="mt-2 text-sm text-[#525852]">
            O link pode estar incorreto ou o documento foi removido. Entre em
            contato conosco para receber uma nova via.
          </p>
        </div>
      </div>
    );
  }

  const r = data;
  const cancelado = r.cancelado;
  const dataConf = fmtDate(r.enviado_em, "dd/MM/yyyy 'às' HH:mm");
  const dataAtend = fmtDate(r.data_atendimento);
  const dataPag = fmtDate(r.data_pagamento);
  const forma = r.forma_pagamento
    ? r.forma_pagamento.replace(/_/g, " ")
    : null;

  const buildReciboData = () => ({
    tipo: r.tipo,
    numero: r.numero_recibo,
    data: r.data_pagamento || r.enviado_em.slice(0, 10),
    contraparte: r.contraparte,
    descricao:
      [r.servico, r.pet_nome ? `Pet: ${r.pet_nome}` : null]
        .filter(Boolean)
        .join(" · ") || "Serviços do spa",
    valor: Number(r.valor),
    forma: r.forma_pagamento || null,
    empresa: {
      nome: r.empresa_nome,
      telefone: r.empresa_telefone,
    },
  });

  const baixarPdf = () => {
    void generateReciboPDF(buildReciboData());
  };

  const abrirPreview = async () => {
    if (previewUrl) {
      // fecha se já estiver aberto
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    setGerandoPreview(true);
    try {
      const res = (await generateReciboPDF(buildReciboData(), true)) as {
        blob: Blob;
        fileName: string;
      };
      setPreviewUrl(URL.createObjectURL(res.blob));
    } finally {
      setGerandoPreview(false);
    }
  };

  const fecharPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };




  const whatsappNumero = r.empresa_whatsapp
    ? (() => {
        const d = digits(r.empresa_whatsapp);
        if (!d) return null;
        return d.startsWith("55") ? d : `55${d}`;
      })()
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F5F2EA] to-white pb-16">
      <header className="bg-[#123F2A] text-white">
        <div className="max-w-2xl mx-auto px-5 py-6 flex items-center gap-3">
          {r.empresa_logo ? (
            <img
              src={r.empresa_logo}
              alt=""
              className="h-12 w-12 rounded-full object-cover border-2 border-[#C99845]"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-[#168055] border-2 border-[#C99845] flex items-center justify-center">
              <PawPrint className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-[#C99845]">
              Recibo de pagamento
            </div>
            <div className="text-lg font-semibold truncate">
              {r.empresa_nome ?? "Spa de Pet Tia Jéssica"}
            </div>
          </div>
        </div>
        <div className="h-1 bg-[#C99845]" />
      </header>

      <main className="max-w-2xl mx-auto px-5 pt-6">
        {cancelado && (
          <div className="rounded-xl border border-red-300 bg-red-50 text-red-800 px-4 py-3 mb-4 text-sm font-semibold text-center">
            Recibo cancelado
          </div>
        )}

        <section className="bg-white rounded-2xl shadow-md border border-[#E7E1D3] overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-[#EFEADC]">
            <div className="text-[11px] uppercase tracking-widest text-[#8A8F87]">
              Nº do recibo
            </div>
            <div className="font-mono text-base text-[#252824]">
              {r.numero_recibo}
            </div>
          </div>

          <div className="px-5 py-6 bg-[#FBF9F2]">
            <div className="text-[11px] uppercase tracking-widest text-[#8A8F87]">
              Valor pago
            </div>
            <div
              className={
                "mt-1 text-3xl font-bold " +
                (cancelado ? "text-red-700 line-through" : "text-[#123F2A]")
              }
            >
              {brl(Number(r.valor))}
            </div>
          </div>

          <dl className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
            <Field label="Cliente" value={r.contraparte} />
            {r.pet_nome && <Field label="Pet" value={r.pet_nome} />}
            {r.servico && <Field label="Serviço" value={r.servico} />}
            {dataAtend && <Field label="Data do atendimento" value={dataAtend} />}
            {forma && <Field label="Forma de pagamento" value={forma} />}
            {dataPag && <Field label="Data do pagamento" value={dataPag} />}
            {dataConf && <Field label="Confirmação" value={dataConf} />}
          </dl>

          <div className="px-5 pb-5 flex flex-col sm:flex-row gap-2">
            <Button
              onClick={abrirPreview}
              disabled={cancelado || gerandoPreview}
              className="w-full sm:w-auto bg-[#123F2A] hover:bg-[#0E2F20] text-white"
            >
              {gerandoPreview ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : previewUrl ? (
                <X className="h-4 w-4 mr-1" />
              ) : (
                <Eye className="h-4 w-4 mr-1" />
              )}
              {previewUrl ? "Fechar prévia" : "Visualizar recibo"}
            </Button>
            <Button
              onClick={baixarPdf}
              disabled={cancelado}
              variant="outline"
              className="w-full sm:w-auto border-[#C99845] text-[#7A5A1D] hover:bg-[#FBF3DE]"
            >
              <Download className="h-4 w-4 mr-1" /> Baixar PDF
            </Button>
          </div>

          {previewUrl && (
            <div className="border-t border-[#EFEADC] bg-[#F5F2EA]">
              <div className="flex items-center justify-between px-5 py-2 text-xs uppercase tracking-widest text-[#525852]">
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> Prévia do PDF
                </span>
                <div className="flex items-center gap-3">
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#123F2A] underline"
                  >
                    Abrir em nova aba
                  </a>
                  <button
                    onClick={fecharPreview}
                    className="text-[#525852] hover:text-[#123F2A]"
                    aria-label="Fechar prévia"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <iframe
                key={previewUrl}
                src={previewUrl}
                title="Prévia do recibo"
                className="w-full h-[70vh] bg-white border-t border-[#EFEADC]"
              />
            </div>
          )}
        </section>

        <div className="mt-4 flex items-start gap-2 text-xs text-[#525852] px-1">
          <ShieldCheck className="h-4 w-4 text-[#168055] shrink-0 mt-0.5" />
          <p>
            Documento autêntico emitido pelo sistema do{" "}
            {r.empresa_nome ?? "Spa de Pet Tia Jéssica"}. Este link é único e
            permanece válido enquanto o recibo estiver ativo.
          </p>
        </div>

        {whatsappNumero && (
          <div className="mt-6">
            <Button
              asChild
              className="w-full bg-[#168055] hover:bg-[#0F6641] text-white"
            >
              <a
                href={`https://wa.me/${whatsappNumero}?text=${encodeURIComponent(
                  `Olá! Referente ao recibo ${r.numero_recibo}.`,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Falar no WhatsApp
              </a>
            </Button>
          </div>
        )}

        <footer className="mt-10 text-center text-[11px] text-[#8A8F87]">
          <Badge
            variant="outline"
            className="border-[#C99845]/60 text-[#7A5A1D]"
          >
            Recibo digital · verificação por código único
          </Badge>
        </footer>
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-[#8A8F87]">
        {label}
      </dt>
      <dd className="mt-0.5 text-[#252824] font-medium break-words">{value}</dd>
    </div>
  );
}

export const Route = createFileRoute("/recibo/$codigo")({
  head: ({ params }) => {
    const title = `Recibo ${params.codigo} — Spa de Pet Tia Jéssica`;
    const description =
      "Consulte com segurança o recibo oficial emitido pelo Spa de Pet Tia Jéssica.";
    const url = `https://tia-jessicas-pet-hq.lovable.app/recibo/${params.codigo}`;
    const image = `https://tia-jessicas-pet-hq.lovable.app${logoAsset.url}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Spa de Pet Tia Jéssica" },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { property: "og:image:alt", content: "Spa de Pet Tia Jéssica" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ReciboPublicoPage,
});

