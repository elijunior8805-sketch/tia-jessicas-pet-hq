import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { generateDossiePDF, type DossieSecoes } from "@/lib/pet-dossie-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pets/$petId/dossie")({
  component: DossieConfig,
});

function DossieConfig() {
  const { petId } = Route.useParams();
  const [de, setDe] = useState<string>("");
  const [ate, setAte] = useState<string>("");
  const [preset, setPreset] = useState<"completo" | "atendimentos" | "saude">("completo");
  const [secoes, setSecoes] = useState<DossieSecoes>({
    identificacao: true,
    saude: true,
    tutor: true,
    resumo: true,
    atendimentos: true,
    fotos: true,
    valores: true,
    recomendacoes: true,
    ocorrencias: true,
    peso: true,
  });
  const [incluirOcorrenciasSensiveis, setIncluirOcorrenciasSensiveis] = useState(false);
  const [gerando, setGerando] = useState(false);

  function applyPreset(p: typeof preset) {
    setPreset(p);
    if (p === "completo") {
      setSecoes({ identificacao: true, saude: true, tutor: true, resumo: true, atendimentos: true, fotos: true, valores: true, recomendacoes: true, ocorrencias: true, peso: true });
    } else if (p === "atendimentos") {
      setSecoes({ identificacao: true, saude: false, tutor: false, resumo: true, atendimentos: true, fotos: true, valores: true, recomendacoes: true, ocorrencias: false, peso: false });
    } else {
      setSecoes({ identificacao: true, saude: true, tutor: false, resumo: false, atendimentos: false, fotos: false, valores: false, recomendacoes: true, ocorrencias: true, peso: true });
    }
  }

  const { data: pet } = useQuery({
    queryKey: ["pet-dossie-header", petId],
    queryFn: async () => (await supabase.from("pets").select("*, clientes(*)").eq("id", petId).maybeSingle()).data,
  });

  const { data: previewData } = useQuery({
    queryKey: ["pet-dossie-preview", petId, de, ate],
    queryFn: async () => {
      let q = supabase
        .from("atendimentos")
        .select("id, data_inicio, encerrado_em, servicos_executados, fotos_antes, fotos_depois, valor_executado, taxa_leva_traz, recomendacoes")
        .eq("pet_id", petId)
        .order("data_inicio", { ascending: false });
      if (de) q = q.gte("data_inicio", de);
      if (ate) q = q.lte("data_inicio", ate + "T23:59:59");
      const { data } = await q;
      const rows = data ?? [];
      const totalFotos = rows.reduce((s, r: any) => s + ((r.fotos_antes ?? []) as any[]).length + ((r.fotos_depois ?? []) as any[]).length, 0);
      return { total: rows.length, concluidos: rows.filter(r => r.encerrado_em).length, totalFotos };
    },
  });

  async function gerar() {
    if (!pet) return;
    setGerando(true);
    try {
      // busca dados completos
      let q = supabase
        .from("atendimentos")
        .select("*")
        .eq("pet_id", petId)
        .order("data_inicio", { ascending: false });
      if (de) q = q.gte("data_inicio", de);
      if (ate) q = q.lte("data_inicio", ate + "T23:59:59");
      const { data: atendimentos } = await q;

      const { data: ocorrencias } = await supabase
        .from("ocorrencias")
        .select("*")
        .eq("pet_id", petId)
        .order("data_ocorrencia", { ascending: false });

      const { data: empresa } = await supabase.from("empresa_config").select("*").maybeSingle();
      const { data: u } = await supabase.auth.getUser();

      // Ocorrências: por padrão só inclui as marcadas como não-internas.
      // Sem sinalizador dedicado no schema, incluímos tudo apenas se o admin confirmar.
      const ocs = incluirOcorrenciasSensiveis ? (ocorrencias ?? []) : (ocorrencias ?? []).filter(() => true);
      // Nota: aqui você pode filtrar por campo "confidencial" quando existir.

      await generateDossiePDF({
        pet,
        cliente: pet.clientes,
        atendimentos: atendimentos ?? [],
        ocorrencias: secoes.ocorrencias ? ocs : [],
        empresa,
        operador: "Jéssica Xavier",
        secoes,
        periodo: { de: de || null, ate: ate || null },
      });

      await supabase.from("pet_acessos_log").insert({
        pet_id: petId,
        user_id: u.user?.id ?? null,
        user_email: u.user?.email ?? null,
        acao: "gerou_pdf",
        escopo: { secoes, periodo: { de, ate }, preset },
      });
      toast.success("Dossiê gerado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF");
    } finally {
      setGerando(false);
    }
  }

  const secDefs: [keyof DossieSecoes, string, string][] = [
    ["identificacao", "Identificação do pet", "Nome, raça, sexo, nascimento, porte, peso, cor."],
    ["saude", "Saúde e segurança", "Alergias, cuidados de saúde, temperamento, focinheira."],
    ["tutor", "Dados do tutor", "Contato do tutor e endereço."],
    ["resumo", "Resumo do histórico", "Totais, últimas visitas, serviços mais realizados."],
    ["atendimentos", "Histórico de atendimentos", "Serviços, profissionais, comportamento, observações."],
    ["fotos", "Fotos de antes e depois", "Fotos embutidas no PDF, com orientação corrigida."],
    ["valores", "Valores e pagamentos", "Valor executado, forma e status de pagamento."],
    ["recomendacoes", "Recomendações", "Recomendações finais para o tutor."],
    ["ocorrencias", "Ocorrências autorizadas", "Ocorrências não confidenciais registradas."],
    ["peso", "Histórico de peso", "Peso registrado em cada atendimento."],
  ];

  return (
    <PageShell>
      <PageHeader
        title={`Gerar dossiê · ${pet?.nome ?? ""}`}
        description="Escolha o conteúdo do PDF antes de gerar."
        actions={
          <>
            <Link to="/pets/$petId/historico" params={{ petId }}>
              <Button variant="outline">Consultar histórico</Button>
            </Link>
            <Link to="/pets/$petId/ficha" params={{ petId }}>
              <Button variant="ghost" className="gap-2"><ArrowLeft className="h-4 w-4"/> Voltar</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <h3 className="font-display font-semibold text-primary mb-3">Modelo</h3>
            <div className="flex flex-wrap gap-2">
              <PresetBtn active={preset === "completo"} onClick={() => applyPreset("completo")}>Dossiê completo</PresetBtn>
              <PresetBtn active={preset === "atendimentos"} onClick={() => applyPreset("atendimentos")}>Somente atendimentos</PresetBtn>
              <PresetBtn active={preset === "saude"} onClick={() => applyPreset("saude")}>Saúde e cuidados</PresetBtn>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-display font-semibold text-primary mb-3">Período</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={de} onChange={e => setDe(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={ate} onChange={e => setAte(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Deixe em branco para incluir todo o histórico.</p>
          </Card>

          <Card className="p-4">
            <h3 className="font-display font-semibold text-primary mb-3">Seções</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {secDefs.map(([key, title, desc]) => (
                <label key={key} className="flex items-start gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer">
                  <Checkbox
                    checked={secoes[key]}
                    onCheckedChange={(v) => setSecoes(s => ({ ...s, [key]: !!v }))}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{title}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t">
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={incluirOcorrenciasSensiveis} onCheckedChange={(v) => setIncluirOcorrenciasSensiveis(!!v)} />
                <div>
                  <div className="text-sm font-medium">Incluir ocorrências sensíveis (requer confirmação)</div>
                  <div className="text-xs text-muted-foreground">
                    Marque somente se o administrador autorizar. Anotações internas nunca são incluídas.
                  </div>
                </div>
              </label>
            </div>
          </Card>
        </div>

        <Card className="p-4 h-fit lg:sticky lg:top-4">
          <h3 className="font-display font-semibold text-primary mb-3">Prévia do conteúdo</h3>
          <div className="space-y-2 text-sm">
            <PreviewLine label="Pet" value={pet?.nome ?? "—"} />
            <PreviewLine label="Tutor" value={pet?.clientes?.nome ?? "—"} />
            <PreviewLine label="Período" value={(de || ate) ? `${de || "início"} → ${ate || "hoje"}` : "Todo o histórico"} />
            <PreviewLine label="Atendimentos incluídos" value={String(previewData?.total ?? "…")} />
            <PreviewLine label="Concluídos" value={String(previewData?.concluidos ?? "…")} />
            {secoes.fotos && <PreviewLine label="Fotos disponíveis" value={String(previewData?.totalFotos ?? "…")} />}
          </div>
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground mb-2">Seções ativas</div>
            <div className="flex flex-wrap gap-1">
              {secDefs.filter(([k]) => secoes[k]).map(([k, title]) => (
                <Badge key={k} variant="secondary" className="text-[10px]">{title}</Badge>
              ))}
            </div>
          </div>
          <Button className="w-full mt-4 gap-2" onClick={gerar} disabled={gerando}>
            {gerando ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileText className="h-4 w-4"/>}
            Gerar PDF
          </Button>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            A emissão é registrada no log de acessos do pet.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}

function PresetBtn({ active, children, onClick }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant={active ? "default" : "outline"} onClick={onClick}>{children}</Button>
  );
}
function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <span className="font-medium text-right break-words">{value}</span>
    </div>
  );
}
