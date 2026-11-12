import { z } from "zod";

export const permissions = [
  "contacts.read",
  "contacts.write",
  "contacts.import",
  "contacts.merge",
  "contacts.archive",
  "contacts.export",
  "contacts.privacy",
  "audit.read",
  "channels.read",
  "channels.send",
  "ai.suggest",
] as const;
export const permissionSchema = z.enum(permissions);
export type Permission = z.infer<typeof permissionSchema>;
export const uuid = z.string().uuid();
export const timestamp = z.string().datetime({ offset: true });
export const membershipSchema = z.object({
  tenant_id: uuid,
  name: z.string(),
  user_id: uuid,
  role: z.enum(["admin", "supervisor", "agent", "analyst", "integration"]),
  active: z.boolean(),
  scope: z.enum(["own", "team", "organization"]),
  team_ids: z.array(uuid),
  permissions: z.array(permissionSchema),
  timezone: z.string(),
  currency: z.string().length(3),
});
export type Membership = z.infer<typeof membershipSchema>;
export const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/),
  label: z.string().min(1).max(80),
  type: z.enum(["text", "number", "boolean", "date", "select"]),
  required: z.boolean(),
  options: z.array(z.string()).default([]),
});
export type CustomField = z.infer<typeof fieldSchema>;
export const customValue = z.union([
  z.string().max(1000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
export const contactDraftSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome.").max(160),
    phone: z.string().trim().max(40).default(""),
    email: z.string().trim().max(254).default(""),
    source: z.string().trim().max(160).default("Desconhecida"),
    tags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
    custom_fields: z.record(customValue).default({}),
  })
  .strict();
export type ContactDraft = z.infer<typeof contactDraftSchema>;
export const contactSchema = contactDraftSchema.extend({
  id: uuid,
  tenant_id: uuid,
  owner_id: uuid.nullable(),
  team_id: uuid.nullable(),
  phone_normalized: z.string().nullable(),
  email_normalized: z.string().nullable(),
  status: z.enum(["active", "archived", "merged", "anonymized"]),
  marketing_opt_out: z.boolean(),
  version: z.number().int().positive(),
  created_at: timestamp,
  updated_at: timestamp,
});
export type Contact = z.infer<typeof contactSchema>;
export const workspaceSchema = z.object({
  version: z.literal(1),
  memberships: z.array(membershipSchema),
});
export const pageSchema = z.object({
  items: z.array(contactSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive().max(100),
  fields: z.array(fieldSchema),
});
export const historySchema = z.array(
  z.object({
    id: uuid,
    action: z.string(),
    actor_name: z.string(),
    occurred_at: timestamp,
    changed_fields: z.array(z.string()),
    reason: z.string().nullable(),
  }),
);
export const importResultSchema = z.object({
  created: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  errors: z.array(z.object({ row: z.number().int(), message: z.string() })),
});
const tenant = z.object({ tenant_id: uuid });
const mutation = tenant.extend({ request_id: uuid });
export const listInput = tenant
  .extend({
    query: z.string().trim().max(160).default(""),
    status: z.enum(["active", "archived"]).default("active"),
    page: z.number().int().positive().max(100000).default(1),
    page_size: z.number().int().positive().max(100).default(25),
  })
  .strict();
export const saveInput = mutation
  .extend({
    id: uuid.nullable(),
    expected_version: z.number().int().positive().nullable(),
    contact: contactDraftSchema,
  })
  .strict()
  .refine(
    (d) => (d.id === null) === (d.expected_version === null),
    "Informe a versão do contato que está editando.",
  );
export const importInput = mutation
  .extend({
    rows: z
      .array(z.object({ row: z.number().int().min(2), contact: contactDraftSchema }).strict())
      .min(1)
      .max(500),
  })
  .strict();
export const mergeInput = mutation
  .extend({
    primary_id: uuid,
    secondary_id: uuid,
    primary_version: z.number().int().positive(),
    secondary_version: z.number().int().positive(),
    reason: z.string().trim().min(5).max(500),
  })
  .strict()
  .refine((d) => d.primary_id !== d.secondary_id, "Escolha dois contatos diferentes.");
export const archiveInput = mutation
  .extend({
    id: uuid,
    expected_version: z.number().int().positive(),
    archived: z.boolean(),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
export const privacyInput = mutation
  .extend({
    id: uuid,
    expected_version: z.number().int().positive(),
    marketing_opt_out: z.boolean(),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
export const historyInput = tenant.extend({ id: uuid }).strict();

/** UI hints only. The database must repeat authorization using auth.uid(). */
export function canAccess(
  membership: Membership | undefined,
  permission: Permission,
  record?: { tenant_id: string; owner_id: string | null; team_id: string | null },
) {
  if (!membership?.active || !membership.permissions.includes(permission)) return false;
  if (!record) return true;
  if (membership.tenant_id !== record.tenant_id) return false;
  if (membership.scope === "organization") return true;
  if (record.owner_id === membership.user_id) return true;
  return (
    membership.scope === "team" &&
    record.team_id !== null &&
    membership.team_ids.includes(record.team_id)
  );
}
