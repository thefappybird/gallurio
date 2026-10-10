import { VOCABULARY_PRESET_IDS, type VocabularyPresetId } from "./presets";

export function isVocabularyPresetId(value: unknown): value is VocabularyPresetId {
  return typeof value === "string" && (VOCABULARY_PRESET_IDS as readonly string[]).includes(value);
}

export function resolveVocabularyPreset(workspace: {
  vocabularyPreset?: VocabularyPresetId | null;
  businessType?: string;
}): VocabularyPresetId {
  if (workspace.vocabularyPreset) return workspace.vocabularyPreset;
  return isVocabularyPresetId(workspace.businessType) ? workspace.businessType : "standard";
}
