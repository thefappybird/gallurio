"use client";

import "@measured/puck/puck.css";
import "./editor.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Puck, type Config, type Data } from "@measured/puck";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { puckConfig } from "@/lib/page-builder/config";
import { resolveBrandKit } from "@/lib/page-builder/resolveBrandKit";
import type {
  PortfolioBrandKit,
  PortfolioContactConfig,
  PuckData,
} from "@/lib/page-builder/types";
import {
  savePortfolioDraftAction,
  publishPortfolioAction,
} from "../_actions";
import { PublishDialog } from "./PublishDialog";
import { ThemePanelDialog } from "./ThemePanelDialog";
import { ContactPanelDialog } from "./ContactPanelDialog";
import { MobileBanner } from "./MobileBanner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Zone = "home" | "gallery";
type SaveStatus = "idle" | "saving" | "saved";

type Props = {
  slug: string;
  workspaceName: string;
  initialData: { home: PuckData; gallery: PuckData };
  initialBrandKit: PortfolioBrandKit;
  initialContact: PortfolioContactConfig;
  publicOrigin: string;
};

const EMPTY_ZONE: PuckData = { content: [], root: {} };
const AUTOSAVE_MS = 1500;

// The editor is uncontrolled per zone — Puck owns the live edit state and emits
// it via onChange. Each content item needs a stable props.id; seeded template
// data has none, so add deterministic ids before handing data to <Puck>.
function ensureIds(data: PuckData): Data {
  const withIds = (items: PuckData["content"], prefix: string) =>
    (items ?? []).map((b, i) => ({
      ...b,
      props: { id: (b.props?.id as string) ?? `${prefix}-${b.type}-${i}`, ...b.props },
    }));
  return {
    root: data.root ?? {},
    content: withIds(data.content, "c"),
    zones: data.zones
      ? Object.fromEntries(Object.entries(data.zones).map(([k, v]) => [k, withIds(v, k)]))
      : undefined,
  } as Data;
}

export function EditorShell({
  slug,
  workspaceName,
  initialData,
  initialBrandKit,
  initialContact,
  publicOrigin,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor");

  const [activeZone, setActiveZone] = useState<Zone>("home");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [brandKit, setBrandKit] = useState(initialBrandKit);
  const [contact, setContact] = useState(initialContact);
  const [publishOpen, setPublishOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  // Source of truth for each zone's latest data, updated by Puck's onChange.
  // A ref (not state) so editing doesn't re-feed Puck mid-session.
  const zoneDataRef = useRef<Record<Zone, PuckData>>({
    home: initialData.home ?? EMPTY_ZONE,
    gallery: initialData.gallery ?? EMPTY_ZONE,
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Puck emits onChange once on mount (and again on the zone-switch remount).
  // Skip that first emission so merely loading a zone doesn't autosave/bump the
  // version — only genuine edits should.
  const ignoreNextChange = useRef(true);
  // Snapshots taken when a side panel opens, so closing it without saving reverts
  // the live preview to the last-saved value (no "looks saved but isn't" trap).
  const themeSnapshot = useRef<PortfolioBrandKit | null>(null);
  const contactSnapshot = useRef<PortfolioContactConfig | null>(null);

  // The data object handed to <Puck> at mount. Set only on zone switch (in the
  // event handler, from the ref) and initialized from props — never read the ref
  // during render. Paired with key={activeZone} so brand-kit re-renders (which
  // re-run this component) never reset the editor mid-edit.
  const [puckSeed, setPuckSeed] = useState<Data>(() =>
    ensureIds(initialData.home ?? EMPTY_ZONE)
  );

  const saveZone = useCallback(async (zone: Zone, data: PuckData): Promise<boolean> => {
    setSaveStatus("saving");
    const res = await savePortfolioDraftAction({ zone, data });
    if ("error" in res) {
      setSaveStatus("idle");
      toast.error(t("errorToast"));
      return false;
    }
    setSaveStatus("saved");
    return true;
  }, [t]);

  // Flush a pending autosave when leaving the active zone (effect cleanup runs on
  // zone change) and on unmount — so a final edit made within the debounce window
  // isn't lost, and the debounced timer never fires after the component is gone.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        // Intentionally read the LATEST ref value at flush time — that's the
        // freshest edit for the zone this effect was set up for (captured in
        // `activeZone`). Not a DOM-node ref, so the exhaustive-deps caution
        // about stale refs doesn't apply.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        void saveZone(activeZone, zoneDataRef.current[activeZone]);
      }
    };
  }, [activeZone, saveZone]);

  const handleChange = useCallback(
    (data: Data) => {
      const next = data as unknown as PuckData;
      zoneDataRef.current[activeZone] = next;
      if (ignoreNextChange.current) {
        ignoreNextChange.current = false;
        return; // mount/remount echo — capture data, but don't autosave.
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const zone = activeZone;
      saveTimer.current = setTimeout(() => void saveZone(zone, next), AUTOSAVE_MS);
    },
    [activeZone, saveZone]
  );

  function switchZone(zone: Zone) {
    if (zone === activeZone) return;
    // The leaving zone's pending autosave is flushed by the effect cleanup that
    // runs when activeZone changes. The new zone remounts <Puck> (key change)
    // and will echo onChange — ignore that first emission.
    ignoreNextChange.current = true;
    setPuckSeed(ensureIds(zoneDataRef.current[zone]));
    setActiveZone(zone);
  }

  async function handlePublish() {
    // Persist the active zone's latest edits FIRST and only publish if that
    // succeeds — otherwise we'd flip publishedAt against a stale draft while
    // telling the owner their newest edits went live.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const saved = await saveZone(activeZone, zoneDataRef.current[activeZone]);
    if (!saved) return;
    const res = await publishPortfolioAction();
    if ("error" in res) {
      toast.error(t("errorToast"));
      return;
    }
    setPublishOpen(false);
    toast.success(t("publishedToast"));
  }

  function openTheme() {
    themeSnapshot.current = brandKit;
    setThemeOpen(true);
  }
  function closeTheme(saved: boolean) {
    if (!saved && themeSnapshot.current) setBrandKit(themeSnapshot.current);
    setThemeOpen(false);
  }
  function openContact() {
    contactSnapshot.current = contact;
    setContactOpen(true);
  }
  function closeContact(saved: boolean) {
    if (!saved && contactSnapshot.current) setContact(contactSnapshot.current);
    setContactOpen(false);
  }

  const { cssVars, className } = resolveBrandKit(brandKit);

  return (
    <>
      <MobileBanner publicUrl={`${publicOrigin}/w/${slug}`} />

      <div
        className={cn("gallurio-editor", className)}
        style={cssVars as React.CSSProperties}
      >
        <Puck
          key={activeZone}
          // Pass the base Config (not Config<Components>) so Puck's deep generic
          // inference doesn't blow tsc's stack. The components are still typed at
          // their own block configs; the editor only needs the runtime registry.
          config={puckConfig as unknown as Config}
          data={puckSeed}
          onChange={handleChange}
          onPublish={() => setPublishOpen(true)}
          iframe={{ enabled: false }}
          headerTitle={`${workspaceName} · ${t(`zone.${activeZone}`)}`}
          viewports={[
            { width: 1280, label: "Desktop", icon: "Monitor" },
            { width: 768, label: "Tablet", icon: "Tablet" },
            { width: 390, label: "Mobile", icon: "Smartphone" },
          ]}
          overrides={{
            headerActions: ({ children }) => (
              <div className="flex items-center gap-2">
                {/* Zone switcher */}
                <div className="flex items-center gap-1" role="group" aria-label={t("zone.home")}>
                  {(["home", "gallery"] as const).map((zone) => (
                    <Button
                      key={zone}
                      type="button"
                      size="sm"
                      variant={activeZone === zone ? "default" : "outline"}
                      onClick={() => switchZone(zone)}
                    >
                      {t(`zone.${zone}`)}
                    </Button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  {saveStatus === "saving" ? t("save.saving") : saveStatus === "saved" ? t("save.saved") : t("save.idle")}
                </span>
                <Button type="button" size="sm" variant="outline" onClick={openTheme}>
                  {t("theme")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={openContact}>
                  {t("contact")}
                </Button>
                {/* Puck's default Publish button (wired to onPublish → dialog). */}
                {children}
              </div>
            ),
          }}
        />
      </div>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onConfirm={handlePublish}
        publicUrl={`${publicOrigin}/w/${slug}`}
      />
      <ThemePanelDialog
        open={themeOpen}
        brandKit={brandKit}
        onBrandKitChange={setBrandKit}
        onSaved={() => closeTheme(true)}
        onCancel={() => closeTheme(false)}
      />
      <ContactPanelDialog
        open={contactOpen}
        contact={contact}
        onContactChange={setContact}
        onSaved={() => closeContact(true)}
        onCancel={() => closeContact(false)}
      />
    </>
  );
}
