import { contactDraftSchema, type ContactDraft, type CustomField } from "./contracts";

/** Explicit + prefix for international numbers; local input uses Brazilian DDD. */
export function normalizePhone(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;
  if (!/^\+?[\d\s().-]+$/.test(input))
    throw new Error("Telefone inválido. Use DDD ou código internacional com +.");
  const digits = input.replace(/\D/g, "");
  if (input.startsWith("+")) {
    if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error("Telefone internacional inválido.");
    if (digits.startsWith("55") && !/^55[1-9]\d\d{8,9}$/.test(digits))
      throw new Error("Telefone brasileiro deve incluir DDD e 8 ou 9 dígitos.");
    return `+${digits}`;
  }
  if (/^[1-9]\d\d{8,9}$/.test(digits)) return `+55${digits}`;
  if (/^55[1-9]\d\d{8,9}$/.test(digits)) return `+${digits}`;
  throw new Error("Telefone inválido. Informe DDD; para outro país, comece com +.");
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  return email.toLowerCase();
}

export function normalizeContact(input: ContactDraft, fields: CustomField[] = []) {
  const draft = contactDraftSchema.parse(input);
  const allowed = new Map(fields.map((field) => [field.key, field]));
  for (const key of Object.keys(draft.custom_fields)) {
    if (!allowed.has(key)) throw new Error(`Campo personalizado não cadastrado: ${key}.`);
  }
  for (const field of fields) {
    const value = draft.custom_fields[field.key];
    const missing = value === undefined || value === null || value === "";
    if (missing) {
      if (field.required) throw new Error(`Preencha ${field.label}.`);
      continue;
    }
    const invalid =
      field.type === "number"
        ? typeof value !== "number" || !Number.isFinite(value)
        : field.type === "boolean"
          ? typeof value !== "boolean"
          : field.type === "select"
            ? typeof value !== "string" || !field.options.includes(value)
            : field.type === "date"
              ? typeof value !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
                Number.isNaN(Date.parse(value)) ||
                new Date(value).toISOString().slice(0, 10) !== value
              : typeof value !== "string";
    if (invalid) throw new Error(`Valor inválido para ${field.label}.`);
  }
  return {
    ...draft,
    source: draft.source || "Desconhecida",
    tags: [...new Map(draft.tags.map((tag) => [tag.toLocaleLowerCase("pt-BR"), tag])).values()],
    phone_normalized: normalizePhone(draft.phone),
    email_normalized: normalizeEmail(draft.email),
  };
}

export type ImportMapping = {
  name: string;
  phone: string;
  email: string;
  source: string;
  tags: string;
};
export type ImportPreview = {
  row: number;
  contact: ContactDraft | null;
  status: "ready" | "invalid" | "duplicate";
  message: string;
};
export const emptyMapping: ImportMapping = { name: "", phone: "", email: "", source: "", tags: "" };
export function suggestMapping(headers: string[]): ImportMapping {
  const aliases = {
    name: ["nome", "name", "cliente"],
    phone: ["telefone", "phone", "celular", "whatsapp"],
    email: ["email", "e-mail"],
    source: ["origem", "source"],
    tags: ["tags", "etiquetas"],
  };
  return Object.fromEntries(
    Object.entries(aliases).map(([key, options]) => [
      key,
      headers.find((h) => options.includes(h.toLowerCase().trim())) ?? "",
    ]),
  ) as ImportMapping;
}

/** All identifier conflicts remain explicit. Never merge by name or photo. */
export function previewImport(
  rows: Record<string, unknown>[],
  mapping: ImportMapping,
  fields: CustomField[] = [],
): ImportPreview[] {
  if (rows.length > 500) throw new Error("Importe até 500 linhas por lote.");
  if (!mapping.name) throw new Error("Mapeie a coluna de nome.");
  const identifiers = new Map<string, number>();
  return rows.map((row, index) => {
    const line = index + 2;
    try {
      const cell = (key: keyof ImportMapping) => String(row[mapping[key]] ?? "").trim();
      const draft = contactDraftSchema.parse({
        name: cell("name"),
        phone: cell("phone"),
        email: cell("email"),
        source: cell("source") || "Desconhecida",
        tags: cell("tags")
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter(Boolean),
      });
      const normalized = normalizeContact(draft, fields);
      const keys = [
        normalized.phone_normalized && `p:${normalized.phone_normalized}`,
        normalized.email_normalized && `e:${normalized.email_normalized}`,
      ].filter((v): v is string => Boolean(v));
      const conflict = keys.map((key) => identifiers.get(key)).find((row) => row !== undefined);
      // Track even conflicting rows: a later row must not bypass an earlier ambiguity.
      keys.forEach((key) => {
        if (!identifiers.has(key)) identifiers.set(key, line);
      });
      return {
        row: line,
        contact: draft,
        status: conflict === undefined ? "ready" : "duplicate",
        message:
          conflict === undefined
            ? "Pronto; duplicatas na organização serão verificadas no servidor."
            : `Identificador repetido na linha ${conflict}. Revisão necessária.`,
      };
    } catch (error) {
      return {
        row: line,
        contact: null,
        status: "invalid",
        message: error instanceof Error ? error.message : "Linha inválida.",
      };
    }
  });
}

export function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
