import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Inbox } from "@/components/inbox/Inbox";

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (search: Record<string, unknown>): { conversa?: string } => typeof search['conversa'] === 'string' ? { conversa: search['conversa'] } : {},
  head: () => ({
    meta: [
      { title: "Inbox · CRM Grupo Ômega" },
      { name: "description", content: "Conversas de WhatsApp das lojas Ômega com o Hudson e a equipe de atendimento." },
      { property: "og:title", content: "Inbox · CRM Grupo Ômega" },
      { property: "og:description", content: "Conversas de WhatsApp das lojas Ômega com o Hudson e a equipe de atendimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { conversa } = Route.useSearch();
  return (
    <AppShell crumb="Inbox" section="Atendimento">
      <Inbox key={conversa ?? 'inbox'} {...(conversa ? { initialId: conversa } : {})} />
    </AppShell>
  );
}
