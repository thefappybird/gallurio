"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useForm, useFieldArray, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  inquirySubmissionSchema,
  PREFERRED_CONTACT_METHODS,
  type InquirySubmissionInput,
} from "@/lib/validators/inquiry";
import { EVENT_TYPES, type EventType } from "@/lib/validators/booking";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";

export type InquiryFormLabels = {
  tabClient: string;
  tabBooking: string;
  name: string;
  email: string;
  phone: string;
  preferredContact: string;
  preferred: Record<(typeof PREFERRED_CONTACT_METHODS)[number], string>;
  sessionsLabel: string;
  /** Contains a literal "{n}" token replaced per row. */
  sessionLabel: string;
  startDate: string;
  startTime: string;
  endTime: string;
  addSession: string;
  removeSession: string;
  shiftHint: string;
  eventType: string;
  eventTypes: Record<EventType, string>;
  guestCount: string;
  location: string;
  message: string;
  messagePlaceholder: string;
  submit: string;
  submitting: string;
  errorGeneric: string;
  requiredHint: string;
};

const fieldStyle: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "0 0.75rem",
  backgroundColor: "var(--pf-color-bg)",
  color: "var(--pf-color-fg)",
  border: "1px solid color-mix(in srgb, var(--pf-color-fg) 28%, transparent)",
  borderRadius: "var(--pf-radius)",
  fontSize: "0.9375rem",
  fontFamily: "var(--pf-font-body)",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--pf-color-fg)",
  marginBottom: "0.25rem",
};

const errorStyle: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--pf-color-accent)",
  marginTop: "0.25rem",
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function readTracking() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || undefined,
    utm_medium: params.get("utm_medium") || undefined,
    utm_campaign: params.get("utm_campaign") || undefined,
    referrer: document.referrer || undefined,
  };
}

/** Configurable submit-button appearance, derived from publicPage.contact. */
export type SubmitAppearance = {
  /** CSS var name for the button color, e.g. "--pf-color-primary". */
  colorVar: string;
  style: "solid" | "outline" | "soft";
};

function submitButtonStyle(appearance: SubmitAppearance, disabled: boolean): CSSProperties {
  const color = `var(${appearance.colorVar})`;
  const base: CSSProperties = {
    marginTop: "1rem",
    width: "100%",
    minHeight: "48px",
    borderRadius: "var(--pf-radius)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
    fontSize: "1rem",
    fontFamily: "var(--pf-font-body)",
  };
  if (appearance.style === "outline") {
    return { ...base, backgroundColor: "transparent", color, border: `1px solid ${color}` };
  }
  if (appearance.style === "soft") {
    return {
      ...base,
      backgroundColor: `color-mix(in srgb, ${color} 16%, var(--pf-color-bg))`,
      color,
      border: "none",
    };
  }
  return { ...base, backgroundColor: color, color: "var(--pf-color-bg)", border: "none" };
}

const DEFAULT_SUBMIT_APPEARANCE: SubmitAppearance = {
  colorVar: "--pf-color-primary",
  style: "solid",
};

export function ContactForm({
  workspaceSlug,
  labels,
  onSuccess,
  submitAppearance = DEFAULT_SUBMIT_APPEARANCE,
  preview = false,
}: {
  workspaceSlug: string;
  labels: InquiryFormLabels;
  onSuccess: () => void;
  submitAppearance?: SubmitAppearance;
  /** Editor preview — never POST a real inquiry; submitting is a no-op. */
  preview?: boolean;
}) {
  const form = useForm<InquirySubmissionInput>({
    resolver: zodResolver(inquirySubmissionSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      preferredContact: "email",
      sessions: [{ startDate: "", startTime: "10:00", endTime: "17:00" }],
      eventType: "other",
      guestCount: undefined,
      location: "",
      description: "",
      company_name: "",
    },
  });

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const { fields, append, remove } = useFieldArray({ control, name: "sessions" });
  const minDate = todayIso();
  const [activeTab, setActiveTab] = useState<"client" | "booking">("client");

  // On a failed client-side validation, surface the first tab that has an error
  // so the user isn't left staring at a submit button that "does nothing".
  function onInvalid(errs: FieldErrors<InquirySubmissionInput>) {
    const tab1HasError = Boolean(errs.name || errs.email || errs.phone || errs.preferredContact);
    setActiveTab(tab1HasError ? "client" : "booking");
  }

  // Attach tracking params once on mount.
  useEffect(() => {
    const t = readTracking();
    if (t.utm_source) form.setValue("utm_source", t.utm_source);
    if (t.utm_medium) form.setValue("utm_medium", t.utm_medium);
    if (t.utm_campaign) form.setValue("utm_campaign", t.utm_campaign);
    if (t.referrer) form.setValue("referrer", t.referrer);
  }, [form]);

  async function onSubmit(data: InquirySubmissionInput) {
    // In the owner's editor preview the form is fully interactive but inert —
    // submitting must not create a real inquiry/booking against the workspace.
    if (preview) return;
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, ...data }),
      });
      if (!res.ok) {
        setError("root", { message: labels.errorGeneric });
        return;
      }
      onSuccess();
    } catch {
      setError("root", { message: labels.errorGeneric });
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      noValidate
      style={{ fontFamily: "var(--pf-font-body)" }}
    >
      <style>{`
        .pf-cf-btn:focus-visible { outline: 2px solid var(--pf-color-accent); outline-offset: 2px; }
      `}</style>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "client" | "booking")}>
        <TabsList>
          <TabsTab value="client">{labels.tabClient}</TabsTab>
          <TabsTab value="booking">{labels.tabBooking}</TabsTab>
        </TabsList>

        {/* Tab 1 — client info */}
        <TabsPanel value="client">
          <div>
            <label htmlFor="cf-name" style={labelStyle}>
              {labels.name}
            </label>
            <input
              id="cf-name"
              style={fieldStyle}
              aria-invalid={errors.name ? "true" : undefined}
              {...register("name")}
            />
            {errors.name && <p style={errorStyle} role="alert">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="cf-email" style={labelStyle}>
              {labels.email}
            </label>
            <input
              id="cf-email"
              type="email"
              style={fieldStyle}
              aria-invalid={errors.email ? "true" : undefined}
              {...register("email")}
            />
            {errors.email && <p style={errorStyle} role="alert">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="cf-phone" style={labelStyle}>
              {labels.phone}
            </label>
            <input id="cf-phone" type="tel" style={fieldStyle} {...register("phone")} />
          </div>

          <div>
            <label htmlFor="cf-preferred" style={labelStyle}>
              {labels.preferredContact}
            </label>
            <select id="cf-preferred" style={fieldStyle} {...register("preferredContact")}>
              {PREFERRED_CONTACT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {labels.preferred[m]}
                </option>
              ))}
            </select>
          </div>
        </TabsPanel>

        {/* Tab 2 — booking request */}
        <TabsPanel value="booking">
          <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
            <legend style={{ ...labelStyle, marginBottom: "0.5rem" }}>{labels.sessionsLabel}</legend>
            <p style={{ fontSize: "0.75rem", opacity: 0.7, margin: "0 0 0.75rem" }}>
              {labels.shiftHint}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  style={{
                    border: "1px solid color-mix(in srgb, var(--pf-color-fg) 18%, transparent)",
                    borderRadius: "var(--pf-radius)",
                    padding: "0.75rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                      {labels.sessionLabel.replace("{n}", String(index + 1))}
                    </span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        className="pf-cf-btn"
                        onClick={() => remove(index)}
                        aria-label={`${labels.removeSession} ${index + 1}`}
                        style={{
                          minHeight: "44px",
                          padding: "0 0.75rem",
                          background: "transparent",
                          color: "var(--pf-color-fg)",
                          border: "1px solid color-mix(in srgb, var(--pf-color-fg) 24%, transparent)",
                          borderRadius: "var(--pf-radius)",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                        }}
                      >
                        {labels.removeSession}
                      </button>
                    )}
                  </div>

                  <div>
                    <label htmlFor={`cf-start-${index}`} style={labelStyle}>
                      {labels.startDate}
                    </label>
                    <input
                      id={`cf-start-${index}`}
                      type="date"
                      min={minDate}
                      style={fieldStyle}
                      aria-invalid={errors.sessions?.[index]?.startDate ? "true" : undefined}
                      {...register(`sessions.${index}.startDate` as const)}
                    />
                    {errors.sessions?.[index]?.startDate && (
                      <p style={errorStyle} role="alert">
                        {errors.sessions[index]?.startDate?.message}
                      </p>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label htmlFor={`cf-stime-${index}`} style={labelStyle}>
                        {labels.startTime}
                      </label>
                      <input
                        id={`cf-stime-${index}`}
                        type="time"
                        style={fieldStyle}
                        {...register(`sessions.${index}.startTime` as const)}
                      />
                    </div>
                    <div>
                      <label htmlFor={`cf-etime-${index}`} style={labelStyle}>
                        {labels.endTime}
                      </label>
                      <input
                        id={`cf-etime-${index}`}
                        type="time"
                        style={fieldStyle}
                        aria-invalid={errors.sessions?.[index]?.endTime ? "true" : undefined}
                        {...register(`sessions.${index}.endTime` as const)}
                      />
                      {errors.sessions?.[index]?.endTime && (
                        <p style={errorStyle} role="alert">
                          {errors.sessions[index]?.endTime?.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="pf-cf-btn"
              onClick={() => append({ startDate: "", startTime: "10:00", endTime: "17:00" })}
              style={{
                marginTop: "0.5rem",
                minHeight: "44px",
                padding: "0 0.75rem",
                background: "transparent",
                color: "var(--pf-color-fg)",
                border: "1px dashed color-mix(in srgb, var(--pf-color-fg) 40%, transparent)",
                borderRadius: "var(--pf-radius)",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              + {labels.addSession}
            </button>
          </fieldset>

          <div>
            <label htmlFor="cf-eventType" style={labelStyle}>
              {labels.eventType}
            </label>
            <select id="cf-eventType" style={fieldStyle} {...register("eventType")}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {labels.eventTypes[t]}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div>
              <label htmlFor="cf-guests" style={labelStyle}>
                {labels.guestCount}
              </label>
              <input
                id="cf-guests"
                type="number"
                min={0}
                inputMode="numeric"
                style={fieldStyle}
                {...register("guestCount")}
              />
            </div>
            <div>
              <label htmlFor="cf-location" style={labelStyle}>
                {labels.location}
              </label>
              <input id="cf-location" style={fieldStyle} {...register("location")} />
            </div>
          </div>

          <div>
            <label htmlFor="cf-description" style={labelStyle}>
              {labels.message}
            </label>
            <textarea
              id="cf-description"
              rows={4}
              placeholder={labels.messagePlaceholder}
              style={{ ...fieldStyle, minHeight: "96px", padding: "0.5rem 0.75rem", resize: "vertical" }}
              aria-invalid={errors.description ? "true" : undefined}
              {...register("description")}
            />
            {errors.description && (
              <p style={errorStyle} role="alert">
                {errors.description.message}
              </p>
            )}
          </div>
        </TabsPanel>
      </Tabs>

      {/* Honeypot — visually hidden, off the tab order */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px" }}
        {...register("company_name")}
      />

      {/* Live region for the top-level submit error */}
      <div aria-live="polite">
        {errors.root && (
          <p style={{ ...errorStyle, fontSize: "0.8125rem" }} role="alert">
            {errors.root.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="pf-cf-btn"
        disabled={isSubmitting}
        style={submitButtonStyle(submitAppearance, isSubmitting)}
      >
        {isSubmitting ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
