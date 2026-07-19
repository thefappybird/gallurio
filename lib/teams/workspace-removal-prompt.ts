function storageKey(workspaceId: string): string {
  return `gw_hide_workspace_removal_prompt:${workspaceId}`;
}

export function isWorkspaceRemovalPromptDismissed(workspaceId: string): boolean {
  return Boolean(window.localStorage.getItem(storageKey(workspaceId)));
}

export function dismissWorkspaceRemovalPrompt(workspaceId: string): void {
  window.localStorage.setItem(storageKey(workspaceId), "1");
}
