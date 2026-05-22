import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing");

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black px-6">
      <div className="w-full max-w-2xl py-24 flex flex-col gap-8">
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">
          {t("version")}
        </span>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t("headline")}
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400 max-w-xl">
          {t("description")}
        </p>
        <div className="flex gap-3">
          <Link
            href="/sign-up"
            className="inline-flex h-11 items-center justify-center bg-zinc-950 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {t("getStarted")}
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex h-11 items-center justify-center border border-zinc-200 px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            {t("signIn")}
          </Link>
        </div>
      </div>
    </main>
  );
}
