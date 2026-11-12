import { useMemo, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { PageHead } from "@/components/pw";
import { Field, Modal, PwButton, Empty } from "@/components/omega-ui";
import {
  canAccess,
  type Contact,
  type ContactDraft,
  type CustomField,
  type Membership,
} from "@/lib/crm/contracts";
import {
  normalizeContact,
  previewImport,
  suggestMapping,
  emptyMapping,
  csvCell,
  type ImportMapping,
} from "@/lib/crm/contacts";
import {
  getCrmWorkspace,
  listCrmContacts,
  saveCrmContact,
  importCrmContacts,
  mergeCrmContacts,
  archiveCrmContact,
  updateCrmPrivacy,
  getCrmHistory,
  exportCrmContacts,
} from "@/lib/crm/crm.functions";
import { readSheet } from "@/lib/omega-planilha";

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";
const labels: Record<string, string> = {
  name: "Nome",
  phone: "Telefone",
  email: "E-mail",
  source: "Origem inicial",
  tags: "Etiquetas",
};
const emptyDraft: ContactDraft = {
  name: "",
  phone: "",
  email: "",
  source: "Desconhecida",
  tags: [],
  custom_fields: {},
};

function useRequestId() {
  const ref = useRef({ payload: "", id: "" });
  return (payload: unknown) => {
    const serialized = JSON.stringify(payload);
    if (serialized !== ref.current.payload)
      ref.current = { payload: serialized, id: crypto.randomUUID() };
    return ref.current.id;
  };
}

export function CrmContacts({ userId }: { userId: string }) {
  const load = useServerFn(getCrmWorkspace);
  const workspace = useQuery({
    queryKey: ["crm", userId, "workspace"],
    queryFn: () => load(),
    retry: false,
    staleTime: 0,
  });
  const [chosen, setChosen] = useState("");
  const memberships = workspace.data?.memberships ?? [];
  const member = memberships.find((m) => m.tenant_id === chosen) ?? memberships[0];
  const control = member ? (
    <select
      className="input select crm-account"
      aria-label="Organização autorizada"
      value={member.tenant_id}
      onChange={(e) => setChosen(e.target.value)}
    >
      {memberships.map((m) => (
        <option key={m.tenant_id} value={m.tenant_id}>
          {m.name}
        </option>
      ))}
    </select>
  ) : (
    <span className="pill is-warn">Organização pendente</span>
  );
  return (
    <AppShell crumb="Contatos" section="Vendas" accountControl={control}>
      <PageHead eyebrow="Relacionamento" title="Contatos" />
      {workspace.isPending ? (
        <p role="status">Verificando organizações autorizadas…</p>
      ) : workspace.error ? (
        <div className="card crm-notice" role="alert">
          <p>{errorText(workspace.error)}</p>
          <PwButton onClick={() => void workspace.refetch()}>Tentar novamente</PwButton>
        </div>
      ) : workspace.data?.state === "setup" ? (
        <div className="card crm-notice">
          <h2 className="t-h3">Cadastro operacional aguardando ativação</h2>
          <p>
            A base de organizações, vínculos e contatos precisa ser provisionada. Depois disso, este
            cadastro salvará os dados no servidor e aplicará as permissões da equipe.
          </p>
          <p className="t-caption">Nenhum cadastro foi criado ou importado nesta tela.</p>
          <PwButton onClick={() => void workspace.refetch()}>Verificar ativação</PwButton>
        </div>
      ) : !member ? (
        <div className="card crm-notice">
          <h2 className="t-h3">Sem organização vinculada</h2>
          <p>
            Um administrador precisa adicionar seu usuário a uma organização para liberar os
            contatos.
          </p>
          <PwButton onClick={() => void workspace.refetch()}>Atualizar acesso</PwButton>
        </div>
      ) : !canAccess(member, "contacts.read") ? (
        <Empty>Seu vínculo não permite consultar contatos.</Empty>
      ) : (
        <ContactDirectory key={`${userId}:${member.tenant_id}`} member={member} />
      )}
    </AppShell>
  );
}

function ContactDirectory({ member }: { member: Membership }) {
  const queryClient = useQueryClient();
  const list = useServerFn(listCrmContacts);
  const save = useServerFn(saveCrmContact);
  const merge = useServerFn(mergeCrmContacts);
  const archive = useServerFn(archiveCrmContact);
  const privacy = useServerFn(updateCrmPrivacy);
  const exportPage = useServerFn(exportCrmContacts);
  const requestId = useRequestId();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Contact[]>([]);
  const [editor, setEditor] = useState<Contact | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [history, setHistory] = useState<Contact | null>(null);
  const [action, setAction] = useState<{
    kind: "archive" | "privacy" | "merge";
    contact: Contact;
  } | null>(null);
  const [primaryId, setPrimaryId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const rootKey = ["crm", member.user_id, member.tenant_id, "contacts"];
  const input = { tenant_id: member.tenant_id, query, status, page, page_size: 25 };
  const result = useQuery({
    queryKey: [...rootKey, input],
    queryFn: () => list({ data: input }),
    retry: false,
  });
  const fields = result.data?.fields ?? [];
  const rows = result.data?.items ?? [];
  const refresh = async () => {
    setSelected([]);
    await queryClient.invalidateQueries({ queryKey: rootKey });
  };
  const startAction = (kind: "archive" | "privacy" | "merge", contact: Contact) => {
    setAction({ kind, contact });
    setPrimaryId(contact.id);
    setReason("");
    setError("");
  };

  async function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!action || busy) return;
    setBusy(true);
    setError("");
    try {
      const base = {
        tenant_id: member.tenant_id,
        id: action.contact.id,
        expected_version: action.contact.version,
        reason,
      };
      if (action.kind === "merge") {
        const primary = selected.find((c) => c.id === primaryId);
        const secondary = selected.find((c) => c.id !== primaryId);
        if (!primary || !secondary) throw new Error("Selecione dois contatos para mesclar.");
        const payload = {
          tenant_id: member.tenant_id,
          primary_id: primary.id,
          secondary_id: secondary.id,
          primary_version: primary.version,
          secondary_version: secondary.version,
          reason,
        };
        await merge({ data: { ...payload, request_id: requestId(payload) } });
      } else if (action.kind === "archive") {
        const payload = { ...base, archived: action.contact.status === "active" };
        await archive({ data: { ...payload, request_id: requestId(payload) } });
      } else {
        const payload = { ...base, marketing_opt_out: !action.contact.marketing_opt_out };
        await privacy({ data: { ...payload, request_id: requestId(payload) } });
      }
      await refresh();
      setAction(null);
      setNotice("Alteração salva e registrada no histórico.");
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setError("");
    try {
      const data = await exportPage({ data: { ...input, request_id: crypto.randomUUID() } });
      const csv = [
        ["Nome", "Telefone", "E-mail", "Origem", "Status"],
        ...data.items.map((c) => [c.name, c.phone, c.email, c.source, c.status]),
      ]
        .map((row) => row.map(csvCell).join(";"))
        .join("\r\n");
      const url = URL.createObjectURL(
        new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `contatos-pagina-${page}.csv`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`${data.items.length} contatos exportados. Exportação registrada na auditoria.`);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-directory om-stack">
      <p className="t-caption">
        {member.name} · Cadastro de pessoas e empresas. Atendimentos e oportunidades têm ciclos
        separados.
      </p>
      <div className="crm-toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
            setPage(1);
            setSelected([]);
          }}
          className="crm-search"
        >
          <input
            className="input"
            aria-label="Buscar nome, telefone ou e-mail"
            placeholder="Nome, telefone ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={160}
          />
          <PwButton type="submit">Buscar</PwButton>
        </form>
        <select
          aria-label="Situação dos contatos"
          className="input select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(1);
            setSelected([]);
          }}
        >
          <option value="active">Ativos</option>
          <option value="archived">Arquivados</option>
        </select>
        {canAccess(member, "contacts.write") && (
          <PwButton
            tone="primary"
            disabled={!result.data}
            onClick={() => {
              setError("");
              setEditor("new");
            }}
          >
            Novo contato
          </PwButton>
        )}
        {canAccess(member, "contacts.import") && (
          <PwButton disabled={!result.data} onClick={() => setImporting(true)}>
            Importar CSV / Excel
          </PwButton>
        )}
        {canAccess(member, "contacts.export") && (
          <PwButton
            disabled={busy || !rows.length || result.isFetching}
            onClick={() => void download()}
          >
            Exportar página
          </PwButton>
        )}
        {canAccess(member, "contacts.merge") && (
          <PwButton
            disabled={selected.length !== 2}
            onClick={() => startAction("merge", selected[0]!)}
          >
            Mesclar selecionados ({selected.length}/2)
          </PwButton>
        )}
      </div>
      {notice && (
        <p className="crm-notice" role="status">
          {notice}
        </p>
      )}
      {error && !action && (
        <p role="alert" className="crm-error">
          {error}
        </p>
      )}
      {result.error ? (
        <div role="alert">
          <p>{errorText(result.error)}</p>
          <PwButton onClick={() => void result.refetch()}>Atualizar lista</PwButton>
        </div>
      ) : result.isPending ? (
        <p role="status">Carregando contatos…</p>
      ) : (
        <>
          <div className="card pw-table-wrap">
            <table className="table">
              <caption className="sr-only">Contatos de {member.name}</caption>
              <thead>
                <tr>
                  <th>Selecionar</th>
                  <th>Contato</th>
                  <th>Telefone / e-mail</th>
                  <th>Origem inicial</th>
                  <th>Etiquetas</th>
                  <th>Marketing</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${contact.name}`}
                        checked={selected.some((c) => c.id === contact.id)}
                        disabled={
                          !canAccess(member, "contacts.merge", contact) ||
                          (selected.length === 2 && !selected.some((c) => c.id === contact.id))
                        }
                        onChange={(e) =>
                          setSelected((old) =>
                            e.target.checked
                              ? [...old, contact]
                              : old.filter((c) => c.id !== contact.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <b>{contact.name}</b>
                      <div className="t-caption">
                        {contact.status === "archived" ? "Arquivado" : "Ativo"}
                      </div>
                    </td>
                    <td>
                      {contact.phone || "Sem telefone"}
                      <div className="t-caption">{contact.email || "Sem e-mail"}</div>
                    </td>
                    <td>{contact.source}</td>
                    <td>
                      {contact.tags.map((tag) => (
                        <span key={tag} className="pill crm-tag">
                          {tag}
                        </span>
                      ))}
                    </td>
                    <td>
                      {contact.marketing_opt_out ? (
                        <span className="pill is-warn">Bloqueado</span>
                      ) : (
                        <span className="t-caption">Verificar finalidade antes de enviar</span>
                      )}
                    </td>
                    <td>
                      <div className="crm-row-actions">
                        {canAccess(member, "contacts.write", contact) && (
                          <PwButton
                            onClick={() => {
                              setError("");
                              setEditor(contact);
                            }}
                          >
                            Editar
                          </PwButton>
                        )}
                        {canAccess(member, "audit.read", contact) && (
                          <PwButton onClick={() => setHistory(contact)}>Histórico</PwButton>
                        )}
                        {canAccess(member, "contacts.archive", contact) && (
                          <PwButton onClick={() => startAction("archive", contact)}>
                            {contact.status === "active" ? "Arquivar" : "Restaurar"}
                          </PwButton>
                        )}
                        {canAccess(member, "contacts.privacy", contact) && (
                          <PwButton onClick={() => startAction("privacy", contact)}>
                            {contact.marketing_opt_out ? "Revisar bloqueio" : "Bloquear marketing"}
                          </PwButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={7}>
                      <Empty>Nenhum contato neste filtro.</Empty>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="crm-pagination">
            <span className="t-caption">
              {result.data?.total ?? 0} contatos · Página {page} de{" "}
              {Math.max(1, Math.ceil((result.data?.total ?? 0) / 25))}
            </span>
            <PwButton
              disabled={page <= 1 || result.isFetching}
              onClick={() => {
                setPage((p) => p - 1);
                setSelected([]);
              }}
            >
              Anterior
            </PwButton>
            <PwButton
              disabled={page * 25 >= (result.data?.total ?? 0) || result.isFetching}
              onClick={() => {
                setPage((p) => p + 1);
                setSelected([]);
              }}
            >
              Próxima
            </PwButton>
          </div>
        </>
      )}
      {editor && (
        <ContactEditor
          contact={editor === "new" ? null : editor}
          fields={fields}
          close={() => setEditor(null)}
          submit={async (draft, request_id) => {
            await save({
              data: {
                tenant_id: member.tenant_id,
                id: editor === "new" ? null : editor.id,
                expected_version: editor === "new" ? null : editor.version,
                contact: draft,
                request_id,
              },
            });
            await refresh();
            setEditor(null);
            setNotice("Contato salvo no servidor.");
          }}
        />
      )}
      {importing && (
        <ContactImport
          member={member}
          fields={fields}
          close={() => setImporting(false)}
          saved={refresh}
        />
      )}
      {history && (
        <ContactHistory member={member} contact={history} close={() => setHistory(null)} />
      )}
      {action && (
        <Modal
          title={
            action.kind === "merge"
              ? "Mesclar contatos"
              : action.kind === "privacy"
                ? "Preferência de marketing"
                : "Situação do cadastro"
          }
          close={() => {
            if (!busy) setAction(null);
          }}
        >
          <form className="om-stack" onSubmit={submitAction}>
            {action.kind === "merge" ? (
              <>
                <p>
                  O cadastro principal conserva seus dados e a origem inicial. Históricos e vínculos
                  serão reunidos; bloqueios de marketing serão preservados.
                </p>
                <Field label="Cadastro principal">
                  <select
                    className="input select"
                    value={primaryId}
                    onChange={(e) => setPrimaryId(e.target.value)}
                  >
                    {selected.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.phone || c.email} · {c.source}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <p>
                {action.contact.name}:{" "}
                {action.kind === "archive"
                  ? action.contact.status === "active"
                    ? "arquivar preserva o histórico e não encerra negócios."
                    : "o cadastro voltará à lista de ativos."
                  : action.contact.marketing_opt_out
                    ? "remover o bloqueio exige evidência de uma nova manifestação do contato. Isso não substitui as demais autorizações de envio."
                    : "novas ações de marketing devem respeitar este bloqueio."}
              </p>
            )}
            <Field
              label={action.kind === "privacy" ? "Motivo e referência da evidência" : "Motivo"}
            >
              <textarea
                className="input"
                required
                minLength={5}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            {error && (
              <p role="alert" className="crm-error">
                {error}
              </p>
            )}
            <PwButton type="submit" tone="primary" disabled={busy}>
              {busy ? "Salvando…" : "Confirmar alteração"}
            </PwButton>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ContactEditor({
  contact,
  fields,
  close,
  submit,
}: {
  contact: Contact | null;
  fields: CustomField[];
  close: () => void;
  submit: (draft: ContactDraft, requestId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ContactDraft>(() =>
    contact
      ? {
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          source: contact.source,
          tags: contact.tags,
          custom_fields: contact.custom_fields,
        }
      : emptyDraft,
  );
  const [tags, setTags] = useState(draft.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useRequestId();
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const value = {
        ...draft,
        tags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const normalized = normalizeContact(value, fields);
      const payload = { ...value, tags: normalized.tags };
      await submit(payload, id(payload));
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={contact ? "Editar contato" : "Novo contato"}
      close={() => {
        if (!busy) close();
      }}
    >
      <form className="om-stack" onSubmit={save}>
        <div className="crm-form-grid">
          {(["name", "phone", "email", "source"] as const).map((key) => (
            <Field key={key} label={labels[key]!}>
              <input
                className="input"
                required={key === "name"}
                type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                disabled={key === "source" && Boolean(contact)}
                value={draft[key]}
                maxLength={key === "name" || key === "source" ? 160 : key === "phone" ? 40 : 254}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        <Field label="Etiquetas separadas por vírgula">
          <input
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            maxLength={1500}
          />
        </Field>
        {fields.map((field) => (
          <Field key={field.key} label={`${field.label}${field.required ? " *" : ""}`}>
            {field.type === "select" || field.type === "boolean" ? (
              <select
                className="input select"
                required={field.required}
                value={String(draft.custom_fields[field.key] ?? "")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    custom_fields: {
                      ...draft.custom_fields,
                      [field.key]:
                        e.target.value === ""
                          ? null
                          : field.type === "boolean"
                            ? e.target.value === "true"
                            : e.target.value,
                    },
                  })
                }
              >
                <option value="">Selecione</option>
                {(field.type === "boolean" ? ["true", "false"] : field.options).map((option) => (
                  <option key={option} value={option}>
                    {field.type === "boolean" ? (option === "true" ? "Sim" : "Não") : option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                step="any"
                required={field.required}
                value={String(draft.custom_fields[field.key] ?? "")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    custom_fields: {
                      ...draft.custom_fields,
                      [field.key]:
                        e.target.value === ""
                          ? null
                          : field.type === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                    },
                  })
                }
              />
            )}
          </Field>
        ))}
        <p className="t-caption">
          Telefone brasileiro com DDD. Para outro país, use + e código do país. A origem inicial
          será preservada.
        </p>
        {error && (
          <p role="alert" className="crm-error">
            {error}
          </p>
        )}
        <PwButton type="submit" tone="primary" disabled={busy}>
          {busy ? "Salvando…" : "Salvar contato"}
        </PwButton>
      </form>
    </Modal>
  );
}

function ContactImport({
  member,
  fields,
  close,
  saved,
}: {
  member: Membership;
  fields: CustomField[];
  close: () => void;
  saved: () => Promise<void>;
}) {
  const runImport = useServerFn(importCrmContacts);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<ImportMapping>(emptyMapping);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Awaited<ReturnType<typeof runImport>> | null>(null);
  const requestId = useRequestId();
  const headers = Object.keys(rows[0] ?? {});
  const preview = useMemo(() => {
    try {
      return { rows: rows.length ? previewImport(rows, mapping, fields) : [], error: "" };
    } catch (error) {
      return { rows: [], error: errorText(error) };
    }
  }, [rows, mapping, fields]);
  const ready = preview.rows.filter((r) => r.status === "ready" && r.contact !== null);
  async function choose(file: File | undefined) {
    if (!file) return;
    setError("");
    setReport(null);
    setRows([]);
    setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("O limite por arquivo é 5 MB.");
      const data = await readSheet(file);
      if (!data.length || data.length > 500)
        throw new Error("Use um arquivo com 1 a 500 linhas de dados.");
      setRows(data);
      setMapping(suggestMapping(Object.keys(data[0]!)));
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (busy || !ready.length) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        tenant_id: member.tenant_id,
        rows: ready.map((row) => ({ row: row.row, contact: row.contact! })),
      };
      setReport(await runImport({ data: { ...payload, request_id: requestId(payload) } }));
      await saved();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Importar contatos"
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="om-stack">
        <p>
          Até 500 linhas e 5 MB. Duplicatas serão ignoradas sem sobrescrever contatos existentes.
        </p>
        <Field label="Arquivo CSV ou Excel">
          <input
            type="file"
            accept=".csv,.xlsx"
            disabled={busy}
            onChange={(e) => void choose(e.target.files?.[0])}
          />
        </Field>
        {!!rows.length && !report && (
          <>
            <div className="crm-form-grid">
              {Object.keys(mapping).map((key) => (
                <Field key={key} label={labels[key]!}>
                  <select
                    className="input select"
                    value={mapping[key as keyof ImportMapping]}
                    onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                  >
                    <option value="">Não importar</option>
                    {headers.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
            <p className="t-caption">
              {ready.length} prontas · {preview.rows.filter((r) => r.status === "duplicate").length}{" "}
              repetidas · {preview.rows.filter((r) => r.status === "invalid").length} inválidas
            </p>
            <div className="crm-import-preview pw-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Nome</th>
                    <th>Telefone</th>
                    <th>Validação</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      <td>{row.contact?.name || "—"}</td>
                      <td>{row.contact?.phone || "—"}</td>
                      <td>{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PwButton
              tone="primary"
              disabled={busy || !ready.length}
              onClick={() => void confirm()}
            >
              {busy ? "Importando…" : `Importar ${ready.length} linhas válidas`}
            </PwButton>
          </>
        )}
        {report && (
          <div role="status">
            <p>
              {report.created} criados · {report.skipped} duplicatas ignoradas ·{" "}
              {report.errors.length} erros
            </p>
            {report.errors.map((error, index) => (
              <p key={index}>
                Linha {error.row}: {error.message}
              </p>
            ))}
          </div>
        )}
        {(error || preview.error) && (
          <p role="alert" className="crm-error">
            {error || preview.error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function ContactHistory({
  member,
  contact,
  close,
}: {
  member: Membership;
  contact: Contact;
  close: () => void;
}) {
  const load = useServerFn(getCrmHistory);
  const result = useQuery({
    queryKey: ["crm", member.user_id, member.tenant_id, "history", contact.id, contact.version],
    queryFn: () => load({ data: { tenant_id: member.tenant_id, id: contact.id } }),
    retry: false,
  });
  return (
    <Modal title={`Histórico · ${contact.name}`} close={close}>
      {result.isPending ? (
        <p>Carregando…</p>
      ) : result.error ? (
        <p role="alert">{errorText(result.error)}</p>
      ) : (
        <div className="crm-history">
          {result.data?.map((event) => (
            <article key={event.id}>
              <b>{event.action}</b>
              <p className="t-caption">
                {event.actor_name} ·{" "}
                {new Date(event.occurred_at).toLocaleString("pt-BR", { timeZone: member.timezone })}
              </p>
              <p>{event.changed_fields.join(", ")}</p>
              {event.reason && <p>{event.reason}</p>}
            </article>
          ))}
          {!result.data?.length && <Empty>Sem eventos disponíveis.</Empty>}
        </div>
      )}
    </Modal>
  );
}
