"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useForm, useFieldArray, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  inquirySubmissionSchema,
  PREFERRED_CONTACT_METHODS,
  type InquirySubmissionInput,
} from "@/lib/validators/inquiry";
import { EVENT_TYPES, type EventType } from "@/lib/validators/booking";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { PhoneInput } from "@/components/ui/phone-input";
import { LocationPicker } from "@/components/ui/location-picker";
import {
  buildButtonStyle,
  type ButtonAppearance,
} from "./contactButtonAppearance";
import type { PortfolioContactConfig } from "@/lib/page-builder/types";

export type InquiryFormLabels = {
  tabClient: string;
  tabEvent: string;
  tabLocation: string;
  name: string;
  email: string;
  phone: string;
  preferredContact: string;
  preferred: Record<(typeof PREFERRED_CONTACT_METHODS)[number], string>;
  eventTitle: string;
  sessionsLabel: string;
  sessionLabel: string;
  startDate: string;
  startTime: string;
  endTime: string;
  addSession: string;
  removeSession: string;
  shiftHint: string;
  eventType: string;
  eventTypes: Record<EventType, string>;
  location: string;
  message: string;
  messagePlaceholder: string;
  continue: string;
  submit: string;
  submitting: string;
  errorGeneric: string;
  requiredHint: string;
  locationRequired: string;
  locationPicker: {
    searchPlaceholder: string;
    searching: string;
    noResults: string;
    dragHint: string;
    clear: string;
    changeLocation?: string;
    accept?: string;
    cancel?: string;
    apply?: string;
    currentAddressLabel?: string;
  };
};

function createFieldStyle(): CSSProperties {
  return {
    width: "100%",
    minHeight: "44px",
    padding: "0 0.75rem",
    backgroundColor: "var(--pf-color-bg)",
    color: "currentColor",
    border: "1px solid color-mix(in srgb, currentColor 28%, transparent)",
    borderRadius: "var(--pf-radius)",
    fontSize: "0.9375rem",
    fontFamily: "var(--pf-font-body)",
  };
}

function createLabelStyle(): CSSProperties {
  return {
    display: "block",
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "currentColor",
    marginBottom: "0.25rem",
  };
}

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

export type SubmitAppearance = ButtonAppearance;

const DEFAULT_SUBMIT_APPEARANCE: ButtonAppearance = {
  color: "var(--pf-color-primary)",
  style: "solid",
};

const DEFAULT_ADD_SESSION_APPEARANCE: ButtonAppearance = {
  color: "var(--pf-color-fg)",
  style: "outline",
  border: "1px dashed color-mix(in srgb, var(--pf-color-fg) 40%, transparent)",
};

const TAB_FONT_SIZE_MAP: Record<string, string> = {
  sm: "0.8125rem",
  md: "0.9375rem",
  lg: "1.0625rem",
};

const TAB_RADIUS_MAP: Record<string, string> = {
  sharp: "0",
  subtle: "0.25rem",
  rounded: "0.5rem",
};

function resolveTabColor(token: string | undefined, fallback: string): string {
  if (!token) return fallback;
  if (token.startsWith("#")) return token;
  return `var(--pf-color-${token}, ${fallback})`;
}

function buildTabColorWithOpacity(color: string, opacity: number): string {
  if (opacity >= 100) return color;
  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`;
}

export function getActiveTabExtraStyle(config: PortfolioContactConfig | null | undefined): CSSProperties {
  const style: CSSProperties = {};
  const activeColor = resolveTabColor(config?.activeTabColor, "var(--pf-color-fg)");
  style.color = activeColor;
  if (config?.activeTabScale) {
    (style as CSSProperties & Record<string, string>)["transform"] = "scale(1.08)";
    (style as CSSProperties & Record<string, string>)["fontWeight"] = "700";
  }
  if (config?.activeTabHighlight) {
    const highlightColor = resolveTabColor(
      config.tabHighlightColor,
      "color-mix(in srgb, var(--pf-color-fg) 8%, transparent)",
    );
    style.backgroundColor = buildTabColorWithOpacity(highlightColor, config.tabHighlightOpacity ?? 100);
    style.borderRadius = config.activeTabRadius
      ? (TAB_RADIUS_MAP[config.activeTabRadius] ?? "var(--pf-radius)")
      : "var(--pf-radius)";
  }
  if (config?.activeTabUnderline) {
    style.borderBottom = `3px solid ${resolveTabColor(config.tabUnderlineColor, "var(--pf-color-accent)")}`;
  }
  return style;
}

export function ContactForm({
  workspaceSlug,
  labels,
  onSuccess,
  submitAppearance = DEFAULT_SUBMIT_APPEARANCE,
  addSessionAppearance = DEFAULT_ADD_SESSION_APPEARANCE,
  preview = false,
  compactLocationPicker = false,
  scrollable = false,
  contactConfig,
}: {
  workspaceSlug: string;
  labels: InquiryFormLabels;
  onSuccess: () => void;
  submitAppearance?: SubmitAppearance;
  addSessionAppearance?: ButtonAppearance;
  preview?: boolean;
  compactLocationPicker?: boolean;
  scrollable?: boolean;
  contactConfig?: PortfolioContactConfig | null;
}) {
  const form = useForm<InquirySubmissionInput>({
    resolver: zodResolver(inquirySubmissionSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      preferredContact: "email",
      eventTitle: "",
      sessions: [{ startDate: "", startTime: "10:00", endTime: "17:00" }],
      eventType: "other",
      location: { label: null, address: null, placeId: null, lat: null, lng: null },
      description: "",
      company_name: "",
    },
  });

  const {
    register,
    control,
    handleSubmit,
    setError,
    trigger,
    formState: { errors, isSubmitting },
  } = form;

  const errorStyle: CSSProperties = {
    fontSize: "0.75rem",
    color: submitAppearance.errorColor ?? "var(--pf-color-accent)",
    marginTop: "0.25rem",
  };
  const fieldStyle = createFieldStyle();
  const labelStyle = createLabelStyle();

  const { fields, append, remove } = useFieldArray({ control, name: "sessions" });
  const minDate = todayIso();
  const [activeTab, setActiveTab] = useState<"client" | "event" | "location">("client");

  function onInvalid(errs: FieldErrors<InquirySubmissionInput>) {
    if (errs.name || errs.email || errs.phone || errs.preferredContact) {
      setActiveTab("client");
      return;
    }
    if (errs.eventTitle || errs.sessions || errs.eventType) {
      setActiveTab("event");
      return;
    }
    // location or description errors land on the location tab
    setActiveTab("location");
  }

  useEffect(() => {
    const t = readTracking();
    if (t.utm_source) form.setValue("utm_source", t.utm_source);
    if (t.utm_medium) form.setValue("utm_medium", t.utm_medium);
    if (t.utm_campaign) form.setValue("utm_campaign", t.utm_campaign);
    if (t.referrer) form.setValue("referrer", t.referrer);
  }, [form]);

  async function handleContinue() {
    const ok = await trigger(["name", "email", "phone", "preferredContact"]);
    if (ok) setActiveTab("event");
  }

  async function handleEventContinue() {
    const ok = await trigger(["eventTitle", "sessions", "eventType"]);
    if (ok) setActiveTab("location");
  }

  async function onSubmit(data: InquirySubmissionInput) {
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
      className="pf-contact-form"
      style={{
        fontFamily: "var(--pf-font-body)",
        color: "inherit",
        maxHeight: scrollable ? "100%" : undefined,
        overflowY: scrollable ? "auto" : undefined,
        paddingRight: scrollable ? "0.25rem" : undefined,
      }}
    >
      <style>{`
        .pf-cf-btn:focus-visible { outline: 2px solid var(--pf-color-accent); outline-offset: 2px; }
        .pf-contact-form,
        .pf-contact-form label,
        .pf-contact-form legend,
        .pf-contact-form span,
        .pf-contact-form p {
          color: inherit;
        }
        .pf-contact-form input,
        .pf-contact-form select,
        .pf-contact-form textarea,
        .pf-contact-form [data-slot="input"] {
          color: inherit;
          border-color: color-mix(in srgb, currentColor 28%, transparent);
        }
        .pf-contact-form input::placeholder,
        .pf-contact-form textarea::placeholder,
        .pf-contact-form [data-slot="input"]::placeholder {
          color: color-mix(in srgb, currentColor 62%, transparent);
        }
        .pf-contact-form .pf-contact-phone,
        .pf-contact-form .pf-contact-location {
          color: inherit;
        }
        .pf-contact-form .pf-contact-phone input,
        .pf-contact-form .pf-contact-location input,
        .pf-contact-form .pf-contact-location button,
        .pf-contact-form .pf-contact-location [data-slot="input"] {
          color: inherit;
        }
        .pf-contact-form .pf-contact-location .text-muted-foreground,
        .pf-contact-form .pf-contact-location svg,
        .pf-contact-form .pf-contact-phone .PhoneInputCountrySelectArrow {
          color: color-mix(in srgb, currentColor 62%, transparent);
        }
      `}</style>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "client" | "event" | "location")}>
        <TabsList>
          {(["client", "event", "location"] as const).map((tabValue) => {
            const isActive = activeTab === tabValue;
            const label = tabValue === "client" ? labels.tabClient : tabValue === "event" ? labels.tabEvent : labels.tabLocation;
            const tabFontSize = contactConfig?.tabFontSize
              ? (TAB_FONT_SIZE_MAP[contactConfig.tabFontSize] ?? "0.9375rem")
              : "0.9375rem";
            const inactiveColor = resolveTabColor(contactConfig?.tabColor, "");
            const activeExtraStyle = getActiveTabExtraStyle(contactConfig);
            const tabStyle: CSSProperties = isActive
              ? { fontSize: tabFontSize, ...activeExtraStyle }
              : { fontSize: tabFontSize, ...(inactiveColor ? { color: inactiveColor } : {}) };
            return (
              <TabsTab key={tabValue} value={tabValue} style={tabStyle}>
                {label}
              </TabsTab>
            );
          })}
        </TabsList>

        <TabsPanel value="client">
          <div>
            <label htmlFor="cf-name" style={labelStyle}>{labels.name}</label>
            <input id="cf-name" style={fieldStyle} aria-invalid={errors.name ? "true" : undefined} {...register("name")} />
            {errors.name && <p style={errorStyle} role="alert">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="cf-email" style={labelStyle}>{labels.email}</label>
            <input id="cf-email" type="email" style={fieldStyle} aria-invalid={errors.email ? "true" : undefined} {...register("email")} />
            {errors.email && <p style={errorStyle} role="alert">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="cf-phone" style={labelStyle}>{labels.phone}</label>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  id="cf-phone"
                  className="pf-contact-phone"
                  value={field.value || undefined}
                  onChange={(value) => field.onChange(value ?? "")}
                />
              )}
            />
          </div>

          <div>
            <label htmlFor="cf-preferred" style={labelStyle}>{labels.preferredContact}</label>
            <select id="cf-preferred" style={fieldStyle} {...register("preferredContact")}>
              {PREFERRED_CONTACT_METHODS.map((m) => (
                <option key={m} value={m}>{labels.preferred[m]}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="pf-cf-btn"
            onClick={() => void handleContinue()}
            style={buildButtonStyle(submitAppearance, false, { marginTop: "1rem" })}
          >
            {labels.continue}
          </button>
        </TabsPanel>

        <TabsPanel value="event">
          <div>
            <label htmlFor="cf-eventTitle" style={labelStyle}>{labels.eventTitle}</label>
            <input id="cf-eventTitle" style={fieldStyle} aria-invalid={errors.eventTitle ? "true" : undefined} {...register("eventTitle")} />
            {errors.eventTitle && <p style={errorStyle} role="alert">{errors.eventTitle.message}</p>}
          </div>

          <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
            <legend style={{ ...labelStyle, marginBottom: "0.5rem" }}>{labels.sessionsLabel}</legend>
            <p style={{ fontSize: "0.75rem", opacity: 0.7, margin: "0 0 0.75rem" }}>{labels.shiftHint}</p>
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                    <label htmlFor={`cf-start-${index}`} style={labelStyle}>{labels.startDate}</label>
                    <input
                      id={`cf-start-${index}`}
                      type="date"
                      min={minDate}
                      style={fieldStyle}
                      aria-invalid={errors.sessions?.[index]?.startDate ? "true" : undefined}
                      {...register(`sessions.${index}.startDate` as const)}
                    />
                    {errors.sessions?.[index]?.startDate && <p style={errorStyle} role="alert">{errors.sessions[index]?.startDate?.message}</p>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label htmlFor={`cf-stime-${index}`} style={labelStyle}>{labels.startTime}</label>
                      <input id={`cf-stime-${index}`} type="time" style={fieldStyle} {...register(`sessions.${index}.startTime` as const)} />
                    </div>
                    <div>
                      <label htmlFor={`cf-etime-${index}`} style={labelStyle}>{labels.endTime}</label>
                      <input
                        id={`cf-etime-${index}`}
                        type="time"
                        style={fieldStyle}
                        aria-invalid={errors.sessions?.[index]?.endTime ? "true" : undefined}
                        {...register(`sessions.${index}.endTime` as const)}
                      />
                      {errors.sessions?.[index]?.endTime && <p style={errorStyle} role="alert">{errors.sessions[index]?.endTime?.message}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="pf-cf-btn"
              onClick={() => append({ startDate: "", startTime: "10:00", endTime: "17:00" })}
              style={buildButtonStyle(addSessionAppearance, false, {
                marginTop: "0.5rem",
                minHeight: "44px",
                padding: "0 0.75rem",
                fontSize: "0.875rem",
              })}
            >
              + {labels.addSession}
            </button>
          </fieldset>

          <div>
            <label htmlFor="cf-eventType" style={labelStyle}>{labels.eventType}</label>
            <select id="cf-eventType" style={fieldStyle} {...register("eventType")}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{labels.eventTypes[t]}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="pf-cf-btn"
            onClick={() => void handleEventContinue()}
            style={buildButtonStyle(submitAppearance, false, { marginTop: "1rem" })}
          >
            {labels.continue}
          </button>
        </TabsPanel>

        <TabsPanel value="location">
          <div>
            <label htmlFor="cf-location" style={labelStyle}>{labels.location}</label>
            <Controller
              control={control}
              name="location"
              render={({ field }) => (
                <LocationPicker
                  id="cf-location"
                  editable
                  className="pf-contact-location"
                  labels={labels.locationPicker}
                  searchEnabled={!preview}
                  value={{
                    address: field.value.address ?? "",
                    lat: field.value.lat ?? null,
                    lng: field.value.lng ?? null,
                  }}
                  compact={compactLocationPicker}
                  applyButtonStyle={buildButtonStyle(submitAppearance, false)}
                  ariaDescribedby={errors.location?.address ? "cf-location-error" : undefined}
                  onChange={(value) =>
                    field.onChange({
                      label: value.address || null,
                      address: value.address || null,
                      placeId: null,
                      lat: value.lat ?? null,
                      lng: value.lng ?? null,
                    })
                  }
                />
              )}
            />
            {errors.location?.address && (
              <p id="cf-location-error" style={errorStyle} role="alert">
                {errors.location.address.message ?? labels.locationRequired}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="cf-description" style={labelStyle}>{labels.message}</label>
            <textarea
              id="cf-description"
              rows={4}
              placeholder={labels.messagePlaceholder}
              style={{ ...fieldStyle, minHeight: "96px", padding: "0.5rem 0.75rem", resize: "vertical" }}
              aria-invalid={errors.description ? "true" : undefined}
              {...register("description")}
            />
            {errors.description && <p style={errorStyle} role="alert">{errors.description.message}</p>}
          </div>
        </TabsPanel>
      </Tabs>

      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px" }}
        {...register("company_name")}
      />

      <div aria-live="polite">
        {errors.root && (
          <p id="cf-root-error" style={{ ...errorStyle, fontSize: "0.8125rem" }} role="alert">
            {errors.root.message}
          </p>
        )}
      </div>

      {activeTab === "location" ? (
        <button
          type="submit"
          className="pf-cf-btn"
          disabled={isSubmitting}
          style={buildButtonStyle(submitAppearance, isSubmitting, { marginTop: "1rem" })}
        >
          {isSubmitting ? labels.submitting : labels.submit}
        </button>
      ) : null}
    </form>
  );
}
