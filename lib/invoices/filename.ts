function sanitizeForFilename(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
}

export function buildPdfFilename(args: {
  business: string;
  customer: string;
  kind: "invoice" | "receipt";
  date?: Date;
}): string {
  const b = sanitizeForFilename(args.business);
  const c = sanitizeForFilename(args.customer);
  const d = (args.date ?? new Date()).toISOString().slice(0, 10);
  const keyword = args.kind === "invoice" ? "INVOICE" : "RECEIPT";
  return `${b}-${c}-${keyword}_${d}.PDF`;
}
