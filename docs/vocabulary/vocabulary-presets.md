# Workspace vocabulary presets

## Problem
The app used photographer-generic words ("Bookings", "Clients", "Teams"). A venue thinks in Events and Venues. Owners pick a preset that renames four entity words everywhere in the app UI and member-facing emails. Routes, data, and logic do not change.

## Target
- Concepts: inquiry, booking, client, team. Universal labels (Dashboard, Portfolio, Notifications, Settings) never change.
- Presets: `standard` + one per business type (photographer, venue, planner, stylist, catering, entertainer, artists). `Workspace.vocabularyPreset` is `null` by default = follow `businessType` (`other` -> standard). Owner-set, workspace-wide, members read-only.
- Reach: in-app UI, member emails, notifications. NOT end-client emails, public portfolio, marketing.

## How it works
- Catalog strings under `app.*` in `messages/*.json` carry ASCII tokens: `%team%`, `%teams%`, `%Team%`, `%Teams%`, `%a_team%`, `%A_team%` (same for booking, client; inquiry plural is `%inquiries%`/`%Inquiries%`). ICU braces are untouched.
- `lib/vocabulary/presets.ts` holds terms per preset x concept x locale; `apply.ts` rewrites only the `app` subtree (memoized); `resolve.ts` maps workspace -> preset.
- Server: `getAppTranslations()` / `getAppMessages()` (`lib/vocabulary/appTranslations.ts`) replace `getTranslations` in `(app)` server files. Client: `(app)/layout.tsx` passes vocabulary-applied messages to its provider. `lib/i18n/request.ts` is deliberately NOT used (reading cookies there would make ISR marketing/public pages dynamic).
- Any code that reads `app.*` outside those paths must apply a preset itself (`applyVocabulary`), or raw `%tokens%` leak. Tests use `renderWithProviders` (standard preset).
- Member emails: `lib/email/vocabulary.ts` (`emailVocabulary`), senders take optional `vocabularyPreset`. Notifications: `buildNotificationContent` always applies a preset; title/body are stored pre-rendered, so old notifications do not follow a later preset change (the in-app list re-renders from `params`).
- Settings: `settings/customize/_panel.tsx` Vocabulary section; `updateVocabularyPresetAction` (owner-only, `revalidatePath("/", "layout")`).
- Marketing: scroll-reveal motion (`marketing-reveal.tsx`, `globals.css` MARKETING MOTION block) + `vocabulary-showcase.tsx` ("Speaks your trade").

## Adding copy
Use tokens for entity words in new `app.*` strings; `lib/vocabulary/catalogRoundtrip.test.ts` fails on unknown tokens or tokens left after any preset. Non-en locales use singular tokens where the language has invariant plurals; `ar` terms are indefinite (write `ال%team%` for definite).

## Known gaps
- Some English-only hint strings in id/ar/th are untokenized (need translation first).
- A few server-action errors still hardcode "team" ("Invalid team id").
- ar loses dual forms / tanwin in some strings; native review recommended.
