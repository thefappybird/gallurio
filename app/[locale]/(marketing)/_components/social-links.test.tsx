import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: string) => {
    return (key: string) => `${namespace}:${key}`;
  }),
}));

import { SocialLinks } from "./social-links";

const ENV_KEYS = [
  "NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL",
  "NEXT_PUBLIC_SOCIAL_FACEBOOK_URL",
  "NEXT_PUBLIC_SOCIAL_REDDIT_URL",
  "NEXT_PUBLIC_SOCIAL_LINKEDIN_URL",
] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("SocialLinks", () => {
  it("omits the Instagram icon when its env var is unset", async () => {
    const el = await SocialLinks();
    render(el);

    expect(screen.queryByLabelText("marketing.contact.social:instagram")).not.toBeInTheDocument();
  });

  it("renders the Instagram icon with the configured href when its env var is set", async () => {
    process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL = "https://instagram.com/gallurio";
    const el = await SocialLinks();
    render(el);

    const link = screen.getByLabelText("marketing.contact.social:instagram");
    expect(link).toHaveAttribute("href", "https://instagram.com/gallurio");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
