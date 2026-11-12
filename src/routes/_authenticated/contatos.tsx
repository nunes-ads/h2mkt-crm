import { createFileRoute } from "@tanstack/react-router";
import { CrmContacts } from "@/components/crm/CrmContacts";
import { meta } from "@/components/pw";
export const Route = createFileRoute("/_authenticated/contatos")({
  head: () => meta("Contatos", "Cadastro, importação e histórico de contatos por organização."),
  component: ContactsPage,
});
function ContactsPage() {
  const { user } = Route.useRouteContext();
  return <CrmContacts userId={user!.id} />;
}
