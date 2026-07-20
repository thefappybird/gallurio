import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "notFound" });
  const user = await getAuthUser();
  const href = user ? "/dashboard" : "/";
  const label = user ? t("backToDashboard") : t("backToHome");

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <span className="font-mono text-8xl font-bold text-muted-foreground/30 select-none">
          404
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Link href={href} className={cn(buttonVariants({ variant: "brand", size: "lg" }))}>
          {label}
        </Link>
      </div>
    </main>
  );
}
