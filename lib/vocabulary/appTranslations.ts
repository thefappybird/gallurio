import "server-only";
import { createTranslator } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { peekOrgContext } from "@/lib/auth/requireOrg";
import { applyVocabulary } from "./apply";
import { resolveVocabularyPreset } from "./resolve";
import type { VocabularyPresetId } from "./presets";

type Messages = Awaited<ReturnType<typeof getMessages>>;

/**
 * Full request-locale messages with the workspace's vocabulary preset applied
 * to the `app` subtree. Signed-out / no workspace -> plain messages.
 * Pass `presetOverride` when the caller already holds the workspace (layout).
 */
export async function getAppMessages(
  presetOverride?: VocabularyPresetId,
): Promise<Messages> {
  const [messages, locale] = await Promise.all([getMessages(), getLocale()]);
  const preset =
    presetOverride ??
    (await peekOrgContext().then((ctx) =>
      ctx ? resolveVocabularyPreset(ctx.workspace) : null,
    ));
  return preset ? applyVocabulary(messages, locale, preset) : messages;
}

/**
 * Drop-in for next-intl `getTranslations(namespace)` on workspace-scoped
 * server surfaces: same call shape, vocabulary-aware.
 */
export async function getAppTranslations(namespace?: string) {
  const ctx = await peekOrgContext();
  if (!ctx) return getTranslations(namespace as never);
  const [messages, locale] = await Promise.all([getAppMessages(resolveVocabularyPreset(ctx.workspace)), getLocale()]);
  return createTranslator({ locale, messages, namespace: namespace as never });
}
