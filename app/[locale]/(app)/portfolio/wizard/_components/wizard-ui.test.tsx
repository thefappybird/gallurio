import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";

const push = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  usePathname: () => "/portfolio/wizard",
  Link: ({ children, href }: { children: ReactNode; href: string }) => createElement("a", { href }, children),
}));

let searchParamsValue = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsValue,
}));

vi.mock("../_actions", () => ({ saveWizardOutputAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/storage/uploadToCloudinary.client", () => ({ uploadImageToCloudinary: vi.fn() }));

import { WizardClient, type WizardTemplateSummary } from "./WizardClient";
import { StepTemplate } from "./StepTemplate";
import { StepBranding } from "./StepBranding";
import { StepReview } from "./StepReview";
import { PORTFOLIO_TEMPLATES } from "@/lib/page-builder/templates";

const templates: WizardTemplateSummary[] = PORTFOLIO_TEMPLATES.map((t) => ({
  id: t.id,
  label: t.label,
  description: t.description,
  previewImage: t.previewImage,
  defaultBrandKit: t.defaultBrandKit,
  defaultContact: t.defaultContact,
}));

const branding = { primaryColor: "#111111", secondaryColor: "#f5f5f5", tagline: "Tag", description: "Desc" };

describe("WizardClient", () => {
  it("renders the template step first for a fresh portfolio", () => {
    searchParamsValue = new URLSearchParams();
    renderWithProviders(
      <WizardClient
        templates={templates}
        defaultTemplateId="wedding-photographer"
        workspaceBranding={branding}
        hasExistingData={false}
      />
    );
    expect(screen.getByText("Pick a starting point")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Wedding Photographer/i })).toBeInTheDocument();
  });

  it("blocks with an overwrite confirmation when a portfolio already exists", () => {
    searchParamsValue = new URLSearchParams();
    renderWithProviders(
      <WizardClient
        templates={templates}
        defaultTemplateId="minimal"
        workspaceBranding={branding}
        hasExistingData
      />
    );
    expect(screen.getByText("You already have a portfolio")).toBeInTheDocument();
    expect(screen.queryByText("Pick a starting point")).not.toBeInTheDocument();
  });

  it("renders the review step when ?step=4", () => {
    searchParamsValue = new URLSearchParams("step=4");
    renderWithProviders(
      <WizardClient
        templates={templates}
        defaultTemplateId="planner"
        workspaceBranding={branding}
        hasExistingData={false}
      />
    );
    expect(screen.getByText("Review & launch")).toBeInTheDocument();
  });
});

describe("wizard step components (smoke)", () => {
  it("StepTemplate renders all templates", () => {
    renderWithProviders(
      <StepTemplate templates={templates} selectedId="minimal" onSelect={() => {}} />
    );
    expect(screen.getByRole("button", { name: /Minimal/i })).toBeInTheDocument();
  });

  it("StepBranding renders the tagline + description fields", () => {
    renderWithProviders(
      <StepBranding value={{ tagline: "x", description: "y" }} onChange={() => {}} />
    );
    expect(screen.getByLabelText("Tagline")).toBeInTheDocument();
    expect(screen.getByLabelText("About")).toBeInTheDocument();
  });

  it("StepReview shows the chosen template + image count", () => {
    renderWithProviders(
      <StepReview template={templates[0]} brandKit={templates[0].defaultBrandKit} imageCount={3} />
    );
    expect(screen.getByText("Wedding Photographer")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
