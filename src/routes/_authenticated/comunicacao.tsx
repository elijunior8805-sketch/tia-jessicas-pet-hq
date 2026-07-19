import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/comunicacao")({
  component: () => <PlaceholderPage title="Comunicação e IA" description="Mensagens WhatsApp e sugestões da IA." />,
});
