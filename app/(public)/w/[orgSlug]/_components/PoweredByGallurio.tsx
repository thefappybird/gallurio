/**
 * Attribution mark at the foot of every published portfolio.
 *
 * Deliberately a plain followed link: each published workspace is a page on our
 * own domain, and this is what lets authority flow back to it. Styled from the
 * tenant's own `--pf-*` brand variables so it reads as part of their page
 * rather than as an advert pasted onto it.
 */
export function PoweredByGallurio({ label }: { label: string }) {
  return (
    <footer
      style={{
        background: "var(--pf-color-bg)",
        fontFamily: "var(--pf-font-body)",
        padding: "2rem 1.5rem",
        textAlign: "center",
      }}
    >
      <a
        href="https://gallurio.com"
        style={{
          color: "var(--pf-color-fg)",
          fontSize: "0.75rem",
          letterSpacing: "0.02em",
          opacity: 0.7,
        }}
      >
        {label}
      </a>
    </footer>
  );
}
