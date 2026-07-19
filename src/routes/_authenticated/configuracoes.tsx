import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: () => <PlaceholderPage title="Configurações" description="Dados da empresa, usuários e preferências." />,
});
