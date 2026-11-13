import fs from "node:fs";
import path from "node:path";
import { type Contact, type ContactDraft } from "./contracts";

export const PILOT_TENANTS = {
  matriz: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Grupo Ômega (Matriz)",
    instances: ["teste-local--crm-1", "teste-local", "matriz"],
  },
  "sub-asasul": {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Ômega Asa Sul (Franquia)",
    instances: ["franquia-asasul", "sub-asasul"],
  },
} as const;

export type PilotContactRecord = Contact & {
  instance?: string;
  lid?: string | null;
  last_message_id?: string;
  entered_at?: string;
};

type PilotStoreData = {
  contacts: Record<string, PilotContactRecord>; // keyed by id
  processed_messages: Record<string, { contact_id: string; ingested_at: string }>;
};

const storeFile = path.resolve(process.cwd(), ".output", "pilot-crm-data.json");

let memoryStore: PilotStoreData | null = null;

function loadStore(): PilotStoreData {
  if (memoryStore) return memoryStore;
  try {
    if (fs.existsSync(storeFile)) {
      const raw = fs.readFileSync(storeFile, "utf-8");
      memoryStore = JSON.parse(raw) as PilotStoreData;
      return memoryStore;
    }
  } catch (err) {
    console.warn("[pilot-store] Não foi possível ler o arquivo de dados piloto:", err);
  }
  memoryStore = {
    contacts: {},
    processed_messages: {},
  };
  return memoryStore;
}

function persistStore(data: PilotStoreData) {
  memoryStore = data;
  try {
    const dir = path.dirname(storeFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storeFile, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("[pilot-store] Não foi possível salvar o arquivo de dados piloto:", err);
  }
}

export function resolveTenantForInstance(instance: string): { id: string; name: string } {
  if (instance === "franquia-asasul" || instance === "sub-asasul") {
    return { id: PILOT_TENANTS["sub-asasul"].id, name: PILOT_TENANTS["sub-asasul"].name };
  }
  return { id: PILOT_TENANTS.matriz.id, name: PILOT_TENANTS.matriz.name };
}

export async function saveLocalPilotLead(
  instance: string,
  event: {
    message_id: string;
    phone: string | null;
    lid: string | null;
    name: string | null;
    sent_at: string | null;
  },
): Promise<{ contact_id: string; lead_id: string }> {
  const store = loadStore();
  const tenant = resolveTenantForInstance(instance);
  const now = new Date().toISOString();
  const occurred = event.sent_at || now;

  // Idempotência por mensagem
  const messageKey = `${tenant.id}:${instance}:${event.message_id}`;
  if (store.processed_messages[messageKey]) {
    const existingContactId = store.processed_messages[messageKey].contact_id;
    return { contact_id: existingContactId, lead_id: existingContactId };
  }

  // Localizar contato existente pelo telefone ou lid dentro da mesma organização
  const existing = Object.values(store.contacts).find((c) => {
    if (c.tenant_id !== tenant.id) return false;
    if (event.phone && (c.phone_normalized === event.phone || c.phone === event.phone)) return true;
    if (event.lid && c.lid === event.lid) return true;
    return false;
  });

  let contactId: string;

  if (existing) {
    contactId = existing.id;
    existing.updated_at = now;
    existing.last_message_id = event.message_id;
    if (event.name && (!existing.name || existing.name === "Contato WhatsApp" || existing.name === existing.phone)) {
      existing.name = event.name;
    }
    if (event.phone && !existing.phone) {
      existing.phone = event.phone;
      existing.phone_normalized = event.phone;
    }
    if (event.lid && !existing.lid) {
      existing.lid = event.lid;
    }
    store.contacts[contactId] = existing;
  } else {
    contactId = crypto.randomUUID();
    const displayName = event.name || event.phone || "Contato WhatsApp";
    const newContact: PilotContactRecord = {
      id: contactId,
      tenant_id: tenant.id,
      owner_id: null,
      team_id: null,
      name: displayName,
      phone: event.phone || "",
      phone_normalized: event.phone,
      email: "",
      email_normalized: null,
      source: "WhatsApp",
      tags: ["lead-whatsapp"],
      custom_fields: {},
      status: "active",
      marketing_opt_out: false,
      version: 1,
      created_at: occurred,
      updated_at: now,
      instance,
      lid: event.lid,
      last_message_id: event.message_id,
      entered_at: occurred,
    };
    store.contacts[contactId] = newContact;
  }

  store.processed_messages[messageKey] = {
    contact_id: contactId,
    ingested_at: now,
  };

  persistStore(store);
  return { contact_id: contactId, lead_id: contactId };
}

export function getLocalPilotContacts(
  tenantId: string,
  query = "",
  status: "active" | "archived" = "active",
  page = 1,
  pageSize = 25,
) {
  const store = loadStore();
  const search = query.trim().toLowerCase();

  const all = Object.values(store.contacts).filter((c) => {
    if (c.tenant_id !== tenantId) return false;
    if (c.status !== status) return false;
    if (!search) return true;
    return (
      c.name.toLowerCase().includes(search) ||
      (c.phone && c.phone.includes(search)) ||
      (c.phone_normalized && c.phone_normalized.includes(search))
    );
  });

  // Ordena pelos mais recentes
  all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const total = all.length;
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize).map((c) => ({
    id: c.id,
    tenant_id: c.tenant_id,
    owner_id: c.owner_id,
    team_id: c.team_id,
    name: c.name,
    phone: c.phone,
    phone_normalized: c.phone_normalized,
    email: c.email,
    email_normalized: c.email_normalized,
    source: c.source,
    tags: c.tags,
    custom_fields: c.custom_fields,
    status: c.status,
    marketing_opt_out: c.marketing_opt_out,
    version: c.version,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  return {
    items,
    total,
    page,
    page_size: pageSize,
    fields: [],
  };
}

export function saveLocalPilotContact(
  tenantId: string,
  id: string | null,
  draft: ContactDraft,
): Contact {
  const store = loadStore();
  const now = new Date().toISOString();
  const contactId = id || crypto.randomUUID();

  const existing = id ? store.contacts[id] : undefined;

  const contact: PilotContactRecord = {
    id: contactId,
    tenant_id: tenantId,
    owner_id: existing?.owner_id ?? null,
    team_id: existing?.team_id ?? null,
    name: draft.name,
    phone: draft.phone,
    phone_normalized: draft.phone ? (draft.phone.startsWith("+") ? draft.phone : `+55${draft.phone.replace(/\D/g, "")}`) : null,
    email: draft.email,
    email_normalized: draft.email ? draft.email.toLowerCase().trim() : null,
    source: draft.source || "Manual",
    tags: draft.tags || [],
    custom_fields: draft.custom_fields || {},
    status: existing?.status ?? "active",
    marketing_opt_out: existing?.marketing_opt_out ?? false,
    version: (existing?.version ?? 0) + 1,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  store.contacts[contactId] = contact;
  persistStore(store);

  return {
    id: contact.id,
    tenant_id: contact.tenant_id,
    owner_id: contact.owner_id,
    team_id: contact.team_id,
    name: contact.name,
    phone: contact.phone,
    phone_normalized: contact.phone_normalized,
    email: contact.email,
    email_normalized: contact.email_normalized,
    source: contact.source,
    tags: contact.tags,
    custom_fields: contact.custom_fields,
    status: contact.status,
    marketing_opt_out: contact.marketing_opt_out,
    version: contact.version,
    created_at: contact.created_at,
    updated_at: contact.updated_at,
  };
}

