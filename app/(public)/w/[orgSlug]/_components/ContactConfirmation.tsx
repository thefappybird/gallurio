/**
 * Success panel shown after a successful inquiry submission. Brand-kit styled.
 */
export function ContactConfirmation({
  title,
  body,
  closeLabel,
  onClose,
}: {
  title: string;
  body: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "1rem",
        padding: "2rem 0.5rem",
        fontFamily: "var(--pf-font-body)",
        color: "var(--pf-color-fg)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: "56px",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "999px",
          backgroundColor: "var(--pf-color-accent)",
          color: "var(--pf-color-bg)",
          fontSize: "1.5rem",
        }}
      >
        ✓
      </div>
      <h2
        style={{
          fontFamily: "var(--pf-font-heading)",
          fontSize: "1.375rem",
          fontWeight: 700,
          margin: 0,
        }}
      >
        {title}
      </h2>
      <p style={{ margin: 0, opacity: 0.75, maxWidth: "32ch" }}>{body}</p>
      <button
        type="button"
        onClick={onClose}
        style={{
          minHeight: "44px",
          padding: "0 1.5rem",
          marginTop: "0.5rem",
          backgroundColor: "var(--pf-color-primary)",
          color: "var(--pf-color-bg)",
          border: "none",
          borderRadius: "var(--pf-radius)",
          cursor: "pointer",
          fontSize: "0.9375rem",
          fontFamily: "var(--pf-font-body)",
        }}
      >
        {closeLabel}
      </button>
    </div>
  );
}
