"use client";

import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function insertAtCaret(
  el: HTMLInputElement | HTMLTextAreaElement,
  emoji: string,
): string {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  return el.value.slice(0, start) + emoji + el.value.slice(end);
}

// Curated palette — covers common creative/event contexts
const EMOJI_PALETTE = [
  "😊", "😍", "🎉", "🙌", "👏", "✨", "🔥", "💫",
  "❤️", "💕", "🌟", "🎶", "📸", "🌸", "🍃", "🌈",
  "🏆", "👑", "💼", "📅", "📍", "🎯", "💡", "🙏",
];

export function EmojiButton({
  inputRef,
  onChange,
  className,
}: {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleEmoji(emoji: string) {
    const el = inputRef.current;
    if (el) {
      const newValue = insertAtCaret(el, emoji);
      const caretPos = (el.selectionStart ?? el.value.length) + [...emoji].length;
      onChange(newValue);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caretPos, caretPos);
      });
    }
    setOpen(false);
  }

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Insert emoji"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-background text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className
        )}
      >
        😊
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Emoji picker"
            className="absolute bottom-full right-0 z-50 mb-1 grid w-max grid-cols-8 gap-0.5 rounded border border-border bg-popover p-1.5 shadow-md"
          >
            {EMOJI_PALETTE.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={emoji}
                onClick={() => handleEmoji(emoji)}
                className="flex h-7 w-7 items-center justify-center rounded text-base hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
