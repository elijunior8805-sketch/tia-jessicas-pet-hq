import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/atendimentos")({
  component: () => <PlaceholderPage title="Atendimentos" description="Check-in, execução e check-out dos pets do dia." />,
});
