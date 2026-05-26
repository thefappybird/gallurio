import { describe, it, expect } from "vitest";
import { clientFormSchema } from "./client";

const validFull = {
  name: "Maria Santos",
  email: "maria@example.com",
  phone: "+63 912 345 6789",
  source: "referral" as const,
  tags: ["vip", "wedding"],
  notes: "Referred by Ana Reyes.",
};

describe("clientFormSchema", () => {
  it("accepts a valid full input (all fields)", () => {
    expect(clientFormSchema.safeParse(validFull).success).toBe(true);
  });

  it("accepts minimal input (name only, rest optional/defaulted)", () => {
    const result = clientFormSchema.safeParse({ name: "Jose Rizal" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("manual");
      expect(result.data.tags).toEqual([]);
      expect(result.data.notes).toBe("");
    }
  });

  it("rejects empty name with 'Name is required'", () => {
    const result = clientFormSchema.safeParse({ ...validFull, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find((i) => i.path[0] === "name");
      expect(nameError?.message).toBe("Name is required");
    }
  });

  it("rejects name longer than 120 chars", () => {
    const result = clientFormSchema.safeParse({ name: "a".repeat(121) });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email format", () => {
    const result = clientFormSchema.safeParse({ ...validFull, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("accepts null email", () => {
    const result = clientFormSchema.safeParse({ ...validFull, email: null });
    expect(result.success).toBe(true);
  });

  it("accepts undefined email (optional) and email is absent/undefined in output", () => {
    const { email: _omittedEmail, ...withoutEmail } = validFull;
    void _omittedEmail;
    const result = clientFormSchema.safeParse(withoutEmail);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
    }
  });

  it("lowercases a valid email on parse", () => {
    const result = clientFormSchema.safeParse({ ...validFull, email: "MARIA@Example.COM" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("maria@example.com");
    }
  });

  it("rejects phone longer than 40 chars", () => {
    const result = clientFormSchema.safeParse({ ...validFull, phone: "1".repeat(41) });
    expect(result.success).toBe(false);
  });

  it("accepts null phone", () => {
    const result = clientFormSchema.safeParse({ ...validFull, phone: null });
    expect(result.success).toBe(true);
  });

  it("normalizes empty-string email to null (so blank inputs do not fail .email())", () => {
    const result = clientFormSchema.safeParse({ ...validFull, email: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeNull();
    }
  });

  it("normalizes whitespace-only email to null", () => {
    const result = clientFormSchema.safeParse({ ...validFull, email: "   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeNull();
    }
  });

  it("normalizes empty-string phone to null (avoids persisting blank phone)", () => {
    const result = clientFormSchema.safeParse({ ...validFull, phone: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeNull();
    }
  });

  it("rejects an invalid source value", () => {
    const result = clientFormSchema.safeParse({ ...validFull, source: "unknown" });
    expect(result.success).toBe(false);
  });

  it("defaults source to 'manual' when omitted", () => {
    const result = clientFormSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("manual");
    }
  });

  it("rejects a tags array containing a tag longer than 40 chars", () => {
    const result = clientFormSchema.safeParse({ ...validFull, tags: ["a".repeat(41)] });
    expect(result.success).toBe(false);
  });

  it("defaults tags to [] when omitted", () => {
    const result = clientFormSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  it("rejects notes longer than 2000 chars", () => {
    const result = clientFormSchema.safeParse({ ...validFull, notes: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("defaults notes to '' when omitted", () => {
    const result = clientFormSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe("");
    }
  });

  it("trims leading and trailing whitespace from name", () => {
    const result = clientFormSchema.safeParse({ name: "  Maria Santos  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Maria Santos");
    }
  });
});
