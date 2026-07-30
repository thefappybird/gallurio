"use client";

import { useState } from "react";
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_TYPES, type EventType } from "@/lib/validators/booking";
import { cn } from "@/lib/utils";
import { LocationPicker } from "@/components/ui/location-picker";
import type { WizardValues } from "./types";

type Props = {
  control: Control<WizardValues>;
  register: UseFormRegister<WizardValues>;
  watch: UseFormWatch<WizardValues>;
  setValue: UseFormSetValue<WizardValues>;
  errors: FieldErrors<WizardValues>;
  /** Writable teams the user can assign this booking to (create + edit mode). */
  teams?: { id: string; name: string }[];
  /** Wizard mode — team selector only rendered when teams.length > 1. */
  mode?: "create" | "edit";
  /** True when the step has been submitted/validated — reveals the location error even before onChange. */
  locationSubmitted?: boolean;
};

const Asterisk = () => <span className="ms-0.5 text-destructive">*</span>;

function safe(t: (k: string) => string, key: string, fallback: string) {
  try {
    const v = t(key);
    return v && v !== key ? v : fallback;
  } catch {
    return fallback;
  }
}

export function EventPricingStep({
  control,
  register,
  watch,
  errors,
  teams,
  locationSubmitted = false,
}: Props) {
  const t = useTranslations("app.bookings.wizard.event");
  const tWiz = useTranslations("app.bookings.wizard");
  const tEvent = useTranslations("app.bookings.eventTypes");

  const locationValue = watch("location");
  const [locationTouched, setLocationTouched] = useState(false);
  const showLocationError = (locationTouched || locationSubmitted) && !locationValue?.address?.trim();

  // A team picker only appears when the caller can choose among >1 writable
  // teams; a single team is auto-applied (seeded into teamId), so no field is
  // needed. When it's present, title · event type · team share one row; when
  // absent, event type sits beside the title (title spans two columns).
  const showTeamPicker = !!(teams && teams.length > 1);

  return (
    <div className="flex flex-col gap-3">
      {/* Title · Event type (· Team) on one row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={cn("flex flex-col gap-1", !showTeamPicker && "sm:col-span-2")}>
          <Label htmlFor="wiz-title">
            {t("title")}
            <Asterisk />
          </Label>
          <Input
            id="wiz-title"
            {...register("title", { required: true })}
            placeholder={t("titlePlaceholder")}
            aria-invalid={errors.title ? "true" : undefined}
          />
          {errors.title ? (
            <p className="text-xs text-destructive">
              {errors.title.message ?? t("titleRequired")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="wiz-eventType">{t("eventType")}</Label>
          <Controller
            control={control}
            name="eventType"
            render={({ field }) => (
              <Select<EventType>
                value={field.value}
                onValueChange={(v) => v && field.onChange(v)}
              >
                <SelectTrigger className="capitalize">
                  <SelectValue placeholder={t("eventType")} />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((e) => (
                    <SelectItem key={e} value={e} className="capitalize">
                      {safe(tEvent, e, e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {showTeamPicker ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="wiz-teamId">{tWiz("teamLabel")}</Label>
            <Controller
              control={control}
              name="teamId"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) => v && field.onChange(v)}
                >
                  <SelectTrigger id="wiz-teamId">
                    <SelectValue placeholder={tWiz("teamPlaceholder")}>
                      {(value: string) =>
                        teams!.find((team) => team.id === value)?.name ??
                        tWiz("teamPlaceholder")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {teams!.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        ) : null}
      </div>

      {/* Location — required, applies to all sessions */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="wiz-location">
          {t("location")}
          <Asterisk />
        </Label>
        <Controller
          control={control}
          name="location"
          render={({ field }) => (
            <LocationPicker
              id="wiz-location"
              editable
              value={{
                address: field.value?.address ?? "",
                lat: field.value?.lat ?? null,
                lng: field.value?.lng ?? null,
              }}
              onChange={(v) => { setLocationTouched(true); field.onChange(v); }}
              error={showLocationError ? t("locationRequired") : undefined}
            />
          )}
        />
      </div>
    </div>
  );
}
