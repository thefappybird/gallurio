/**
 * Minimum workspace shape needed by this component.
 * Using a structural subtype rather than the full `WorkspaceDoc` or lean type
 * so both the server page (which passes a `.lean()` result) and tests (which
 * construct plain objects) satisfy the prop without awkward casting.
 */
type WorkspaceShape = {
  name: string;
};

type ComingSoonFallbackProps = {
  workspace: WorkspaceShape;
  /** Pre-resolved chrome strings. Defaults to English so standalone/test usage works without i18n setup. */
  labels?: { comingSoon: string; poweredBy: string };
};

const DEFAULT_LABELS = { comingSoon: "Coming soon", poweredBy: "Powered by Gallurio" };

/**
 * "Coming soon" fallback shown when a workspace is published but
 * `publicPage.data.home` has not been set via the page builder yet.
 *
 * Uses the `--pf-color-*` CSS variables injected by the layout wrapper so
 * styling is consistent with whatever brand kit the owner configured.
 */
export function ComingSoonFallback({ workspace, labels = DEFAULT_LABELS }: ComingSoonFallbackProps) {
  return (
    <main
      style={{
        backgroundColor: "var(--pf-color-bg, #ffffff)",
        color: "var(--pf-color-fg, #111111)",
        fontFamily: "var(--pf-font-body, 'Merriweather', serif)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
        gap: "1.5rem",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--pf-font-heading, 'Merriweather', serif)",
          fontSize: "2rem",
          fontWeight: 700,
          lineHeight: 1.2,
          margin: 0,
        }}
      >
        {workspace.name}
      </h1>

      <p
        style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.5,
          margin: 0,
        }}
      >
        {labels.comingSoon}
      </p>

      <p
        style={{
          fontSize: "0.75rem",
          opacity: 0.35,
          marginTop: "2rem",
        }}
      >
        {labels.poweredBy}
      </p>
    </main>
  );
}
