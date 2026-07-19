import type { ContactModalLabels } from "./ContactModal";

type Translator = (key: string, values?: Record<string, string | number>) => string;

/**
 * Builds the fully-resolved contact modal labels from a `publicPage.inquiryForm`
 * scoped translator. Lives server-side because the public route is outside the
 * `[locale]` segment, so strings are resolved at the boundary and passed as props
 * (mirrors how chrome strings reach server-rendered blocks).
 */
export function buildContactLabels(t: Translator, tLocationPicker?: Translator): ContactModalLabels {
  const tp = tLocationPicker ?? t;
  return {
    title: t("title"),
    description: t("description"),
    close: t("close"),
    confirmTitle: t("confirmTitle"),
    confirmBody: t("confirmBody"),
    confirmClose: t("confirmClose"),
    form: {
      tabClient: t("tabClient"),
      tabEvent: t("tabEvent"),
      tabLocation: t("tabLocation"),
      name: t("name"),
      email: t("email"),
      phone: t("phone"),
      preferredContact: t("preferredContact"),
      preferred: {
        email: t("preferred.email"),
        phone: t("preferred.phone"),
        either: t("preferred.either"),
      },
      eventTitle: t("eventTitle"),
      sessionsLabel: t("sessionsLabel"),
      sessionLabel: t("sessionLabel", { n: "{n}" }),
      startDate: t("startDate"),
      startTime: t("startTime"),
      endTime: t("endTime"),
      addSession: t("addSession"),
      removeSession: t("removeSession"),
      shiftHint: t("shiftHint"),
      eventType: t("eventType"),
      eventTypes: {
        wedding: t("eventTypes.wedding"),
        corporate: t("eventTypes.corporate"),
        portrait: t("eventTypes.portrait"),
        engagement: t("eventTypes.engagement"),
        anniversary: t("eventTypes.anniversary"),
        other: t("eventTypes.other"),
      },
      location: t("location"),
      message: t("message"),
      messagePlaceholder: t("messagePlaceholder"),
      continue: t("continue"),
      submit: t("submit"),
      submitting: t("submitting"),
      errorGeneric: t("errorGeneric"),
      requiredHint: t("requiredHint"),
      locationRequired: t("locationRequired"),
      locationPicker: {
        searchPlaceholder: tp("searchPlaceholder"),
        searching: tp("searching"),
        noResults: tp("noResults"),
        dragHint: tp("dragHint"),
        clear: tp("clear"),
        changeLocation: tp("changeLocation"),
        accept: tp("accept"),
        cancel: tp("cancel"),
        apply: tp("apply"),
        currentAddressLabel: tp("currentAddressLabel"),
      },
    },
  };
}
