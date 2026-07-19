import { beforeEach, describe, expect, it } from "vitest";
import {
  isWorkspaceRemovalPromptDismissed,
  dismissWorkspaceRemovalPrompt,
} from "./workspace-removal-prompt";

beforeEach(() => {
  window.localStorage.clear();
});

describe("workspace removal prompt dismissal", () => {
  it("is not dismissed by default", () => {
    expect(isWorkspaceRemovalPromptDismissed("ws1")).toBe(false);
  });

  it("is dismissed when the localStorage flag is already set", () => {
    window.localStorage.setItem("gw_hide_workspace_removal_prompt:ws1", "1");
    expect(isWorkspaceRemovalPromptDismissed("ws1")).toBe(true);
  });

  it("stores a flag in localStorage when dismissed", () => {
    dismissWorkspaceRemovalPrompt("ws1");
    expect(window.localStorage.getItem("gw_hide_workspace_removal_prompt:ws1")).toBe(
      "1",
    );
  });
});
