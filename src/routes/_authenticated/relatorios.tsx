import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: () => <PlaceholderPage title="Relatórios" description="Indicadores gerenciais e exportações." />,
});
