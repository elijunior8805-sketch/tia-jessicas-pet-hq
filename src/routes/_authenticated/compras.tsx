import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/compras")({
  component: () => <PlaceholderPage title="Compras" description="Compras e parcelas geradas automaticamente." />,
});
