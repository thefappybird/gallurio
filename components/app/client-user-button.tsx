"use client";

import * as React from "react";
import { UserButton } from "@clerk/nextjs";

export function ClientUserButton() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sets mounted flag to suppress SSR hydration mismatch for Clerk UserButton
    setMounted(true);
  }, []);

  // Render a same-size placeholder until clerk-js has mounted so SSR and
  // the initial client render produce identical markup (no hydration mismatch).
  if (!mounted) {
    return <div className="size-7 shrink-0" aria-hidden />;
  }

  return (
    <UserButton
      appearance={{
        elements: {
          rootBox: "!size-7",
          userButtonBox: "!size-7",
          userButtonTrigger: "!size-7 !p-0",
          userButtonOuterIdentifier: "hidden",
          avatarBox: "!size-7",
        },
      }}
    />
  );
}
