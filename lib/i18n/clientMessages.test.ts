import { describe, it, expect } from "vitest";
import { pickMessages } from "./clientMessages";

describe("pickMessages", () => {
  it("selects a dotted-path subtree and merges sibling paths under one parent", () => {
    const messages = {
      marketing: {
        nav: { pricing: "Pricing" },
        terms: { title: "Terms of Service", body: "Long legal text..." },
      },
      app: { theme: { light: "Light" } },
    };

    const picked = pickMessages(messages, ["marketing.nav", "marketing.terms.title"]);

    expect(picked).toEqual({
      marketing: {
        nav: { pricing: "Pricing" },
        terms: { title: "Terms of Service" },
      },
    });
  });

  it("silently ignores a path with no matching key in the catalog", () => {
    const messages = { marketing: { nav: { pricing: "Pricing" } } };

    const picked = pickMessages(messages, ["marketing.nav", "marketing.doesNotExist"]);

    expect(picked).toEqual({ marketing: { nav: { pricing: "Pricing" } } });
  });
});
