import { describe, it, expect } from "vitest";
import { InvoiceDocument, type InvoiceData } from "./InvoiceDocument";

// @react-pdf/renderer elements are plain React elements (type/props), not DOM —
// safe to walk without a full PDF render.
function collectText(node: unknown, out: string[] = []): string[] {
  if (node == null || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out));
    return out;
  }
  if (typeof node === "object" && "type" in (node as Record<string, unknown>) && "props" in (node as Record<string, unknown>)) {
    const el = node as { type: unknown; props: { children?: unknown } };
    if (typeof el.type === "function") {
      collectText((el.type as (props: unknown) => unknown)(el.props), out);
    } else {
      collectText(el.props.children, out);
    }
  }
  return out;
}

const baseData: InvoiceData = {
  invoiceNumber: "INV-000042",
  issueDate: new Date("2026-07-05T00:00:00Z"),
  business: {
    name: "Studio Aperture",
    logoUrl: "",
    address: "123 Main St",
    email: "owner@studio.test",
    theme: { main: "#0F1B33", accent: "#C9A24B" },
  },
  client: { name: "Emma Carter", email: "emma@example.com", phone: null },
  booking: {
    title: "Carter Wedding",
    eventType: "wedding",
    sessionStart: new Date("2026-08-15T10:00:00Z"),
    sessionEnd: new Date("2026-08-15T14:00:00Z"),
    locationAddress: "Pier 27, Manila",
  },
  amount: { total: 75_000, deposit: 25_000, currency: "PHP" },
  locale: "en-PH",
};

describe("InvoiceDocument", () => {
  it("renders the business name, INVOICE label, invoice number, and THANK YOU footer", () => {
    const element = InvoiceDocument({ data: baseData });
    const text = collectText(element).join(" | ");
    expect(text).toContain("Studio Aperture");
    expect(text).toContain("INVOICE");
    expect(text).toContain("INV-000042");
    expect(text).toContain("THANK YOU");
  });

  it("renders the info grid labels, client name, and the Gallurio brand mark", () => {
    const element = InvoiceDocument({ data: baseData });
    const text = collectText(element).join(" | ");
    expect(text).toContain("BILL TO");
    expect(text).toContain("EVENT");
    expect(text).toContain("LOCATION");
    expect(text).toContain("DATE");
    expect(text).toContain("Emma Carter");
    expect(text).toContain("Powered by Gallurio");
  });
});
