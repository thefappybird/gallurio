import { describe, expect, it } from "vitest";
import { applyVocabulary, applyVocabularyToString } from "./apply";

describe("applyVocabularyToString", () => {
  it("lower/Cap singular+plural", () => {
    expect(applyVocabularyToString("%client% %clients% %Client% %Clients%", "en", "venue")).toBe(
      "host hosts Host Hosts",
    );
  });
  it("a/an articles", () => {
    expect(applyVocabularyToString("%a_booking% / %A_booking%", "en", "venue")).toBe("an event / An event");
    expect(applyVocabularyToString("%a_team%", "en", "venue")).toBe("a venue");
  });
  it("multiple tokens in one string", () => {
    expect(applyVocabularyToString("New %inquiry% for %a_client%, see %Bookings%", "en", "planner")).toBe(
      "New lead for a client, see Events",
    );
  });
  it("ICU plural preserved except tokens", () => {
    const src = "{count, plural, one {# %inquiry% from {name}} other {# %inquiries% don't match}}";
    expect(applyVocabularyToString(src, "en", "standard")).toBe(
      "{count, plural, one {# inquiry from {name}} other {# inquiries don't match}}",
    );
  });
  it("unknown token and bare percent untouched", () => {
    expect(applyVocabularyToString("%foo% 50% off 20%", "en", "venue")).toBe("%foo% 50% off 20%");
  });
  it("non-en uses localized term, no article", () => {
    expect(applyVocabularyToString("%a_team% %Teams%", "id", "standard")).toBe("tim Tim");
    expect(applyVocabularyToString("%A_client%", "fil", "standard")).toBe("Kliyente");
    expect(applyVocabularyToString("%teams%", "ar", "standard")).toBe("فِرق");
  });
});

describe("applyVocabulary", () => {
  const make = () => ({
    app: { title: "%Clients%", nested: { list: ["%a_booking%", 3], n: null } },
    common: { ok: "%client% stays" },
  });
  it("rewrites only app subtree; others same reference", () => {
    const m = make();
    const out = applyVocabulary(m, "en", "venue");
    expect(out.app).toEqual({ title: "Hosts", nested: { list: ["an event", 3], n: null } });
    expect(out.common).toBe(m.common);
  });
  it("does not mutate input", () => {
    const m = make();
    applyVocabulary(m, "en", "venue");
    expect(m).toEqual(make());
  });
  it("memoized per messages, locale, preset", () => {
    const m = make();
    const a = applyVocabulary(m, "en", "venue");
    expect(applyVocabulary(m, "en", "venue")).toBe(a);
    expect(applyVocabulary(m, "en", "planner")).not.toBe(a);
  });
});
