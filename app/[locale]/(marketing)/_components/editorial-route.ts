export function isEditorialRoute(pathname: string): boolean {
  return ["/resources", "/blog", "/compare"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
