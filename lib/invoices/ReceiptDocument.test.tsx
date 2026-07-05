import { describe, it, expect } from "vitest";
import { ReceiptDocument, type ReceiptData } from "./ReceiptDocument";

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

const baseData: ReceiptData = {
  receiptNumber: "INV-000042",
  issueDate: new Date("2026-08-16T00:00:00Z"),
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
    sessionStart: new Date("2026-08-15T10:00:00Z"),
    sessionEnd: new Date("2026-08-15T14:00:00Z"),
  },
  amount: { total: 75_000, paidTotal: 75_000, currency: "PHP" },
  locale: "en-PH",
};

describe("ReceiptDocument", () => {
  it("renders RECEIPT label, receipt number, paid-in-full sentence, and THANK YOU footer", () => {
    const element = ReceiptDocument({ data: baseData });
    const text = collectText(element).join(" | ");
    expect(text).toContain("Studio Aperture");
    expect(text).toContain("RECEIPT");
    expect(text).toContain("INV-000042");
    expect(text).toContain("This booking has been paid in full and marked complete.");
    expect(text).toContain("THANK YOU");
    expect(text).not.toContain("Balance due");
  });
});
