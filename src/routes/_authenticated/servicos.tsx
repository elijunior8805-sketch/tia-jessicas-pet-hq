import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/servicos")({
  component: () => <PlaceholderPage title="Serviços" description="Tabela de serviços, valores por porte e combos." />,
});
