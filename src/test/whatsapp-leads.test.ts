import { describe, expect, it, vi } from "vitest";
import { receiveWhatsAppLead } from "../lib/crm/whatsapp-leads.server";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

const matrizToken = "m".repeat(48);
const asaSulToken = "a".repeat(48);
const config = JSON.stringify({ matriz: matrizToken, "asa-sul": asaSulToken });
const message = {
  key: {
    id: "event-1", remoteJid: "999999999@lid",
    remoteJidAlt: "5561999990000@s.whatsapp.net", fromMe: false,
  },
  pushName: " Cliente teste ",
  messageTimestamp: 1794510854,
  message: { conversation: "Mensagem privada" },
};
const event = { instance: "matriz", event: "messages.upsert", data: message };

function request(data: unknown, token = matrizToken) {
  return new Request("https://crm.test/api/webhooks/evolution", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

describe("captação WhatsApp", () => {
  it("encaminha apenas a identidade e o timestamp da mensagem recebida", async () => {
    const persist = vi.fn();
    const result = await receiveWhatsAppLead(request(event), config, persist);
    expect(result.status).toBe(200);
    expect(persist).toHaveBeenCalledExactlyOnceWith("matriz", {
      message_id: "event-1", phone: "+5561999990000", lid: "999999999@lid",
      name: "Cliente teste", sent_at: new Date(1794510854000).toISOString(),
    });
  });

  it("autentica a instância e não permite gravar em outra com o mesmo token", async () => {
    const persist = vi.fn();
    const incoming = { ...event, instance: "asa-sul" };
    expect((await receiveWhatsAppLead(request(incoming), config, persist)).status).toBe(401);
    expect(persist).not.toHaveBeenCalled();
    expect((await receiveWhatsAppLead(request(incoming, asaSulToken), config, persist)).status).toBe(200);
    expect(persist).toHaveBeenCalledWith("asa-sul", expect.anything());
  });

  it("ignora grupos, mensagens próprias, reações e importação do histórico", async () => {
    const persist = vi.fn();
    for (const data of [
      { ...event, event: "messages.set" },
      { ...event, data: { ...message, key: { ...message.key, fromMe: true } } },
      { ...event, data: { ...message, key: { ...message.key, remoteJid: "123@g.us" } } },
      { ...event, data: { ...message, message: { reactionMessage: { text: "👍" } } } },
    ]) {
      expect(await (await receiveWhatsAppLead(request(data), config, persist)).json())
        .toEqual({ status: "ignored" });
    }
    expect(persist).not.toHaveBeenCalled();
  });

  it("aceita LID sem inventar telefone e sinaliza falha de gravação", async () => {
    const persist = vi.fn().mockRejectedValue(new Error("Banco fora do ar"));
    const data = { ...message, key: { ...message.key, remoteJidAlt: undefined } };
    const result = await receiveWhatsAppLead(request({ ...event, data }), config, persist);
    expect(result.status).toBe(503);
    expect(persist).toHaveBeenCalledWith("matriz", expect.objectContaining({
      phone: null, lid: "999999999@lid",
    }));
  });

  it("rejeita corpos grandes antes de gravar", async () => {
    const persist = vi.fn();
    const result = await receiveWhatsAppLead(request({ ...event, pad: "x".repeat(300000) }), config, persist);
    expect(result.status).toBe(413);
    expect(persist).not.toHaveBeenCalled();
  });
});
