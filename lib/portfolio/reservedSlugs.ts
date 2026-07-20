export const RESERVED_SUBDOMAIN_LABELS = new Set([
  "www","auth","autoconfig","dev","send","staging","app","api","admin","mail","static","cdn","assets","status",
]);

export function isReservedSlug(label: string): boolean {
  return RESERVED_SUBDOMAIN_LABELS.has(label.trim().toLowerCase());
}
