"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FieldA11y = {
  id: string;
  errorId: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

export function useFieldError(
  error?: string,
  opts?: { id?: string; describedBy?: string }
): FieldA11y {
  const generatedId = React.useId();
  const id = opts?.id ?? generatedId;
  const errorId = `${id}-error`;
  const describedBy =
    [error ? errorId : null, opts?.describedBy].filter(Boolean).join(" ") || undefined;

  return {
    id,
    errorId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };
}

export function FormField({
  label,
  error,
  hint,
  id,
  describedBy,
  className,
  labelClassName,
  errorClassName,
  children,
}: {
  label?: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  id?: string;
  describedBy?: string;
  className?: string;
  labelClassName?: string;
  errorClassName?: string;
  children: (a11y: FieldA11y) => React.ReactNode;
}): React.ReactElement {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  const errorId = `${controlId}-error`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const composedDescribedBy =
    [error ? errorId : null, hintId, describedBy].filter(Boolean).join(" ") || undefined;

  const a11y: FieldA11y = {
    id: controlId,
    errorId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": composedDescribedBy,
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={controlId} className={labelClassName}>
          {label}
        </Label>
      )}
      {hint && (
        <div id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </div>
      )}
      {children(a11y)}
      {error && (
        <p id={errorId} role="alert" className={cn("text-xs text-destructive", errorClassName)}>
          {error}
        </p>
      )}
    </div>
  );
}
