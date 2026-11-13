import type { Mensagem } from "@/components/inbox/dados";
import { whatsappTimestamp } from "./whatsapp-time";

export type WhatsAppMessageKey = {
  id?: string;
  remoteJid?: string;
  remoteJidAlt?: string;
  participant?: string;
  participantAlt?: string;
  fromMe?: boolean;
};

export type WhatsAppReaction = {
  messageId: string;
  actor: string;
  emoji: string;
  at: number;
  eventId: string;
};

export function whatsappPhoneJid(jid: string | undefined) {
  const match = jid?.match(/^([1-9]\d{7,14})(?::\d+)?@(s\.whatsapp\.net|c\.us)$/);
  return match ? `${match[1]}@s.whatsapp.net` : undefined;
}

export function whatsappPhone(jid: string | undefined) {
  const digits = whatsappPhoneJid(jid)?.split("@")[0];
  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, -4)}-${digits.slice(-4)}`;
  }
  return `+${digits}`;
}

/** Baileys supplies both addresses on the same message key when the association is known. */
export function whatsappAddressPair(key: WhatsAppMessageKey | undefined) {
  const addresses = [key?.remoteJid, key?.remoteJidAlt];
  const phone = addresses.map(whatsappPhoneJid).find(Boolean);
  const lid = addresses.find((jid) => jid && /^\d+@lid$/.test(jid));
  return phone && lid ? { phone, lid } : undefined;
}

export function whatsappHistoryJids(jid: string, aliases: readonly string[] = []) {
  if (jid.endsWith("@g.us")) return [jid];
  const phone = whatsappPhoneJid(jid);
  const other = phone
    ? aliases.find((id) => /^\d+@lid$/.test(id))
    : aliases.map(whatsappPhoneJid).find(Boolean);
  return other ? [jid, other] : [jid];
}

export function readWhatsAppReaction(row: {
  key?: WhatsAppMessageKey;
  messageTimestamp?: unknown;
  message?: {
    reactionMessage?: { key?: WhatsAppMessageKey; text?: string; senderTimestampMs?: unknown };
  };
}): WhatsAppReaction | undefined {
  const reaction = row.message?.reactionMessage;
  const eventId = row.key?.id;
  const messageId = reaction?.key?.id;
  if (!reaction || !eventId || !messageId) return undefined;
  const senderTime = Number(reaction.senderTimestampMs);
  const messageTime = whatsappTimestamp(row.messageTimestamp);
  const actor = row.key?.fromMe
    ? "self"
    : row.key?.remoteJid?.endsWith("@g.us")
      ? whatsappPhoneJid(row.key.participant) ||
        whatsappPhoneJid(row.key.participantAlt) ||
        row.key.participant
      : "contact";
  if (!actor) return undefined;
  return {
    messageId,
    eventId,
    actor,
    emoji: typeof reaction.text === "string" ? reaction.text : "",
    at:
      Number.isFinite(senderTime) && senderTime > 0
        ? senderTime
        : messageTime,
  };
}

function updateReactions(current: WhatsAppReaction[] | undefined, incoming: WhatsAppReaction[]) {
  const byActor = new Map((current ?? []).map((item) => [item.actor, item]));
  let changed = false;
  for (const item of incoming) {
    const previous = byActor.get(item.actor);
    if (
      previous &&
      (item.at < previous.at || (item.at === previous.at && item.eventId <= previous.eventId))
    )
      continue;
    byActor.set(item.actor, item);
    changed = true;
  }
  return changed ? [...byActor.values()] : current;
}

/** Polls return a sliding window. Merge by WhatsApp message ID and apply reaction events separately. */
export function mergeWhatsAppHistory(
  current: Mensagem[],
  incoming: Mensagem[],
  reactions: WhatsAppReaction[],
) {
  const reactionIds = new Set(reactions.map((reaction) => reaction.eventId));
  const messages = new Map(
    current
      .filter(
        (message) =>
          !reactionIds.has(message.id) && (!incoming.length || !message.id.startsWith("preview:")),
      )
      .map((message) => [message.id, message]),
  );
  for (const message of incoming) {
    const previous = messages.get(message.id);
    if (!previous) {
      // Deduplica mensagens provisórias locais que têm o mesmo texto e tipo
      for (const [existingId, existingMsg] of messages.entries()) {
        if (
          existingMsg.kind === message.kind &&
          existingMsg.text.trim() === message.text.trim() &&
          existingId !== message.id &&
          (!existingMsg.sentAt || Math.abs((existingMsg.sentAt || 0) - (message.sentAt || 0)) < 180000)
        ) {
          messages.delete(existingId);
          break;
        }
      }
      messages.set(message.id, message);
      continue;
    }
    const next = { ...previous, ...message, mediaUrl: message.mediaUrl ?? previous.mediaUrl };
    if (Object.entries(next).some(([key, value]) => value !== previous[key as keyof Mensagem]))
      messages.set(message.id, next);
  }

  // Remove duplicatas locais remanescentes com mesmo texto e tipo se uma delas não tiver sentAt
  const seenTexts = new Map<string, string>();
  for (const [id, msg] of Array.from(messages.entries())) {
    const key = `${msg.kind}:${msg.text.trim()}`;
    const seenId = seenTexts.get(key);
    if (seenId) {
      const seenMsg = messages.get(seenId);
      if (seenMsg && !msg.sentAt) {
        messages.delete(id);
      } else if (seenMsg && !seenMsg.sentAt) {
        messages.delete(seenId);
        seenTexts.set(key, id);
      }
    } else {
      seenTexts.set(key, id);
    }
  }
  const byMessage = new Map<string, WhatsAppReaction[]>();
  for (const reaction of reactions) {
    const items = byMessage.get(reaction.messageId);
    if (items) items.push(reaction);
    else byMessage.set(reaction.messageId, [reaction]);
  }
  for (const [id, items] of byMessage) {
    const message = messages.get(id);
    if (!message) continue;
    const next = updateReactions(message.reactions, items);
    if (next !== message.reactions) messages.set(id, { ...message, reactions: next });
  }
  const result = [...messages.values()].sort((a, b) =>
    a.sentAt !== undefined && b.sentAt !== undefined ? a.sentAt - b.sentAt : 0,
  );
  return result.length === current.length &&
    result.every((message, index) => message === current[index])
    ? current
    : result;
}
