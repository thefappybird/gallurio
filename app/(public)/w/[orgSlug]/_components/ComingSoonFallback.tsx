/**
 * Minimum workspace shape needed by this component.
 * Using a structural subtype rather than the full `WorkspaceDoc` or lean type
 * so both the server page (which passes a `.lean()` result) and tests (which
 * construct plain objects) satisfy the prop without awkward casting.
 */
type WorkspaceShape = {
  name: string;
  branding?: {
    logoUrl?: string | null;
    tagline?: string | null;
  } | null;
};

type ComingSoonFallbackProps = {
  workspace: WorkspaceShape;
};

/**
 * Branded "Coming soon" fallback shown when a workspace is published but
 * `publicPage.data.home` has not been set via the page builder yet.
 *
 * Uses the `--pf-color-*` CSS variables injected by the layout wrapper so
 * branding is consistent with whatever the workspace owner configured.
 */
export function ComingSoonFallback({ workspace }: ComingSoonFallbackProps) {
  const logoUrl =
    typeof workspace.branding?.logoUrl === "string" && workspace.branding.logoUrl
      ? workspace.branding.logoUrl
      : null;

  const tagline =
    typeof workspace.branding?.tagline === "string" ? workspace.branding.tagline : "";

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
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${workspace.name} logo`}
          style={{ maxWidth: "120px", maxHeight: "80px", objectFit: "contain" }}
        />
      )}

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

      {tagline && (
        <p
          style={{
            fontSize: "1.125rem",
            opacity: 0.75,
            maxWidth: "480px",
            margin: 0,
          }}
        >
          {tagline}
        </p>
      )}

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
        Coming soon
      </p>

      <p
        style={{
          fontSize: "0.75rem",
          opacity: 0.35,
          marginTop: "2rem",
        }}
      >
        Powered by Gallurio
      </p>
    </main>
  );
}
