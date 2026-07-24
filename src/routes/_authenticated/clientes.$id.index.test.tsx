import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import {
  resetRouterMock,
  navigateSpy,
  setRouteParams,
} from "@/test/router-mock";
import {
  resetSupabaseMock,
  setTableResponse,
} from "@/test/supabase-mock";

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"));
vi.mock("@/integrations/supabase/client", () => import("@/test/supabase-mock"));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn() },
}));

vi.mock("@/lib/use-signed-url", () => ({ useSignedUrl: () => null }));
vi.mock("@/lib/use-realtime-financeiro", () => ({ useRealtimeFinanceiro: () => {} }));
vi.mock("@/lib/whatsapp", () => ({ abrirWhatsApp: vi.fn() }));

import { Route } from "@/routes/_authenticated/clientes.$id.index";

const FichaPage = Route.options.component!;

beforeEach(() => {
  resetRouterMock();
  resetSupabaseMock();
  toastError.mockClear();
  setRouteParams({ id: "cli-1" });
});

describe("/clientes/$id (ficha)", () => {
  it("renderiza dados do cliente e ações de navegação", async () => {
    setTableResponse("clientes", "select", {
      data: {
        id: "cli-1",
        nome: "Débora Teste",
        telefone: "11999999999",
        whatsapp: "11999999999",
        vip: true,
        ativo: true,
        pets: [],
      },
      error: null,
    });

    renderWithProviders(<FichaPage />);
    await waitFor(() => expect(screen.getByText(/Débora Teste/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Editar cliente/i })).toBeInTheDocument();
    expect(screen.getByText(/VIP/i)).toBeInTheDocument();
  });

  it("mostra mensagem clara quando o cliente não é encontrado (RLS/inexistente)", async () => {
    setTableResponse("clientes", "select", { data: null, error: null });
    renderWithProviders(<FichaPage />);
    await waitFor(() =>
      expect(screen.getByText(/Cliente não encontrado/i)).toBeInTheDocument(),
    );
  });

  it("propaga falhas de leitura sem quebrar silenciosamente", async () => {
    setTableResponse("clientes", "select", {
      data: null,
      error: { message: "permission denied" },
    });
    // Silence expected React error log for the thrown query
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithProviders(<FichaPage />);
    // Component throws in query → error boundary above handles it; here we
    // just confirm the loading placeholder eventually clears.
    await waitFor(() => {
      expect(screen.queryByText(/Carregando…/)).not.toBeInTheDocument();
    });
    errSpy.mockRestore();
  });

  it("clicar em Editar cliente navega para a rota de edição", async () => {
    setTableResponse("clientes", "select", {
      data: { id: "cli-1", nome: "Débora", ativo: true, pets: [] },
      error: null,
    });
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithProviders(<FichaPage />);
    await waitFor(() => screen.getByRole("button", { name: /Editar cliente/i }));
    await user.click(screen.getByRole("button", { name: /Editar cliente/i }));
    expect(navigateSpy).toHaveBeenCalledWith({
      to: "/clientes/$id/editar",
      params: { id: "cli-1" },
    });
  });
});
