import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: () => <PlaceholderPage title="Financeiro" description="Fluxo de caixa, categorias e conciliação." />,
});
