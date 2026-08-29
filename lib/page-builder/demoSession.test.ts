import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_PROMO_CLAIMED_EVENT,
  DEMO_SESSION_KEY,
  demoDraftKey,
  demoImageLibraryKey,
  detectImportableDemoSession,
  getOrCreateDemoSessionId,
  isDemoPromoClaimed,
  markDemoPromoClaimed,
  markDemoSignupIntent,
  peekDemoSessionId,
  readDemoDraftBuffer,
  wipeDemoLocalStorage,
} from "./demoSession";

describe("getOrCreateDemoSessionId", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is stable across calls", () => {
    const first = getOrCreateDemoSessionId();
    const second = getOrCreateDemoSessionId();
    expect(second).toBe(first);
  });
});

describe("peekDemoSessionId", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null and does not create a session when none exists", () => {
    expect(peekDemoSessionId()).toBeNull();
    expect(window.localStorage.getItem(DEMO_SESSION_KEY)).toBeNull();
  });

  it("returns the existing session id without regenerating it", () => {
    const id = getOrCreateDemoSessionId();
    expect(peekDemoSessionId()).toBe(id);
  });
});

describe("readDemoDraftBuffer", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no buffer is stored for the session", () => {
    expect(readDemoDraftBuffer("sess-1")).toBeNull();
  });

  it("returns the parsed buffer for a valid v2 buffer", () => {
    const buffer = {
      version: 2,
      data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
      brandKit: {},
      contact: {},
      formLocale: "",
      formDir: "",
      headerConfig: {},
      collectionsPopup: {},
      draftId: null,
      draftName: "New Draft",
    };
    window.localStorage.setItem(demoDraftKey("sess-1"), JSON.stringify(buffer));
    expect(readDemoDraftBuffer("sess-1")).toEqual(buffer);
  });

  it("returns null for an unrecognized buffer version", () => {
    window.localStorage.setItem(demoDraftKey("sess-1"), JSON.stringify({ version: 99, data: {} }));
    expect(readDemoDraftBuffer("sess-1")).toBeNull();
  });
});

describe("wipeDemoLocalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("removes the draft buffer, image library, and session key", () => {
    window.localStorage.setItem(DEMO_SESSION_KEY, "sess-1");
    window.localStorage.setItem(demoDraftKey("sess-1"), "{}");
    window.localStorage.setItem(demoImageLibraryKey("sess-1"), "[]");

    wipeDemoLocalStorage("sess-1");

    expect(window.localStorage.getItem(DEMO_SESSION_KEY)).toBeNull();
    expect(window.localStorage.getItem(demoDraftKey("sess-1"))).toBeNull();
    expect(window.localStorage.getItem(demoImageLibraryKey("sess-1"))).toBeNull();
  });
});

describe("markDemoSignupIntent", () => {
  afterEach(() => {
    document.cookie = "gw_demo_import=; path=/; max-age=0";
  });

  it("sets the gw_demo_import marker cookie", () => {
    markDemoSignupIntent();
    expect(document.cookie).toContain("gw_demo_import=1");
  });
});

describe("detectImportableDemoSession", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no demo session exists", () => {
    expect(detectImportableDemoSession()).toBeNull();
  });

  it("returns the session id + buffer when both exist", () => {
    const id = getOrCreateDemoSessionId();
    const buffer = {
      version: 2,
      data: { home: { content: [], root: {} }, gallery: { content: [], root: {} } },
      brandKit: {},
      contact: {},
      formLocale: "",
      formDir: "",
      headerConfig: {},
      collectionsPopup: {},
      draftId: null,
      draftName: "New Draft",
    };
    window.localStorage.setItem(demoDraftKey(id), JSON.stringify(buffer));

    expect(detectImportableDemoSession()).toEqual({ sessionId: id, buffer });
  });
});

describe("demo promo claimed flag", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips: unclaimed until marked, then claimed", () => {
    expect(isDemoPromoClaimed()).toBe(false);
    markDemoPromoClaimed();
    expect(isDemoPromoClaimed()).toBe(true);
  });

  it("dispatches DEMO_PROMO_CLAIMED_EVENT so same-tab listeners react", () => {
    const listener = vi.fn();
    window.addEventListener(DEMO_PROMO_CLAIMED_EVENT, listener);
    markDemoPromoClaimed();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(DEMO_PROMO_CLAIMED_EVENT, listener);
  });
});
