import { defaultWhatsAppInstances } from "../whatsapp-connection";

export type EvolutionWebhookInfo = {
  instance: string;
  configured: boolean;
  url?: string;
  enabled?: boolean;
  events?: string[];
  error?: string;
};

function getWebhookTargetUrl(): string {
  if (process.env["EVOLUTION_WEBHOOK_URL"]) {
    return process.env["EVOLUTION_WEBHOOK_URL"];
  }
  // Se estiver em produção no Vercel
  if (process.env["VERCEL_URL"]) {
    return `https://${process.env["VERCEL_URL"]}/api/webhooks/evolution`;
  }
  // Em desenvolvimento local com Evolution no Docker:
  // O container Docker do Evolution precisa acessar o host Windows onde o Vite roda na 8081
  return "http://host.docker.internal:8081/api/webhooks/evolution";
}

function getWebhookSecrets(): Record<string, string> {
  try {
    return JSON.parse(process.env["EVOLUTION_LEAD_WEBHOOK_SECRETS"] || "{}");
  } catch {
    return {};
  }
}

export async function configureEvolutionWebhookForInstance(instanceName: string): Promise<EvolutionWebhookInfo> {
  const apiUrl = (process.env["EVOLUTION_API_URL"] || "http://localhost:18080").replace(/\/+$/, "");
  const apiKey = process.env["EVOLUTION_API_KEY"] || "";
  const targetUrl = getWebhookTargetUrl();
  const secrets = getWebhookSecrets();
  const secret = secrets[instanceName];

  if (!secret) {
    return {
      instance: instanceName,
      configured: false,
      error: `Segredo não configurado para a instância ${instanceName} em EVOLUTION_LEAD_WEBHOOK_SECRETS`,
    };
  }

  try {
    const res = await fetch(`${apiUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: targetUrl,
          events: ["MESSAGES_UPSERT"],
          webhook_by_events: false,
          headers: {
            Authorization: `Bearer ${secret}`,
          },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        instance: instanceName,
        configured: false,
        error: `Evolution API retornou status ${res.status}: ${errorText}`,
      };
    }

    const data = await res.json();
    return {
      instance: instanceName,
      configured: true,
      url: targetUrl,
      enabled: Boolean(data?.enabled ?? true),
      events: data?.events ?? ["MESSAGES_UPSERT"],
    };
  } catch (err) {
    return {
      instance: instanceName,
      configured: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

let lastEnsureTime = 0;
export async function ensureAllEvolutionWebhooks(): Promise<EvolutionWebhookInfo[]> {
  // Evita reconfigurar repetidamente em chamadas consecutivas rápidas (cooldown de 30 segundos)
  if (Date.now() - lastEnsureTime < 30000) {
    return [];
  }
  lastEnsureTime = Date.now();

  const secrets = getWebhookSecrets();
  const instances = Object.keys(secrets);

  // Também garante as instâncias padrão caso não constem expressamente nas chaves
  const targetInstances = new Set([
    ...instances,
    "teste-local--crm-1",
    defaultWhatsAppInstances["sub-asasul"],
  ]);

  const results: EvolutionWebhookInfo[] = [];
  for (const inst of targetInstances) {
    if (secrets[inst]) {
      const res = await configureEvolutionWebhookForInstance(inst);
      results.push(res);
    }
  }

  return results;
}
