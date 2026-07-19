import type { ReactNode } from "react";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function PlaceholderPage({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <PageShell>
      <PageHeader title={title} description={description}/>
      <Card className="p-10 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground mb-4">
          <Construction className="h-7 w-7"/>
        </div>
        <h3 className="font-display text-lg font-semibold">Em construção</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Este módulo faz parte do plano de entrega do ERP e será habilitado nas próximas fases (Operação, Financeiro, Estoque e Inteligência).
        </p>
        {children && <div className="mt-5">{children}</div>}
      </Card>
    </PageShell>
  );
}
