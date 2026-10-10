export const VOCABULARY_PRESET_IDS = [
  "standard",
  "photographer",
  "venue",
  "planner",
  "stylist",
  "catering",
  "entertainer",
  "artists",
] as const;
export type VocabularyPresetId = (typeof VOCABULARY_PRESET_IDS)[number];

export const VOCABULARY_LOCALES = ["en", "fil", "id", "ar", "th"] as const;
export type VocabularyLocale = (typeof VOCABULARY_LOCALES)[number];

export const VOCABULARY_CONCEPTS = ["inquiry", "booking", "client", "team"] as const;
export type VocabularyConcept = (typeof VOCABULARY_CONCEPTS)[number];

export type Term = { singular: string; plural: string };
type TermSet = Record<VocabularyLocale, Term>;

const t = (singular: string, plural: string = singular): Term => ({ singular, plural });
const fil = (w: string): Term => t(w, `mga ${w}`);

// Reusable term sets. Standard locale words mirror messages/<locale>.json app.sidebar.
const INQUIRY: TermSet = {
  en: t("inquiry", "inquiries"),
  fil: fil("inquiry"),
  id: t("pertanyaan"),
  ar: t("استفسار", "استفسارات"),
  th: t("คำขอจอง"),
};
const BOOKING: TermSet = {
  en: t("booking", "bookings"),
  fil: fil("booking"),
  id: t("pemesanan"),
  ar: t("حجز", "حجوزات"),
  th: t("การจอง"),
};
const CLIENT: TermSet = {
  en: t("client", "clients"),
  fil: fil("kliyente"),
  id: t("klien"),
  ar: t("عميل", "عملاء"),
  th: t("ลูกค้า"),
};
const TEAM: TermSet = {
  en: t("team", "teams"),
  fil: fil("koponan"),
  id: t("tim"),
  ar: t("فريق", "فِرق"),
  th: t("ทีม"),
};

const SESSION: TermSet = {
  en: t("session", "sessions"),
  fil: fil("sesyon"),
  id: t("sesi"),
  ar: t("جلسة", "جلسات"),
  th: t("เซสชัน"),
};
const CREW: TermSet = {
  en: t("crew", "crews"),
  fil: fil("crew"),
  id: t("kru"),
  ar: t("طاقم", "طواقم"),
  th: t("ทีมงาน"),
};
const EVENT: TermSet = {
  en: t("event", "events"),
  fil: fil("event"),
  id: t("acara"),
  ar: t("فعالية", "فعاليات"),
  th: t("อีเวนต์"),
};
const HOST: TermSet = {
  en: t("host", "hosts"),
  fil: fil("host"),
  id: t("penyelenggara"),
  ar: t("مضيف", "مضيفون"),
  th: t("เจ้าภาพ"),
};
const VENUE: TermSet = {
  en: t("venue", "venues"),
  fil: fil("venue"),
  id: t("tempat"),
  ar: t("قاعة", "قاعات"),
  th: t("สถานที่"),
};
const LEAD: TermSet = {
  en: t("lead", "leads"),
  fil: fil("lead"),
  id: t("prospek"),
  ar: t("استفسار", "استفسارات"),
  th: t("ลูกค้าเป้าหมาย"),
};
const REQUEST: TermSet = {
  en: t("request", "requests"),
  fil: fil("kahilingan"),
  id: t("permintaan"),
  ar: t("طلب", "طلبات"),
  th: t("คำขอ"),
};
const APPOINTMENT: TermSet = {
  en: t("appointment", "appointments"),
  fil: fil("appointment"),
  id: t("janji temu"),
  ar: t("موعد", "مواعيد"),
  th: t("นัดหมาย"),
};
const QUOTE_REQUEST: TermSet = {
  en: t("quote request", "quote requests"),
  fil: t("hiling ng quote", "mga hiling ng quote"),
  id: t("permintaan penawaran"),
  ar: t("عرض", "عروض"),
  th: t("คำขอใบเสนอราคา"),
};
const ORDER: TermSet = {
  en: t("order", "orders"),
  fil: fil("order"),
  id: t("pesanan"),
  ar: t("طلب", "طلبات"),
  th: t("ออเดอร์"),
};
const CUSTOMER: TermSet = {
  en: t("customer", "customers"),
  fil: fil("customer"),
  id: t("pelanggan"),
  ar: t("زبون", "زبائن"),
  th: t("ลูกค้า"),
};
const KITCHEN: TermSet = {
  en: t("kitchen", "kitchens"),
  fil: fil("kusina"),
  id: t("dapur"),
  ar: t("مطبخ", "مطابخ"),
  th: t("ครัว"),
};
const GIG: TermSet = {
  en: t("gig", "gigs"),
  fil: fil("gig"),
  id: t("pertunjukan"),
  ar: t("عرض", "عروض"),
  th: t("งานแสดง"),
};
const ACT: TermSet = {
  en: t("act", "acts"),
  fil: fil("act"),
  id: t("penampil"),
  ar: t("فرقة", "فرق"),
  th: t("ศิลปิน"),
};
const COMMISSION: TermSet = {
  en: t("commission", "commissions"),
  fil: fil("komisyon"),
  id: t("komisi"),
  ar: t("طلب", "طلبات"),
  th: t("งานคอมมิชชัน"),
};
const PATRON: TermSet = {
  en: t("patron", "patrons"),
  fil: fil("patron"),
  id: t("patron"),
  ar: t("راعٍ", "رعاة"),
  th: t("ผู้อุปถัมภ์"),
};
const STUDIO: TermSet = {
  en: t("studio", "studios"),
  fil: fil("studio"),
  id: t("studio"),
  ar: t("ستوديو", "ستوديوهات"),
  th: t("สตูดิโอ"),
};

type PresetTerms = Record<VocabularyConcept, TermSet>;
const preset = (
  inquiry: TermSet,
  booking: TermSet,
  client: TermSet,
  team: TermSet,
): PresetTerms => ({ inquiry, booking, client, team });

export const PRESET_TERMS: Record<VocabularyPresetId, PresetTerms> = {
  standard: preset(INQUIRY, BOOKING, CLIENT, TEAM),
  photographer: preset(INQUIRY, SESSION, CLIENT, CREW),
  venue: preset(INQUIRY, EVENT, HOST, VENUE),
  planner: preset(LEAD, EVENT, CLIENT, TEAM),
  stylist: preset(REQUEST, APPOINTMENT, CLIENT, TEAM),
  catering: preset(QUOTE_REQUEST, ORDER, CUSTOMER, KITCHEN),
  entertainer: preset(INQUIRY, GIG, CLIENT, ACT),
  artists: preset(INQUIRY, COMMISSION, PATRON, STUDIO),
};

export function getTerms(
  presetId: VocabularyPresetId,
  locale: VocabularyLocale,
  concept: VocabularyConcept,
): Term {
  return PRESET_TERMS[presetId][concept][locale];
}
