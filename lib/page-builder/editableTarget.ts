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

/**
 * True for a `role="combobox"` element (e.g. `components/ui/combobox.tsx`'s
 * search input). Such elements own their Arrow/Enter/Escape keys and need the
 * keydown event to actually reach them, so the interceptor above exempts them
 * from the blanket Puck-hotkey suppression it otherwise applies to every
 * editable target.
 */
export function isSelfManagedComboboxTarget(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  return el.getAttribute("role") === "combobox";
}
