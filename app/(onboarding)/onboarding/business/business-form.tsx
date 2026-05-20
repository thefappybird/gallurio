"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOrganizationList } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  businessStepSchema,
  type BusinessStepInput,
} from "@/lib/validators/workspace";
import { businessStepAction } from "@/lib/actions/onboarding";
import { StepShell } from "../_components/step-shell";
import { BusinessIllustration } from "../_components/illustrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BUSINESS_TYPES = [
  { value: "photographer", label: "Photographer" },
  { value: "venue", label: "Venue" },
  { value: "planner", label: "Wedding / Event Planner" },
  { value: "stylist", label: "Stylist" },
  { value: "catering", label: "Catering" },
  { value: "entertainer", label: "Entertainer / DJ / Band" },
  { value: "other", label: "Other" },
] as const;

const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "ES", label: "Spain" },
  { value: "IT", label: "Italy" },
  { value: "NL", label: "Netherlands" },
  { value: "BR", label: "Brazil" },
  { value: "MX", label: "Mexico" },
];

function toSlug(val: string) {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export function BusinessStepForm({ defaults }: { defaults: BusinessStepInput }) {
  const router = useRouter();
  const { setActive } = useOrganizationList();
  const [serverError, setServerError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BusinessStepInput>({
    resolver: zodResolver(businessStepSchema),
    defaultValues: defaults,
  });

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue("name", e.target.value);
    if (!defaults.slug) {
      setValue("slug", toSlug(e.target.value), { shouldValidate: true });
    }
  }

  async function onSubmit(data: BusinessStepInput) {
    setServerError(null);
    try {
      const result = await businessStepAction(data);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      if (result.orgIdToActivate && setActive) {
        await setActive({ organization: result.orgIdToActivate });
      }
      startTransition(() => router.push("/onboarding/branding"));
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <StepShell
      step="business"
      title="Tell us about your business"
      description="Your name, your business basics, and where you operate."
      illustration={<BusinessIllustration />}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" placeholder="Sarah" {...register("firstName")} />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lastName">
              Last name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="lastName" placeholder="Bell" {...register("lastName")} />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Business name</Label>
          <Input
            id="name"
            placeholder="e.g. Sarah Bell Photography"
            {...register("name")}
            onChange={handleNameChange}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">
            Workspace URL{" "}
            <span className="font-normal text-muted-foreground">(your public page address)</span>
          </Label>
          <div className="flex items-stretch">
            <span className="flex items-center border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
              gallurio.com/w/
            </span>
            <Input id="slug" placeholder="sarah-bell-photo" {...register("slug")} />
          </div>
          {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessType">Business type</Label>
            <select
              id="businessType"
              className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("businessType")}
            >
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {errors.businessType && (
              <p className="text-sm text-destructive">{errors.businessType.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="country">Country</Label>
            <select
              id="country"
              className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("country")}
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.country && (
              <p className="text-sm text-destructive">{errors.country.message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" {...register("timezone")} />
          {errors.timezone && (
            <p className="text-sm text-destructive">{errors.timezone.message}</p>
          )}
        </div>

        {serverError && (
          <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <div className="mt-2 flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="min-w-40">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </form>
    </StepShell>
  );
}
