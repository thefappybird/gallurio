"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { bookDemoSubmissionSchema, type BookDemoSubmissionInput } from "@/lib/validators/bookDemo";
import { submitBookDemoAction } from "../_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fieldMessage } from "@/lib/utils/fieldMessage";

export function BookDemoForm() {
  const t = useTranslations("marketing.bookDemo.form");
  const tSuccess = useTranslations("marketing.bookDemo.success");
  const tErrors = useTranslations("marketing.bookDemo.errors");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BookDemoSubmissionInput>({
    resolver: zodResolver(bookDemoSubmissionSchema),
    defaultValues: { name: "", email: "", businessName: "", message: "" },
  });

  async function onSubmit(data: BookDemoSubmissionInput) {
    setSubmitError(null);
    const result = await submitBookDemoAction(data);
    if (!result.ok) {
      setSubmitError(result.error === "rate_limited" ? tErrors("rateLimited") : result.error);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div role="status" className="border border-border bg-muted p-6 text-start">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{tSuccess("title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{tSuccess("body")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bd-name">{t("name")}</Label>
        <Input id="bd-name" aria-invalid={errors.name ? "true" : undefined} {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive" role="alert">
            {fieldMessage(errors.name)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bd-email">{t("email")}</Label>
        <Input
          id="bd-email"
          type="email"
          aria-invalid={errors.email ? "true" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive" role="alert">
            {fieldMessage(errors.email)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bd-business">{t("businessName")}</Label>
        <Input
          id="bd-business"
          aria-invalid={errors.businessName ? "true" : undefined}
          {...register("businessName")}
        />
        {errors.businessName && (
          <p className="text-sm text-destructive" role="alert">
            {fieldMessage(errors.businessName)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bd-message">{t("message")}</Label>
        <Textarea
          id="bd-message"
          rows={4}
          placeholder={t("messagePlaceholder")}
          aria-invalid={errors.message ? "true" : undefined}
          {...register("message")}
        />
        {errors.message && (
          <p className="text-sm text-destructive" role="alert">
            {fieldMessage(errors.message)}
          </p>
        )}
      </div>

      {submitError && (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      )}

      <Button type="submit" variant="brand" loading={isSubmitting} disabled={isSubmitting} className="w-fit">
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
