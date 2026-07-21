import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listarUsuarios,
  convidarUsuario,
  setPerfilUsuario,
  setStatusUsuario,
  listarPermissoes,
  salvarPermissoes,
  enviarResetSenha,
  definirSenhaManual,
  encerrarSessoes,
  listarConvites,
  cancelarConvite,
  overviewSeguranca,
  listarAuditoria,
} from "@/lib/users.functions";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Shield, UserPlus, MoreHorizontal, Lock, Unlock, KeyRound, LogOut, UserMinus, UserCheck, Users as UsersIcon, CheckCircle2, XCircle, Clock, Search,
} from "lucide-react";

// ============ Perfis e módulos ============
const PERFIS = [
  { value: "proprietario", label: "Proprietário", desc: "Acesso total, protegido" },
  { value: "admin", label: "Administrador", desc: "Gestão completa, exceto proprietários" },
  { value: "gestor", label: "Gestor", desc: "Operação e relatórios" },
  { value: "atendente", label: "Atendente", desc: "Agenda, clientes, comunicação" },
  { value: "banho_tosa", label: "Banho e Tosa", desc: "Ficha operacional e atendimentos" },
  { value: "leva_traz", label: "Leva e Traz", desc: "Somente transportes atribuídos" },
  { value: "financeiro", label: "Financeiro", desc: "Receitas, despesas e cobranças" },
  { value: "consulta", label: "Consulta", desc: "Somente visualizar" },
] as const;

const MODULOS = [
  "dashboard","agenda","clientes","pets","atendimentos","servicos","leva_traz",
  "financeiro","cobrancas","estoque","compras","fornecedores","relatorios",
  "comunicacao","inbox","campanhas","lembretes","aniversarios","reativacao",
  "usuarios","configuracoes","auditoria",
];
const ACOES = [
  { key: "visualizar", label: "Visualizar" },
  { key: "criar", label: "Criar" },
  { key: "editar", label: "Editar" },
  { key: "excluir", label: "Excluir" },
  { key: "exportar", label: "Exportar" },
  { key: "aprovar", label: "Aprovar" },
  { key: "valores", label: "Ver valores" },
  { key: "confidencial", label: "Confidenciais" },
];

// ============ Perfis modelo (padrões iniciais aplicados ao convidar) ============
const PERFIL_TEMPLATE: Record<string, Array<{ modulo: string; acao: string }>> = {
  proprietario: MODULOS.flatMap((m) => ACOES.map((a) => ({ modulo: m, acao: a.key }))),
  admin: MODULOS.filter((m) => m !== "usuarios").flatMap((m) => ACOES.map((a) => ({ modulo: m, acao: a.key })))
    .concat([{ modulo: "usuarios", acao: "visualizar" }, { modulo: "usuarios", acao: "editar" }]),
  gestor: ["dashboard","agenda","clientes","pets","atendimentos","comunicacao","leva_traz","relatorios","financeiro"]
    .flatMap((m) => [{modulo:m, acao:"visualizar"},{modulo:m, acao:"criar"},{modulo:m, acao:"editar"},{modulo:m, acao:"exportar"},{modulo:m, acao:"valores"}]),
  atendente: ["clientes","pets","agenda","atendimentos","comunicacao","inbox"]
    .flatMap((m) => [{modulo:m, acao:"visualizar"},{modulo:m, acao:"criar"},{modulo:m, acao:"editar"}]),
  banho_tosa: ["agenda","atendimentos","pets"]
    .flatMap((m) => [{modulo:m, acao:"visualizar"},{modulo:m, acao:"editar"}]),
  leva_traz: [{modulo:"leva_traz", acao:"visualizar"},{modulo:"leva_traz", acao:"editar"}],
  financeiro: ["financeiro","cobrancas","compras","fornecedores","relatorios"]
    .flatMap((m) => [{modulo:m, acao:"visualizar"},{modulo:m, acao:"criar"},{modulo:m, acao:"editar"},{modulo:m, acao:"valores"},{modulo:m, acao:"exportar"}]),
  consulta: MODULOS.map((m) => ({ modulo: m, acao: "visualizar" })),
};

export const Route = createFileRoute("/_authenticated/usuarios")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: prof } = await supabase.from("profiles").select("perfil,status").eq("id", u.user.id).maybeSingle();
    const perfil = (prof as any)?.perfil;
    if (perfil !== "proprietario" && perfil !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: UsuariosPage,
});

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string; icon: any }> = {
    ativo: { label: "Ativo", className: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
    bloqueado: { label: "Bloqueado", className: "bg-red-100 text-red-800", icon: Lock },
    desativado: { label: "Desativado", className: "bg-muted text-muted-foreground", icon: XCircle },
    convite_pendente: { label: "Convite pendente", className: "bg-amber-100 text-amber-800", icon: Clock },
    expirado: { label: "Expirado", className: "bg-orange-100 text-orange-800", icon: Clock },
  };
  const it = map[status] ?? { label: status, className: "", icon: Clock };
  const Icon = it.icon;
  return (
    <Badge variant="outline" className={"gap-1 " + it.className}>
      <Icon className="h-3 w-3" /> {it.label}
    </Badge>
  );
}

function perfilLabel(v: string) {
  return PERFIS.find((p) => p.value === v)?.label ?? v;
}

function UsuariosPage() {
  const qc = useQueryClient();
  const listUsers = useServerFn(listarUsuarios);
  const listInv = useServerFn(listarConvites);
  const listAudit = useServerFn(listarAuditoria);
  const overview = useServerFn(overviewSeguranca);

  const users = useQuery({ queryKey: ["users.list"], queryFn: () => listUsers({ data: {} as any }) });
  const invites = useQuery({ queryKey: ["users.invites"], queryFn: () => listInv({ data: {} as any }) });
  const audit = useQuery({ queryKey: ["users.audit"], queryFn: () => listAudit({ data: { limit: 100 } }) });
  const geral = useQuery({ queryKey: ["users.overview"], queryFn: () => overview({ data: {} as any }) });

  const [busca, setBusca] = useState("");

  const filteredUsers = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return users.data ?? [];
    return (users.data ?? []).filter((u: any) =>
      (u.nome || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.perfil || "").toLowerCase().includes(q),
    );
  }, [users.data, busca]);

  return (
    <PageShell>
      <PageHeader
        title="Usuários e Acessos"
        description="Central de segurança, permissões e histórico de atividades."
        icon={Shield}
        actions={<ConvidarDialog onDone={() => { qc.invalidateQueries({ queryKey: ["users.list"] }); qc.invalidateQueries({ queryKey: ["users.invites"] }); }} />}
      />
      <Tabs defaultValue="visao">
        <TabsList className="mb-4">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="convites">Convites</TabsTrigger>
          <TabsTrigger value="perfis">Perfis</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="visao">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {[
              { l: "Total de usuários", v: geral.data?.total ?? "—" },
              { l: "Ativos", v: geral.data?.ativos ?? "—" },
              { l: "Bloqueados", v: geral.data?.bloqueados ?? "—" },
              { l: "Desativados", v: geral.data?.desativados ?? "—" },
              { l: "Convites pendentes", v: geral.data?.convites_pendentes ?? "—" },
              { l: "Administradores", v: geral.data?.administradores ?? "—" },
              { l: "Proprietários ativos", v: geral.data?.proprietarios ?? "—" },
            ].map((c) => (
              <Card key={c.l}><CardContent className="p-4">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{c.l}</div>
                <div className="mt-1 text-2xl font-semibold">{c.v}</div>
              </CardContent></Card>
            ))}
          </div>
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-base">Atividades recentes</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                {(geral.data?.atividades ?? []).slice(0, 12).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between border-b pb-1 last:border-b-0">
                    <span className="truncate">
                      <b>{a.user_email ?? "sistema"}</b> · {a.action} em {a.table_name}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                ))}
                {(!geral.data?.atividades || geral.data.atividades.length === 0) && (
                  <div className="text-muted-foreground">Sem atividades registradas.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2"><UsersIcon className="h-4 w-4" /> Usuários</CardTitle>
              <div className="relative w-64 max-w-full">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome, e-mail, perfil…" className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u: any) => (
                    <UsuarioRow key={u.id} user={u} onChange={() => { qc.invalidateQueries({ queryKey: ["users.list"] }); qc.invalidateQueries({ queryKey: ["users.overview"] }); }} />
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum usuário encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="convites">
          <Card>
            <CardHeader><CardTitle className="text-base">Convites</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invites.data ?? []).map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.email}</TableCell>
                      <TableCell>{i.nome ?? "—"}</TableCell>
                      <TableCell>{perfilLabel(i.perfil)}</TableCell>
                      <TableCell>{statusBadge(i.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(i.criado_em).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <CancelarConviteBtn id={i.id} disabled={i.status !== "pendente"} onDone={() => qc.invalidateQueries({ queryKey: ["users.invites"] })} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {(invites.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum convite registrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="perfis">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PERFIS.map((p) => (
              <Card key={p.value}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{p.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {PERFIL_TEMPLATE[p.value]?.length ?? 0} permissões padrão
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Perfis são modelos iniciais; permissões finais são ajustadas por usuário na aba Usuários → Permissões.
          </p>
        </TabsContent>

        <TabsContent value="auditoria">
          <Card>
            <CardHeader><CardTitle className="text-base">Histórico de atividades</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(audit.data ?? []).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                      <TableCell>{a.user_email ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{a.action}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{a.table_name}</TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[220px]">{a.record_id}</TableCell>
                    </TableRow>
                  ))}
                  {(audit.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem registros.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

// ============ CONVIDAR ============
function ConvidarDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [perfil, setPerfil] = useState("atendente");
  const [msg, setMsg] = useState("");
  const invite = useServerFn(convidarUsuario);
  const m = useMutation({
    mutationFn: async () => {
      const permissoes = PERFIL_TEMPLATE[perfil]?.map((p) => ({ ...p, permitido: true })) ?? [];
      return invite({ data: { nome, email, telefone: telefone || null, perfil: perfil as any, permissoes, mensagem: msg || null } });
    },
    onSuccess: () => {
      toast.success("Convite enviado");
      setOpen(false);
      setNome(""); setEmail(""); setTelefone(""); setMsg(""); setPerfil("atendente");
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao convidar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><UserPlus className="h-4 w-4" /> Convidar usuário</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Convidar novo usuário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Telefone (opcional)</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
          <div>
            <Label>Perfil</Label>
            <Select value={perfil} onValueChange={setPerfil}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERFIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label} — {p.desc}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Mensagem (opcional)</Label><Textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={!nome || !email || m.isPending}>
            {m.isPending ? "Enviando…" : "Enviar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ CANCELAR CONVITE ============
function CancelarConviteBtn({ id, disabled, onDone }: { id: string; disabled: boolean; onDone: () => void }) {
  const cancel = useServerFn(cancelarConvite);
  const m = useMutation({
    mutationFn: () => cancel({ data: { id } }),
    onSuccess: () => { toast.success("Convite cancelado"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });
  return (
    <Button size="sm" variant="outline" disabled={disabled || m.isPending} onClick={() => m.mutate()}>
      Cancelar
    </Button>
  );
}

// ============ LINHA DE USUÁRIO ============
function UsuarioRow({ user, onChange }: { user: any; onChange: () => void }) {
  const setPerfil = useServerFn(setPerfilUsuario);
  const setStatus = useServerFn(setStatusUsuario);
  const resetSenha = useServerFn(enviarResetSenha);
  const encerrar = useServerFn(encerrarSessoes);

  const doPerfil = useMutation({
    mutationFn: (v: string) => setPerfil({ data: { userId: user.id, perfil: v as any } }),
    onSuccess: () => { toast.success("Perfil atualizado"); onChange(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });
  const doStatus = useMutation({
    mutationFn: (v: string) => setStatus({ data: { userId: user.id, status: v as any } }),
    onSuccess: () => { toast.success("Status atualizado"); onChange(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });
  const doReset = useMutation({
    mutationFn: () => resetSenha({ data: { email: user.email } }),
    onSuccess: () => toast.success("Link de redefinição gerado — enviado por e-mail"),
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });
  const doEncerrar = useMutation({
    mutationFn: () => encerrar({ data: { userId: user.id } }),
    onSuccess: () => toast.success("Sessões encerradas"),
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  const isOwner = user.perfil === "proprietario";

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {(user.nome ?? user.email ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{user.nome ?? "—"} {isOwner && <Shield className="inline h-3 w-3 text-amber-500 ml-1" />}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Select value={user.perfil} onValueChange={(v) => doPerfil.mutate(v)}>
          <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERFIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>{statusBadge(user.status)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Nunca"}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center gap-2 justify-end">
          <PermissoesDialog userId={user.id} nome={user.nome ?? user.email} perfil={user.perfil} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {user.status !== "ativo" && (
                <DropdownMenuItem onClick={() => doStatus.mutate("ativo")}>
                  <UserCheck className="h-4 w-4 mr-2" /> Ativar
                </DropdownMenuItem>
              )}
              {user.status !== "bloqueado" && (
                <DropdownMenuItem onClick={() => doStatus.mutate("bloqueado")}>
                  <Lock className="h-4 w-4 mr-2" /> Bloquear
                </DropdownMenuItem>
              )}
              {user.status === "bloqueado" && (
                <DropdownMenuItem onClick={() => doStatus.mutate("ativo")}>
                  <Unlock className="h-4 w-4 mr-2" /> Desbloquear
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => doEncerrar.mutate()}>
                <LogOut className="h-4 w-4 mr-2" /> Encerrar sessões
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => doReset.mutate()}>
                <KeyRound className="h-4 w-4 mr-2" /> Redefinir senha
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => doStatus.mutate("desativado")} className="text-red-600">
                <UserMinus className="h-4 w-4 mr-2" /> Desativar usuário
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ============ PERMISSÕES ============

const GRUPOS_MODULOS: Array<{ titulo: string; modulos: string[] }> = [
  { titulo: "Operação", modulos: ["dashboard", "agenda", "clientes", "pets", "atendimentos", "servicos", "leva_traz"] },
  { titulo: "Financeiro", modulos: ["financeiro", "cobrancas", "compras", "fornecedores", "estoque"] },
  { titulo: "Comunicação e Relatórios", modulos: ["comunicacao", "inbox", "campanhas", "lembretes", "aniversarios", "reativacao", "relatorios"] },
  { titulo: "Configurações e Segurança", modulos: ["usuarios", "configuracoes", "auditoria"] },
];

const ACOES_SENSIVEIS = new Set(["excluir", "valores", "confidencial"]);

const PRESETS: Array<{ key: string; label: string; acoes: string[] }> = [
  { key: "none", label: "Nenhum acesso", acoes: [] },
  { key: "view", label: "Somente visualizar", acoes: ["visualizar"] },
  { key: "edit", label: "Editar", acoes: ["visualizar", "criar", "editar"] },
  { key: "full", label: "Acesso total", acoes: ACOES.map((a) => a.key) },
];

function detectarPreset(rowState: Record<string, boolean>): string {
  const marcadas = ACOES.filter((a) => rowState[a.key]).map((a) => a.key).sort();
  for (const p of PRESETS) {
    const ref = [...p.acoes].sort();
    if (marcadas.length === ref.length && marcadas.every((k, i) => k === ref[i])) return p.key;
  }
  return "custom";
}

function moduloNome(m: string) {
  return m.replace(/_/g, " ");
}

function PermissoesDialog({ userId, nome, perfil }: { userId: string; nome: string; perfil: string }) {
  const [open, setOpen] = useState(false);
  const listar = useServerFn(listarPermissoes);
  const salvar = useServerFn(salvarPermissoes);
  const { data, refetch } = useQuery({
    queryKey: ["users.perms", userId],
    enabled: open && perfil !== "proprietario",
    queryFn: () => listar({ data: { userId } }),
  });

  const isOwner = perfil === "proprietario";

  const initGrid = useMemo(() => {
    const g: Record<string, Record<string, boolean>> = {};
    MODULOS.forEach((m) => { g[m] = {}; ACOES.forEach((a) => { g[m][a.key] = false; }); });
    (data ?? []).forEach((p: any) => {
      g[p.modulo] = g[p.modulo] ?? {};
      g[p.modulo][p.acao] = !!p.permitido;
    });
    return g;
  }, [data]);

  const [grid, setGrid] = useState<Record<string, Record<string, boolean>>>({});
  const [busca, setBusca] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Sincroniza grid quando dados chegam
  useMemo(() => {
    if (Object.keys(grid).length === 0 && Object.keys(initGrid).length > 0) {
      setGrid(initGrid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initGrid]);

  const current = Object.keys(grid).length ? grid : initGrid;

  function setModuloPreset(modulo: string, presetKey: string) {
    const preset = PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    setGrid((prev) => {
      const base = Object.keys(prev).length ? prev : initGrid;
      const g = { ...base, [modulo]: { ...(base[modulo] ?? {}) } };
      ACOES.forEach((a) => { g[modulo][a.key] = preset.acoes.includes(a.key); });
      return g;
    });
  }

  function toggleCell(modulo: string, acao: string) {
    setGrid((prev) => {
      const base = Object.keys(prev).length ? prev : initGrid;
      const g = { ...base, [modulo]: { ...(base[modulo] ?? {}) } };
      g[modulo][acao] = !g[modulo][acao];
      return g;
    });
  }

  function toggleColuna(acao: string, ativar: boolean) {
    setGrid((prev) => {
      const base = Object.keys(prev).length ? prev : initGrid;
      const g: Record<string, Record<string, boolean>> = { ...base };
      MODULOS.forEach((m) => { g[m] = { ...(g[m] ?? {}) }; g[m][acao] = ativar; });
      return g;
    });
  }

  const modulosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return null;
    return new Set(MODULOS.filter((m) => moduloNome(m).toLowerCase().includes(q)));
  }, [busca]);

  const diff = useMemo(() => {
    let adicionadas = 0;
    let removidas = 0;
    const detalhes: Array<{ modulo: string; acao: string; op: "add" | "del" }> = [];
    MODULOS.forEach((m) => {
      ACOES.forEach((a) => {
        const before = !!initGrid[m]?.[a.key];
        const after = !!current[m]?.[a.key];
        if (before !== after) {
          if (after) { adicionadas++; detalhes.push({ modulo: m, acao: a.key, op: "add" }); }
          else { removidas++; detalhes.push({ modulo: m, acao: a.key, op: "del" }); }
        }
      });
    });
    return { adicionadas, removidas, detalhes };
  }, [current, initGrid]);

  const m = useMutation({
    mutationFn: async () => {
      const rows: Array<{ modulo: string; acao: string; permitido: boolean }> = [];
      Object.entries(current).forEach(([modulo, acoes]) => {
        Object.entries(acoes).forEach(([acao, permitido]) => {
          if (permitido) rows.push({ modulo, acao, permitido: true });
        });
      });
      return salvar({ data: { userId, permissoes: rows } });
    },
    onSuccess: () => {
      toast.success("Permissões salvas");
      setConfirmOpen(false);
      setOpen(false);
      setGrid({});
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const colunaMasterEstado = (acao: string): boolean | "indeterminate" => {
    const vals = MODULOS.map((mm) => !!current[mm]?.[acao]);
    if (vals.every(Boolean)) return true;
    if (vals.every((v) => !v)) return false;
    return "indeterminate";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setGrid({}); setBusca(""); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Permissões</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" /> Permissões — {nome}
          </DialogTitle>
        </DialogHeader>

        {isOwner ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <div className="max-w-md text-center space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-6">
              <Shield className="h-10 w-10 mx-auto text-amber-500" />
              <div className="text-base font-semibold">Este usuário é Proprietário</div>
              <p className="text-sm text-muted-foreground">
                Proprietários têm acesso completo ao sistema e não podem ser editados por aqui.
                Alterações de escopo devem ser feitas ajustando o perfil na linha do usuário.
              </p>
              <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar módulo…"
                  className="pl-8"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Colunas destacadas (<span className="text-red-600 font-medium">Excluir</span>,{" "}
                <span className="text-red-600 font-medium">Ver valores</span>,{" "}
                <span className="text-red-600 font-medium">Confidenciais</span>) são permissões sensíveis.
              </div>
            </div>

            <div className="overflow-auto flex-1 -mx-6 px-6 py-2 space-y-4">
              {/* Cabeçalho de colunas com master */}
              <div className="hidden md:grid gap-2 items-end sticky top-0 bg-background z-10 pb-2 border-b"
                   style={{ gridTemplateColumns: "minmax(180px,1.4fr) 200px repeat(8, minmax(0,1fr))" }}>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Módulo</div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preset rápido</div>
                {ACOES.map((a) => {
                  const sens = ACOES_SENSIVEIS.has(a.key);
                  const st = colunaMasterEstado(a.key);
                  return (
                    <div key={a.key} className={"flex flex-col items-center gap-1 text-xs " + (sens ? "text-red-600" : "text-muted-foreground")}>
                      <span className="font-medium text-center leading-tight">{a.label}</span>
                      <Checkbox
                        checked={st === true ? true : st === "indeterminate" ? "indeterminate" as any : false}
                        onCheckedChange={(v) => toggleColuna(a.key, !!v)}
                        aria-label={`Marcar ${a.label} em todos os módulos`}
                      />
                    </div>
                  );
                })}
              </div>

              {GRUPOS_MODULOS.map((grupo) => {
                const modulosVisiveis = grupo.modulos.filter((mm) => !modulosFiltrados || modulosFiltrados.has(mm));
                if (modulosVisiveis.length === 0) return null;
                return (
                  <GrupoModulos
                    key={grupo.titulo}
                    titulo={grupo.titulo}
                    modulos={modulosVisiveis}
                    current={current}
                    onPreset={setModuloPreset}
                    onToggleCell={toggleCell}
                  />
                );
              })}
            </div>

            <DialogFooter className="border-t pt-3 flex-col sm:flex-row gap-2">
              <div className="text-xs text-muted-foreground sm:mr-auto">
                {diff.adicionadas + diff.removidas === 0
                  ? "Nenhuma alteração pendente."
                  : <>Pendente: <b className="text-emerald-700">+{diff.adicionadas}</b> adicionadas, <b className="text-red-600">−{diff.removidas}</b> removidas.</>}
              </div>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={m.isPending || (diff.adicionadas + diff.removidas === 0)}
              >
                Salvar permissões
              </Button>
            </DialogFooter>

            {/* Resumo de mudanças */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Confirmar alterações</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-4">
                    <div className="rounded-lg bg-emerald-50 text-emerald-800 px-3 py-2 flex-1 text-center">
                      <div className="text-2xl font-semibold">{diff.adicionadas}</div>
                      <div className="text-xs uppercase tracking-wider">Adicionadas</div>
                    </div>
                    <div className="rounded-lg bg-red-50 text-red-800 px-3 py-2 flex-1 text-center">
                      <div className="text-2xl font-semibold">{diff.removidas}</div>
                      <div className="text-xs uppercase tracking-wider">Removidas</div>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-auto border rounded-md divide-y text-xs">
                    {diff.detalhes.map((d, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5">
                        <span className="capitalize">
                          <span className={d.op === "add" ? "text-emerald-700 font-semibold mr-1" : "text-red-600 font-semibold mr-1"}>
                            {d.op === "add" ? "+" : "−"}
                          </span>
                          {moduloNome(d.modulo)}
                        </span>
                        <span className={"text-muted-foreground " + (ACOES_SENSIVEIS.has(d.acao) ? "text-red-600" : "")}>
                          {ACOES.find((a) => a.key === d.acao)?.label ?? d.acao}
                        </span>
                      </div>
                    ))}
                    {diff.detalhes.length === 0 && (
                      <div className="p-3 text-center text-muted-foreground">Sem alterações.</div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A alteração será registrada na auditoria com data, autor e conteúdo modificado.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConfirmOpen(false)}>Revisar</Button>
                  <Button onClick={() => m.mutate()} disabled={m.isPending}>
                    {m.isPending ? "Salvando…" : "Confirmar e salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GrupoModulos({
  titulo, modulos, current, onPreset, onToggleCell,
}: {
  titulo: string;
  modulos: string[];
  current: Record<string, Record<string, boolean>>;
  onPreset: (modulo: string, preset: string) => void;
  onToggleCell: (modulo: string, acao: string) => void;
}) {
  const [aberto, setAberto] = useState(true);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 text-sm font-semibold"
      >
        <span>{titulo}</span>
        <span className="text-xs text-muted-foreground">{aberto ? "Recolher" : "Expandir"} ({modulos.length})</span>
      </button>
      {aberto && (
        <div className="divide-y">
          {modulos.map((mm) => {
            const rowState = current[mm] ?? {};
            const presetAtual = detectarPreset(rowState);
            return (
              <div key={mm}>
                {/* Desktop: linha em grid */}
                <div className="hidden md:grid gap-2 items-center px-3 py-2"
                     style={{ gridTemplateColumns: "minmax(180px,1.4fr) 200px repeat(8, minmax(0,1fr))" }}>
                  <div className="font-medium capitalize">{moduloNome(mm)}</div>
                  <Select
                    value={presetAtual === "custom" ? "" : presetAtual}
                    onValueChange={(v) => onPreset(mm, v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={presetAtual === "custom" ? "Personalizado" : "Preset"} />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESETS.map((p) => (
                        <SelectItem key={p.key} value={p.key} className="text-xs">{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {ACOES.map((a) => {
                    const sens = ACOES_SENSIVEIS.has(a.key);
                    const on = !!rowState[a.key];
                    return (
                      <div key={a.key} className="flex justify-center">
                        <Checkbox
                          checked={on}
                          onCheckedChange={() => onToggleCell(mm, a.key)}
                          className={sens && on ? "border-red-500 data-[state=checked]:bg-red-500" : ""}
                          aria-label={`${a.label} em ${mm}`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Mobile: empilhado */}
                <div className="md:hidden px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium capitalize">{moduloNome(mm)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {presetAtual === "custom" ? "Personalizado" : PRESETS.find((p) => p.key === presetAtual)?.label}
                    </div>
                  </div>
                  <Select
                    value={presetAtual === "custom" ? "" : presetAtual}
                    onValueChange={(v) => onPreset(mm, v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Preset rápido" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESETS.map((p) => (
                        <SelectItem key={p.key} value={p.key} className="text-xs">{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    {ACOES.map((a) => {
                      const sens = ACOES_SENSIVEIS.has(a.key);
                      const on = !!rowState[a.key];
                      return (
                        <label key={a.key} className={"flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs " + (sens ? "border-red-200" : "")}>
                          <Checkbox
                            checked={on}
                            onCheckedChange={() => onToggleCell(mm, a.key)}
                            className={sens && on ? "border-red-500 data-[state=checked]:bg-red-500" : ""}
                          />
                          <span className={sens ? "text-red-700" : ""}>{a.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
