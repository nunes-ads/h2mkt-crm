import { whatsappPhone, whatsappPhoneJid } from "./whatsapp-history";

export type WhatsAppProfile = {
  name?: unknown;
  pushName?: unknown;
  subject?: unknown;
  profilePicUrl?: unknown;
  pictureUrl?: unknown;
  isSaved?: boolean;
};

export function whatsappName(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const name = value.trim();
    if (name && name.toLowerCase() !== "você" &&
        !/^[+\d().\s-]+$/.test(name) && !/@(?:lid|g\.us|s\.whatsapp\.net|c\.us)$/i.test(name)) return name;
  }
  return "";
}

export function whatsappPhoto(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password) return url.href;
    } catch {
      // A missing or invalid provider URL uses the initials in the interface.
    }
  }
  return null;
}

export function whatsappProfileKey(jid: string) {
  return whatsappPhoneJid(jid) || jid;
}

export function whatsappContactProfile(
  jid: string, contacts: ReadonlyMap<string, WhatsAppProfile>, aliases: readonly string[] = [],
) {
  const entries = [jid, ...aliases].map(id => contacts.get(whatsappProfileKey(id)))
    .filter((item): item is WhatsAppProfile => Boolean(item));
  return {
    name: whatsappName(...entries.flatMap(c => [c.name, c.isSaved ? c.pushName : null]),
      ...entries.map(c => c.pushName)),
    avatar: whatsappPhoto(...entries.flatMap(c => [c.profilePicUrl, c.pictureUrl])),
    phone: whatsappPhone(jid) || aliases.map(whatsappPhone).find(Boolean) || "",
  };
}
