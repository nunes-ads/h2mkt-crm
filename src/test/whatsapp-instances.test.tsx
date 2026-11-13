import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { Inbox } from "@/components/inbox/Inbox";
import { clearRuntimeState } from "@/lib/omega-local";
import { whatsappTimestamp } from "@/lib/whatsapp-time";
import {
  readEvolutionState,
  requireEvolutionConnection,
  resolveEvolutionInstance,
  selectEvolutionInstance,
  needsFreshPairing,
  requireExpectedInstance,
} from "@/lib/evolution-connection.server";

const fixture = vi.hoisted(() => ({
  account: "matriz",
  state: "close",
  instance: "teste-local",
  chats: vi.fn(),
  messages: vi.fn(),
  refresh: vi.fn(),
  markRead: vi.fn(),
  react: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useRouteContext: () => ({ user: { id: "test-admin" } }),
}));
vi.mock("@/lib/omega-accounts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/omega-accounts")>();
  return {
    ...actual,
    useActiveAccount: () => ({
      activeAccount: fixture.account === "matriz" ? actual.CONTA_MATRIZ : actual.SUBCONTA_MVP,
    }),
  };
});
vi.mock("@/hooks/use-whatsapp-connection", () => ({
  useWhatsAppConnection: () => ({
    status: { state: fixture.state, instance: fixture.instance, chatsCount: 0 },
    checking: false,
    refresh: fixture.refresh,
  }),
}));
vi.mock("@/lib/evolution.functions", () => ({
  getEvolutionChats: fixture.chats,
  getEvolutionMessages: fixture.messages,
  markEvolutionChatAsRead: fixture.markRead,
  sendEvolutionMessage: vi.fn(),
  sendEvolutionMedia: vi.fn(),
  sendEvolutionAudio: vi.fn(),
  sendEvolutionReaction: fixture.react,
}));
vi.mock("@/lib/omega-chat.functions", () => ({
  generateAiChatbotResponse: vi.fn(),
  getAiKeyStatus: vi.fn().mockResolvedValue({ configured: true, provider: "gemini" }),
  saveAiApiKey: vi.fn().mockResolvedValue({ success: true }),
  parseAiOutput: (text: string) => ({ cleanContent: text }),
  parseSuggestions: vi.fn(),
}));

afterEach(() => {
  cleanup();
  clearRuntimeState();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("WhatsApp da Matriz e da Asa Sul", () => {
  it.each([
    ["matriz", "teste-local--crm-1"],
    ["sub-asasul", "franquia-asasul"],
  ])("agrupa o histórico de %s pelo dia de Brasília e mostra os perfis", async (account, instance) => {
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-13T12:00:00Z"));
    try {
      const jid = "120363123456@g.us";
      const photo = "https://example.com/grupo.jpg";
      const member = "https://example.com/pessoa.jpg";
      const beforeMidnight = whatsappTimestamp("2026-11-13T02:55:00Z");
      const afterMidnight = whatsappTimestamp("2026-11-13T03:05:00Z");
      Object.assign(fixture, { account, instance, state: "open" });
      fixture.chats.mockResolvedValue([{
        remoteJid: jid, name: "Grupo de teste", phone: "Grupo", avatar: photo,
        isGroup: true, unreadCount: 0, timestamp: afterMidnight, lastMessage: "Depois da meia-noite",
      }]);
      fixture.markRead.mockResolvedValue({ success: true });
      fixture.messages.mockResolvedValue({
        aliases: [jid], phone: "", reactions: [],
        messages: [
          { id: "undated", remoteJid: jid, fromMe: false, sender: "Participante", text: "Sem data", sentAt: 0 },
          { id: "before", remoteJid: jid, fromMe: false, sender: "Ana", senderAvatar: member, text: "Antes da meia-noite", sentAt: beforeMidnight },
          { id: "after", remoteJid: jid, fromMe: false, sender: "Ana", senderAvatar: member, text: "Depois da meia-noite", sentAt: afterMidnight },
        ],
      });
      const view = render(<Inbox />);
      await screen.findByText("Antes da meia-noite", { selector: ".wa-bubble-text" });
      expect([...view.container.querySelectorAll(".wa-day-divider")].map(el => el.textContent))
        .toEqual(["Data não informada", "Ontem", "Hoje"]);
      expect([...view.container.querySelectorAll(".wa-bubble-meta time")].map(el => el.textContent))
        .toEqual(["", "23:55", "00:05"]);
      expect(view.container.querySelector(".wa-row-time")).toHaveTextContent("00:05");
      expect(view.container.querySelector(".wa-chat-header img")).toHaveAttribute("src", photo);
      expect(view.container.querySelector(".wa-msg-row img[alt='Ana']")).toHaveAttribute("src", member);
      fireEvent.error(view.container.querySelector(".wa-chat-header img")!);
      expect(view.container.querySelector(".wa-chat-header .wa-avatar")).toHaveTextContent("GD");
      expect(fixture.chats).toHaveBeenCalledWith({ data: { accountId: account, expectedInstance: instance } });
    } finally {
      now.mockRestore();
    }
  });

  it("exibe o número e reage usando o endereço da mensagem, preservando o histórico", async () => {
    const phoneJid = "5561999990000@s.whatsapp.net";
    const lid = "1234567890123@lid";
    const phone = "+55 (61) 99999-0000";
    fixture.account = "matriz";
    fixture.state = "open";
    fixture.instance = "teste-local";
    fixture.markRead.mockResolvedValue({ success: true });
    fixture.react.mockResolvedValue({});
    fixture.chats.mockResolvedValue([
      {
        remoteJid: phoneJid,
        aliases: [phoneJid, lid],
        name: "Contato",
        phone,
        isGroup: false,
        unreadCount: 0,
      },
    ]);
    fixture.messages.mockResolvedValue({
      aliases: [phoneJid, lid],
      phone,
      messages: [
        {
          id: "old",
          remoteJid: lid,
          fromMe: false,
          text: "Mensagem mais antiga",
          timestamp: "10:00",
          sentAt: 100,
        },
        {
          id: "target",
          remoteJid: lid,
          fromMe: true,
          text: "Mensagem original",
          timestamp: "10:01",
          sentAt: 200,
        },
      ],
      reactions: [
        { messageId: "target", actor: "contact", emoji: "❤️", at: 300, eventId: "event-1" },
      ],
    });
    render(<Inbox />);
    const target = (await screen.findByText("Mensagem original", { selector: ".wa-bubble-text" })).closest(
      ".wa-bubble",
    ) as HTMLElement;
    expect(within(target).getByText("❤️")).toBeInTheDocument();
    expect(screen.queryByText("Reação: ❤️")).not.toBeInTheDocument();
    expect(fixture.messages).toHaveBeenCalledWith({
      data: {
        remoteJid: phoneJid,
        aliases: [phoneJid, lid],
        accountId: "matriz",
        expectedInstance: "teste-local",
      },
    });
    fireEvent.click(within(target).getByTitle("Reagir"));
    fireEvent.click(within(target).getByRole("button", { name: "👍" }));
    await waitFor(() =>
      expect(fixture.react).toHaveBeenCalledWith({
        data: expect.objectContaining({ remoteJid: lid, messageId: "target", reaction: "👍" }),
      }),
    );
    expect(screen.getByText("Mensagem mais antiga")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /\+55 \(61\) 99999-0000/ }));
    expect(screen.getByLabelText("Número do WhatsApp")).toHaveValue(phone);
  });
  it("não lê conversas desconectadas e usa a sessão certa após trocar ou parear outro número", async () => {
    fixture.account = "matriz";
    fixture.state = "open";
    fixture.instance = "teste-local";
    fixture.messages.mockResolvedValue({ messages: [], reactions: [], aliases: [], phone: "" });
    fixture.markRead.mockResolvedValue({ success: true });
    fixture.chats
      .mockResolvedValueOnce([
        {
          remoteJid: "5561990000000@s.whatsapp.net",
          name: "Contato da sessão anterior",
          phone: "",
          isGroup: false,
          unreadCount: 0,
        },
      ])
      .mockResolvedValue([]);
    const view = render(<Inbox />);
    await waitFor(() =>
      expect(screen.getAllByText("Contato da sessão anterior").length).toBeGreaterThan(0),
    );
    expect(fixture.chats).toHaveBeenCalledWith({
      data: { accountId: "matriz", expectedInstance: "teste-local" },
    });

    fixture.state = "close";
    view.rerender(<Inbox />);
    expect(screen.getByText("WhatsApp desconectado")).toBeInTheDocument();
    expect(screen.queryByText("Contato da sessão anterior")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nova conversa" })).not.toBeInTheDocument();

    fixture.account = "sub-asasul";
    fixture.state = "open";
    fixture.instance = "franquia-asasul";
    view.rerender(<Inbox />);
    await waitFor(() =>
      expect(fixture.chats).toHaveBeenCalledWith({
        data: { accountId: "sub-asasul", expectedInstance: "franquia-asasul" },
      }),
    );
    expect(screen.queryByText("Contato da sessão anterior")).not.toBeInTheDocument();

    fixture.account = "matriz";
    fixture.instance = "teste-local--crm-1";
    view.rerender(<Inbox />);
    await waitFor(() =>
      expect(fixture.chats).toHaveBeenCalledWith({
        data: { accountId: "matriz", expectedInstance: "teste-local--crm-1" },
      }),
    );
    expect(screen.queryByText("Contato da sessão anterior")).not.toBeInTheDocument();
  });

  it("recupera a sessão mais recente sem confundir os nomes das duas contas", () => {
    const entries = [
      { name: "teste-local--crm-2" },
      { name: "teste-local--crm-1" },
      { name: "franquia-asasul--crm-15" },
      { name: "teste-local--crm-3-outra" },
    ];
    expect(selectEvolutionInstance(resolveEvolutionInstance("matriz", {}), entries).instance).toBe(
      "teste-local--crm-2",
    );
    expect(
      selectEvolutionInstance(resolveEvolutionInstance("sub-asasul", {}), entries).instance,
    ).toBe("franquia-asasul--crm-15");
    expect(() =>
      resolveEvolutionInstance("matriz", {
        EVOLUTION_INSTANCE_NAME: "mesma",
        EVOLUTION_ASA_SUL_INSTANCE_NAME: "mesma",
      }),
    ).toThrow("diferentes");
    expect(() => requireExpectedInstance("teste-local--crm-2", "teste-local--crm-1")).toThrow(
      "mudou",
    );
  });

  it("detecta dados históricos em uma instância encerrada, inclusive se perdeu o JID", () => {
    expect(needsFreshPairing({ name: "teste-local", _count: { Chat: 222, Message: 48994 } })).toBe(
      true,
    );
    expect(
      needsFreshPairing({ name: "franquia-asasul", _count: { Chat: 0, Message: 0, Contact: 0 } }),
    ).toBe(false);
  });

  it("consulta o estado real da instância e bloqueia operações quando fechada", async () => {
    const config = { url: "http://localhost:18080", key: "test-key", instance: "franquia-asasul" };
    const fetcher = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ instance: { state: "close" } })),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(readEvolutionState(config)).resolves.toBe("close");
    await expect(requireEvolutionConnection(config)).rejects.toThrow("WhatsApp desconectado");
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:18080/instance/connectionState/franquia-asasul",
      expect.objectContaining({ cache: "no-store" }),
    );
    fetcher.mockImplementation(async () => new Response("", { status: 404 }));
    await expect(readEvolutionState(config)).resolves.toBe("missing");
    fetcher.mockImplementation(async () => new Response("", { status: 503 }));
    await expect(readEvolutionState(config)).resolves.toBe("unavailable");
  });
});
