import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  component: ClienteLayout,
});

function ClienteLayout() {
  return <Outlet />;
}
