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

// Silence noisy side effects
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m) },
}));

// Storage helpers used only on save with photo — no-op them
vi.mock("@/lib/foto-upload", () => ({
  uploadFoto: vi.fn(async () => "mock/path"),
  removeFoto: vi.fn(async () => {}),
}));

// Signed URL hook used inside FotoPicker — must return a react-query-shaped object
vi.mock("@/lib/use-signed-url", () => ({ useSignedUrl: () => ({ data: undefined }) }));

// Avoid ViaCEP network noise
vi.mock("@/lib/cep", () => ({
  lookupCep: vi.fn(async () => null),
  formatCep: (v: string) => v,
}));

// Permission hook — default: allow. Individual tests can override.
const accessState = { canEdit: true };
vi.mock("@/hooks/use-my-permissions", () => ({
  useMyAccess: () => ({
    data: {
      userId: "u1",
      perfil: "admin",
      status: "ativo",
      canManageUsers: true,
      isProprietario: false,
      isAdmin: true,
      permissoes: { clientes: { editar: accessState.canEdit } },
    },
    isLoading: false,
  }),
  hasPermission: (_a: any, modulo: string, acao: string) =>
    modulo === "clientes" && acao === "editar" ? accessState.canEdit : false,
}));

import { Route } from "@/routes/_authenticated/clientes.$id.editar";

const EditPage = Route.options.component as any;

const clienteRow = {
  id: "cli-1",
  nome: "Débora Teste",
  telefone: "11999999999",
  whatsapp: "11999999999",
  email: "debora@example.com",
  cpf: null,
  nascimento: null,
  cep: "01001000",
  rua: "Praça da Sé",
  numero: "1",
  complemento: null,
  bairro: "Sé",
  cidade: "São Paulo",
  estado: "SP",
  observacoes: null,
  vip: false,
  ativo: true,
  foto_url: null,
};

beforeEach(() => {
  resetRouterMock();
  resetSupabaseMock();
  toastError.mockClear();
  toastSuccess.mockClear();
  accessState.canEdit = true;
  setRouteParams({ id: "cli-1" });
  setTableResponse("clientes", "select", { data: clienteRow, error: null });
});

describe("/clientes/$id/editar", () => {
  it("carrega o cliente e renderiza o cabeçalho com o nome", async () => {
    const { container } = renderWithProviders(<EditPage />);
    await waitFor(
      () => {
        expect(container.textContent ?? "").toMatch(/Débora Teste/);
      },
      { timeout: 3000 },
    );
    expect(
      screen.getByRole("button", { name: /Salvar alterações/i }),
    ).toBeInTheDocument();
  });

  it("clicar em Voltar chama navigate para a ficha do cliente", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithProviders(<EditPage />);
    await waitFor(() => screen.getByText(/Editar Débora Teste/i));
    const backButtons = screen.getAllByRole("button", { name: /Voltar|Cancelar/i });
    await user.click(backButtons[0]);
    expect(navigateSpy).toHaveBeenCalledWith({
      to: "/clientes/$id",
      params: { id: "cli-1" },
    });
  });

  it("mostra mensagem clara de permissão insuficiente quando o update retorna vazio", async () => {
    // RLS-blocked update: no error but empty result → route must surface a
    // permission-denied toast rather than silently claim success.
    setTableResponse("clientes", "update", { data: [], error: null });

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithProviders(<EditPage />);
    await waitFor(() => screen.getByText(/Editar Débora Teste/i));

    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/permissão/i);
    expect(toastSuccess).not.toHaveBeenCalled();
    // Should NOT navigate on failure
    expect(navigateSpy).not.toHaveBeenCalledWith({
      to: "/clientes/$id",
      params: { id: "cli-1" },
    });
  });

  it("propaga erro do backend como toast quando update falha", async () => {
    setTableResponse("clientes", "update", {
      data: null,
      error: { message: "permission denied for table clientes" },
    });
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithProviders(<EditPage />);
    await waitFor(() => screen.getByText(/Editar Débora Teste/i));
    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/permission denied/i);
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
