import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, PawPrint, ArrowLeft, Ruler, Cake, Syringe, Heart,
  Pencil, CalendarPlus, FileText, History, User as UserIcon,
} from "lucide-react";
import { useSignedUrl } from "@/lib/use-signed-url";

export const Route = createFileRoute("/_authenticated/pets/$petId/ficha")({
  component: FichaOperacional,
});

function idadeStr(nasc?: string | null): string {
  if (!nasc) return "—";
  const n = new Date(nasc);
  if (isNaN(+n)) return "—";
  const hoje = new Date();
  let anos = hoje.getFullYear() - n.getFullYear();
  let meses = hoje.getMonth() - n.getMonth();
  if (hoje.getDate() < n.getDate()) meses -= 1;
  if (meses < 0) { anos--; meses += 12; }
  if (anos <= 0) return `${meses < 0 ? 0 : meses} ${meses === 1 ? "mês" : "meses"}`;
  return `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

function FichaOperacional() {
  const { petId } = Route.useParams();
  const navigate = useNavigate();

  const { data: pet, isLoading } = useQuery({
    queryKey: ["pet-ficha", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("*, clientes(id, nome, whatsapp, telefone, vip)")
        .eq("id", petId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Só um COUNT + últimas datas — não carrega histórico
  const { data: resumo } = useQuery({
    queryKey: ["pet-resumo", petId],
    queryFn: async () => {
      const { count } = await supabase
        .from("atendimentos")
        .select("id", { count: "exact", head: true })
        .eq("pet_id", petId)
        .not("encerrado_em", "is", null);
      const { data: ult } = await supabase
        .from("atendimentos")
        .select("data_inicio, encerrado_em")
        .eq("pet_id", petId)
        .not("encerrado_em", "is", null)
        .order("data_inicio", { ascending: false })
        .limit(2);
      
      // Se houver pelo menos um encerrado, a última visita é o mais recente.
      // A regra de "anterior" aplica-se ao RELATÓRIO do atendimento atual.
      // Na ficha, mostramos a última data de fato gravada.
      return { total: count ?? 0, ultima: ult?.[0]?.data_inicio ?? null };
    },
  });

  const { data: programaContratado } = useQuery({
    queryKey: ["pet-programa-ativo", petId],
    enabled: !!pet,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("programas_contratados" as any)
        .select(`
          id, nome_snapshot, composicao_snapshot, data_de_inicio, data_de_validade, status_do_programa,
          movimentacoes:programas_creditos_movimentacoes(id, servico_id, quantidade, tipo)
        `)
        .or(`pet_id.eq.${petId},and(cliente_id.eq.${pet!.cliente_id},pet_id.is.null)`)
        .not("status_do_programa", "eq", "cancelado")
        .order("criado_em", { ascending: false })
        .limit(1);
      return rows?.[0] ?? null;
    },
  });

  if (isLoading) return <PageShell><div className="text-sm text-muted-foreground">Carregando ficha…</div></PageShell>;
  if (!pet) return <PageShell><div className="text-sm text-muted-foreground">Pet não encontrado.</div></PageShell>;

  const alertas: string[] = [];
  if (pet.temperamento && ["agressivo", "medroso", "estressado"].includes(String(pet.temperamento).toLowerCase())) {
    alertas.push(`Temperamento: ${pet.temperamento}`);
  }
  if (pet.alergias) alertas.push(`Alergias: ${pet.alergias}`);
  if ((pet as any).cuidados_saude) alertas.push(`Saúde: ${(pet as any).cuidados_saude}`);
  if (pet.necessita_focinheira) alertas.push(`Focinheira obrigatória`);

  const movs = ((programaContratado as any)?.movimentacoes as any[]) ?? [];

  return (
    <PageShell>
      <PageHeader
        title={pet.nome}
        description={`Ficha do pet · ${pet.clientes?.nome ?? ""}`}
        actions={
          <>
            <Button
              className="gap-2 bg-white text-primary hover:bg-white/90"
              onClick={() => navigate({ to: "/pets/$petId/historico", params: { petId } })}
            >
              <History className="h-4 w-4"/> Consultar histórico
            </Button>
            <Button
              variant="outline"
              className="gap-2 bg-white/10 border-white/25 text-white hover:bg-white/20 hover:text-white"
              onClick={() => navigate({ to: "/pets/$petId/dossie", params: { petId } })}
            >
              <FileText className="h-4 w-4"/> Gerar PDF do pet
            </Button>
            <Button
              variant="outline"
              className="gap-2 bg-white/10 border-white/25 text-white hover:bg-white/20 hover:text-white"
              onClick={() => navigate({ to: "/pets/$petId/editar", params: { petId } })}
            >
              <Pencil className="h-4 w-4"/> Editar pet
            </Button>
            <Link
              to="/agenda"
              search={{ cliente: pet.cliente_id, pet: pet.id }}
            >
              <Button variant="outline" className="gap-2 bg-white/10 border-white/25 text-white hover:bg-white/20 hover:text-white"><CalendarPlus className="h-4 w-4"/> Novo agendamento</Button>
            </Link>
            <Link to="/clientes/$id" params={{ id: pet.cliente_id }}>
              <Button variant="ghost" className="gap-2 text-white hover:bg-white/15 hover:text-white"><ArrowLeft className="h-4 w-4"/> Voltar</Button>
            </Link>
          </>
        }
      />

      {alertas.length > 0 && (
        <Card className="p-4 mb-4 border-warning bg-warning/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5"/>
            <div className="min-w-0">
              <div className="font-display font-semibold text-warning-foreground">Atenção antes de manusear</div>
              <ul className="mt-1 space-y-0.5 text-sm">
                {alertas.map((a, i) => <li key={i}>• {a}</li>)}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Programa de Cuidado do Pet */}
      {programaContratado && (
        <Card className="p-4 mb-4 border-l-4 border-l-primary bg-primary/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-muted-foreground">Programa de Cuidado</span>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                  {(programaContratado as any).status_do_programa}
                </Badge>
              </div>
              <h3 className="font-display font-semibold text-lg text-primary">
                {(programaContratado as any).nome_snapshot}
              </h3>
              <p className="text-xs text-muted-foreground">
                Válido até {(programaContratado as any).data_de_validade ? new Date((programaContratado as any).data_de_validade).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>

            {/* Créditos */}
            <div className="flex flex-wrap gap-2">
              {Array.isArray((programaContratado as any).composicao_snapshot) && (programaContratado as any).composicao_snapshot.map((item: any, idx: number) => {
                const movsItem = movs.filter((m: any) => m.servico_id === item.servico_id);
                let contratados = item.quantidade || 1;
                let consumidos = 0;
                let reservados = 0;
                movsItem.forEach((m: any) => {
                  if (m.tipo === "credito_consumido") consumidos += Number(m.quantidade || 0);
                  if (m.tipo === "credito_reservado") reservados += Number(m.quantidade || 0);
                });
                const disponiveis = Math.max(0, contratados - consumidos - reservados);

                return (
                  <div key={idx} className="bg-background rounded-lg border px-3 py-1.5 text-xs flex items-center gap-2 shadow-sm">
                    <span className="font-medium">{item.nome}</span>
                    <Badge variant="secondary" className="font-bold text-primary">
                      {disponiveis} disponíveis
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <PetAvatar path={pet.foto_url} nome={pet.nome}/>
            <div className="min-w-0">
              <div className="font-display text-xl font-semibold text-primary truncate">{pet.nome}</div>
              <div className="text-xs text-muted-foreground truncate">
                {[pet.raca, pet.porte].filter(Boolean).join(" · ") || "—"}
              </div>
              {pet.necessita_focinheira && (
                <div className="mt-1 text-[11px] text-warning-foreground bg-warning/20 rounded px-1.5 py-0.5 inline-block">
                  ⚠ Focinheira obrigatória
                </div>
              )}
            </div>
          </div>
          <dl className="space-y-2 text-sm">
            <Info icon={UserIcon} label="Tutor" value={pet.clientes?.nome ?? "—"}/>
            {pet.sexo && <Info icon={Heart} label="Sexo" value={pet.sexo === "macho" ? "Macho" : "Fêmea"}/>}
            {pet.nascimento && <Info icon={Cake} label="Idade" value={idadeStr(pet.nascimento)}/>}
            {pet.peso != null && <Info icon={Ruler} label="Peso atual" value={`${pet.peso} kg`}/>}
            {(pet as any).cuidados_saude && <Info icon={Syringe} label="Saúde" value={(pet as any).cuidados_saude}/>}
          </dl>
          {pet.temperamento && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Temperamento</div>
              <Badge variant="secondary">{pet.temperamento}</Badge>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display font-semibold text-primary mb-3">Resumo operacional</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <ResumoItem label="Alergias" value={pet.alergias ?? "—"}/>
            <ResumoItem label="Última visita" value={fmt(resumo?.ultima)}/>
            <ResumoItem label="Próxima visita" value={fmt(pet.proxima_visita)}/>
            <ResumoItem label="Último banho" value={fmt(pet.ultimo_banho)}/>
            <ResumoItem label="Última tosa" value={fmt(pet.ultima_tosa)}/>
            <ResumoItem label="Total atendimentos" value={String(resumo?.total ?? 0)}/>
          </div>
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
            O histórico completo não é carregado nesta tela. Toque em <strong>Consultar histórico</strong> ou <strong>Gerar PDF do pet</strong> para acessar os registros.
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function fmt(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

function ResumoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 break-words">{value || "—"}</div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5"/>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm break-words">{value}</div>
      </div>
    </div>
  );
}

function PetAvatar({ path, nome }: { path: string | null | undefined; nome: string }) {
  const { data: url } = useSignedUrl(path ?? null);
  if (url) return <img src={url} alt={nome} className="h-14 w-14 rounded-full object-cover border" />;
  return (
    <div className="h-14 w-14 rounded-full bg-primary/10 grid place-items-center">
      <PawPrint className="h-7 w-7 text-primary"/>
    </div>
  );
}
