import {
  VOCABULARY_LOCALES,
  getTerms,
  type VocabularyConcept,
  type VocabularyLocale,
  type VocabularyPresetId,
} from "./presets";

type Messages = Record<string, unknown>;

const WORDS: Record<string, { concept: VocabularyConcept; plural: boolean }> = {
  inquiry: { concept: "inquiry", plural: false },
  inquiries: { concept: "inquiry", plural: true },
  booking: { concept: "booking", plural: false },
  bookings: { concept: "booking", plural: true },
  client: { concept: "client", plural: false },
  clients: { concept: "client", plural: true },
  team: { concept: "team", plural: false },
  teams: { concept: "team", plural: true },
};

const TOKEN = /%(a_|A_)?([A-Za-z]+)%/g;

const capitalize = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

function toLocale(locale: string): VocabularyLocale {
  return (VOCABULARY_LOCALES as readonly string[]).includes(locale)
    ? (locale as VocabularyLocale)
    : "en";
}

export function applyVocabularyToString(str: string, locale: string, preset: VocabularyPresetId): string {
  if (!str.includes("%")) return str;
  const loc = toLocale(locale);
  return str.replace(TOKEN, (match, article: string | undefined, word: string) => {
    const info = WORDS[word.toLowerCase()];
    if (!info) return match;
    if (article && info.plural) return match;
    const terms = getTerms(preset, loc, info.concept);
    const base = info.plural ? terms.plural : terms.singular;
    if (article) {
      const withArticle = loc === "en" ? `${/^[aeiou]/i.test(base) ? "an" : "a"} ${base}` : base;
      return article === "A_" ? capitalize(withArticle) : withArticle;
    }
    return word.charAt(0) === word.charAt(0).toUpperCase() ? capitalize(base) : base;
  });
}

function walk(node: unknown, locale: string, preset: VocabularyPresetId): unknown {
  if (typeof node === "string") return applyVocabularyToString(node, locale, preset);
  if (Array.isArray(node)) return node.map((n) => walk(n, locale, preset));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = walk(v, locale, preset);
    return out;
  }
  return node;
}

const cache = new WeakMap<object, Map<string, Messages>>();

export function applyVocabulary<T extends Messages>(messages: T, locale: string, preset: VocabularyPresetId): T {
  let byKey = cache.get(messages);
  if (!byKey) {
    byKey = new Map();
    cache.set(messages, byKey);
  }
  const key = `${locale}:${preset}`;
  const hit = byKey.get(key);
  if (hit) return hit as T;
  const result = { ...messages, app: walk(messages.app, locale, preset) } as T;
  byKey.set(key, result);
  return result;
}
