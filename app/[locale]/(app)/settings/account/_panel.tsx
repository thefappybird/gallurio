"use client";

import { useTransition, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useActionError } from "@/lib/i18n/actionError";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "@/lib/i18n/navigation";
import { updateProfileNameAction, updateAvatarAction } from "../_actions";
import { uploadImage } from "@/lib/storage/uploadImage.client";
import { ACCEPTED_MIME } from "@/lib/page-builder/photoSpec";
import { PasswordSection } from "./_password-section";
import { MfaSection } from "./_mfa-section";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
});
type FormValues = z.infer<typeof schema>;

function getInitials(name: string, email: string): string {
  const n = name.trim();
  if (n.length > 0) {
    const parts = n.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }
    return (parts[0]![0] ?? "").toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "U";
}

type Props = {
  name: string;
  email: string;
  avatarUrl: string | null;
  avatarAssetId: string | null;
  hasOAuth: boolean;
  mfaEnabled: boolean;
};

export function AccountPanel({
  name,
  email,
  avatarUrl: initialAvatarUrl,
  avatarAssetId: initialAvatarPublicId,
  hasOAuth,
  mfaEnabled,
}: Props) {
  const t = useTranslations("app.settings.account");
  const errMsg = useActionError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [avatarPending, startAvatarTransition] = useTransition();
  const [displayName, setDisplayName] = useState(name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarPublicId, setAvatarPublicId] = useState<string | null>(
    initialAvatarPublicId,
  );
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map the shared uploader's machine-readable failure reasons to friendly,
  // layman copy shown inline beneath the avatar buttons.
  function avatarErrorMessage(reason: string): string {
    if (reason === "type_not_accepted") return t("avatarTypeError");
    if (reason === "file_too_large") return t("avatarSizeError");
    return t("avatarUploadError");
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await updateProfileNameAction(values);
      if (result && "error" in result) {
        toast.error(errMsg(result.error, result.params));
      } else {
        setDisplayName(values.name);
        toast.success(t("nameSaved"));
      }
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected after removal
    e.target.value = "";
    setAvatarError(null);
    setUploading(true);
    try {
      // Shared, signature-correct uploader (same one the portfolio gallery
      // uses). validateDimensions is off — avatars have no minimum size.
      const res = await uploadImage(file, {
        subfolder: "avatars",
      });
      const newUrl = res.url;
      const newPublicId = res.assetId;
      // Capture prior values before optimistic update so we can roll back on DB failure.
      const prevUrl = avatarUrl;
      const prevPublicId = avatarPublicId;
      // Optimistic update
      setAvatarUrl(newUrl);
      setAvatarPublicId(newPublicId);
      // If persistence fails, the just-uploaded image is left as a best-effort orphan — no client-side cleanup is attempted.
      startAvatarTransition(async () => {
        const result = await updateAvatarAction({
          avatarUrl: newUrl,
          avatarAssetId: newPublicId,
        });
        if (result && "error" in result) {
          setAvatarUrl(prevUrl);
          setAvatarPublicId(prevPublicId);
          setAvatarError(result.error ? errMsg(result.error, result.params) : t("avatarUploadError"));
        } else {
          toast.success(t("avatarSaved"));
          // Re-render server components (e.g. the sidebar avatar) with fresh data.
          router.refresh();
        }
      });
    } catch (err: unknown) {
      setAvatarError(
        avatarErrorMessage(err instanceof Error ? err.message : ""),
      );
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveAvatar() {
    setAvatarError(null);
    const prevUrl = avatarUrl;
    const prevPublicId = avatarPublicId;
    setAvatarUrl(null);
    setAvatarPublicId(null);
    startAvatarTransition(async () => {
      const result = await updateAvatarAction({
        avatarUrl: null,
        avatarAssetId: null,
      });
      if (result && "error" in result) {
        setAvatarUrl(prevUrl);
        setAvatarPublicId(prevPublicId);
        setAvatarError(result.error ? errMsg(result.error, result.params) : t("avatarUploadError"));
      } else {
        toast.success(t("avatarRemoved"));
        router.refresh();
      }
    });
  }

  const avatarBusy = uploading || avatarPending;
  const initials = getInitials(displayName, email);

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {/* Avatar */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("profileSection")}</h2>
          <p className="text-sm text-muted-foreground">{t("profileHint")}</p>
        </div>
        <div className="flex items-start gap-4">
          {avatarUrl ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              aria-label={t("avatarPreview")}
              className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar size="lg" className="size-14">
                <AvatarImage src={avatarUrl} alt={displayName || email} />
                <AvatarFallback className="text-base">{initials}</AvatarFallback>
              </Avatar>
            </button>
          ) : (
            <Avatar size="lg" className="size-14 shrink-0">
              <AvatarFallback className="text-base">{initials}</AvatarFallback>
            </Avatar>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{displayName || email}</span>
            <p className="text-xs text-muted-foreground">{t("avatarHint")}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                aria-label={avatarUrl ? t("avatarReplace") : t("avatarUpload")}
              >
                {uploading ? (
                  <>
                    <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
                    {t("avatarUploading")}
                  </>
                ) : avatarPending ? (
                  <>
                    <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
                    {t("avatarSaving")}
                  </>
                ) : avatarUrl ? (
                  t("avatarReplace")
                ) : (
                  t("avatarUpload")
                )}
              </Button>
              {/* Remove only applies to a photo the user uploaded; a default
                  avatar from the identity provider has no stored asset ID. */}
              {avatarPublicId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={avatarBusy}
                  aria-label={t("avatarRemove")}
                >
                  {t("avatarRemove")}
                </Button>
              )}
            </div>
            {avatarError && (
              <p role="alert" className="text-xs text-destructive">
                {avatarError}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_MIME.join(",")}
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={handleFile}
            />
          </div>
        </div>

        {/* Expanded avatar preview */}
        {avatarUrl && (
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogTitle className="sr-only">
                {t("avatarPreviewTitle")}
              </DialogTitle>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt={displayName || email}
                className="mx-auto h-auto w-full max-w-sm object-contain"
              />
            </DialogContent>
          </Dialog>
        )}
      </section>

      {/* Name form */}
      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold">{t("nameSection")}</h2>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-name">{t("nameLabel")}</Label>
              <Input
                id="profile-name"
                type="text"
                autoComplete="name"
                disabled={pending}
                aria-describedby={errors.name ? "profile-name-error" : undefined}
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              {errors.name && (
                <p
                  id="profile-name-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Email — read-only; email change is out of scope */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-email">{t("emailLabel")}</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                readOnly
                disabled
                aria-describedby="profile-email-hint"
                className="cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              disabled={pending || !isDirty}
              className="min-h-11 min-w-28"
            >
              {pending ? (
                <>
                  <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
                  {t("saving")}
                </>
              ) : (
                t("saveName")
              )}
            </Button>
          </div>
        </form>
      </section>

      {/* Password */}
      <PasswordSection hasOAuth={hasOAuth} />

      {/* MFA */}
      <MfaSection mfaEnabled={mfaEnabled} />
    </div>
  );
}
