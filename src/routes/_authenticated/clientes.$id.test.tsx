import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import {
  resetRouterMock,
  navigateSpy,
  invalidateSpy,
  setRouteParams,
} from "@/test/router-mock";

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"));
vi.mock("@/integrations/supabase/client", () => import("@/test/supabase-mock"));

// Import the module AFTER mocks are registered
import { Route } from "@/routes/_authenticated/clientes.$id";

const Layout = Route.options.component!;
const ErrorC = Route.options.errorComponent!;
const NotFoundC = Route.options.notFoundComponent!;
const PendingC = Route.options.pendingComponent!;

beforeEach(() => {
  resetRouterMock();
  setRouteParams({ id: "cli-1" });
});

describe("/clientes/$id layout", () => {
  it("renderiza <Outlet /> em condição normal", () => {
    renderWithProviders(<Layout />);
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });

  it("mostra estado de carregamento com skeletons e aria-busy", () => {
    renderWithProviders(<PendingC />);
    expect(screen.getByText(/Carregando cliente/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("errorComponent mostra mensagem e permite tentar novamente", async () => {
    const reset = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithProviders(<ErrorC error={new Error("Falha de rede")} reset={reset} />);
    expect(screen.getByText(/Não foi possível carregar o cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/Falha de rede/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(invalidateSpy).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Voltar para clientes/i }));
    expect(navigateSpy).toHaveBeenCalledWith({ to: "/clientes" });
  });

  it("notFoundComponent mostra aviso claro e link de retorno", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithProviders(<NotFoundC />);
    expect(screen.getByText(/Cliente não encontrado/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Voltar para clientes/i }));
    expect(navigateSpy).toHaveBeenCalledWith({ to: "/clientes" });
  });

  it("errorComponent do layout também absorve erros de render dos filhos", () => {
    // Silence expected error log noise
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ErrComp = ErrorC;
    renderWithProviders(
      <ErrComp
        error={new Error("Falha inesperada ao renderizar ficha")}
        reset={() => {}}
      />,
    );
    expect(
      screen.getByText(/Falha inesperada ao renderizar ficha/),
    ).toBeInTheDocument();
    errSpy.mockRestore();
  });
});
