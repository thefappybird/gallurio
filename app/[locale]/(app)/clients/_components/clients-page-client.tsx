"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ClientsToolbar } from "./clients-toolbar";
import { ClientsTable, type ClientRow } from "./clients-table";
import { ClientFormModal } from "./client-form-modal";
import { ClientDetailModal } from "./client-detail-modal";
import { DeactivateClientDialog } from "./deactivate-client-dialog";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { reactivateClientAction } from "@/lib/actions/clients";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSizeSelect } from "@/components/app/page-size-select";
import { TableSkeleton } from "@/components/app/table-skeleton";
import { useGuardedAction } from "@/hooks/use-guarded-action";
import { useActionError } from "@/lib/i18n/actionError";

// ClientsTable has: name, contact, source, totalSpent, actions = 5 columns
const CLIENTS_TABLE_COLUMNS = 5;

type Props = {
  rows: ClientRow[];
  total: number;
  page: number;
  limit: number;
  locale: string;
  availableTags: string[];
  empty: string;
  /** Heading shown when the workspace has zero clients (no filters applied). */
  listEmpty: string;
  /** Guidance shown under `listEmpty`. */
  listEmptyHint: string;
  initialDetailClient?: ClientRow | null;
};

export function ClientsPageClient({
  rows,
  total,
  page,
  limit,
  locale,
  availableTags,
  empty,
  listEmpty,
  listEmptyHint,
  initialDetailClient = null,
}: Props) {
  const t = useTranslations("app.clients");
  const tc = useTranslations("common.pagination");
  const errMsg = useActionError();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Modal state. ?add=1 (e.g. dashboard quick-add) opens the add form on arrival.
  const [formOpen, setFormOpen] = useState(searchParams.get("add") === "1");
  const [editTarget, setEditTarget] = useState<ClientRow | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [pendingFormAction, setPendingFormAction] = useState<(() => void) | null>(null);
  const [detailClient, setDetailClient] = useState<ClientRow | null>(initialDetailClient);
  const [detailOpen, setDetailOpen] = useState<boolean>(!!initialDetailClient);
  const [deactivateTarget, setDeactivateTarget] = useState<ClientRow | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  // Open the detail modal whenever a ?client= deep-link arrives — including
  // soft navigations AFTER mount (browser Back/Forward, or a push to a
  // ?client= URL while /clients is already open), which don't re-run the
  // useState initializers above. The server emits a fresh initialDetailClient
  // object on every render that carries the param, so a reference change marks
  // a new deep-link to honor. This render-phase sync is React's recommended
  // alternative to a state-setting effect. When the param is stripped on close
  // the prop becomes null, so the modal is never re-opened.
  const [syncedDeepLink, setSyncedDeepLink] = useState(initialDetailClient);
  if (initialDetailClient !== syncedDeepLink) {
    setSyncedDeepLink(initialDetailClient);
    if (initialDetailClient) {
      setDetailClient(initialDetailClient);
      setDetailOpen(true);
    }
  }

  // The add form opens from ?add=1 via the formOpen initializer above; here we
  // just strip the param once so a refresh/back-navigation doesn't reopen it.
  useEffect(() => {
    if (searchParams.get("add") !== "1") return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("add");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    // Run once on mount for the incoming deep-link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshPage() {
    startTransition(() => {
      router.refresh();
    });
  }

  // Remove the ?client= param so closing the modal (or transitioning to
  // edit/deactivate) doesn't reopen it on a hard refresh or back-navigation.
  function stripClientParam() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("client")) return;
    params.delete("client");
    const qs = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      qs ? `${pathname}?${qs}` : pathname
    );
  }

  function setClientParam(clientId: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("client", clientId);
    const qs = params.toString();
    window.history.pushState(window.history.state, "", `${pathname}?${qs}`);
  }

  // If the form is open with unsaved edits, intercept the next action that
  // would change `editTarget` (e.g. opening another row) and surface the
  // unsaved-changes dialog instead of silently replacing the draft.
  function withFormGuard(next: () => void) {
    if (formOpen && formDirty) {
      setPendingFormAction(() => next);
      return;
    }
    next();
  }

  function openAdd() {
    withFormGuard(() => {
      setEditTarget(null);
      setFormOpen(true);
    });
  }

  function openEdit(client: ClientRow) {
    withFormGuard(() => {
      setEditTarget(client);
      setFormOpen(true);
      setDetailOpen(false);
      stripClientParam();
    });
  }

  function openDetail(client: ClientRow) {
    setDetailClient(client);
    setDetailOpen(true);
    setClientParam(client.id);
  }

  function returnToDetailFromEdit() {
    if (!editTarget) return;
    setFormOpen(false);
    setDetailClient(editTarget);
    setDetailOpen(true);
    setClientParam(editTarget.id);
  }

  function openDeactivate(client: ClientRow) {
    setDeactivateTarget(client);
    setDeactivateOpen(true);
    setDetailOpen(false);
    stripClientParam();
  }

  // Track the specific client being reactivated so only that row shows a
  // spinner / disabled state — a shared boolean would dim every inactive row.
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const { trigger: triggerReactivate } = useGuardedAction(
    async (client: ClientRow) => {
      setReactivatingId(client.id);
      const toastId = toast.loading(t("toasts.reactivating"));
      try {
        const result = await reactivateClientAction(client.id);
        if ("error" in result) {
          toast.error(errMsg(result.error), { id: toastId });
          return;
        }
        toast.success(t("form.updateSuccess"), { id: toastId });
        setDetailOpen(false);
        stripClientParam();
        refreshPage();
      } finally {
        setReactivatingId(null);
      }
    }
  );

  // Fire-and-forget: the guarded action handles its own errors via toast and
  // never rejects, so there is no rejection to await or catch here.
  function handleReactivate(client: ClientRow) {
    void triggerReactivate(client);
  }

  // True once any narrowing filter is active — distinguishes "no clients match
  // your filters" from a genuinely empty workspace (which gets a CTA instead).
  const hasFilters = Boolean(
    searchParams.get("q") || searchParams.get("source") || searchParams.get("tags")
  );

  // Pagination helpers
  const totalPages = Math.ceil(total / limit);
  const from = Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <>
      <ClientsToolbar availableTags={availableTags} onAddClient={openAdd} />

      {isPending ? (
        <TableSkeleton
          columns={CLIENTS_TABLE_COLUMNS}
          rows={limit}
          cardRows={Math.min(limit, 4)}
        />
      ) : (
        <ClientsTable
          rows={rows}
          locale={locale}
          empty={hasFilters ? empty : listEmpty}
          emptyHint={hasFilters ? undefined : listEmptyHint}
          emptyAction={
            hasFilters ? undefined : (
              <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90" onClick={openAdd}>
                <PlusIcon className="size-4" />
                {t("toolbar.add")}
              </Button>
            )
          }
          onClickClient={openDetail}
          onView={openDetail}
          onEdit={openEdit}
          onDeactivate={openDeactivate}
          onReactivate={handleReactivate}
          reactivatingId={reactivatingId}
        />
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {tc("showing", { from, to, total })}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <PageSizeSelect value={limit} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="min-h-11 sm:min-h-0"
            >
              {tc("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="min-h-11 sm:min-h-0"
            >
              {tc("next")}
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <ClientFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editTarget ?? undefined}
        onSuccess={refreshPage}
        onDirtyChange={setFormDirty}
        onView={editTarget ? returnToDetailFromEdit : undefined}
      />

      <UnsavedChangesDialog
        open={pendingFormAction !== null}
        onKeepEditing={() => setPendingFormAction(null)}
        onDiscard={() => {
          const next = pendingFormAction;
          setPendingFormAction(null);
          setFormDirty(false);
          setFormOpen(false);
          // Defer the queued action until after the form has closed so its
          // reset effect doesn't overwrite the new target.
          if (next) setTimeout(next, 0);
        }}
      />

      <ClientDetailModal
        client={detailClient}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          stripClientParam();
        }}
        onEdit={openEdit}
        onDeactivate={openDeactivate}
        onReactivate={handleReactivate}
        reactivatingId={reactivatingId}
        locale={locale}
      />

      {deactivateTarget && (
        <DeactivateClientDialog
          clientId={deactivateTarget.id}
          clientName={deactivateTarget.name}
          open={deactivateOpen}
          onOpenChange={setDeactivateOpen}
          onSuccess={refreshPage}
        />
      )}
    </>
  );
}
