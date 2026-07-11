import type { ReactNode } from "react";

// Shared shell for the three "quiet" compliance pages (Terms, Privacy,
// Refunds) — single-column prose, no TOC, no extra chrome, per the scope
// doc's "do not over-design these" instruction. Sequential h2 sections only.

function LegalArticle({ children }: { children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 text-start sm:px-6 sm:py-20">
      {children}
    </article>
  );
}

function LegalHeader({ title, effectiveDate }: { title: string; effectiveDate: string }) {
  return (
    <header>
      <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{effectiveDate}</p>
    </header>
  );
}

function LegalIntro({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 space-y-4 text-base leading-7 text-muted-foreground">{children}</div>
  );
}

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-4 text-base leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 ps-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export { LegalArticle, LegalHeader, LegalIntro, LegalSection, LegalList };
