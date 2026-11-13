// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = Boolean(process.env["VERCEL"] || process.env["VERCEL_ENV"] || process.env["NOW_BUILDER"]);

const nitroPreset = isVercel ? "vercel" : process.env["NITRO_PRESET"];

const SUPABASE_FALLBACK_URL = "https://pecuiecphiowtdcmbjif.supabase.co";
const SUPABASE_FALLBACK_KEY = "sb_publishable_BNvgK9MJbtqprC9nNb5b6Q_J2q-EJiI";
const SUPABASE_FALLBACK_ID = "pecuiecphiowtdcmbjif";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    ...(nitroPreset ? { preset: nitroPreset } : {}),
  },
  vite: {
    server: { allowedHosts: ["host.docker.internal"] },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || SUPABASE_FALLBACK_URL
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"] || SUPABASE_FALLBACK_KEY
      ),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
        process.env["VITE_SUPABASE_PROJECT_ID"] || process.env["SUPABASE_PROJECT_ID"] || SUPABASE_FALLBACK_ID
      ),
    },
  },
});
