import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  component: ClienteLayout,
  errorComponent: ClienteLayoutError,
  notFoundComponent: ClienteLayoutNotFound,
});

function ClienteLayout() {
  return <Outlet />;
}

function ClienteLayoutError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <PageShell>
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
        <div className="font-display text-lg text-destructive">Não foi possível carregar o cliente</div>
        <p className="text-sm text-muted-foreground">{error?.message ?? "Erro inesperado."}</p>
        <div className="flex gap-2">
          <Button onClick={() => { router.invalidate(); reset(); }}>Tentar novamente</Button>
          <Button variant="outline" onClick={() => router.navigate({ to: "/clientes" })}>Voltar para clientes</Button>
        </div>
      </div>
    </PageShell>
  );
}

function ClienteLayoutNotFound() {
  const router = useRouter();
  return (
    <PageShell>
      <div className="rounded-xl border p-6 space-y-3">
        <div className="font-display text-lg text-primary">Cliente não encontrado</div>
        <p className="text-sm text-muted-foreground">Este cliente foi removido ou o link está incorreto.</p>
        <Button variant="outline" onClick={() => router.navigate({ to: "/clientes" })}>Voltar para clientes</Button>
      </div>
    </PageShell>
  );
}
