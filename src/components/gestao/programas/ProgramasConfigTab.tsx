import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Settings as SettingsIcon, BellRing, Send, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getProgramasConfig,
  salvarProgramasConfig,
  listarAlertasVencimento,
  gerarAlertasVencimento,
  atualizarAlertaVencimento,
} from "@/lib/programas-config.functions";
import { useMyAccess } from "@/hooks/use-my-permissions";
import { abrirWhatsAppBusiness } from "@/lib/whatsapp";

type ConfigState = {
  permitir_venda_fracionada: boolean;
  notificar_vencimento: boolean;
  notificar_dias_antes: number;
  validade_padrao_dias: number;
};

export function ProgramasConfigTab() {
  const queryClient = useQueryClient();
  const { data: access } = useMyAccess();
  const podeEditar = !!access?.isAdmin;

  const { data: config } = useQuery({
    queryKey: ["programas-config"],
    queryFn: () => getProgramasConfig(),
  });

  const [form, setForm] = useState<ConfigState | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        permitir_venda_fracionada: !!(config as any).permitir_venda_fracionada,
        notificar_vencimento: !!(config as any).notificar_vencimento,
        notificar_dias_antes: Number((config as any).notificar_dias_antes ?? 7),
        validade_padrao_dias: Number((config as any).validade_padrao_dias ?? 30),
      });
    }
  }, [config]);

  const dirty =
    !!form &&
    !!config &&
    (form.permitir_venda_fracionada !== !!(config as any).permitir_venda_fracionada ||
      form.notificar_vencimento !== !!(config as any).notificar_vencimento ||
      form.notificar_dias_antes !== Number((config as any).notificar_dias_antes ?? 7) ||
      form.validade_padrao_dias !== Number((config as any).validade_padrao_dias ?? 30));

  const salvar = useMutation({
    mutationFn: (vars: ConfigState) => salvarProgramasConfig({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programas-config"] });
      toast.success("Configurações salvas no banco de dados.");
      setConfirmOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar."),
  });

  const { data: alertas } = useQuery({
    queryKey: ["programas-alertas-vencimento"],
    queryFn: () => listarAlertasVencimento(),
  });

  const gerar = useMutation({
    mutationFn: () => gerarAlertasVencimento(),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["programas-alertas-vencimento"] });
      if (r?.motivo) toast.info(r.motivo);
      else toast.success(`${r.criados} alerta(s) criado(s). ${r.ignorados} ignorado(s) (duplicado ou sem saldo).`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar alertas."),
  });

  const atualizarAlerta = useMutation({
    mutationFn: (vars: { id: string; status: "aprovado" | "enviado" | "descartado"; mensagem_sugerida?: string }) =>
      atualizarAlertaVencimento({ data: vars }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["programas-alertas-vencimento"] }),
  });

  const pendentes = (alertas ?? []).filter((a: any) => a.status !== "enviado" && a.status !== "descartado");

  const statusBadge = (ativo: boolean) => (
    <Badge
      variant="secondary"
      className={`border-none px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
        ativo
          ? "bg-green-500/10 text-green-600 dark:text-green-500"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
      }`}
    >
      {ativo ? "ATIVO" : "DESATIVADO"}
    </Badge>
  );

  if (!form) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Carregando configurações...</div>;
  }

  return (
    <>
      <Card className="border-sidebar-border/60 max-w-2xl bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
        <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-sidebar-border/40 pb-6">
          <CardTitle className="text-xl font-display font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
            <SettingsIcon className="h-6 w-6 text-gold" />
            Configurações do Módulo
          </CardTitle>
          <CardDescription className="text-zinc-500 dark:text-zinc-400">
            Defina as regras operacionais e financeiras que regem todos os programas de cuidado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-8">
          <div className="space-y-2">
            {/* Venda fracionada */}
            <div className="flex justify-between items-center gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Permitir venda fracionada</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Habilita a venda de parte dos serviços de um programa, com valor calculado automaticamente.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {statusBadge(form.permitir_venda_fracionada)}
                <Switch
                  checked={form.permitir_venda_fracionada}
                  disabled={!podeEditar}
                  onCheckedChange={(v) => setForm({ ...form, permitir_venda_fracionada: v })}
                />
              </div>
            </div>

            {/* Notificar vencimento */}
            <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors space-y-4">
              <div className="flex justify-between items-center gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Notificar vencimento</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Cria alertas de expiração para revisão humana antes do envio pelo WhatsApp.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {statusBadge(form.notificar_vencimento)}
                  <Switch
                    checked={form.notificar_vencimento}
                    disabled={!podeEditar}
                    onCheckedChange={(v) => setForm({ ...form, notificar_vencimento: v })}
                  />
                </div>
              </div>

              {form.notificar_vencimento && (
                <div className="space-y-4 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-4 pt-3">
                    <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Avisar quantos dias antes</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        disabled={!podeEditar}
                        className="h-9 w-20 text-center font-bold"
                        value={form.notificar_dias_antes}
                        onChange={(e) => setForm({ ...form, notificar_dias_antes: Number(e.target.value) })}
                      />
                      <span className="text-xs text-muted-foreground">dias</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                      Fila de revisão ({pendentes.length})
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg text-xs font-bold"
                      onClick={() => gerar.mutate()}
                      disabled={gerar.isPending || dirty}
                    >
                      <RefreshCw className={`mr-2 h-3 w-3 ${gerar.isPending ? "animate-spin" : ""}`} />
                      Gerar alertas
                    </Button>
                  </div>
                  {dirty && (
                    <p className="text-[10px] text-amber-600 font-medium">
                      Salve as alterações antes de gerar os alertas.
                    </p>
                  )}

                  <div className="space-y-2">
                    {pendentes.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-2">Nenhum alerta pendente de revisão.</p>
                    ) : (
                      pendentes.map((a: any) => (
                        <div
                          key={a.id}
                          className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 space-y-2 bg-zinc-50/60 dark:bg-zinc-900/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                {a.cliente_nome} • {a.pet_nome}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {a.programa_nome} — vence em {String(a.data_de_validade).split("-").reverse().join("/")} •{" "}
                                {a.saldo_creditos} crédito(s)
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase font-bold shrink-0 border-gold/30 text-gold"
                            >
                              {a.status}
                            </Badge>
                          </div>
                          <p className="text-[11px] whitespace-pre-line text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-950 rounded-lg p-2 border border-zinc-100 dark:border-zinc-800">
                            {a.mensagem_sugerida}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {a.status === "pendente" ? (
                              <Button
                                size="sm"
                                className="h-8 rounded-lg text-xs font-bold bg-gold hover:bg-gold/90 text-white"
                                onClick={() => atualizarAlerta.mutate({ id: a.id, status: "aprovado" })}
                              >
                                <BellRing className="mr-2 h-3 w-3" />
                                Aprovar
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="h-8 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => {
                                  if (!a.telefone) {
                                    toast.error("Tutor sem telefone cadastrado.");
                                    return;
                                  }
                                  abrirWhatsAppBusiness(String(a.telefone).replace(/\D+/g, "").replace(/^(?!55)/, "55"), a.mensagem_sugerida);
                                  atualizarAlerta.mutate({ id: a.id, status: "enviado" });
                                  toast.info("WhatsApp aberto. Confirme o envio no aplicativo.");
                                }}
                              >
                                <Send className="mr-2 h-3 w-3" />
                                Abrir WhatsApp
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 rounded-lg text-xs"
                              onClick={() => atualizarAlerta.mutate({ id: a.id, status: "descartado" })}
                            >
                              <X className="mr-2 h-3 w-3" />
                              Descartar
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Validade padrão */}
            <div className="flex justify-between items-center gap-4 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Validade padrão</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Prazo sugerido na criação de novos planos. Contratos já vendidos não são alterados.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  type="number"
                  min={1}
                  disabled={!podeEditar}
                  className="h-9 w-24 text-center font-bold text-gold"
                  value={form.validade_padrao_dias}
                  onChange={(e) => setForm({ ...form, validade_padrao_dias: Number(e.target.value) })}
                />
                <span className="text-sm font-bold text-gold">dias</span>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-zinc-50/30 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-800 p-6 gap-3 flex-col sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:flex-1 h-12 rounded-xl font-bold"
            disabled={!dirty || salvar.isPending}
            onClick={() =>
              setForm({
                permitir_venda_fracionada: !!(config as any).permitir_venda_fracionada,
                notificar_vencimento: !!(config as any).notificar_vencimento,
                notificar_dias_antes: Number((config as any).notificar_dias_antes ?? 7),
                validade_padrao_dias: Number((config as any).validade_padrao_dias ?? 30),
              })
            }
          >
            Cancelar alterações
          </Button>
          <Button
            className="w-full sm:flex-1 h-12 rounded-xl font-bold bg-gold hover:bg-gold/90 text-white"
            disabled={!dirty || !podeEditar || salvar.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {salvar.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              As novas regras passam a valer imediatamente para novos programas e contratos. Contratos já vendidos
              permanecem inalterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-gold hover:bg-gold/90 text-white"
              onClick={() => form && salvar.mutate(form)}
            >
              Confirmar e salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>

      </AlertDialog>
    </>
  );
}
