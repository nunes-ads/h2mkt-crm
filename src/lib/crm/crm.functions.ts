import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { crmRpc, CrmError, type RpcClient } from "./gateway";
import {
  workspaceSchema,
  listInput,
  pageSchema,
  saveInput,
  contactSchema,
  importInput,
  importResultSchema,
  mergeInput,
  archiveInput,
  privacyInput,
  historyInput,
  historySchema,
} from "./contracts";
import { normalizePhone, normalizeEmail } from "./contacts";

// Isolated adapter until Lovable regenerates the schema types. Responses are runtime validated.
const client = (value: unknown) => value as RpcClient;
async function verifiedCrmRpc<T extends z.ZodTypeAny>(
  supabase: SupabaseClient<Database>,
  userId: string,
  operation: string,
  payload: Record<string, unknown>,
  schema: T,
): Promise<z.output<T>> {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId || !data.user.email_confirmed_at)
    throw new Error("Acesso não autorizado. Confirme seu e-mail e entre novamente.");
  return crmRpc(client(supabase), operation, payload, schema);
}
export const getCrmWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.auth.getUser();
    if (error || !data.user?.email_confirmed_at)
      throw new Error("Confirme seu e-mail para acessar o CRM.");
    try {
      const workspace = await crmRpc(client(context.supabase), "workspace", {}, workspaceSchema);
      if (workspace.memberships.some((m) => m.user_id !== context.userId))
        throw new Error("Resposta de acesso inválida.");
      return {
        state: "ready" as const,
        memberships: workspace.memberships.filter((m) => m.active),
        message: "",
      };
    } catch (error) {
      if (error instanceof CrmError && error.code === "setup")
        return { state: "setup" as const, memberships: [], message: error.message };
      throw error;
    }
  });
export const listCrmContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(listInput)
  .handler(({ context, data }) =>
    verifiedCrmRpc(context.supabase, context.userId, "contacts.list", data, pageSchema),
  );
export const saveCrmContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(saveInput)
  .handler(({ context, data }) => {
    normalizePhone(data.contact.phone);
    normalizeEmail(data.contact.email);
    return verifiedCrmRpc(context.supabase, context.userId, "contacts.save", data, contactSchema);
  });
export const importCrmContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(importInput)
  .handler(({ context, data }) => {
    for (const row of data.rows) {
      normalizePhone(row.contact.phone);
      normalizeEmail(row.contact.email);
    }
    return verifiedCrmRpc(
      context.supabase,
      context.userId,
      "contacts.import",
      data,
      importResultSchema,
    );
  });
export const mergeCrmContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(mergeInput)
  .handler(({ context, data }) =>
    verifiedCrmRpc(context.supabase, context.userId, "contacts.merge", data, contactSchema),
  );
export const archiveCrmContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(archiveInput)
  .handler(({ context, data }) =>
    verifiedCrmRpc(context.supabase, context.userId, "contacts.archive", data, contactSchema),
  );
export const updateCrmPrivacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(privacyInput)
  .handler(({ context, data }) =>
    verifiedCrmRpc(context.supabase, context.userId, "contacts.privacy", data, contactSchema),
  );
export const getCrmHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(historyInput)
  .handler(({ context, data }) =>
    verifiedCrmRpc(context.supabase, context.userId, "contacts.history", data, historySchema),
  );
export const exportCrmContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(listInput.extend({ request_id: z.string().uuid() }).strict())
  .handler(({ context, data }) =>
    verifiedCrmRpc(context.supabase, context.userId, "contacts.export", data, pageSchema),
  );
