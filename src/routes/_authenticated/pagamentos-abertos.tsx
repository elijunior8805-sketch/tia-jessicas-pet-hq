import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/pagamentos-abertos")({
  component: () => <PlaceholderPage title="Pagamentos em aberto" description="Contas a receber com destaque para atrasos." />,
});
