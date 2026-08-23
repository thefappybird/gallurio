import type { ContentEntry, ContentKind } from "@/lib/content/entries";
import { Link } from "@/lib/i18n/navigation";
import { estimateReadingTime } from "./article-chrome";
import { formatContentDate } from "./format-content-date";

type EditorialIndexProps = {
  entries: ContentEntry[];
  activeKind?: ContentKind;
};

const COPY = {
  all: {
    eyebrow: "Resources",
    headline: "Practical resources for running an event business",
    intro: "Guides for the operational decisions behind the work, alongside honest comparisons of the tools event businesses use to manage them.",
  },
  blog: {
    eyebrow: "Guides",
    headline: "Practical guides for the work behind the event",
    intro: "Clear, useful pieces on pricing, client intake, portfolio decisions, and the operational systems that keep bookings moving.",
  },
  compare: {
    eyebrow: "Comparisons",
    headline: "Gallurio compared with the tools you use now",
    intro: "Direct comparisons of price, workflow, strengths, and material gaps—so you can choose the tool that fits the way your business actually runs.",
  },
} as const;

function entryHref(entry: ContentEntry): string {
  return entry.kind === "blog" ? `/blog/${entry.slug}` : `/compare/${entry.slug}`;
}

export function EditorialIndex({ entries, activeKind }: EditorialIndexProps) {
  const copy = COPY[activeKind ?? "all"];
  const sorted = [...entries].sort((a, b) => {
    if (a.publishedAt === b.publishedAt) return a.title.localeCompare(b.title);
    return a.publishedAt < b.publishedAt ? 1 : -1;
  });

  return (
    <>
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl text-start">
          <p className="text-sm font-semibold text-brand">{copy.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-balance font-heading text-3xl font-semibold tracking-tight sm:text-5xl">{copy.headline}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{copy.intro}</p>
          <nav aria-label="Resource type" className="mt-8 flex flex-wrap gap-2">
            {[
              ["All resources", "/resources", !activeKind],
              ["Guides", "/blog", activeKind === "blog"],
              ["Comparisons", "/compare", activeKind === "compare"],
            ].map(([label, href, active]) => (
              <Link key={href as string} href={href as string} aria-current={active ? "page" : undefined} className={`rounded-[var(--radius)] px-3 py-2 text-sm font-semibold ring-1 ring-foreground/10 ${active ? "bg-brand text-brand-foreground" : "bg-card text-foreground hover:bg-muted"}`}>
                {label as string}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="border-t border-border px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-5xl gap-px bg-border ring-1 ring-foreground/10 md:grid-cols-2">
          {sorted.map((entry) => (
            <article key={`${entry.kind}:${entry.slug}`} className="group flex min-h-56 flex-col bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>{entry.kind === "blog" ? "Guide" : "Comparison"}</span>
                {entry.category ? <><span aria-hidden="true">·</span><span>{entry.category.replaceAll("-", " ")}</span></> : null}
              </div>
              <h2 className="mt-5 text-balance font-heading text-xl font-semibold tracking-tight">
                <Link href={entryHref(entry)} className="hover:text-brand">{entry.title}</Link>
              </h2>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{entry.description}</p>
              <div className="mt-auto flex items-center gap-2 pt-6 text-xs text-muted-foreground">
                <time dateTime={entry.updatedAt ?? entry.publishedAt}>{formatContentDate(entry.updatedAt ?? entry.publishedAt, "en")}</time>
                <span aria-hidden="true">·</span>
                <span>{estimateReadingTime(entry.body)} min read</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
