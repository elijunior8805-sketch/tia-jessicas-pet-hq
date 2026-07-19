import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/estoque")({
  component: () => <PlaceholderPage title="Estoque" description="Produtos, saldos e alertas de reposição." />,
});
