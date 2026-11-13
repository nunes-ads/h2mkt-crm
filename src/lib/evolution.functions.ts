import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { requireLegacyIntegrationAdmin } from './crm/legacy-access';
import { readWhatsAppReaction, whatsappAddressPair, whatsappHistoryJids, whatsappPhone, whatsappPhoneJid, type WhatsAppReaction } from './whatsapp-history';
import { whatsappAccountId, type WhatsAppAccountId, type WhatsAppConnectionState } from './whatsapp-connection';
import { resolveEvolutionInstance, readEvolutionState, requireEvolutionConnection, listEvolutionInstances, selectEvolutionInstance, needsFreshPairing, requireExpectedInstance } from './evolution-connection.server';
import { whatsappDate, whatsappHour, whatsappTimestamp } from './whatsapp-time';
import { whatsappContactProfile, whatsappName, whatsappPhoto, whatsappProfileKey, type WhatsAppProfile } from './whatsapp-profiles';
import { ensureAllEvolutionWebhooks } from './crm/evolution-webhook.server';

type ProfileConfig = { url: string; key: string; instance: string };
const contactsCache = new Map<string, { expires: number; value: Promise<Map<string, WhatsAppProfile>> }>();
type PhotoEntry = { expires: number; url: string | null };
const photoCaches = new Map<string, { entries: Map<string, PhotoEntry>; pending: Set<string> }>();

function getContacts({ url, key, instance }: ProfileConfig) {
  const scope = `${url}/${instance}`;
  const cached = contactsCache.get(scope);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = fetch(`${url}/chat/findContacts/${instance}`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ where: {} }),
    signal: AbortSignal.timeout(7000),
  }).then(async (response) => {
    if (!response.ok) throw new Error('Contatos indisponíveis');
    const data = await response.json();
    const contacts = new Map<string, WhatsAppProfile>();
    for (const c of Array.isArray(data) ? data : []) {
      if (typeof c?.remoteJid === 'string') contacts.set(whatsappProfileKey(c.remoteJid), c);
    }
    return contacts;
  }).catch(() => {
    contactsCache.delete(scope);
    return new Map<string, WhatsAppProfile>();
  });
  contactsCache.set(scope, { expires: Date.now() + 30000, value });
  return value;
}

function cachedProfilePhoto({ url, key, instance }: ProfileConfig, jid: string, fallback: string | null) {
  if (fallback) return fallback;
  if (!/^[\d:-]+@(s\.whatsapp\.net|c\.us|lid|g\.us)$/.test(jid)) return null;
  const scope = `${url}/${instance}`;
  let cache = photoCaches.get(scope);
  if (!cache) {
    cache = { entries: new Map(), pending: new Set() };
    photoCaches.set(scope, cache);
  }
  const { entries, pending } = cache;
  const existing = entries.get(jid);
  if (existing && existing.expires > Date.now()) return existing.url;
  if (!pending.has(jid) && pending.size < 4) {
    pending.add(jid);
    void fetch(`${url}/chat/fetchProfilePictureUrl/${instance}`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: jid }),
      signal: AbortSignal.timeout(6000),
    }).then(response => response.ok ? response.json() : null).then(data => {
      const photo = whatsappPhoto(data?.profilePictureUrl, data?.profilePicUrl, data?.pictureUrl);
      if (entries.size >= 2000) {
        const oldest = entries.keys().next().value;
        if (oldest) entries.delete(oldest);
      }
      entries.set(jid, { url: photo, expires: Date.now() + (photo ? 30 : 5) * 60000 });
    }).catch(() => {
      entries.set(jid, { url: null, expires: Date.now() + 60000 });
    }).finally(() => pending.delete(jid));
  }
  return existing?.url ?? null;
}

async function getEvolutionConfig(accountId: WhatsAppAccountId = 'matriz') {
  const url = (process.env['EVOLUTION_API_URL'] || 'http://localhost:18080').replace(/\/+$/, '');
  const key = process.env['EVOLUTION_API_KEY'] || '';
  const base = resolveEvolutionInstance(accountId, process.env);
  const instances = await listEvolutionInstances({ url, key });
  return { url, key, base, ...selectEvolutionInstance(base, instances) };
}

function extractMessageText(msg: any): string {
  if (!msg || msg.reactionMessage) return '';
  if (typeof msg.conversation === 'string') return msg.conversation;
  if (typeof msg.extendedTextMessage?.text === 'string') return msg.extendedTextMessage.text;
  if (typeof msg.imageMessage?.caption === 'string') return `📷 ${msg.imageMessage.caption}`;
  if (msg.imageMessage) return '📷 [Imagem]';
  if (msg.audioMessage) return '🎙️ [Áudio]';
  if (msg.videoMessage) return '🎥 [Vídeo]';
  if (msg.documentMessage) return `📄 [Documento: ${msg.documentMessage.fileName || 'arquivo'}]`;
  if (msg.stickerMessage) return '🏷️ [Figurinha]';
  return 'Mensagem';
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    // 55 61 9XXXX-XXXX
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length > 13) {
    return 'WhatsApp';
  }
  return raw;
}

export type EvolutionStatusResponse = {
  configured: boolean;
  state: WhatsAppConnectionState;
  instance: string;
  phone: string | null;
  profilePicUrl: string | null;
  count: number;
  contactsCount: number;
  chatsCount: number;
  error?: string | undefined;
};

/**
 * Consulta o status de conexão da instância da Evolution API.
 */
export const getEvolutionStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ accountId: whatsappAccountId.optional() }).strict().optional())
  .handler(async ({ data, context }): Promise<EvolutionStatusResponse> => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const config = await getEvolutionConfig(data?.accountId);
    const state = await readEvolutionState(config);
    if (state === 'open') {
      void ensureAllEvolutionWebhooks().catch(() => undefined);
    }
    const metadata = state === 'open' ? config.metadata : undefined;
    const phone = metadata?.ownerJid?.split('@')[0];
    return {
      configured: Boolean(config.key), state, instance: config.instance,
      phone: phone ? formatPhone(phone) : null,
      profilePicUrl: metadata?.profilePicUrl ?? null,
      count: metadata?._count?.Message ?? 0,
      contactsCount: metadata?._count?.Contact ?? 0,
      chatsCount: metadata?._count?.Chat ?? 0,
    };
  });

export const syncEvolutionWebhook = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    return await ensureAllEvolutionWebhooks();
  });

export type EvolutionConnectResponse = {
  state: 'open' | 'connecting' | 'close' | 'refused';
  base64?: string | null;
  code?: string | null;
  pairingCode?: string | null;
  count?: number;
  instance: string;
  error?: string | null;
};

/**
 * Obtém o QR Code ou estado de conexão de uma instância na Evolution API.
 * Se a instância não existir, cria-a automaticamente com Baileys para gerar o QR code.
 */
export const getEvolutionConnectQr = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ accountId: whatsappAccountId.optional() }).strict().optional())
  .handler(async ({ data, context }): Promise<EvolutionConnectResponse> => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const config = await getEvolutionConfig(data?.accountId);
    const { url, key, instance: current } = config;
    const state = await readEvolutionState(config);
    if (state === 'open') return { state: 'open', instance: current };
    const hasHistory = needsFreshPairing(config.metadata);
    const rotate = (state === 'close' || state === 'missing') && hasHistory;
    const instance = rotate ? `${config.base}--crm-${config.generation + 1}` : current;
    if (state === 'unconfigured' || state === 'unavailable') {
      return { state: 'close', instance, error: state === 'unconfigured' ? 'Chave da Evolution API não configurada.' : 'A Evolution API não respondeu. Tente novamente.' };
    }

    if (state === 'connecting' && hasHistory) {
      return { state: 'connecting', instance, error: 'A sessão anterior está reconectando. Desconecte a sessão antes de parear outro número.' };
    }

    const getQr = (json: { base64?: unknown; qrcode?: { base64?: unknown }; instance?: { state?: string }; state?: string }): EvolutionConnectResponse | null => {
      if ((json.instance?.state ?? json.state) === 'open') return { state: 'open', instance };
      const raw = json.base64 ?? json.qrcode?.base64;
      if (typeof raw !== 'string' || !raw) return null;
      const base64 = raw.startsWith('data:image/png;base64,') ? raw : `data:image/png;base64,${raw}`;
      return { state: 'connecting', instance, base64 };
    };

    try {
      if (state === 'missing' || rotate) {
        const response = await fetch(`${url}/instance/create`, {
          method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceName: instance, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok && response.status !== 409 && await readEvolutionState({ ...config, instance }) === 'missing') {
          return { state: 'close', instance, error: `Não foi possível criar a instância desta conta (HTTP ${response.status}).` };
        }
        if (response.ok) {
          const qr = getQr(await response.json());
          if (qr) return qr;
        }
      }
      const response = await fetch(`${url}/instance/connect/${instance}`, {
        headers: { apikey: key }, signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return { state: 'close', instance, error: `Não foi possível gerar o QR (HTTP ${response.status}).` };
      return getQr(await response.json()) ?? { state: 'connecting', instance };
    } catch {
      return { state: 'close', instance, error: 'Falha ao gerar o QR Code. Tente novamente.' };
    }
  });

/**
 * Desconecta a sessão do WhatsApp na Evolution API.
 */
export const logoutEvolutionInstance = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ accountId: whatsappAccountId, expectedInstance: z.string().max(100) }).strict())
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = await getEvolutionConfig(data.accountId);
    requireExpectedInstance(instance, data.expectedInstance);
    if (!key) throw new Error('Evolution API não configurada.');

    try {
      const res = await fetch(`${url}/instance/logout/${instance}`, {
        method: 'DELETE',
        headers: { apikey: key },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Erro HTTP ${res.status}`);
      }
      return { success: true, message: 'WhatsApp desconectado com sucesso.' };
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao desconectar WhatsApp');
    }
  });

/**
 * Reinicia uma instância na Evolution API.
 */
export const restartEvolutionInstance = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    accountId: whatsappAccountId.optional(),
  }).strict().optional())
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = await getEvolutionConfig(data?.accountId);
    if (!key) throw new Error('Evolution API não configurada.');

    try {
      const res = await fetch(`${url}/instance/restart/${instance}`, {
        method: 'POST',
        headers: { apikey: key },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Erro HTTP ${res.status}`);
      }
      return { success: true, message: 'Instância reiniciada com sucesso.' };
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao reiniciar instância');
    }
  });

export type EvolutionChat = {
  id: string;
  remoteJid: string;
  name: string;
  phone: string;
  unreadCount: number;
  lastMessage: string;
  timestamp: number;
  isGroup: boolean;
  avatar?: string | null | undefined;
  aliases?: string[] | undefined;
};

// Cache em memória para mapeamento de identificadores de LID para telefone WhatsApp


/**
 * Busca a lista de conversas ativas da Evolution API.
 * Sincroniza contatos, grupos e conversas unificando identificadores de número e LID.
 */
export const getEvolutionChats = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ accountId: whatsappAccountId, expectedInstance: z.string().max(100) }).strict())
  .handler(async ({ data, context }): Promise<EvolutionChat[]> => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const config = await getEvolutionConfig(data.accountId);
    requireExpectedInstance(config.instance, data.expectedInstance);
    await requireEvolutionConnection(config);
    const { url, key, instance } = config;
    const lidToPhoneMap = new Map<string, string>();

    try {
      const [chatsRes, contactsRes, groupsRes] = await Promise.all([
        fetch(`${url}/chat/findChats/${instance}`, {
          method: 'POST',
          headers: { apikey: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ where: {} }),
          signal: AbortSignal.timeout(12000),
        }).then(r => { if (!r.ok) throw new Error('Conversas indisponíveis'); return r.json(); }),

        getContacts(config),

        fetch(`${url}/group/fetchAllGroups/${instance}?getParticipants=false`, {
          headers: { apikey: key },
          signal: AbortSignal.timeout(12000),
        }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);

      const groups = Array.isArray(groupsRes) ? groupsRes : [];
      const chats = Array.isArray(chatsRes) ? chatsRes : [];
      const groupMap = new Map<string, WhatsAppProfile>();
      for (const g of groups) {
        if (g.id) groupMap.set(g.id, g);
      }

      // Learn only the phone/LID pairs explicitly associated on a provider message key.
      for (const chat of chats) {
        const pair = whatsappAddressPair(chat.lastMessage?.key);
        if (pair && !lidToPhoneMap.has(pair.lid)) lidToPhoneMap.set(pair.lid, pair.phone);
      }

      const merged = new Map<string, EvolutionChat>();

      for (const c of chats) {
        if (!c.remoteJid || c.remoteJid === 'status@broadcast' || c.remoteJid.endsWith('@newsletter')) {
          continue;
        }

        const isGroup = c.remoteJid.endsWith('@g.us');
        const groupInfo = groupMap.get(c.remoteJid);
        const mappedPhone = lidToPhoneMap.get(c.remoteJid) || whatsappPhoneJid(c.remoteJid);
        const canonicalJid = mappedPhone || c.remoteJid;
        const aliases = Array.from(new Set([canonicalJid, c.remoteJid, ...[...lidToPhoneMap].filter(([, phone]) => phone === canonicalJid).map(([lid]) => lid)]));
        const contact = whatsappContactProfile(canonicalJid, contactsRes, aliases);
        const phone = isGroup ? 'Grupo' : contact.phone;
        const name = isGroup
          ? whatsappName(groupInfo?.subject, c.subject, contact.name, c.pushName) || 'Grupo WhatsApp'
          : whatsappName(contact.name, c.name, c.pushName,
              c.lastMessage?.key?.fromMe === false ? c.lastMessage?.pushName : null) || phone || 'Contato';
        const timestamp = whatsappTimestamp(c.lastMessage?.messageTimestamp);
        const avatar = cachedProfilePhoto(config, canonicalJid,
          whatsappPhoto(groupInfo?.pictureUrl, groupInfo?.profilePicUrl, contact.avatar, c.profilePicUrl));

        const item: EvolutionChat = {
          id: canonicalJid,
          remoteJid: canonicalJid,
          name,
          phone,
          unreadCount: c.unreadCount || 0,
          lastMessage: c.lastMessage?.message ? extractMessageText(c.lastMessage.message) : '',
          timestamp,
          isGroup,
          avatar,
          aliases,
        };

        const old = merged.get(canonicalJid);
        const [latest, other] = old && old.timestamp > item.timestamp ? [old, item] : [item, old];
        merged.set(canonicalJid, other ? {
          ...latest,
          name: latest.name === 'Contato' || latest.name === latest.phone ? other.name : latest.name,
          avatar: latest.avatar || other.avatar,
          unreadCount: Math.max(latest.unreadCount, other.unreadCount),
          aliases: Array.from(new Set([...(latest.aliases || []), ...(other.aliases || [])])),
        } : latest);
      }

      return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
      throw new Error('Não foi possível sincronizar as conversas. O histórico atual foi preservado.');
    }
  });

export type EvolutionMessage = {
  id: string;
  fromMe: boolean;
  sender: string;
  senderAvatar?: string | null;
  text: string;
  timestamp: string; // HH:mm
  date: string; // dd/mm
  mediaType?: "image" | "video" | "audio" | "document" | undefined;
  mediaUrl?: string | undefined;
  caption?: string | undefined;
  fileName?: string | undefined;
  sentAt: number;
  remoteJid: string;
  participant?: string | undefined;
  quotedText?: string | undefined;
  starred?: boolean | undefined;
};

/**
 * Busca as mensagens de uma conversa específica da Evolution API.
 */
export const getEvolutionMessages = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    remoteJid: z.string().regex(/^[\d:-]+@(s\.whatsapp\.net|c\.us|lid|g\.us)$/),
    aliases: z.array(z.string().max(80)).max(4).optional(),
    accountId: whatsappAccountId,
    expectedInstance: z.string().max(100),
  }).strict())
  .handler(async ({ data, context }): Promise<{ messages: EvolutionMessage[]; reactions: WhatsAppReaction[]; aliases: string[]; phone: string }> => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = await getEvolutionConfig(data.accountId);
    requireExpectedInstance(instance, data.expectedInstance);
    await requireEvolutionConnection({ url, key, instance });

    try {
      const aliases = whatsappHistoryJids(data.remoteJid, data.aliases);
      const fetchJid = async (jid: string) => {
        try {
          const res = await fetch(`${url}/chat/findMessages/${instance}`, {
            method: 'POST',
            headers: { apikey: key, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              where: {
                key: {
                  remoteJid: jid,
                },
              },
              page: 1,
              offset: 50,
            }),
            signal: AbortSignal.timeout(10000),
          });

          if (!res.ok) return [];
          const json = await res.json();
          return json.messages?.records || (Array.isArray(json) ? json : []);
        } catch {
          return [];
        }
      };

      const results = await Promise.all(aliases.map(fetchJid));
      if (aliases.length === 1 && !data.remoteJid.endsWith('@g.us')) {
        const pair = results.flat().map(row => whatsappAddressPair(row.key)).find(pair => pair && (pair.lid === data.remoteJid || pair.phone === whatsappPhoneJid(data.remoteJid)));
        const other = pair && (pair.lid === data.remoteJid ? pair.phone : pair.lid);
        if (other) { aliases.push(other); results.push(await fetchJid(other)); }
      }
      const seen = new Map<string, any>();
      for (const list of results) {
        for (const r of list) {
          const id = r.key?.id || r.id;
          if (id && !seen.has(id)) {
            seen.set(id, r);
          }
        }
      }

      const allRecords = Array.from(seen.values());
      const reactions = allRecords.map(readWhatsAppReaction).filter((reaction): reaction is WhatsAppReaction => Boolean(reaction));
      const records = allRecords.filter(row => !row.message?.reactionMessage).sort(
        (a, b) => whatsappTimestamp(a.messageTimestamp) - whatsappTimestamp(b.messageTimestamp)
      );
      const isGroup = data.remoteJid.endsWith('@g.us');
      const contacts = isGroup ? await getContacts({ url, key, instance }) : new Map<string, WhatsAppProfile>();

      // Para mensagens com mídia (imagem, áudio, vídeo, documento), busca o base64 descriptografado via Evolution API
      const mediaRecords = records.filter(
        (r: any) => Boolean(
          r.message?.imageMessage ||
          r.message?.audioMessage ||
          r.message?.videoMessage ||
          r.message?.documentMessage
        )
      );

      // Descriptografa em lote as mídias recentes
      const mediaToFetch = mediaRecords.slice(-15);
      await Promise.allSettled(
        mediaToFetch.map(async (r: any) => {
          const msgId = r.key?.id || r.id;
          if (!msgId) return;

          try {
            const mediaRes = await fetch(`${url}/chat/getBase64FromMediaMessage/${instance}`, {
              method: 'POST',
              headers: { apikey: key, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: {
                  key: {
                    id: msgId,
                  },
                },
                convertToMp4: false,
              }),
              signal: AbortSignal.timeout(3500),
            }).then((res) => (res.ok ? res.json() : null)).catch(() => null);

            if (mediaRes?.base64) {
              const mime = mediaRes.mimetype || (r.message?.imageMessage ? 'image/jpeg' : r.message?.audioMessage ? 'audio/ogg' : 'application/octet-stream');
              r._fetchedMediaUrl = mediaRes.base64.startsWith('data:')
                ? mediaRes.base64
                : `data:${mime};base64,${mediaRes.base64}`;
            }
          } catch {}
        })
      );

      const messages = records.map((r: any): EvolutionMessage => {
        const text = extractMessageText(r.message);
        const sentAt = whatsappTimestamp(r.messageTimestamp);
        const participant = r.key?.participant || r.participant || r.key?.participantAlt;
        const participantProfile = isGroup && participant && !r.key?.fromMe
          ? whatsappContactProfile(participant, contacts, r.key?.participantAlt ? [r.key.participantAlt] : [])
          : undefined;

        let mediaType: EvolutionMessage["mediaType"] = undefined;
        let mediaUrl: string | undefined = undefined;
        let caption: string | undefined = undefined;
        let fileName: string | undefined = undefined;

        if (r.message?.imageMessage) {
          mediaType = "image";
          caption = r.message.imageMessage.caption;
          if (r._fetchedMediaUrl) {
            mediaUrl = r._fetchedMediaUrl;
          } else if (r.message.imageMessage.jpegThumbnail) {
            const thumb = r.message.imageMessage.jpegThumbnail;
            mediaUrl = thumb.startsWith('data:') ? thumb : `data:image/jpeg;base64,${thumb}`;
          }
        } else if (r.message?.videoMessage) {
          mediaType = "video";
          caption = r.message.videoMessage.caption;
          mediaUrl = r._fetchedMediaUrl || undefined;
        } else if (r.message?.audioMessage) {
          mediaType = "audio";
          mediaUrl = r._fetchedMediaUrl || (r.message.audioMessage.url?.startsWith('data:') ? r.message.audioMessage.url : undefined);
        } else if (r.message?.documentMessage) {
          mediaType = "document";
          fileName = r.message.documentMessage.fileName || "documento";
          mediaUrl = r._fetchedMediaUrl || undefined;
        }

        const quotedMsg = r.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = quotedMsg ? extractMessageText(quotedMsg) : undefined;

        return {
          id: r.key?.id || r.id || crypto.randomUUID(),
          fromMe: Boolean(r.key?.fromMe),
          sender: r.key?.fromMe ? 'Você' : whatsappName(participantProfile?.name, r.pushName) ||
            participantProfile?.phone || (isGroup ? 'Participante' : 'Cliente'),
          senderAvatar: participantProfile && participant
            ? cachedProfilePhoto({ url, key, instance }, participant, participantProfile.avatar) : null,
          text,
          timestamp: whatsappHour(sentAt),
          sentAt,
          remoteJid: r.key?.remoteJid || data.remoteJid,
          participant,
          date: whatsappDate(sentAt),
          mediaType,
          mediaUrl,
          caption,
          fileName,
          quotedText,
        };
      });
      return { messages, reactions, aliases, phone: aliases.map(whatsappPhone).find(Boolean) || '' };
    } catch {
      throw new Error('Não foi possível atualizar as mensagens. O histórico atual foi preservado.');
    }
  });

/**
 * Marca as mensagens de uma conversa como lidas na Evolution API.
 */
export const markEvolutionChatAsRead = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    remoteJid: z.string().min(1),
    accountId: whatsappAccountId,
    expectedInstance: z.string().max(100),
  }).strict())
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = await getEvolutionConfig(data.accountId);
    requireExpectedInstance(instance, data.expectedInstance);
    await requireEvolutionConnection({ url, key, instance });

    try {
      const response = await fetch(`${url}/chat/markMessageAsRead/${instance}`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readMessages: [
            {
              remoteJid: data.remoteJid,
              fromMe: false,
              id: 'all',
            },
          ],
        }),
        signal: AbortSignal.timeout(3000),
      }).catch(() => null);

      return { success: response?.ok === true };
    } catch {
      return { success: false };
    }
  });

/**
 * Envia uma mensagem de texto via WhatsApp usando a Evolution API.
 */
export const sendEvolutionMessage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    number: z.string().optional(),
    remoteJid: z.string().optional(),
    text: z.string().min(1),
    quotedId: z.string().optional(),
    accountId: whatsappAccountId,
    expectedInstance: z.string().max(100),
  }).strict())
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = await getEvolutionConfig(data.accountId);
    requireExpectedInstance(instance, data.expectedInstance);
    await requireEvolutionConnection({ url, key, instance });

    let destination = (data.number || data.remoteJid || '').trim();
    if (!destination) {
      throw new Error('Destinatário não informado (number ou remoteJid)');
    }



    if (!destination.includes('@')) {
      const cleanDigits = destination.replace(/\D/g, '');
      if ((cleanDigits.length === 10 || cleanDigits.length === 11) && !cleanDigits.startsWith('55')) {
        destination = `55${cleanDigits}`;
      } else {
        destination = cleanDigits;
      }
    }

    const payload: any = {
      number: destination,
      text: data.text,
    };

    if (data.quotedId) {
      payload.quoted = {
        key: {
          id: data.quotedId,
        },
      };
    }

    const res = await fetch(`${url}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const detailed = errJson.response?.message?.[0];
      const errorText = typeof detailed === 'object' && detailed?.exists === false
        ? `O número ${detailed.number || destination} não possui WhatsApp ou é inválido.`
        : errJson.response?.message || errJson.message || `Erro HTTP ${res.status}`;
      throw new Error(typeof errorText === 'string' ? errorText : JSON.stringify(errorText));
    }

    return await res.json();
  });

/**
 * Envia mídia (imagem, vídeo, documento, áudio) via WhatsApp.
 */
export const sendEvolutionMedia = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    number: z.string().optional(),
    remoteJid: z.string().optional(),
    mediatype: z.enum(["image", "video", "audio", "document"]),
    mimetype: z.string().min(1),
    media: z.string().min(1), // base64 data URL ou URL pública
    caption: z.string().optional(),
    fileName: z.string().optional(),
    accountId: whatsappAccountId,
    expectedInstance: z.string().max(100),
  }).strict())
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = await getEvolutionConfig(data.accountId);
    requireExpectedInstance(instance, data.expectedInstance);
    await requireEvolutionConnection({ url, key, instance });

    let destination = (data.number || data.remoteJid || '').trim();
    if (!destination) {
      throw new Error('Destinatário não informado (number ou remoteJid)');
    }



    if (!destination.includes('@')) {
      const cleanDigits = destination.replace(/\D/g, '');
      if ((cleanDigits.length === 10 || cleanDigits.length === 11) && !cleanDigits.startsWith('55')) {
        destination = `55${cleanDigits}`;
      } else {
        destination = cleanDigits;
      }
    }

    // Limpa prefixo "data:...;base64," se presente
    let cleanMedia = data.media;
    if (cleanMedia.startsWith('data:')) {
      const parts = cleanMedia.split('base64,');
      if (parts[1]) cleanMedia = parts[1];
    }

    const res = await fetch(`${url}/message/sendMedia/${instance}`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: destination,
        mediatype: data.mediatype,
        mimetype: data.mimetype,
        caption: data.caption || "",
        media: cleanMedia,
        fileName: data.fileName || (data.mediatype === 'image' ? 'imagem.png' : 'documento.pdf'),
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.response?.message || errJson.message || `Erro HTTP ${res.status} ao enviar mídia`);
    }

    return await res.json();
  });

/**
 * Envia mensagem de áudio / PTT gravada no WhatsApp.
 */
export const sendEvolutionAudio = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    number: z.string().optional(),
    remoteJid: z.string().optional(),
    audio: z.string().min(1), // base64
    accountId: whatsappAccountId,
    expectedInstance: z.string().max(100),
  }).strict())
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = await getEvolutionConfig(data.accountId);
    requireExpectedInstance(instance, data.expectedInstance);
    await requireEvolutionConnection({ url, key, instance });

    let destination = (data.number || data.remoteJid || '').trim();
    if (!destination) {
      throw new Error('Destinatário não informado (number ou remoteJid)');
    }



    if (!destination.includes('@')) {
      const cleanDigits = destination.replace(/\D/g, '');
      if ((cleanDigits.length === 10 || cleanDigits.length === 11) && !cleanDigits.startsWith('55')) {
        destination = `55${cleanDigits}`;
      } else {
        destination = cleanDigits;
      }
    }

    let cleanAudio = data.audio;
    if (cleanAudio.startsWith('data:')) {
      const parts = cleanAudio.split('base64,');
      if (parts[1]) cleanAudio = parts[1];
    }

    const res = await fetch(`${url}/message/sendWhatsAppAudio/${instance}`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: destination,
        audio: cleanAudio,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.response?.message || errJson.message || `Erro HTTP ${res.status} ao enviar áudio`);
    }

    return await res.json();
  });

/**
 * Envia uma reação com emoji para uma mensagem do WhatsApp.
 */
export const sendEvolutionReaction = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    remoteJid: z.string().min(1),
    messageId: z.string().min(1),
    fromMe: z.boolean(),
    reaction: z.string().max(32),
    participant: z.string().max(80).optional(),
    accountId: whatsappAccountId,
    expectedInstance: z.string().max(100),
  }).strict())
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = await getEvolutionConfig(data.accountId);
    requireExpectedInstance(instance, data.expectedInstance);
    await requireEvolutionConnection({ url, key, instance });

    const res = await fetch(`${url}/message/sendReaction/${instance}`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: {
          remoteJid: data.remoteJid,
          fromMe: data.fromMe,
          id: data.messageId,
          ...(data.participant ? { participant: data.participant } : {}),
        },
        reaction: data.reaction,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.response?.message || errJson.message || `Erro HTTP ${res.status} ao reagir`);
    }

    return await res.json();
  });

