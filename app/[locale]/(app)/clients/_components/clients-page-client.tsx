"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ClientsToolbar } from "./clients-toolbar";
import { ClientsTable, type ClientRow } from "./clients-table";
import { ClientFormModal } from "./client-form-modal";
import { ClientDetailModal } from "./client-detail-modal";
import { DeactivateClientDialog } from "./deactivate-client-dialog";
import { reactivateClientAction } from "@/lib/actions/clients";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  rows: ClientRow[];
  total: number;
  page: number;
  limit: number;
  locale: string;
  availableTags: string[];
  empty: string;
};

export function ClientsPageClient({
  rows,
  total,
  page,
  limit,
  locale,
  availableTags,
  empty,
}: Props) {
  const t = useTranslations("app.clients");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClientRow | null>(null);
  const [detailClient, setDetailClient] = useState<ClientRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<ClientRow | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  function refreshPage() {
    const params = new URLSearchParams(searchParams.toString());
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    });
  }

  function openAdd() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(client: ClientRow) {
    setEditTarget(client);
    setFormOpen(true);
    setDetailOpen(false);
  }

  function openDetail(client: ClientRow) {
    setDetailClient(client);
    setDetailOpen(true);
  }

  function openDeactivate(client: ClientRow) {
    setDeactivateTarget(client);
    setDeactivateOpen(true);
    setDetailOpen(false);
  }

  async function handleReactivate(client: ClientRow) {
    const result = await reactivateClientAction(client.id);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(t("form.updateSuccess"));
      refreshPage();
    }
  }

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

      <ClientsTable
        rows={rows}
        locale={locale}
        empty={empty}
        onClickClient={openDetail}
        onEdit={openEdit}
        onDeactivate={openDeactivate}
        onReactivate={handleReactivate}
      />

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {t("pagination.showing", { from, to, total })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
            >
              {t("pagination.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
            >
              {t("pagination.next")}
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
      />

      <ClientDetailModal
        client={detailClient}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={openEdit}
        onDeactivate={openDeactivate}
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
