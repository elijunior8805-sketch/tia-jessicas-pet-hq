import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/leva-traz")({
  component: () => <PlaceholderPage title="Leva e Traz" description="Roteiro do dia, endereços e ordem de coleta/entrega." />,
});
