import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrmContacts } from "@/components/crm/CrmContacts";

const api = vi.hoisted(() => ({
  getCrmWorkspace: vi.fn(),
  listCrmContacts: vi.fn(),
  listCrmWhatsAppLeads: vi.fn(),
  saveCrmContact: vi.fn(),
  importCrmContacts: vi.fn(),
  mergeCrmContacts: vi.fn(),
  archiveCrmContact: vi.fn(),
  updateCrmPrivacy: vi.fn(),
  getCrmHistory: vi.fn(),
  exportCrmContacts: vi.fn(),
}));
vi.mock("@/lib/crm/crm.functions", () => api);
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({
    children,
    accountControl,
  }: {
    children: React.ReactNode;
    accountControl: React.ReactNode;
  }) => (
    <main>
      {accountControl}
      {children}
    </main>
  ),
}));
vi.mock("@/components/pw", () => ({
  PageHead: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const user = "22222222-2222-4222-8222-222222222222";
const tenant = "11111111-1111-4111-8111-111111111111";
const second = "33333333-3333-4333-8333-333333333333";
const membership = {
  user_id: user,
  tenant_id: tenant,
  name: "Organização A",
  role: "admin",
  active: true,
  scope: "organization",
  permissions: ["contacts.read", "contacts.write", "contacts.import"],
  team_ids: [],
  timezone: "America/Sao_Paulo",
  currency: "BRL",
};
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <CrmContacts userId={user} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  api.getCrmWorkspace.mockResolvedValue({ state: "ready", memberships: [membership], message: "" });
  api.listCrmContacts.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
    fields: [],
  });
  api.saveCrmContact.mockResolvedValue({});
});
afterEach(cleanup);

describe("Cadastro operacional", () => {
  it("consulta a base de leads do WhatsApp apenas na organização selecionada", async () => {
    api.listCrmWhatsAppLeads.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 25, fields: [] });
    mount();
    fireEvent.change(await screen.findByLabelText("Base de contatos ou leads"), { target: { value: "whatsapp" } });
    await waitFor(() => expect(api.listCrmWhatsAppLeads).toHaveBeenCalledWith({
      data: { tenant_id: tenant, query: "", status: "active", page: 1, page_size: 25 },
    }));
  });

  it("base ausente não vira sucesso, dados demo ou botão de criação", async () => {
    api.getCrmWorkspace.mockResolvedValue({ state: "setup", memberships: [], message: "" });
    mount();
    expect(await screen.findByText("Cadastro operacional aguardando ativação")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo contato" })).not.toBeInTheDocument();
    expect(api.listCrmContacts).not.toHaveBeenCalled();
  });
  it("cadastro público sem vínculo não recebe organização padrão", async () => {
    api.getCrmWorkspace.mockResolvedValue({ state: "ready", memberships: [] });
    mount();
    expect(await screen.findByText("Sem organização vinculada")).toBeInTheDocument();
    expect(api.listCrmContacts).not.toHaveBeenCalled();
  });
  it("salva somente após validar o formulário e transmite organização e chave de repetição", async () => {
    mount();
    const button = await screen.findByRole("button", { name: "Novo contato" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Gabriel" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contato" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Telefone inválido");
    expect(api.saveCrmContact).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "61999992222" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar contato" }));
    await waitFor(() => expect(api.saveCrmContact).toHaveBeenCalledTimes(1));
    expect(api.saveCrmContact.mock.calls[0]?.[0].data).toMatchObject({
      tenant_id: tenant,
      id: null,
      expected_version: null,
      contact: { name: "Gabriel", phone: "61999992222", source: "Desconhecida" },
    });
    expect(api.saveCrmContact.mock.calls[0]?.[0].data.request_id).toMatch(/^[\da-f-]{36}$/i);
  });
  it("troca de organização descarta formulário e seleção da organização anterior", async () => {
    api.getCrmWorkspace.mockResolvedValue({
      state: "ready",
      memberships: [membership, { ...membership, tenant_id: second, name: "Organização B" }],
    });
    mount();
    const button = await screen.findByRole("button", { name: "Novo contato" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Rascunho da A" } });
    fireEvent.change(screen.getByLabelText("Organização autorizada"), {
      target: { value: second },
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(api.listCrmContacts).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenant_id: second }) }),
      ),
    );
    expect(api.saveCrmContact).not.toHaveBeenCalled();
  });
  it("permissão de leitura não revela controles de gravação e importação", async () => {
    api.getCrmWorkspace.mockResolvedValue({
      state: "ready",
      memberships: [{ ...membership, permissions: ["contacts.read"] }],
    });
    mount();
    await screen.findByText("Nenhum contato neste filtro.");
    expect(screen.queryByRole("button", { name: "Novo contato" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Importar CSV / Excel" })).not.toBeInTheDocument();
  });
});
