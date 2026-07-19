import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/agenda")({
  component: () => <PlaceholderPage title="Agenda" description="Calendário de agendamentos, com visão diária, semanal e por profissional." />,
});
