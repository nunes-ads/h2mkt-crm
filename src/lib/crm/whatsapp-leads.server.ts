import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { whatsappPhoneJid } from "../whatsapp-history";
import { whatsappName } from "../whatsapp-profiles";
import { whatsappTimestamp } from "../whatsapp-time";
import { uuid } from "./contracts";
import { saveLocalPilotLead } from "./pilot-store.server";

const instanceName = z.string().regex(/^[\w-]{1,100}$/);
const endpointConfig = z.record(instanceName, z.string().regex(/^[\w-]{32,200}$/));
const envelope = z.object({
  instance: instanceName,
  event: z.string().max(80),
  data: z.unknown(),
});
const message = z.object({
  key: z.object({
    id: z.string().regex(/^[\w:+.=-]{1,200}$/),
    remoteJid: z.string().max(100),
    remoteJidAlt: z.string().max(100).optional(),
    fromMe: z.literal(false),
  }),
  pushName: z.string().max(512).nullish(),
  messageTimestamp: z.unknown(),
  message: z.record(z.unknown()),
});
const writeResult = z.object({
  contact_id: uuid,
  lead_id: uuid.nullable(),
});
const maxBytes = 256 * 1024;
const contentTypes = new Set([
  "conversation", "extendedTextMessage", "imageMessage", "videoMessage", "audioMessage",
  "documentMessage", "stickerMessage", "contactMessage", "contactsArrayMessage", "locationMessage",
  "liveLocationMessage", "interactiveResponseMessage", "buttonsResponseMessage", "listResponseMessage",
  "templateButtonReplyMessage", "pollCreationMessage", "pollCreationMessageV2", "pollCreationMessageV3",
]);
const wrappers = [
  "ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
];

function hasCustomerContent(value: Record<string, unknown>) {
  let content = value;
  for (let depth = 0; depth < 5; depth++) {
    if (Object.keys(content).some(key => contentTypes.has(key) && content[key] != null)) return true;
    const wrapper = wrappers.find(key => key in content);
    if (!wrapper) break;
    const inner = z.object({ message: z.record(z.unknown()) }).safeParse(content[wrapper]);
    if (!inner.success) break;
    content = inner.data.message;
  }
  return false;
}

function lidJid(jid: string | undefined) {
  return jid?.match(/^(\d{1,24})(?::\d+)?@lid$/)?.[1];
}

function capture(value: unknown) {
  const parsed = message.safeParse(value);
  if (!parsed.success || !hasCustomerContent(parsed.data.message)) return null;
  const { key, pushName, messageTimestamp } = parsed.data;
  const primaryPhone = whatsappPhoneJid(key.remoteJid);
  const primaryLid = lidJid(key.remoteJid);
  if (!primaryPhone && !primaryLid) return null;
  const altPhone = whatsappPhoneJid(key.remoteJidAlt);
  const altLid = lidJid(key.remoteJidAlt);
  const phone = primaryPhone ?? altPhone;
  const lid = primaryLid ?? altLid;
  const timestamp = whatsappTimestamp(messageTimestamp);
  return {
    message_id: key.id,
    phone: phone ? `+${phone.split("@")[0]}` : null,
    lid: lid ? `${lid}@lid` : null,
    name: Array.from(whatsappName(pushName)).slice(0, 160).join("") || null,
    sent_at: timestamp ? new Date(timestamp).toISOString() : null,
  };
}

export type Capture = NonNullable<ReturnType<typeof capture>>;
export type StoreLead = (instance: string, data: Capture) => Promise<void>;
const rpcName = "crm_capture_whatsapp_lead_v1";

const saveLead: StoreLead = async (instance, data) => {
  const token = process.env["SUPABASE_WHATSAPP_CAPTURE_TOKEN"];
  let supabaseSuccess = false;

  if (token) {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (url && key && /^[a-f0-9]{64}$/.test(token)) {
      try {
        const result = await fetch(new URL("/rest/v1/rpc/crm_capture_whatsapp_pilot_v1", url), {
          method: "POST",
          headers: { apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify({ p_instance: instance, p_event: data, p_token: token }),
          signal: AbortSignal.timeout(8000),
        });
        if (result.ok && writeResult.safeParse(await result.json()).success) {
          supabaseSuccess = true;
        }
      } catch (err) {
        console.warn("[whatsapp-leads] Tentativa Supabase pilot_v1 falhou:", err);
      }
    }
  }

  if (!supabaseSuccess) {
    try {
      const db = supabaseAdmin as unknown as {
        rpc: (name: typeof rpcName, input: { p_instance: string; p_event: Capture }) =>
          PromiseLike<{ data: unknown; error: unknown }>;
      };
      const result = await db.rpc(rpcName, { p_instance: instance, p_event: data });
      if (!result.error && writeResult.safeParse(result.data).success) {
        supabaseSuccess = true;
      }
    } catch {
      // Ignora erro no client admin quando não configurado
    }
  }

  // Sempre grava no repositório persistente local de leads para garantir
  // disponibilidade instantânea no painel/contatos, mesmo se o Supabase ainda estiver em setup.
  await saveLocalPilotLead(instance, data);
};

async function readPayload(request: Request) {
  if (!request.body) throw new Error("Corpo ausente");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let length = 0;
  let content = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) return { tooLarge: true } as const;
      content += decoder.decode(value, { stream: true });
    }
    return { payload: JSON.parse(content + decoder.decode()) as unknown };
  } finally {
    if (length > maxBytes) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function sameSecret(a: string, b: string) {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}

const reply = (status: number, code: string) =>
  Response.json({ status: code }, { status, headers: { "Cache-Control": "no-store" } });

export async function receiveWhatsAppLead(
  request: Request,
  rawConfig = process.env["EVOLUTION_LEAD_WEBHOOK_SECRETS"],
  persist: StoreLead = saveLead,
) {
  if (request.method !== "POST") return reply(405, "method_not_allowed");
  let secrets: Record<string, string>;
  try {
    secrets = endpointConfig.parse(JSON.parse(rawConfig ?? "{}"));
  } catch {
    return reply(503, "not_configured");
  }
  if (!Object.keys(secrets).length) return reply(503, "not_configured");
  const token = /^Bearer ([\w-]{32,200})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token || !Object.values(secrets).some(secret => sameSecret(secret, token)))
    return reply(401, "unauthorized");
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? ""))
    return reply(415, "unsupported_type");
  if (Number(request.headers.get("content-length")) > maxBytes) return reply(413, "too_large");
  let event;
  try {
    const result = await readPayload(request);
    if ("tooLarge" in result) return reply(413, "too_large");
    event = envelope.parse(result.payload);
  } catch {
    return reply(400, "invalid_payload");
  }
  if (!Object.hasOwn(secrets, event.instance) || !sameSecret(secrets[event.instance]!, token))
    return reply(401, "unauthorized");
  if (event.event.toLowerCase().replace(/_/g, ".") !== "messages.upsert") return reply(200, "ignored");
  const rawData = (event.data as Record<string, unknown> | unknown[]) ?? {};
  const records = Array.isArray(rawData)
    ? rawData
    : Array.isArray((rawData as any)?.messages)
      ? (rawData as any).messages
      : [rawData];
  if (!records.length || records.length > 50) return reply(400, "invalid_batch");
  const captures = records.map(capture).filter((item): item is Capture => item !== null);
  if (!captures.length) return reply(200, "ignored");
  try {
    for (const item of captures) await persist(event.instance, item);
  } catch {
    console.error("[whatsapp-leads] Falha ao gravar evento autenticado.");
    return reply(503, "storage_unavailable");
  }
  return reply(200, "accepted");
}
