/**
 * Shown when:
 * - The workspace slug does not exist, or
 * - The workspace exists but has not been published (`publishedAt === null`).
 *
 * No app chrome — this page is outside the authenticated shell.
 */
export default function PortfolioNotFound() {
  return (
    <main
      style={{ fontFamily: "'Merriweather', serif" }}
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center text-[#111111]"
    >
      <p className="text-sm font-semibold tracking-widest uppercase text-[#6b6b6b]">
        Gallurio
      </p>
      <h1 className="text-2xl font-bold">Portfolio not found</h1>
      <p className="max-w-sm text-base text-[#6b6b6b]">
        This portfolio doesn&apos;t exist or hasn&apos;t been published yet.
      </p>
    </main>
  );
}
