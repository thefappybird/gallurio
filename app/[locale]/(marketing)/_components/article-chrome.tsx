import type { ReactNode } from "react";
import type { ContentEntry } from "@/lib/content/entries";
import { Link } from "@/lib/i18n/navigation";
import { ARTICLE_PROSE_CLASS } from "./article-prose";
import { formatContentDate } from "./format-content-date";
import { YouTubeEmbed } from "./youtube-embed";

export function estimateReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

function ComparisonVerdict({ entry }: { entry: ContentEntry }) {
  if (!entry.bestFor && !entry.notFor) return null;

  const gallurioFit = entry.competitor ? entry.notFor : entry.bestFor;
  const alternativeFit = entry.competitor ? entry.bestFor : entry.notFor;
  const alternativeLabel = entry.competitor
    ? `Consider ${entry.competitor} if`
    : "Consider another option if";

  return (
    <section aria-label="Quick verdict" className="mt-8 grid ring-1 ring-foreground/10 sm:grid-cols-2">
      <div className="bg-card p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Start with Gallurio if</p>
        <p className="mt-2 text-sm leading-6 text-foreground">{gallurioFit}</p>
      </div>
      <div className="border-t border-border bg-card p-4 sm:border-t-0 sm:border-s sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{alternativeLabel}</p>
        <p className="mt-2 text-sm leading-6 text-foreground">{alternativeFit}</p>
      </div>
    </section>
  );
}

function FaqSection({ entry }: { entry: ContentEntry }) {
  if (!entry.faq?.length) return null;

  return (
    <section className="mt-14 border-t border-border pt-10">
      <h2 className="font-heading text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
      <div className="mt-5 divide-y divide-border ring-1 ring-foreground/10">
        {entry.faq.map((item) => (
          <details key={item.question} className="group bg-card p-4 open:bg-muted/40 sm:p-5">
            <summary className="cursor-pointer list-none font-heading text-base font-semibold marker:hidden">
              <span className="flex items-start justify-between gap-4">
                {item.question}
                <span aria-hidden="true" className="text-brand group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function ArticleChrome({ entry, children }: { entry: ContentEntry; children: ReactNode }) {
  const isComparison = entry.kind === "compare";
  const indexPath = isComparison ? "/compare" : "/blog";
  const indexLabel = isComparison ? "Comparisons" : "Guides";
  const checkedAt = entry.updatedAt ?? entry.publishedAt;

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/resources" className="hover:text-foreground">Resources</Link>
        <span aria-hidden="true">/</span>
        <Link href={indexPath} className="hover:text-foreground">{indexLabel}</Link>
      </nav>

      <p className="mt-8 text-sm font-semibold text-brand">{isComparison ? "Comparison" : "Guide"}</p>
      <h1 className="mt-2 text-balance font-heading text-3xl font-semibold tracking-tight sm:text-5xl">
        {entry.title}
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{entry.description}</p>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>By <Link href="/about" className="font-semibold text-foreground hover:text-brand">Gallurio Editorial</Link></span>
        <span aria-hidden="true">·</span>
        <span>{estimateReadingTime(entry.body)} min read</span>
        <span aria-hidden="true">·</span>
        <span>
          {isComparison ? "Last checked" : entry.updatedAt ? "Updated" : "Published"}{" "}
          <time dateTime={checkedAt}>{formatContentDate(checkedAt, "en")}</time>
        </span>
      </div>

      {isComparison ? <ComparisonVerdict entry={entry} /> : null}

      {entry.youtubeId && entry.videoTitle ? (
        <YouTubeEmbed videoId={entry.youtubeId} title={entry.videoTitle} caption={entry.videoCaption} />
      ) : null}

      <div className={`${ARTICLE_PROSE_CLASS} mt-10`}>{children}</div>

      {isComparison ? (
        <aside className="mt-12 bg-muted/40 p-5 ring-1 ring-foreground/10">
          <h2 className="font-heading text-base font-semibold">How this comparison was prepared</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Competitor features and prices were checked against the sources linked in the article. Gallurio capabilities were verified in the product. We name material gaps instead of treating missing features as roadmap promises.
          </p>
        </aside>
      ) : null}

      <FaqSection entry={entry} />

      <aside className="mt-14 border-y border-border py-8 sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">See the workflow in your own workspace</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Start with the full product and decide from real bookings, not a feature list.</p>
        </div>
        <Link href="/sign-up" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-[var(--radius)] bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand/90 sm:mt-0">
          Try Gallurio free
        </Link>
      </aside>
    </>
  );
}
