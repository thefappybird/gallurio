import { describe, it, expect } from "vitest";
import { bookDemoSubmissionSchema } from "./bookDemo";

describe("bookDemoSubmissionSchema", () => {
  it("accepts a valid submission", () => {
    const result = bookDemoSubmissionSchema.safeParse({
      name: "Emma Carter",
      email: "Emma@Example.com",
      businessName: "Studio Aurora",
      message: "Would love to see the calendar and gallery.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("emma@example.com");
    }
  });

  it("rejects an empty name", () => {
    const result = bookDemoSubmissionSchema.safeParse({
      name: "",
      email: "emma@example.com",
      businessName: "Studio Aurora",
      message: "Would love to see the calendar and gallery.",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe("Please enter your name");
    }
  });

  it("rejects a name over 100 chars", () => {
    const result = bookDemoSubmissionSchema.safeParse({
      name: "a".repeat(101),
      email: "emma@example.com",
      businessName: "Studio Aurora",
      message: "Would love to see the calendar and gallery.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = bookDemoSubmissionSchema.safeParse({
      name: "Emma Carter",
      email: "not-an-email",
      businessName: "Studio Aurora",
      message: "Would love to see the calendar and gallery.",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe("Enter a valid email");
    }
  });

  it("rejects an empty business name", () => {
    const result = bookDemoSubmissionSchema.safeParse({
      name: "Emma Carter",
      email: "emma@example.com",
      businessName: "",
      message: "Would love to see the calendar and gallery.",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe("Please enter your business name");
    }
  });

  it("rejects a business name over 100 chars", () => {
    const result = bookDemoSubmissionSchema.safeParse({
      name: "Emma Carter",
      email: "emma@example.com",
      businessName: "a".repeat(101),
      message: "Would love to see the calendar and gallery.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty message", () => {
    const result = bookDemoSubmissionSchema.safeParse({
      name: "Emma Carter",
      email: "emma@example.com",
      businessName: "Studio Aurora",
      message: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe("Please tell us what you'd like to see");
    }
  });

  it("rejects a message over 2000 chars", () => {
    const result = bookDemoSubmissionSchema.safeParse({
      name: "Emma Carter",
      email: "emma@example.com",
      businessName: "Studio Aurora",
      message: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace on all string fields", () => {
    const result = bookDemoSubmissionSchema.safeParse({
      name: "  Emma Carter  ",
      email: "  emma@example.com  ",
      businessName: "  Studio Aurora  ",
      message: "  Would love to see the calendar.  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Emma Carter");
      expect(result.data.businessName).toBe("Studio Aurora");
      expect(result.data.message).toBe("Would love to see the calendar.");
    }
  });
});
