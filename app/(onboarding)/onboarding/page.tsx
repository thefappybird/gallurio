"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOrganizationList } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { createWorkspaceSchema, type CreateWorkspaceInput } from "@/lib/validators/workspace";
import { createWorkspaceAction } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";

const BUSINESS_TYPES = [
  { value: "photographer", label: "Photographer" },
  { value: "venue", label: "Venue" },
  { value: "planner", label: "Wedding / Event Planner" },
  { value: "stylist", label: "Stylist" },
  { value: "catering", label: "Catering" },
  { value: "entertainer", label: "Entertainer / DJ / Band" },
  { value: "other", label: "Other" },
] as const;

function toSlug(val: string) {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export default function OnboardingPage() {
  const router = useRouter();
  const { createOrganization, setActive } = useOrganizationList();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { businessType: "photographer" },
  });

  const nameValue = watch("name");

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setValue("name", val);
    setValue("slug", toSlug(val), { shouldValidate: true });
  }

  async function onSubmit(data: CreateWorkspaceInput) {
    setServerError(null);
    try {
      if (!createOrganization || !setActive) {
        setServerError("Organization features unavailable — please refresh.");
        return;
      }

      const org = await createOrganization({ name: data.name, slug: data.slug });
      await setActive({ organization: org.id });

      const result = await createWorkspaceAction(data);
      if (result?.error) {
        setServerError(result.error);
        return;
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Set up your workspace</CardTitle>
        <CardDescription>
          Tell us about your business — you can change these details later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Business name</Label>
            <Input
              id="name"
              placeholder="e.g. Sarah Bell Photography"
              {...register("name")}
              onChange={handleNameChange}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">
              Workspace URL{" "}
              <span className="text-muted-foreground font-normal">
                (your public page address)
              </span>
            </Label>
            <div className="flex items-center gap-0">
              <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
                gallurio.com/w/
              </span>
              <Input
                id="slug"
                className="rounded-l-none"
                placeholder="sarah-bell-photo"
                {...register("slug")}
              />
            </div>
            {errors.slug && (
              <p className="text-sm text-destructive">{errors.slug.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessType">Business type</Label>
            <select
              id="businessType"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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

          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="mt-1">
            {isSubmitting ? "Creating workspace…" : "Create workspace"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
