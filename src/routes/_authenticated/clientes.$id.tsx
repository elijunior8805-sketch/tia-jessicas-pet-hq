import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { Component, Suspense, type ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  component: ClienteLayout,
  errorComponent: ClienteLayoutError,
  notFoundComponent: ClienteLayoutNotFound,
  pendingComponent: ClienteLayoutPending,
});

function ClienteLayout() {
  return (
    <ClienteRenderBoundary>
      <Suspense fallback={<ClienteLayoutPending />}>
        <Outlet />
      </Suspense>
    </ClienteRenderBoundary>
  );
}

function ClienteLayoutPending() {
  return (
    <PageShell>
      <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando cliente…
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </PageShell>
  );
}

function ClienteLayoutError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <PageShell>
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
        <div className="flex items-center gap-2 font-display text-lg text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Não foi possível carregar o cliente
        </div>
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

/**
 * Catches render-time errors thrown by child routes (ficha / editar).
 * TanStack's errorComponent handles loader errors; this catches everything
 * that would otherwise crash silently during render.
 */
class ClienteRenderBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[clientes/$id] render error:", error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <ClienteRenderErrorFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function ClienteRenderErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <PageShell>
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
        <div className="flex items-center gap-2 font-display text-lg text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Falha ao exibir esta tela do cliente
        </div>
        <p className="text-sm text-muted-foreground">
          {error?.message ?? "Ocorreu um erro inesperado ao renderizar o conteúdo."}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => { router.invalidate(); reset(); }}>Tentar novamente</Button>
          <Button variant="outline" onClick={() => router.navigate({ to: "/clientes" })}>
            Voltar para clientes
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
