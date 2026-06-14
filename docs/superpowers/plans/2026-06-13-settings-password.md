# Settings Password (change / set) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-app password management to Settings → Account: password users can change their password (verify current → set new); Google/OAuth-only users can set a password via the existing reset-email flow.

**Architecture:** Two new server actions in the existing `settings/_actions.ts` (`updatePasswordAction`, `sendSetPasswordEmailAction`), backed by WorkOS (`authenticateWithPassword`, `updateUser`, `createPasswordReset`). A server helper `getAuthMethods()` reads `getUserIdentities()` to detect OAuth-only users; the settings page passes a `hasOAuth` flag to the Account panel, which renders either a change-password form or a set-password card. A shared `sendPasswordResetEmail()` helper sends the link via the existing email wrapper. No new env vars, no DB schema changes.

**Tech Stack:** Next.js 16 App Router, React 19 (server actions + `useTransition`), react-hook-form + Zod, WorkOS AuthKit (`@workos-inc/node`), next-intl, Vitest + Testing Library + in-memory Mongo.

---

## Reference facts (verified against the codebase)

- `settings/_actions.ts` imports: `workos` from `@/lib/workos`, `getAuthUser` from `@/lib/auth/session`, `connectDB` from `@/lib/db/mongoose`, `User` from `@/lib/db/models`, `type ActionResult` from `@/lib/auth/ownerContext`, `revalidatePath` from `next/cache`, `z` from `zod`. **No** `checkAuthRateLimit`/`getIp` imported yet.
- `ActionResult = { error: string } | { ok: true }` (from `@/lib/auth/ownerContext`).
- `getAuthUser()` → `{ workosUserId, email, name, avatarUrl } | null`.
- `checkAuthRateLimit({ email?, ip? })` from `@/lib/server/authRateLimit` returns `{ ok: true } | { ok: false, retryAfterSec: number }` (shape confirmed via `forgotPasswordAction`: reads `rl.ok` and `rl.retryAfterSec`).
- `AuthenticationException` is exported from `@workos-inc/node` and carries a `.code` (`AuthenticationErrorCode`). Codes `mfa_challenge`, `mfa_enrollment`, `email_verification_required`, `organization_selection_required` mean **the password was accepted** but another step is pending — these must NOT be treated as "wrong password".
- `workos.userManagement.authenticateWithPassword({ clientId, email, password })` — needs `clientId: process.env.WORKOS_CLIENT_ID`.
- `workos.userManagement.createPasswordReset({ email })` → `{ passwordResetToken, passwordResetUrl, expiresAt, ... }`.
- `workos.userManagement.getUserIdentities(userId)` → `Identity[]` where `Identity = { idpId, type: 'OAuth', provider: 'GoogleOAuth' | ... }`.
- Email wrapper: `sendEmail(input: { to; subject; html; text; replyTo? })` from `@/lib/email/send` → `{ ok: true; id } | { ok: false; error }`.
- `forgotPasswordAction` builds the reset URL as `` `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}` `` (no locale prefix) — match this exactly.
- Account panel: `app/[locale]/(app)/settings/account/_panel.tsx`, `"use client"`, exports `AccountPanel({ name, email, avatarUrl })`, uses `useTranslations("app.settings.account")`, `useTransition`, `toast` from `sonner`, primitives from `@/components/ui/{button,input,label}`. Sections are `<section className="flex flex-col gap-4 border-t border-border pt-8">`.
- Settings page: `app/[locale]/(app)/settings/[[...catchall]]/page.tsx`, server async. Has `userId` (workosUserId) from `requireOrg()` and `authUser` from `getAuthUser()`. Renders `<AccountPanel name={authUser?.name ?? ""} email={authUser?.email ?? ""} avatarUrl={authUser?.avatarUrl ?? null} />`.
- Settings actions test harness: `app/[locale]/(app)/settings/_actions.test.ts` uses in-memory Mongo (`@/test-utils/mongo`), `vi.hoisted` `mockWorkos` (currently only `userManagement.updateUser` + `multiFactorAuth.*`), `mockGetAuthUser`, `mockAuthAsOwnerA()` (sets `owner@test.com` / `OWNER_WORKOS_ID`). `getTranslations` mock returns the key string.
- Component test harness: `renderWithProviders` from `@/test-utils/render`, `screen` from `@testing-library/react`; real `en.json` strings are available in rendered output.
- Locale files: `messages/{en,fil,ms,id}.json`, password UI keys go under `app.settings.account`.

## File Structure

- **Create** `lib/email/sendPasswordResetEmail.ts` — shared reset-link sender (used by the new action).
- **Create** `lib/email/sendPasswordResetEmail.test.ts` — unit test.
- **Create** `lib/auth/authMethods.ts` — `getAuthMethods(workosUserId)` → `{ hasOAuth, oauthProviders }`.
- **Create** `lib/auth/authMethods.test.ts` — unit test.
- **Modify** `app/[locale]/(app)/settings/_actions.ts` — add `updatePasswordAction`, `sendSetPasswordEmailAction`, schemas, imports.
- **Modify** `app/[locale]/(app)/settings/_actions.test.ts` — extend `mockWorkos`, mock rate-limit + email helper, add tests.
- **Create** `app/[locale]/(app)/settings/account/_password-section.tsx` — `"use client"`; renders change-password form or set-password card from `hasOAuth`.
- **Create** `app/[locale]/(app)/settings/account/_password-section.test.tsx` — gating render test.
- **Modify** `app/[locale]/(app)/settings/account/_panel.tsx` — add `hasOAuth` prop, render `<PasswordSection hasOAuth={hasOAuth} />`.
- **Modify** `app/[locale]/(app)/settings/[[...catchall]]/page.tsx` — compute `hasOAuth` via `getAuthMethods(userId)`, pass to `AccountPanel`.
- **Modify** `messages/{en,fil,ms,id}.json` — add password keys under `app.settings.account`.

---

### Task 1: Shared password-reset email helper

**Files:**
- Create: `lib/email/sendPasswordResetEmail.ts`
- Test: `lib/email/sendPasswordResetEmail.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/email/sendPasswordResetEmail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue({ ok: true, id: "email_1" }),
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: mockSendEmail }));

import { sendPasswordResetEmail } from "./sendPasswordResetEmail";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  process.env.NEXT_PUBLIC_APP_NAME = "Gallurio";
});

describe("sendPasswordResetEmail", () => {
  it("sends a reset link containing the token to the given email", async () => {
    await sendPasswordResetEmail("user@example.com", "tok_abc");

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const arg = mockSendEmail.mock.calls[0]![0]!;
    expect(arg.to).toBe("user@example.com");
    expect(arg.html).toContain(
      "https://app.example.com/reset-password?token=tok_abc",
    );
    expect(arg.text).toContain("tok_abc");
    expect(arg.subject).toContain("Gallurio");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run lib/email/sendPasswordResetEmail`
Expected: FAIL — `Failed to resolve import "./sendPasswordResetEmail"`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/email/sendPasswordResetEmail.ts
import "server-only";
import { sendEmail } from "@/lib/email/send";

/**
 * Sends a password reset / set-password link to `email`. The link points at the
 * first-party reset-password page (matching forgotPasswordAction's URL shape).
 * Used by both the forgot-password flow and the in-settings "set a password" flow.
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gallurio.app";
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Gallurio";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: `Set your ${appName} password`,
    html: `<p>Click the link below to set your password. It expires soon.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    text: `Set your password: ${resetUrl}`,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run lib/email/sendPasswordResetEmail`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/email/sendPasswordResetEmail.ts lib/email/sendPasswordResetEmail.test.ts
git commit -m "feat(settings): add shared password reset email helper"
```

---

### Task 2: `getAuthMethods` helper (OAuth detection)

**Files:**
- Create: `lib/auth/authMethods.ts`
- Test: `lib/auth/authMethods.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/auth/authMethods.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUserIdentities } = vi.hoisted(() => ({
  mockGetUserIdentities: vi.fn(),
}));
vi.mock("@/lib/workos", () => ({
  workos: { userManagement: { getUserIdentities: mockGetUserIdentities } },
}));

import { getAuthMethods } from "./authMethods";

beforeEach(() => vi.clearAllMocks());

describe("getAuthMethods", () => {
  it("reports hasOAuth=false when the user has no identities (password user)", async () => {
    mockGetUserIdentities.mockResolvedValue([]);
    const result = await getAuthMethods("user_1");
    expect(result).toEqual({ hasOAuth: false, oauthProviders: [] });
  });

  it("reports hasOAuth=true and lists providers for an OAuth user", async () => {
    mockGetUserIdentities.mockResolvedValue([
      { idpId: "g1", type: "OAuth", provider: "GoogleOAuth" },
    ]);
    const result = await getAuthMethods("user_2");
    expect(result.hasOAuth).toBe(true);
    expect(result.oauthProviders).toEqual(["GoogleOAuth"]);
  });

  it("defaults to hasOAuth=false when the WorkOS call throws", async () => {
    mockGetUserIdentities.mockRejectedValue(new Error("network"));
    const result = await getAuthMethods("user_3");
    expect(result).toEqual({ hasOAuth: false, oauthProviders: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run lib/auth/authMethods`
Expected: FAIL — cannot resolve `./authMethods`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/auth/authMethods.ts
import "server-only";
import { workos } from "@/lib/workos";

export type AuthMethods = {
  hasOAuth: boolean;
  oauthProviders: string[];
};

/**
 * Resolves how a user can authenticate. In this app the only sign-up paths are
 * email+password and Google OAuth, so a user with any OAuth identity signed up
 * via Google and has no password initially. Failure is non-fatal: we default to
 * hasOAuth=false (show the change-password form) and let the caller proceed.
 */
export async function getAuthMethods(
  workosUserId: string,
): Promise<AuthMethods> {
  try {
    const identities = await workos.userManagement.getUserIdentities(
      workosUserId,
    );
    const oauthProviders = identities.map((i) => i.provider);
    return { hasOAuth: oauthProviders.length > 0, oauthProviders };
  } catch (err) {
    console.error("[authMethods] getUserIdentities failed", err);
    return { hasOAuth: false, oauthProviders: [] };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run lib/auth/authMethods`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/authMethods.ts lib/auth/authMethods.test.ts
git commit -m "feat(settings): add getAuthMethods OAuth detection helper"
```

---

### Task 3: `updatePasswordAction` server action

**Files:**
- Modify: `app/[locale]/(app)/settings/_actions.ts`
- Modify: `app/[locale]/(app)/settings/_actions.test.ts`

- [ ] **Step 1: Extend the test harness mocks**

In `app/[locale]/(app)/settings/_actions.test.ts`, update the hoisted `mockWorkos` to add the three methods this feature uses, and add two new module mocks. Replace the existing `vi.hoisted(...)` block:

```typescript
const { mockWorkos, mockGetAuthUser } = vi.hoisted(() => {
  const mockWorkos = {
    userManagement: {
      updateUser: vi.fn(),
      authenticateWithPassword: vi.fn(),
      createPasswordReset: vi.fn(),
      getUserIdentities: vi.fn(),
    },
    multiFactorAuth: {
      createUserAuthFactor: vi.fn(),
      listUserAuthFactors: vi.fn(),
      verifyChallenge: vi.fn(),
      deleteFactor: vi.fn(),
    },
  };
  const mockGetAuthUser = vi.fn();
  return { mockWorkos, mockGetAuthUser };
});

vi.mock("@/lib/workos", () => ({ workos: mockWorkos }));
```

Add these two mocks alongside the other `vi.mock(...)` calls (anywhere in the mock block, before the lazy imports):

```typescript
vi.mock("@/lib/server/authRateLimit", () => ({
  checkAuthRateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/email/sendPasswordResetEmail", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));
```

Extend the lazy import of `./_actions` to include the two new actions, and add imports for the helpers + the WorkOS exception:

```typescript
import {
  updateWorkspaceBusinessAction,
  updateWorkspaceBrandingAction,
  updatePublicPageSettingsAction,
  togglePublicPagePublishedAction,
  deleteWorkspaceAction,
  updateTimeFormatAction,
  requestDataExportAction,
  updateProfileNameAction,
  enrollMfaAction,
  verifyMfaEnrollmentAction,
  disableMfaAction,
  setActiveWorkspaceAction,
  updatePasswordAction,
  sendSetPasswordEmailAction,
} from "./_actions";
import { checkAuthRateLimit } from "@/lib/server/authRateLimit";
import { sendPasswordResetEmail } from "@/lib/email/sendPasswordResetEmail";
import { AuthenticationException } from "@workos-inc/node";
```

- [ ] **Step 2: Write the failing tests**

Add this `describe` block to `app/[locale]/(app)/settings/_actions.test.ts`:

```typescript
describe("updatePasswordAction", () => {
  const validInput = {
    currentPassword: "oldpassword",
    newPassword: "newpassword123",
    confirmPassword: "newpassword123",
  };

  it("verifies the current password then updates it", async () => {
    mockWorkos.userManagement.authenticateWithPassword.mockResolvedValue({
      user: { id: OWNER_WORKOS_ID },
    });
    mockWorkos.userManagement.updateUser.mockResolvedValue({});

    const result = await updatePasswordAction(validInput);
    expect(result).toEqual({ ok: true });

    expect(
      mockWorkos.userManagement.authenticateWithPassword,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ email: "owner@test.com", password: "oldpassword" }),
    );
    expect(mockWorkos.userManagement.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER_WORKOS_ID,
        password: "newpassword123",
      }),
    );
  });

  it("returns 'incorrect' when current password is wrong", async () => {
    mockWorkos.userManagement.authenticateWithPassword.mockRejectedValue(
      new AuthenticationException(
        401,
        { code: "invalid_credentials", message: "bad" } as never,
        "req_1",
      ),
    );

    const result = await updatePasswordAction(validInput);
    expect(result).toEqual({ error: "Current password is incorrect." });
    expect(mockWorkos.userManagement.updateUser).not.toHaveBeenCalled();
  });

  it("treats an MFA-challenge exception as a correct password and proceeds", async () => {
    mockWorkos.userManagement.authenticateWithPassword.mockRejectedValue(
      new AuthenticationException(
        401,
        { code: "mfa_challenge", message: "mfa" } as never,
        "req_2",
      ),
    );
    mockWorkos.userManagement.updateUser.mockResolvedValue({});

    const result = await updatePasswordAction(validInput);
    expect(result).toEqual({ ok: true });
    expect(mockWorkos.userManagement.updateUser).toHaveBeenCalled();
  });

  it("rejects when new and confirm do not match", async () => {
    const result = await updatePasswordAction({
      ...validInput,
      confirmPassword: "different123",
    });
    expect(result).toEqual({ error: "Passwords do not match." });
    expect(
      mockWorkos.userManagement.authenticateWithPassword,
    ).not.toHaveBeenCalled();
  });

  it("rejects a too-short new password", async () => {
    const result = await updatePasswordAction({
      currentPassword: "oldpassword",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect("error" in result).toBe(true);
    expect(
      mockWorkos.userManagement.authenticateWithPassword,
    ).not.toHaveBeenCalled();
  });

  it("returns an error when rate limited", async () => {
    vi.mocked(checkAuthRateLimit).mockResolvedValueOnce({
      ok: false,
      retryAfterSec: 60,
    });
    const result = await updatePasswordAction(validInput);
    expect("error" in result).toBe(true);
    expect(
      mockWorkos.userManagement.authenticateWithPassword,
    ).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const result = await updatePasswordAction(validInput);
    expect(result).toEqual({ error: "Not authenticated" });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test --run settings/_actions`
Expected: FAIL — `updatePasswordAction is not a function` (not yet exported).

- [ ] **Step 4: Implement the action**

In `app/[locale]/(app)/settings/_actions.ts`, add to the imports at the top:

```typescript
import { AuthenticationException } from "@workos-inc/node";
import { checkAuthRateLimit } from "@/lib/server/authRateLimit";
import { sendPasswordResetEmail } from "@/lib/email/sendPasswordResetEmail";
```

Then append this near the other profile actions:

```typescript
const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(1),
});

// AuthenticationException codes that mean the PASSWORD was accepted but a further
// step (MFA, email verification, org selection) is pending. For password
// verification purposes these count as success.
const PASSWORD_OK_CODES = new Set([
  "mfa_challenge",
  "mfa_enrollment",
  "email_verification_required",
  "organization_selection_required",
]);

export async function updatePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const { currentPassword, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword)
    return { error: "Passwords do not match." };

  const rl = await checkAuthRateLimit({ email: authUser.email });
  if (!rl.ok)
    return {
      error: `Too many attempts. Try again in ${rl.retryAfterSec} seconds.`,
    };

  // Verify the current password by attempting authentication.
  try {
    await workos.userManagement.authenticateWithPassword({
      clientId: process.env.WORKOS_CLIENT_ID!,
      email: authUser.email,
      password: currentPassword,
    });
  } catch (err) {
    if (err instanceof AuthenticationException) {
      if (!PASSWORD_OK_CODES.has(err.code)) {
        return { error: "Current password is incorrect." };
      }
      // Password was correct; a pending step (e.g. MFA) is fine here.
    } else {
      console.error("[settings] authenticateWithPassword failed", err);
      return {
        error: "Could not verify your current password. Please try again.",
      };
    }
  }

  try {
    await workos.userManagement.updateUser({
      userId: authUser.workosUserId,
      password: newPassword,
    });
  } catch (err) {
    console.error("[settings] updateUser(password) failed", err);
    return { error: "Failed to update password. Please try again." };
  }

  return { ok: true };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test --run settings/_actions`
Expected: PASS (all `updatePasswordAction` tests + existing tests still green).

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/settings/_actions.ts" "app/[locale]/(app)/settings/_actions.test.ts"
git commit -m "feat(settings): add updatePasswordAction with current-password verification"
```

---

### Task 4: `sendSetPasswordEmailAction` server action

**Files:**
- Modify: `app/[locale]/(app)/settings/_actions.ts`
- Modify: `app/[locale]/(app)/settings/_actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `app/[locale]/(app)/settings/_actions.test.ts`:

```typescript
describe("sendSetPasswordEmailAction", () => {
  it("creates a reset token and emails the link to the user", async () => {
    mockWorkos.userManagement.createPasswordReset.mockResolvedValue({
      passwordResetToken: "tok_xyz",
      passwordResetUrl: "https://workos/x",
    });

    const result = await sendSetPasswordEmailAction();
    expect(result).toEqual({ ok: true });

    expect(
      mockWorkos.userManagement.createPasswordReset,
    ).toHaveBeenCalledWith({ email: "owner@test.com" });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      "owner@test.com",
      "tok_xyz",
    );
  });

  it("returns an error when rate limited", async () => {
    vi.mocked(checkAuthRateLimit).mockResolvedValueOnce({
      ok: false,
      retryAfterSec: 60,
    });
    const result = await sendSetPasswordEmailAction();
    expect("error" in result).toBe(true);
    expect(
      mockWorkos.userManagement.createPasswordReset,
    ).not.toHaveBeenCalled();
  });

  it("returns an error when WorkOS createPasswordReset throws", async () => {
    mockWorkos.userManagement.createPasswordReset.mockRejectedValueOnce(
      new Error("workos down"),
    );
    const result = await sendSetPasswordEmailAction();
    expect("error" in result).toBe(true);
  });

  it("rejects an unauthenticated caller", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const result = await sendSetPasswordEmailAction();
    expect(result).toEqual({ error: "Not authenticated" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test --run settings/_actions`
Expected: FAIL — `sendSetPasswordEmailAction is not a function`.

- [ ] **Step 3: Implement the action**

Append to `app/[locale]/(app)/settings/_actions.ts`:

```typescript
export async function sendSetPasswordEmailAction(): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  const rl = await checkAuthRateLimit({ email: authUser.email });
  if (!rl.ok)
    return {
      error: `Too many attempts. Try again in ${rl.retryAfterSec} seconds.`,
    };

  try {
    const reset = await workos.userManagement.createPasswordReset({
      email: authUser.email,
    });
    await sendPasswordResetEmail(authUser.email, reset.passwordResetToken);
  } catch (err) {
    console.error("[settings] sendSetPasswordEmail failed", err);
    return { error: "Could not send the email. Please try again." };
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --run settings/_actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/settings/_actions.ts" "app/[locale]/(app)/settings/_actions.test.ts"
git commit -m "feat(settings): add sendSetPasswordEmailAction for OAuth users"
```

---

### Task 5: Add locale keys (all four languages)

**Files:**
- Modify: `messages/en.json`, `messages/fil.json`, `messages/ms.json`, `messages/id.json`

- [ ] **Step 1: Add keys to `messages/en.json`**

Inside the `app.settings.account` object (after `"nameSaved"`), add:

```json
    "passwordSection": "Password",
    "passwordHint": "Change the password you use to sign in.",
    "currentPasswordLabel": "Current password",
    "newPasswordLabel": "New password",
    "confirmPasswordLabel": "Confirm new password",
    "newPasswordHint": "At least 8 characters",
    "changePassword": "Change password",
    "updatingPassword": "Updating…",
    "passwordSaved": "Password updated.",
    "passwordMismatch": "Passwords do not match.",
    "passwordTooShort": "Password must be at least 8 characters.",
    "passwordRequired": "Enter your current password.",
    "showPassword": "Show password",
    "hidePassword": "Hide password",
    "setPasswordHint": "You sign in with Google. Set a password to also sign in with your email.",
    "setPassword": "Set a password",
    "sendingSetPassword": "Sending…",
    "setPasswordSent": "Check your email for a link to set your password."
```

(Ensure the key before this block ends with a comma.)

- [ ] **Step 2: Add keys to `messages/fil.json`** (inside `app.settings.account`)

```json
    "passwordSection": "Password",
    "passwordHint": "Baguhin ang password na ginagamit mo para mag-sign in.",
    "currentPasswordLabel": "Kasalukuyang password",
    "newPasswordLabel": "Bagong password",
    "confirmPasswordLabel": "Kumpirmahin ang bagong password",
    "newPasswordHint": "Hindi bababa sa 8 character",
    "changePassword": "Baguhin ang password",
    "updatingPassword": "Ina-update…",
    "passwordSaved": "Na-update ang password.",
    "passwordMismatch": "Hindi magkatugma ang mga password.",
    "passwordTooShort": "Dapat hindi bababa sa 8 character ang password.",
    "passwordRequired": "Ilagay ang iyong kasalukuyang password.",
    "showPassword": "Ipakita ang password",
    "hidePassword": "Itago ang password",
    "setPasswordHint": "Nagsa-sign in ka gamit ang Google. Magtakda ng password para makapag-sign in din gamit ang iyong email.",
    "setPassword": "Magtakda ng password",
    "sendingSetPassword": "Ipinapadala…",
    "setPasswordSent": "Tingnan ang iyong email para sa link na magtatakda ng iyong password."
```

- [ ] **Step 3: Add keys to `messages/ms.json`** (inside `app.settings.account`)

```json
    "passwordSection": "Kata laluan",
    "passwordHint": "Tukar kata laluan yang anda guna untuk log masuk.",
    "currentPasswordLabel": "Kata laluan semasa",
    "newPasswordLabel": "Kata laluan baharu",
    "confirmPasswordLabel": "Sahkan kata laluan baharu",
    "newPasswordHint": "Sekurang-kurangnya 8 aksara",
    "changePassword": "Tukar kata laluan",
    "updatingPassword": "Mengemas kini…",
    "passwordSaved": "Kata laluan dikemas kini.",
    "passwordMismatch": "Kata laluan tidak sepadan.",
    "passwordTooShort": "Kata laluan mesti sekurang-kurangnya 8 aksara.",
    "passwordRequired": "Masukkan kata laluan semasa anda.",
    "showPassword": "Tunjuk kata laluan",
    "hidePassword": "Sembunyi kata laluan",
    "setPasswordHint": "Anda log masuk dengan Google. Tetapkan kata laluan untuk turut log masuk dengan e-mel anda.",
    "setPassword": "Tetapkan kata laluan",
    "sendingSetPassword": "Menghantar…",
    "setPasswordSent": "Semak e-mel anda untuk pautan menetapkan kata laluan anda."
```

- [ ] **Step 4: Add keys to `messages/id.json`** (inside `app.settings.account`)

```json
    "passwordSection": "Kata sandi",
    "passwordHint": "Ubah kata sandi yang Anda gunakan untuk masuk.",
    "currentPasswordLabel": "Kata sandi saat ini",
    "newPasswordLabel": "Kata sandi baru",
    "confirmPasswordLabel": "Konfirmasi kata sandi baru",
    "newPasswordHint": "Minimal 8 karakter",
    "changePassword": "Ubah kata sandi",
    "updatingPassword": "Memperbarui…",
    "passwordSaved": "Kata sandi diperbarui.",
    "passwordMismatch": "Kata sandi tidak cocok.",
    "passwordTooShort": "Kata sandi harus minimal 8 karakter.",
    "passwordRequired": "Masukkan kata sandi Anda saat ini.",
    "showPassword": "Tampilkan kata sandi",
    "hidePassword": "Sembunyikan kata sandi",
    "setPasswordHint": "Anda masuk dengan Google. Atur kata sandi untuk juga masuk dengan email Anda.",
    "setPassword": "Atur kata sandi",
    "sendingSetPassword": "Mengirim…",
    "setPasswordSent": "Periksa email Anda untuk tautan mengatur kata sandi."
```

- [ ] **Step 5: Verify all four files are valid JSON**

Run: `node -e "['en','fil','ms','id'].forEach(l=>{JSON.parse(require('fs').readFileSync('messages/'+l+'.json','utf8'));console.log(l,'ok')})"`
Expected: `en ok` / `fil ok` / `ms ok` / `id ok` (no parse error).

- [ ] **Step 6: Commit**

```bash
git add messages/en.json messages/fil.json messages/ms.json messages/id.json
git commit -m "i18n(settings): add password change/set keys for en, fil, ms, id"
```

---

### Task 6: Password section client component

**Files:**
- Create: `app/[locale]/(app)/settings/account/_password-section.tsx`
- Test: `app/[locale]/(app)/settings/account/_password-section.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// app/[locale]/(app)/settings/account/_password-section.test.tsx
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { PasswordSection } from "./_password-section";

vi.mock("../_actions", () => ({
  updatePasswordAction: vi.fn(),
  sendSetPasswordEmailAction: vi.fn(),
}));

describe("PasswordSection", () => {
  it("renders the change-password form for password users", () => {
    renderWithProviders(<PasswordSection hasOAuth={false} />);
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change password" }),
    ).toBeInTheDocument();
  });

  it("renders the set-password card for OAuth users", () => {
    renderWithProviders(<PasswordSection hasOAuth={true} />);
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set a password" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run account/_password-section`
Expected: FAIL — cannot resolve `./_password-section`.

- [ ] **Step 3: Write the implementation**

```tsx
// app/[locale]/(app)/settings/account/_password-section.tsx
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePasswordAction, sendSetPasswordEmailAction } from "../_actions";

type Props = { hasOAuth: boolean };

export function PasswordSection({ hasOAuth }: Props) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      {hasOAuth ? <SetPasswordCard /> : <ChangePasswordForm />}
    </section>
  );
}

function ChangePasswordForm() {
  const t = useTranslations("app.settings.account");
  const [pending, startTransition] = useTransition();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const schema = z
    .object({
      currentPassword: z.string().min(1, t("passwordRequired")),
      newPassword: z.string().min(8, t("passwordTooShort")).max(128),
      confirmPassword: z.string().min(1),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      message: t("passwordMismatch"),
      path: ["confirmPassword"],
    });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await updatePasswordAction(values);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success(t("passwordSaved"));
        reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
    });
  }

  const fields = [
    {
      id: "current-password",
      label: t("currentPasswordLabel"),
      name: "currentPassword" as const,
      autoComplete: "current-password",
      show: showCurrent,
      toggle: () => setShowCurrent((v) => !v),
      hint: undefined as string | undefined,
    },
    {
      id: "new-password",
      label: t("newPasswordLabel"),
      name: "newPassword" as const,
      autoComplete: "new-password",
      show: showNew,
      toggle: () => setShowNew((v) => !v),
      hint: t("newPasswordHint"),
    },
    {
      id: "confirm-password",
      label: t("confirmPasswordLabel"),
      name: "confirmPassword" as const,
      autoComplete: "new-password",
      show: showConfirm,
      toggle: () => setShowConfirm((v) => !v),
      hint: undefined,
    },
  ];

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">{t("passwordSection")}</h2>
        <p className="text-sm text-muted-foreground">{t("passwordHint")}</p>
      </div>
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {fields.map((f) => (
          <div key={f.id} className="flex flex-col gap-1.5">
            <Label htmlFor={f.id}>{f.label}</Label>
            <div className="relative">
              <Input
                id={f.id}
                type={f.show ? "text" : "password"}
                autoComplete={f.autoComplete}
                disabled={pending}
                className="pr-10"
                aria-invalid={!!errors[f.name]}
                aria-describedby={errors[f.name] ? `${f.id}-error` : undefined}
                {...register(f.name)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={f.toggle}
                aria-label={f.show ? t("hidePassword") : t("showPassword")}
              >
                {f.show ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {f.hint && (
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            )}
            {errors[f.name] && (
              <p
                id={`${f.id}-error`}
                role="alert"
                className="text-xs text-destructive"
              >
                {errors[f.name]?.message}
              </p>
            )}
          </div>
        ))}
        <div>
          <Button type="submit" disabled={pending} className="min-h-11 min-w-28">
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                {t("updatingPassword")}
              </>
            ) : (
              t("changePassword")
            )}
          </Button>
        </div>
      </form>
    </>
  );
}

function SetPasswordCard() {
  const t = useTranslations("app.settings.account");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const result = await sendSetPasswordEmailAction();
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        setSent(true);
        toast.success(t("setPasswordSent"));
      }
    });
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">{t("passwordSection")}</h2>
        <p className="text-sm text-muted-foreground">{t("setPasswordHint")}</p>
      </div>
      {sent ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("setPasswordSent")}
        </p>
      ) : (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={handleClick}
            disabled={pending}
            className="min-h-11"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                {t("sendingSetPassword")}
              </>
            ) : (
              t("setPassword")
            )}
          </Button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run account/_password-section`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/settings/account/_password-section.tsx" "app/[locale]/(app)/settings/account/_password-section.test.tsx"
git commit -m "feat(settings): add password section UI (change form + set-password card)"
```

---

### Task 7: Wire the panel and page together

**Files:**
- Modify: `app/[locale]/(app)/settings/account/_panel.tsx`
- Modify: `app/[locale]/(app)/settings/[[...catchall]]/page.tsx`

- [ ] **Step 1: Add `hasOAuth` to AccountPanel and render the section**

In `app/[locale]/(app)/settings/account/_panel.tsx`:

Add the import near the other imports:

```typescript
import { PasswordSection } from "./_password-section";
```

Change the `Props` type and component signature:

```typescript
type Props = {
  name: string;
  email: string;
  avatarUrl: string | null;
  hasOAuth: boolean;
};

export function AccountPanel({ name, email, avatarUrl, hasOAuth }: Props) {
```

Add `<PasswordSection hasOAuth={hasOAuth} />` as the last child of the top-level `<div className="flex flex-col gap-8">`, immediately after the closing `</section>` of the name form:

```tsx
      {/* Password */}
      <PasswordSection hasOAuth={hasOAuth} />
    </div>
  );
}
```

- [ ] **Step 2: Compute `hasOAuth` in the settings page and pass it down**

In `app/[locale]/(app)/settings/[[...catchall]]/page.tsx`:

Add the import near the other auth imports:

```typescript
import { getAuthMethods } from "@/lib/auth/authMethods";
```

After `const mfaEnabled = userDoc?.mfaEnabled ?? false;`, add:

```typescript
  const { hasOAuth } = await getAuthMethods(userId);
```

Update the `account` page body to pass the prop:

```tsx
          body: (
            <AccountPanel
              name={authUser?.name ?? ""}
              email={authUser?.email ?? ""}
              avatarUrl={authUser?.avatarUrl ?? null}
              hasOAuth={hasOAuth}
            />
          ),
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS — no errors. (Confirms `AccountPanel` callers and the new prop line up.)

- [ ] **Step 4: Run the settings test suites + the catchall page test**

Run: `pnpm test --run settings`
Expected: PASS — including the existing `[[...catchall]]/page.test.ts` (note: `getAuthMethods` swallows errors and defaults to `hasOAuth:false`, so an unmocked `workos.getUserIdentities` in that test will not crash it). If `page.test.ts` fails because it asserts exact `AccountPanel` props, add `hasOAuth: false` to that assertion.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/settings/account/_panel.tsx" "app/[locale]/(app)/settings/[[...catchall]]/page.tsx"
git commit -m "feat(settings): wire password section into account panel"
```

---

### Task 8: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: no errors in the touched files.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Run all affected tests**

Run: `pnpm test --run settings lib/email/sendPasswordResetEmail lib/auth/authMethods`
Expected: PASS across all suites.

- [ ] **Step 4: Manual mobile check (375px)**

Run `pnpm dev`, open `/settings` at 375px width. Verify:
- Password user: Current / New / Confirm fields stack full-width; show/hide toggles reachable; submit button ≥44px tall; error text appears in red with `role="alert"`.
- Google user (or temporarily force `hasOAuth={true}`): "Set a password" card shows the hint and the button; clicking shows the "check your email" state.
- The section sits under the name form with a top border, consistent with the other account sections.

- [ ] **Step 5: Final commit (if any manual tweaks were needed)**

```bash
git add -A
git commit -m "chore(settings): polish password section responsive states"
```

---

## Self-Review

**Spec coverage:**
- Change password (verify current → new) for password users → Task 3 + Task 6 (`ChangePasswordForm`). ✓
- Set password for OAuth-only users via reset email → Task 4 + Task 6 (`SetPasswordCard`). ✓
- OAuth detection via `getUserIdentities` → Task 2 + Task 7. ✓
- Reuse existing reset-password page (no new reset UI) → relies on existing `reset-password` route; `sendPasswordResetEmail` points the link there (Task 1). ✓
- Shared Resend sender → Task 1. ✓ (Deviation: the helper uses the `sendEmail` wrapper from `@/lib/email/send` rather than refactoring `forgotPasswordAction`'s inline `fetch`. `forgotPasswordAction` is left untouched to avoid disturbing the auth flow/tests; the new flow is testable via the `@/lib/email/sendPasswordResetEmail` mock. This is a deliberate scope-control choice.)
- Rate limiting → Task 3 + Task 4 (`checkAuthRateLimit({ email })`, email-only — no `getIp` plumbing needed for an authenticated caller). ✓
- No enumeration / generic errors → Task 3 returns "Current password is incorrect." for any non-pending auth failure. ✓
- MFA correctness → `PASSWORD_OK_CODES` set ensures MFA-enabled users aren't told their correct password is wrong. ✓ (Beyond the spec; required for correctness given MFA exists.)
- i18n in all 4 locales, no `th` → Task 5. ✓
- Tests for actions + gating → Tasks 1–4, 6. ✓
- No new env → confirmed; Task 8 has no env step. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every test step shows assertions. ✓

**Type consistency:** `ActionResult` discriminated union used consistently (`{ ok: true }` / `{ error }`). `updatePasswordAction` input `{ currentPassword, newPassword, confirmPassword }` matches the form `FormValues` and the test inputs. `getAuthMethods` returns `{ hasOAuth, oauthProviders }`, consumed as `{ hasOAuth }` in the page and passed as `hasOAuth` to `AccountPanel` and `PasswordSection`. `sendPasswordResetEmail(email, token)` signature matches caller and test. ✓

## Notes / risks carried from the spec

- The `avatarHint` locale strings still mention "WorkOS" — that is **out of scope** here (it belongs to Task 4 of `settings-auth-ui-enhancements-plan.md`). Do not change it in this plan.
- Server-action error strings are English literals, matching the existing `settings/_actions.ts` convention (`updateProfileNameAction` returns "Not authenticated", etc.). Client-side validation messages ARE localized via Zod + next-intl. If full localization of action errors is later desired, that is a separate, file-wide change.
- Edge case (accepted): a user who linked Google *and* already has a password sees the "set a password" card; clicking it simply resets their password. Not worth extra detection.
