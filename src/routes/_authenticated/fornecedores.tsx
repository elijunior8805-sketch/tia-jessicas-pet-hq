import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  component: () => <PlaceholderPage title="Fornecedores" description="Cadastro e histórico de compras por fornecedor." />,
});
