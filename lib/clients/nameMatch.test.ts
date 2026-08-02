import { describe, expect, it } from "vitest";
import { isClientMatch, nameKeys, normalizeName } from "./nameMatch";

describe("nameKeys", () => {
  it('collides "Last, First" with "First Last"', () => {
    // The two orderings a user might type for the same person must share a key,
    // so a comma-style entry still matches an existing plain-order client.
    const commaForm = nameKeys("Cruz, Ana");
    const plainForm = nameKeys("Ana Cruz");
    expect(commaForm.some((k) => plainForm.includes(k))).toBe(true);
  });

  it("returns no keys for blank or missing names", () => {
    expect(nameKeys("   ")).toEqual([]);
    expect(nameKeys(null)).toEqual([]);
    expect(nameKeys(undefined)).toEqual([]);
  });
});

describe("normalizeName", () => {
  it("folds case, punctuation and repeated whitespace", () => {
    expect(normalizeName("  Ana-Maria   O'Cruz  ")).toBe("ana maria o cruz");
  });
});

describe("isClientMatch", () => {
  it("matches on name alone when contact details differ", () => {
    expect(
      isClientMatch(
        { name: "Ana Cruz", email: "ana@old.com" },
        { name: "cruz,  ANA", email: "ana@new.com" }
      )
    ).toBe(true);
  });

  it("matches on email alone when the names are unrelated", () => {
    // Email equality is a stronger signal than the name — a rename still matches.
    expect(
      isClientMatch(
        { name: "Ana Cruz", email: "Ana@Example.com" },
        { name: "Bea Santos", email: "ana@example.com  " }
      )
    ).toBe(true);
  });

  it("matches on phone alone when the names are unrelated", () => {
    expect(
      isClientMatch(
        { name: "Ana Cruz", phone: "+639171234567" },
        { name: "Bea Santos", phone: " +639171234567 " }
      )
    ).toBe(true);
  });

  it("does not match two different people", () => {
    expect(
      isClientMatch(
        { name: "Ana Cruz", email: "ana@example.com", phone: "+639171234567" },
        { name: "Bea Santos", email: "bea@example.com", phone: "+639179999999" }
      )
    ).toBe(false);
  });

  it("treats absent contact fields as non-matching rather than equal", () => {
    // Now that email is optional, two clients with no email must not collide
    // just because both are blank — that would merge unrelated people.
    expect(
      isClientMatch(
        { name: "Ana Cruz", email: null, phone: "" },
        { name: "Bea Santos", email: null, phone: "" }
      )
    ).toBe(false);
  });
});
