/**
 * ServicesListBlock — heading + embedded services array.
 *
 * Layout: 1 column on mobile, 2 on tablet (≥640px), 3 on desktop (≥1024px).
 * Max 8 items enforced in the component (additional items silently dropped).
 *
 * All branding via `--pf-*` CSS variables. No `rounded-*` Tailwind classes.
 */

import type { ComponentConfig } from "@measured/puck";
import { getRenderWorkspace } from "@/lib/page-builder/serverContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceItem = {
  title: string;
  description?: string;
  priceFrom?: string;
  icon?: string;
};

export type ServicesListProps = {
  heading: string;
  items: ServiceItem[];
};

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

export const servicesListDefaultProps: ServicesListProps = {
  heading: "Services",
  items: [
    {
      title: "Wedding Photography",
      description: "Full-day coverage of your most important day.",
      priceFrom: "₱30,000",
      icon: "📷",
    },
    {
      title: "Portrait Sessions",
      description: "Individual or family portraits in natural light.",
      priceFrom: "₱8,000",
      icon: "🎞️",
    },
    {
      title: "Event Coverage",
      description: "Corporate events, debuts, and intimate gatherings.",
      priceFrom: "₱15,000",
      icon: "✨",
    },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ServicesListBlock({ heading, items }: ServicesListProps) {
  const cappedItems = items.slice(0, 8);
  // Read the resolved "Starting from {price}" template from the render context.
  // Falls back to English so the block still renders correctly in the Puck editor
  // (which does not wrap renders in runWithRenderWorkspace).
  const startingFromTemplate = getRenderWorkspace()?.chrome?.startingFrom ?? "Starting from {price}";

  return (
    <section
      data-block="services-list"
      style={{
        backgroundColor: "var(--pf-color-bg)",
        color: "var(--pf-color-fg)",
        fontFamily: "var(--pf-font-body)",
        padding: "4rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "72rem",
          margin: "0 auto",
        }}
      >
        {heading && (
          <h2
            style={{
              fontFamily: "var(--pf-font-heading)",
              fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
              fontWeight: 700,
              lineHeight: 1.2,
              color: "var(--pf-color-fg)",
              margin: "0 0 2.5rem 0",
              textAlign: "center",
            }}
          >
            {heading}
          </h2>
        )}

        <div
          className="pf-services-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "1.5rem",
          }}
        >
          {cappedItems.map((item, i) => (
            <ServiceCard key={i} item={item} startingFromTemplate={startingFromTemplate} />
          ))}
        </div>
      </div>

      {/* Responsive grid breakpoints */}
      <style>{`
        @media (min-width: 640px) {
          .pf-services-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (min-width: 1024px) {
          .pf-services-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
      `}</style>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Service card
// ---------------------------------------------------------------------------

function ServiceCard({ item, startingFromTemplate }: { item: ServiceItem; startingFromTemplate: string }) {
  return (
    <div
      data-testid="service-card"
      style={{
        border: "1px solid var(--pf-color-fg, #111111)",
        borderColor: "color-mix(in srgb, var(--pf-color-fg) 15%, transparent)",
        padding: "1.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        borderRadius: "var(--pf-radius)",
      }}
    >
      {item.icon && (
        <span
          style={{ fontSize: "2rem", lineHeight: 1 }}
          aria-hidden="true"
        >
          {item.icon}
        </span>
      )}

      <h3
        style={{
          fontFamily: "var(--pf-font-heading)",
          fontSize: "1.125rem",
          fontWeight: 700,
          color: "var(--pf-color-fg)",
          margin: 0,
        }}
      >
        {item.title}
      </h3>

      {item.description && (
        <p
          style={{
            fontSize: "0.9375rem",
            lineHeight: 1.7,
            color: "var(--pf-color-fg)",
            opacity: 0.75,
            margin: 0,
            flexGrow: 1,
          }}
        >
          {item.description}
        </p>
      )}

      {item.priceFrom && (
        <p
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: "var(--pf-color-accent)",
            margin: 0,
          }}
        >
          {startingFromTemplate.replace("{price}", item.priceFrom)}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Puck registration
// ---------------------------------------------------------------------------

export const servicesListBlockConfig: ComponentConfig<ServicesListProps> = {
  label: "Services",
  defaultProps: servicesListDefaultProps,
  fields: {
    heading: { type: "text", label: "Section heading" },
    items: {
      type: "array",
      label: "Services (max 8)",
      arrayFields: {
        title: { type: "text", label: "Title" },
        description: { type: "textarea", label: "Description" },
        priceFrom: { type: "text", label: "Starting price (e.g. ₱30,000)" },
        icon: { type: "text", label: "Icon (emoji or URL)" },
      },
      getItemSummary: (item: ServiceItem) => item.title || "Service",
    },
  },
  render: ServicesListBlock,
};
