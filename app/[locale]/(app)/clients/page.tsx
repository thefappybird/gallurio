import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "@/lib/i18n/navigation";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { listClients, getWorkspaceTags, getClientById } from "./_data/clients-queries";
import { ClientsPageClient } from "./_components/clients-page-client";
import type { ClientRow } from "./_components/clients-table";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.clients");
  return { title: t("title") };
}

type SearchParams = {
  q?: string;
  source?: string;
  tags?: string;
  page?: string;
  limit?: string;
  includeInactive?: string;
  client?: string;
};

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.clients");

  const { workspace } = await requireOrg();
  await connectDB();

  const sp = await searchParams;
  // parseInt("abc") → NaN, Math.max(1, NaN) → NaN; clamp explicitly so a
  // malformed `?page=` can't flow into Mongo's skip() as NaN.
  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const parsedLimit = Number.parseInt(sp.limit ?? "10", 10);
  const limit = PAGE_SIZE_OPTIONS.includes(parsedLimit) ? parsedLimit : 10;
  const tagFilter = sp.tags ? sp.tags.split(",").filter(Boolean) : undefined;

  const [{ items, total }, availableTags] = await Promise.all([
    listClients({
      workspaceId: workspace._id,
      q: sp.q,
      source: sp.source,
      tags: tagFilter,
      includeInactive: sp.includeInactive === "1",
      page,
      limit,
    }),
    getWorkspaceTags(workspace._id),
  ]);

  // If the requested page lies past the end of a non-empty result set (stale
  // bookmark, post-deactivate URL), redirect to the last valid page rather
  // than rendering an empty table that looks like a dead end.
  if (total > 0 && page > 1) {
    const totalPages = Math.ceil(total / limit);
    if (page > totalPages) {
      const next = new URLSearchParams();
      if (sp.q) next.set("q", sp.q);
      if (sp.source) next.set("source", sp.source);
      if (sp.tags) next.set("tags", sp.tags);
      if (sp.limit) next.set("limit", sp.limit);
      if (sp.includeInactive) next.set("includeInactive", sp.includeInactive);
      next.set("page", String(totalPages));
      redirect({
        href: {
          pathname: "/clients",
          query: Object.fromEntries(next.entries()),
        },
        locale,
      });
    }
  }

  function toClientRow(c: {
    _id: { toString(): string };
    name: string;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    tags?: unknown;
    notes?: unknown;
    totalSpent?: number | null;
    bookingsCount: number;
    lastBookingAt: Date | null;
    isActive?: boolean | null;
  }): ClientRow {
    return {
      id: c._id.toString(),
      name: c.name,
      email: c.email ?? null,
      phone: c.phone ?? null,
      source: c.source ?? "manual",
      tags: (c.tags as string[]) ?? [],
      notes: (c.notes as string) ?? "",
      totalSpent: c.totalSpent ?? 0,
      bookingsCount: c.bookingsCount,
      lastBookingAt: c.lastBookingAt,
      isActive: c.isActive ?? true,
      currency: workspace.currency ?? "PHP",
    };
  }

  const rows: ClientRow[] = items.map(toClientRow);

  // Deep-link: if ?client=<id> is present, fetch that client and auto-open its
  // detail modal. If the id is invalid or belongs to another workspace, strip
  // the param and redirect so the URL stays clean.
  let detailClient: ClientRow | null = null;
  if (sp.client) {
    const cleanParams = new URLSearchParams(
      (Object.entries(sp).filter(([k, v]) => k !== "client" && v !== undefined) as [string, string][])
    );
    const cleanQuery = Object.fromEntries(cleanParams.entries());

    let found: Awaited<ReturnType<typeof getClientById>> = null;
    try {
      found = await getClientById(workspace._id, sp.client);
    } catch (err) {
      // Unexpected error (e.g. transient DB failure) — log with context, then
      // treat as not-found and strip the stale param rather than crashing the
      // page. (redirect() below is outside this try, so NEXT_REDIRECT is never
      // swallowed here.)
      console.error("[clients] getClientById failed", {
        clientId: sp.client,
        workspaceId: String(workspace._id),
        err,
      });
      found = null;
    }
    if (found === null) {
      redirect({ href: { pathname: "/clients", query: cleanQuery }, locale });
    } else {
      detailClient = toClientRow(found);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <ClientsPageClient
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        locale={locale}
        availableTags={availableTags}
        empty={t("table.empty")}
        initialDetailClient={detailClient}
      />
    </div>
  );
}
