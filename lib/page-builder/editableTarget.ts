/**
 * Returns true when `el` is an element where the user is actively typing
 * (input, textarea, select, or any contenteditable node).
 *
 * Used by the editor's keydown interceptor to stop Puck's global hotkeys
 * (Backspace, Delete, Escape, Ctrl/Cmd+Z, Ctrl/Cmd+S, …) from firing while
 * the user is editing text in a field inside the right-side properties panel.
 */
export function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return (el as HTMLElement).isContentEditable;
}
