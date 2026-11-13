import { describe, expect, it } from "vitest";
import type { Mensagem } from "@/components/inbox/dados";
import {
  mergeWhatsAppHistory,
  readWhatsAppReaction,
  whatsappAddressPair,
  whatsappHistoryJids,
  whatsappPhone,
} from "@/lib/whatsapp-history";

const pn = "5561999990000@s.whatsapp.net";
const lid = "18397218574123@lid";
const first: Mensagem = { id: "older", kind: "cliente", text: "Olá", t: "10:00", sentAt: 100 };
const target: Mensagem = {
  id: "target",
  kind: "vendedor",
  text: "Tudo bem?",
  t: "10:01",
  sentAt: 200,
  remoteJid: lid,
};

describe("Identidade e reações do WhatsApp", () => {
  it("mostra o número do endereço telefônico confirmado e consulta os dois endereços", () => {
    expect(whatsappAddressPair({ remoteJid: lid, remoteJidAlt: pn })).toEqual({ lid, phone: pn });
    expect(whatsappPhone(pn)).toBe("+55 (61) 99999-0000");
    expect(whatsappPhone(lid)).toBe("");
    expect(whatsappHistoryJids(pn, [pn, lid])).toEqual([pn, lid]);
    expect(whatsappHistoryJids("12345@g.us", [pn, lid])).toEqual(["12345@g.us"]);
  });

  it("aplica reações recebidas e enviadas à mensagem original sem apagar o restante do histórico", () => {
    const inbound = readWhatsAppReaction({
      key: { id: "event-1", remoteJid: lid, fromMe: false },
      message: {
        reactionMessage: {
          key: { id: target.id, remoteJid: lid, fromMe: true },
          text: "❤️",
          senderTimestampMs: 300,
        },
      },
    })!;
    const outbound = readWhatsAppReaction({
      key: { id: "event-2", remoteJid: pn, fromMe: true },
      message: {
        reactionMessage: {
          key: { id: target.id, remoteJid: pn },
          text: "👍",
          senderTimestampMs: 301,
        },
      },
    })!;
    const previous = [first, target, { ...first, id: inbound.eventId, text: "Reação: ❤️" }];
    const merged = mergeWhatsAppHistory(previous, [], [inbound, outbound]);
    expect(merged.map((message) => message.id)).toEqual(["older", "target"]);
    expect(merged[1]?.reactions?.map((reaction) => [reaction.actor, reaction.emoji])).toEqual([
      ["contact", "❤️"],
      ["self", "👍"],
    ]);
    expect(mergeWhatsAppHistory(merged, [target], [inbound, outbound])).toBe(merged);
  });

  it("mantém a remoção e ignora reações antigas ao receber uma janela parcial", () => {
    const older = { messageId: target.id, actor: "contact", emoji: "❤️", eventId: "1", at: 100 };
    const removal = { ...older, emoji: "", eventId: "2", at: 200 };
    const current = mergeWhatsAppHistory([first, target], [], [older, removal]);
    expect(mergeWhatsAppHistory(current, [target], [older])).toBe(current);
    expect(current[1]?.reactions?.[0]?.emoji).toBe("");
    expect(current[0]).toBe(first);
  });
});
