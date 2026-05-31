import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "notFound" });

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <span className="font-mono text-8xl font-bold text-muted-foreground/30 select-none">
          404
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-2xl font-semibold text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center border border-border bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
        >
          {t("backToDashboard")}
        </Link>
      </div>
    </main>
  );
}
