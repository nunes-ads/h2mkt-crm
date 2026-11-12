import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { requireLegacyIntegrationAdmin, resolveLegacyInstance } from './crm/legacy-access';

function getEvolutionConfig(customInstance?: string) {
  const url = process.env['EVOLUTION_API_URL'] || 'http://localhost:18080';
  const key = process.env['EVOLUTION_API_KEY'] || '';
  const instance = resolveLegacyInstance(customInstance, process.env['EVOLUTION_INSTANCE_NAME']);
  return { url: url.replace(/\/+$/, ''), key, instance };
}

function extractMessageText(msg: any): string {
  if (!msg) return '';
  if (typeof msg.conversation === 'string') return msg.conversation;
  if (typeof msg.extendedTextMessage?.text === 'string') return msg.extendedTextMessage.text;
  if (typeof msg.imageMessage?.caption === 'string') return `📷 ${msg.imageMessage.caption}`;
  if (msg.imageMessage) return '📷 [Imagem]';
  if (msg.audioMessage) return '🎙️ [Áudio]';
  if (msg.videoMessage) return '🎥 [Vídeo]';
  if (msg.documentMessage) return `📄 [Documento: ${msg.documentMessage.fileName || 'arquivo'}]`;
  if (msg.stickerMessage) return '🏷️ [Figurinha]';
  if (msg.reactionMessage?.text) return `Reação: ${msg.reactionMessage.text}`;
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
  state: string;
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
  .validator(z.object({ instance: z.string().optional() }).optional())
  .handler(async ({ data, context }): Promise<EvolutionStatusResponse> => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = getEvolutionConfig(data?.instance);
    if (!key) {
      return { configured: false, state: 'Chave não configurada', instance, phone: null, profilePicUrl: null, count: 0, contactsCount: 0, chatsCount: 0 };
    }

    try {
      const res = await fetch(`${url}/instance/fetchInstances`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        return { configured: true, state: `Erro HTTP ${res.status}`, instance, phone: null, profilePicUrl: null, count: 0, contactsCount: 0, chatsCount: 0 };
      }

      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : raw.value || [];
      const inst = list.find((i: any) => i.name === instance);

      if (!inst) {
        return { configured: true, state: 'Instância não criada', instance, phone: null, profilePicUrl: null, count: 0, contactsCount: 0, chatsCount: 0 };
      }

      const rawPhone = inst.ownerJid?.split('@')[0] || null;

      return {
        configured: true,
        state: inst.connectionStatus || 'close',
        instance: inst.name,
        phone: rawPhone ? formatPhone(rawPhone) : null,
        profilePicUrl: inst.profilePicUrl || null,
        count: inst._count?.Message || 0,
        contactsCount: inst._count?.Contact || 0,
        chatsCount: inst._count?.Chat || 0,
      };
    } catch (err: any) {
      return { configured: true, state: 'Inacessível', error: err.message, instance, phone: null, profilePicUrl: null, count: 0, contactsCount: 0, chatsCount: 0 };
    }
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
  .validator(z.object({
    instance: z.string().optional(),
    forceNew: z.boolean().optional(),
  }).optional())
  .handler(async ({ data, context }): Promise<EvolutionConnectResponse> => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = getEvolutionConfig(data?.instance);
    if (!key) {
      return { state: 'close', instance, error: 'Chave da Evolution API não configurada' };
    }

    try {
      // Se forceNew for solicitado, desconecta a sessão antes de pedir novo QR Code
      if (data?.forceNew) {
        await fetch(`${url}/instance/logout/${instance}`, {
          method: 'DELETE',
          headers: { apikey: key },
          signal: AbortSignal.timeout(6000),
        }).catch(() => null);
      }

      // 1. Tenta conectar na instância
      const connectRes = await fetch(`${url}/instance/connect/${instance}`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(8000),
      });

      if (connectRes.ok) {
        const json = await connectRes.json();
        if (json.instance?.state === 'open' || json.state === 'open') {
          return { state: 'open', instance };
        }
        const rawBase64 = json.base64 || json.qrcode?.base64;
        if (rawBase64) {
          const base64Img = rawBase64.startsWith('data:') ? rawBase64 : `data:image/png;base64,${rawBase64}`;
          return {
            state: 'connecting',
            base64: base64Img,
            code: json.code || json.qrcode?.code || null,
            pairingCode: json.pairingCode || json.qrcode?.pairingCode || null,
            count: json.count || json.qrcode?.count || 1,
            instance,
          };
        }
      }

      // 2. Se a instância não existir (404), cria automaticamente
      if (connectRes.status === 404 || !connectRes.ok) {
        const createRes = await fetch(`${url}/instance/create`, {
          method: 'POST',
          headers: { apikey: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceName: instance,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (createRes.ok) {
          const createJson = await createRes.json();
          const qrcode = createJson.qrcode;
          if (qrcode?.base64) {
            const base64Img = qrcode.base64.startsWith('data:') ? qrcode.base64 : `data:image/png;base64,${qrcode.base64}`;
            return {
              state: 'connecting',
              base64: base64Img,
              code: qrcode.code || null,
              pairingCode: qrcode.pairingCode || null,
              count: 1,
              instance,
            };
          }
        }
      }

      // 3. Fallback: verifica se já está open no fetchInstances
      const statusRes = await fetch(`${url}/instance/fetchInstances`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(6000),
      });
      if (statusRes.ok) {
        const raw = await statusRes.json();
        const list = Array.isArray(raw) ? raw : raw.value || [];
        const inst = list.find((i: any) => i.name === instance);
        if (inst?.connectionStatus === 'open') {
          return { state: 'open', instance };
        }
      }

      return { state: 'connecting', instance, error: 'Aguardando geração do QR Code pela Evolution API...' };
    } catch (err: any) {
      return { state: 'close', instance, error: err.message || 'Falha ao conectar à Evolution API' };
    }
  });

/**
 * Desconecta a sessão do WhatsApp na Evolution API.
 */
export const logoutEvolutionInstance = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    instance: z.string().optional(),
  }).optional())
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = getEvolutionConfig(data?.instance);
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
    instance: z.string().optional(),
  }).optional())
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = getEvolutionConfig(data?.instance);
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
  .validator(z.object({ instance: z.string().optional() }).optional())
  .handler(async ({ data, context }): Promise<EvolutionChat[]> => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = getEvolutionConfig(data?.instance);
    if (!key) return [];
    const lidToPhoneMap = new Map<string, string>();
    const phoneToLidMap = new Map<string, string>();

    try {
      const [chatsRes, contactsRes, groupsRes] = await Promise.all([
        fetch(`${url}/chat/findChats/${instance}`, {
          method: 'POST',
          headers: { apikey: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ where: {} }),
          signal: AbortSignal.timeout(12000),
        }).then(r => { if (!r.ok) throw new Error('Conversas indisponíveis'); return r.json(); }),

        fetch(`${url}/chat/findContacts/${instance}`, {
          method: 'POST',
          headers: { apikey: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ where: {} }),
          signal: AbortSignal.timeout(12000),
        }).then((r) => (r.ok ? r.json() : [])).catch(() => []),

        fetch(`${url}/group/fetchAllGroups/${instance}?getParticipants=false`, {
          headers: { apikey: key },
          signal: AbortSignal.timeout(12000),
        }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);

      const contacts = Array.isArray(contactsRes) ? contactsRes : [];
      const groups = Array.isArray(groupsRes) ? groupsRes : [];
      const chats = Array.isArray(chatsRes) ? chatsRes : [];

      const contactMap = new Map<string, any>();
      for (const c of contacts) {
        if (c.remoteJid) contactMap.set(c.remoteJid, c);
        const digits = (c.remoteJid || '').split('@')[0];
        if (digits) contactMap.set(digits, c);
      }

      const groupMap = new Map<string, any>();
      for (const g of groups) {
        if (g.id) groupMap.set(g.id, g);
      }

      // Aprende mapeamentos LID <-> Telefone das mensagens recentes
      for (const c of chats) {
        const k = c.lastMessage?.key;
        if (k?.remoteJid && k?.remoteJidAlt) {
          if (k.remoteJid.endsWith('@lid') && k.remoteJidAlt.endsWith('@s.whatsapp.net')) {
            lidToPhoneMap.set(k.remoteJid, k.remoteJidAlt);
            phoneToLidMap.set(k.remoteJidAlt, k.remoteJid);
          } else if (k.remoteJidAlt.endsWith('@lid') && k.remoteJid.endsWith('@s.whatsapp.net')) {
            lidToPhoneMap.set(k.remoteJidAlt, k.remoteJid);
            phoneToLidMap.set(k.remoteJid, k.remoteJidAlt);
          }
        }
      }

      const merged = new Map<string, EvolutionChat>();

      for (const c of chats) {
        if (!c.remoteJid || c.remoteJid === 'status@broadcast' || c.remoteJid.endsWith('@newsletter')) {
          continue;
        }

        const isGroup = c.remoteJid.endsWith('@g.us');
        const groupInfo = groupMap.get(c.remoteJid);
        const lastKey = c.lastMessage?.key;
        const mappedPhone = lidToPhoneMap.get(c.remoteJid);
        const altJid = mappedPhone || lastKey?.remoteJidAlt || lastKey?.participantAlt || '';
        const canonicalJid = (!isGroup && mappedPhone) ? mappedPhone : c.remoteJid;
        const rawPhone = altJid ? altJid.split('@')[0] : (canonicalJid.split('@')[0] || '');
        const contact = contactMap.get(canonicalJid) || contactMap.get(c.remoteJid) || (altJid ? contactMap.get(altJid) : null) || contactMap.get(rawPhone);

        let name = '';
        if (isGroup) {
          name = groupInfo?.subject || c.pushName || 'Grupo WhatsApp';
        } else {
          const candidates = [
            contact?.pushName,
            contact?.name,
            c.pushName,
            c.lastMessage?.pushName !== 'Você' ? c.lastMessage?.pushName : null,
          ].filter((n): n is string => Boolean(n && typeof n === 'string' && n.trim() && !/^\d{10,}$/.test(n.trim())));

          name = candidates[0] || (rawPhone ? formatPhone(rawPhone) : 'Contato');
        }

        const lastMsgText = extractMessageText(c.lastMessage?.message);
        const timestamp = c.lastMessage?.messageTimestamp
          ? Number(c.lastMessage.messageTimestamp) * 1000
          : c.updatedAt
          ? new Date(c.updatedAt).getTime()
          : Date.now();

        const avatar = contact?.profilePicUrl || c.profilePicUrl || null;
        const aliases = [c.remoteJid];
        if (mappedPhone && !aliases.includes(mappedPhone)) aliases.push(mappedPhone);
        if (altJid && !aliases.includes(altJid)) aliases.push(altJid);

        const item: EvolutionChat = {
          id: canonicalJid,
          remoteJid: canonicalJid,
          name,
          phone: isGroup ? 'Grupo' : formatPhone(rawPhone),
          unreadCount: c.unreadCount || 0,
          lastMessage: lastMsgText,
          timestamp,
          isGroup,
          avatar,
          aliases,
        };

        if (merged.has(canonicalJid)) {
          const old = merged.get(canonicalJid)!;
          if (item.timestamp >= old.timestamp) {
            merged.set(canonicalJid, {
              ...item,
              name: old.name && old.name !== old.phone ? old.name : item.name,
              unreadCount: (old.unreadCount || 0) + (item.unreadCount || 0),
              aliases: Array.from(new Set([...(old.aliases || []), ...(item.aliases || [])])),
            });
          } else {
            merged.set(canonicalJid, {
              ...old,
              unreadCount: (old.unreadCount || 0) + (item.unreadCount || 0),
              aliases: Array.from(new Set([...(old.aliases || []), ...(item.aliases || [])])),
            });
          }
        } else {
          merged.set(canonicalJid, item);
        }
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
  text: string;
  timestamp: string; // HH:mm
  date: string; // dd/mm
  mediaType?: "image" | "video" | "audio" | "document" | undefined;
  mediaUrl?: string | undefined;
  caption?: string | undefined;
  fileName?: string | undefined;
  reaction?: string | undefined;
  quotedText?: string | undefined;
  starred?: boolean | undefined;
};

/**
 * Busca as mensagens de uma conversa específica da Evolution API.
 */
export const getEvolutionMessages = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    remoteJid: z.string().min(1),
    instance: z.string().optional(),
  }))
  .handler(async ({ data, context }): Promise<EvolutionMessage[]> => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = getEvolutionConfig(data.instance);
    if (!key) return [];

    try {
      const aliases = [data.remoteJid];
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
      const seen = new Map<string, any>();
      for (const list of results) {
        for (const r of list) {
          const id = r.key?.id || r.id;
          if (id && !seen.has(id)) {
            seen.set(id, r);
          }
        }
      }

      const records = Array.from(seen.values()).sort(
        (a, b) => Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0)
      );

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

      return records.map((r: any) => {
        const text = extractMessageText(r.message);
        const d = r.messageTimestamp ? new Date(Number(r.messageTimestamp) * 1000) : new Date();
        const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const ddmm = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

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
          sender: r.key?.fromMe ? 'Você' : r.pushName || 'Cliente',
          text,
          timestamp: hhmm,
          date: ddmm,
          mediaType,
          mediaUrl,
          caption,
          fileName,
          quotedText,
        };
      });
    } catch (err) {
      console.error('[Evolution API] Falha ao buscar mensagens:', err);
      return [];
    }
  });

/**
 * Marca as mensagens de uma conversa como lidas na Evolution API.
 */
export const markEvolutionChatAsRead = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    remoteJid: z.string().min(1),
    instance: z.string().optional(),
  }))
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = getEvolutionConfig(data.instance);
    if (!key) return { success: false };

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
    instance: z.string().optional(),
  }))
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = getEvolutionConfig(data.instance);
    if (!key) throw new Error('Evolution API não configurada.');

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
    instance: z.string().optional(),
  }))
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = getEvolutionConfig(data.instance);
    if (!key) throw new Error('Evolution API não configurada.');

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
    instance: z.string().optional(),
  }))
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = getEvolutionConfig(data.instance);
    if (!key) throw new Error('Evolution API não configurada.');

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
    reaction: z.string().min(1),
    instance: z.string().optional(),
  }))
  .handler(async ({ data, context }) => {
    await requireLegacyIntegrationAdmin(context.supabase, context.userId);
    const { url, key, instance } = getEvolutionConfig(data.instance);
    if (!key) throw new Error('Evolution API não configurada.');

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

