"use client";

import { useTransition, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { updateProfileNameAction, updateAvatarAction } from "../_actions";
import { uploadToCloudinary } from "@/lib/storage/uploadToCloudinary";
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
  avatarCloudinaryPublicId: string | null;
  hasOAuth: boolean;
  mfaEnabled: boolean;
};

export function AccountPanel({
  name,
  email,
  avatarUrl: initialAvatarUrl,
  avatarCloudinaryPublicId: initialAvatarPublicId,
  hasOAuth,
  mfaEnabled,
}: Props) {
  const t = useTranslations("app.settings.account");
  const [pending, startTransition] = useTransition();
  const [avatarPending, startAvatarTransition] = useTransition();
  const [displayName, setDisplayName] = useState(name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarPublicId, setAvatarPublicId] = useState<string | null>(
    initialAvatarPublicId,
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        toast.error(result.error);
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
    if (!file.type.startsWith("image/")) {
      toast.error(t("avatarTypeError"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("avatarSizeError"));
      return;
    }
    setUploading(true);
    try {
      const res = await uploadToCloudinary(file, { subfolder: "avatars" });
      const newUrl = res.secure_url;
      const newPublicId = res.public_id;
      // Capture prior values before optimistic update so we can roll back on DB failure.
      const prevUrl = avatarUrl;
      const prevPublicId = avatarPublicId;
      // Optimistic update
      setAvatarUrl(newUrl);
      setAvatarPublicId(newPublicId);
      // If persistence fails, the just-uploaded Cloudinary asset is left as a best-effort orphan — no client-side cleanup is attempted.
      startAvatarTransition(async () => {
        const result = await updateAvatarAction({
          avatarUrl: newUrl,
          avatarCloudinaryPublicId: newPublicId,
        });
        if (result && "error" in result) {
          setAvatarUrl(prevUrl);
          setAvatarPublicId(prevPublicId);
          toast.error(result.error);
        } else {
          toast.success(t("avatarSaved"));
        }
      });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : t("avatarUploadError"),
      );
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveAvatar() {
    const prevUrl = avatarUrl;
    const prevPublicId = avatarPublicId;
    setAvatarUrl(null);
    setAvatarPublicId(null);
    startAvatarTransition(async () => {
      const result = await updateAvatarAction({
        avatarUrl: null,
        avatarCloudinaryPublicId: null,
      });
      if (result && "error" in result) {
        setAvatarUrl(prevUrl);
        setAvatarPublicId(prevPublicId);
        toast.error(result.error);
      } else {
        toast.success(t("avatarRemoved"));
      }
    });
  }

  const avatarBusy = uploading || avatarPending;
  const initials = getInitials(displayName, email);

  return (
    <div className="flex flex-col gap-8">
      {/* Avatar */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("profileSection")}</h2>
          <p className="text-sm text-muted-foreground">{t("profileHint")}</p>
        </div>
        <div className="flex items-start gap-4">
          <Avatar size="lg" className="size-14 shrink-0">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={displayName || email} />
            ) : null}
            <AvatarFallback className="text-base">{initials}</AvatarFallback>
          </Avatar>
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
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    {t("avatarUploading")}
                  </>
                ) : avatarPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    {t("avatarSaving")}
                  </>
                ) : avatarUrl ? (
                  t("avatarReplace")
                ) : (
                  t("avatarUpload")
                )}
              </Button>
              {avatarUrl && (
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={handleFile}
            />
          </div>
        </div>
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
            <p
              id="profile-email-hint"
              className="text-xs text-muted-foreground"
            >
              {t("emailReadOnly")}
            </p>
          </div>

          <div>
            <Button
              type="submit"
              disabled={pending || !isDirty}
              className="min-h-11 min-w-28"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
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
