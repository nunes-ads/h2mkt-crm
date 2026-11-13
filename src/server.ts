import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

const SUPABASE_FALLBACK_URL = "https://pecuiecphiowtdcmbjif.supabase.co";
const SUPABASE_FALLBACK_KEY = "sb_publishable_BNvgK9MJbtqprC9nNb5b6Q_J2q-EJiI";
const SUPABASE_FALLBACK_ID = "pecuiecphiowtdcmbjif";

function applyEnvDefaults(env?: unknown) {
  if (env && typeof env === "object") {
    for (const [key, val] of Object.entries(env)) {
      if (typeof val === "string" && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
  if (!process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL || SUPABASE_FALLBACK_URL;
  }
  if (!process.env.SUPABASE_PUBLISHABLE_KEY) {
    process.env.SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_FALLBACK_KEY;
  }
  if (!process.env.SUPABASE_PROJECT_ID) {
    process.env.SUPABASE_PROJECT_ID = process.env.VITE_SUPABASE_PROJECT_ID || SUPABASE_FALLBACK_ID;
  }
  if (!process.env.EVOLUTION_MVP_ADMIN_EMAILS) {
    process.env.EVOLUTION_MVP_ADMIN_EMAILS = "*";
  }
}

applyEnvDefaults();

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    applyEnvDefaults(env);
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
