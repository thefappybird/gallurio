import { applyVocabularyToString } from "@/lib/vocabulary/apply";
import type { VocabularyPresetId } from "@/lib/vocabulary/presets";

// Private-use char stands in for "%" inside user-supplied values so a client
// typing "%team%" can never be rewritten by the token pass.
const GUARD = "";

/**
 * Preset-word substitution for MEMBER-facing emails only. `t` expands %token%s in
 * static copy; `g` shields user-supplied values (names, titles, free text) that
 * are interpolated into that copy before `t` runs. `standard` is a no-op beyond
 * resolving tokens to today's words.
 */
export function emailVocabulary(preset: VocabularyPresetId | undefined, locale: string) {
  const p = preset ?? "standard";
  return {
    t: (s: string) => applyVocabularyToString(s, locale, p).replaceAll(GUARD, "%"),
    g: (s: string) => s.replaceAll("%", GUARD),
  };
}
