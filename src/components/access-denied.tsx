import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";

type Props = {
  titulo?: string;
  descricao?: string;
  modulo?: string;
  acao?: string;
  backTo?: { to: string; params?: Record<string, string> };
  backLabel?: string;
};

export function AccessDenied({
  titulo = "Sem permissão para acessar esta área",
  descricao = "Seu usuário não tem autorização para executar esta ação. Peça a um administrador para liberar o acesso correspondente.",
  modulo,
  acao,
  backTo,
  backLabel = "Voltar",
}: Props) {
  const navigate = useNavigate();
  return (
    <PageShell>
      <Card
        role="alert"
        aria-live="polite"
        className="mx-auto max-w-xl p-8 text-center space-y-4 border-destructive/30"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{descricao}</p>
          {(modulo || acao) && (
            <p className="text-xs text-muted-foreground/80">
              Permissão necessária:{" "}
              <code className="font-mono">
                {modulo}
                {acao ? `:${acao}` : ""}
              </code>
            </p>
          )}
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (backTo) navigate({ to: backTo.to as any, params: backTo.params as any });
              else window.history.back();
            }}
          >
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
