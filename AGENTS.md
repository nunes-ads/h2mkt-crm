<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Visual system is Pitwall: src/styles/pitwall-ds.css is the DS copy (source of truth, don't edit); module additions go only in src/styles/pitwall.css with a module prefix; shadcn tokens in src/styles.css only bridge to Pitwall vars. Why: one source of truth for color/typography.
- Theme is html[data-theme] + .dark via src/lib/tema.ts (dark default, localStorage "omega-tema"). Why: matches the user's original app; no second theme mechanism.
- Prototype-only state uses omega-local and shared omega-demo data, never credentials or access enforcement. Why: configuration previews must not imply live integrations or actual authorization.
- Native Pitwall controls for the continued modules live in omega-ui and use om-prefixed styles. Why: preserve the existing design system instead of introducing a parallel visual layer.
- Inbox links use the optional conversa search parameter and shared local deal data. Why: pipeline, appointments and proposals must open the same contact and reflect local stage edits.
- Catalog and agent rules are copied from the original attachment into dedicated data modules; spreadsheet parsing stays browser-side. Why: preserve reference values without introducing server work during the structure phase.
- App pages live under the pathless authenticated layout; public auth and recovery pages remain outside. Why: a verified session must precede every CRM screen.
- Profiles store personal fields and preferences; privileges live only in server-controlled user_roles. Why: profile editing must never grant permissions.
- Public email signup requires confirmation and never assigns privileged roles; the existing identity trigger creates the profile. Why: self-service account creation is not administrator provisioning.
- Provider status is read server-side and distinguishes configured credentials from verified connectivity. Why: a saved setting is not a successful integration.
- The voice workspace is shared by /ligacoes and /voz, with focused agent and campaign editors; reference calls and local drafts are explicitly separated from live provider actions. Why: preserve the updated prototype without implying connected telephony.
