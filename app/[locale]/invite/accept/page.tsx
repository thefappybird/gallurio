import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("inviteAccept");
  return { title: t("pageTitle") };
}

type SearchParams = Promise<{ token?: string; error?: string }>;

// Error codes emitted by app/api/invites/accept/route.ts
type InviteError =
  | "invalid"
  | "expired"
  | "already_accepted"
  | "already_member"
  | "email_mismatch"
  | "failed";

function isInviteError(v: string | undefined): v is InviteError {
  return (
    v === "invalid" ||
    v === "expired" ||
    v === "already_accepted" ||
    v === "already_member" ||
    v === "email_mismatch" ||
    v === "failed"
  );
}

export default async function InviteAcceptPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("inviteAccept");

  const { token, error } = await searchParams;

  // No token and no error means a direct visit — redirect to sign-in.
  if (!token && !error) {
    redirect(`/${locale}/sign-in`);
  }

  // If there's a token and no error, forward to the API accept handler.
  // The handler performs auth checks and the accept transaction, then redirects
  // back here with an error param on failure, or to /bookings on success.
  if (token && !error) {
    redirect(`/api/invites/accept?token=${encodeURIComponent(token)}`);
  }

  const errorCode = isInviteError(error) ? error : "invalid";

  // Determine whether to offer a sign-out-and-retry hint (email mismatch case).
  const authUser = await getAuthUser();
  const showSignOutHint = errorCode === "email_mismatch" && authUser != null;

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm border border-border bg-background p-8">
        <h1 className="mb-2 text-xl font-semibold tracking-tight">
          {t(`errors.${errorCode}.title`)}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {t(`errors.${errorCode}.description`)}
        </p>

        {showSignOutHint && (
          <p className="mb-4 text-sm text-muted-foreground">
            {t("errors.email_mismatch.signedInAs", {
              email: authUser.email,
            })}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {errorCode === "already_accepted" || errorCode === "already_member" ? (
            <a
              href={`/${locale}/bookings`}
              className="inline-block w-full bg-foreground px-4 py-2.5 text-center text-sm font-medium text-background"
            >
              {t("goToDashboard")}
            </a>
          ) : (
            <a
              href={`/${locale}/sign-in`}
              className="inline-block w-full bg-foreground px-4 py-2.5 text-center text-sm font-medium text-background"
            >
              {t("signIn")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
