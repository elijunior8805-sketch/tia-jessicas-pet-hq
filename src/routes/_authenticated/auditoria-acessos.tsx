import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyAccess } from "@/hooks/use-my-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, RefreshCw, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auditoria-acessos")({
  component: AuditoriaAcessos,
  head: () => ({
    meta: [
      { title: "Auditoria de Acessos • Spa de Pet Tia Jéssica" },
      { name: "description", content: "Registro de tentativas de acesso negadas por permissão ou RLS." },
    ],
  }),
});

type Row = {
  id: string;
  user_email: string | null;
  modulo: string | null;
  acao: string | null;
  motivo: string;
  codigo_erro: string | null;
  rota: string | null;
  tabela_alvo: string | null;
  detalhes: any;
  user_agent: string | null;
  created_at: string;
};

const MOTIVO_LABEL: Record<string, { label: string; className: string }> = {
  permission_check: { label: "Permissão negada", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  rls_denied: { label: "RLS bloqueou", className: "bg-red-500/15 text-red-700 border-red-500/30" },
  http_403: { label: "HTTP 403", className: "bg-red-500/15 text-red-700 border-red-500/30" },
  http_401: { label: "Não autenticado", className: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
  route_guard: { label: "Rota protegida", className: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  other: { label: "Outro", className: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
};

function AuditoriaAcessos() {
  const { data: access } = useMyAccess();
  const [busca, setBusca] = useState("");
  const canView = !!access && (access.isAdmin || access.isProprietario);

  const { data: rows = [], isFetching, refetch } = useQuery<Row[]>({
    queryKey: ["access-denials", 200],
    enabled: canView,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_denials")
        .select("id,user_email,modulo,acao,motivo,codigo_erro,rota,tabela_alvo,detalhes,user_agent,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.user_email, r.modulo, r.acao, r.motivo, r.codigo_erro, r.rota, r.tabela_alvo]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, busca]);

  if (!canView) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" /> Acesso restrito
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Apenas proprietários e administradores podem consultar a auditoria de acessos.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/configuracoes"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-semibold">Auditoria de Acessos</h1>
            <p className="text-xs text-muted-foreground">
              Registros de tentativas bloqueadas por permissão de usuário ou por política de segurança (RLS).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por usuário, módulo, rota, tabela…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-72"
          />
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos 200 registros</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Quando</th>
                  <th className="px-3 py-2 text-left">Usuário</th>
                  <th className="px-3 py-2 text-left">Motivo</th>
                  <th className="px-3 py-2 text-left">Módulo / Ação</th>
                  <th className="px-3 py-2 text-left">Tabela</th>
                  <th className="px-3 py-2 text-left">Rota</th>
                  <th className="px-3 py-2 text-left">Código</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
                {filtrados.map((r) => {
                  const m = MOTIVO_LABEL[r.motivo] ?? MOTIVO_LABEL.other;
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.user_email ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={m.className}>{m.label}</Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.modulo ?? "—"}{r.acao ? <span className="text-muted-foreground"> / {r.acao}</span> : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.tabela_alvo ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{r.rota ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-mono">{r.codigo_erro ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
