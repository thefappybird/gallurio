import en from "@/messages/en.json";
import fil from "@/messages/fil.json";
import id from "@/messages/id.json";
import ar from "@/messages/ar.json";
import th from "@/messages/th.json";
import { applyVocabulary } from "@/lib/vocabulary/apply";

// Catalog strings carry vocabulary %tokens%; tests read the standard-preset words.
const std = <T extends object>(messages: T, locale: string) =>
  applyVocabulary(messages as Record<string, unknown>, locale, "standard") as unknown as T;

export const enMessages = std(en, "en");
export const filMessages = std(fil, "fil");
export const idMessages = std(id, "id");
export const arMessages = std(ar, "ar");
export const thMessages = std(th, "th");
