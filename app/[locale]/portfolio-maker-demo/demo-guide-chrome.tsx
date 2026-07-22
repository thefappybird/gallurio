"use client";

import { useState, type ReactNode } from "react";
import { DemoDisclaimerBanner } from "@/components/app/demo-disclaimer-banner";
import { DemoGuideChromeContext } from "@/lib/page-builder/demoGuideChrome";
import { MarketingHeader } from "../(marketing)/_components/marketing-header";

export function DemoGuideChrome({ children }: { children: ReactNode }) {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <DemoGuideChromeContext.Provider value={setGuideOpen}>
      <div className="flex h-svh flex-col overflow-hidden">
        {!guideOpen && (
          <>
            <MarketingHeader />
            <DemoDisclaimerBanner />
          </>
        )}
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </DemoGuideChromeContext.Provider>
  );
}
