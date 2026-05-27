import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Building2, Palette, Globe, AlertTriangle, UsersRound } from "lucide-react";
import { requireOrg } from "@/lib/auth/requireOrg";
import { routing } from "@/lib/i18n/routing";
import { SettingsUserProfile, CustomPage } from "../_components/settings-user-profile";
import { WorkspaceBusinessForm } from "../workspace/_business-form";
import { WorkspaceBrandingForm } from "../workspace/_branding-form";
import { CustomizePanel } from "../customize/_panel";
import { PublicPageSettingsForm } from "../public-page/_form";
import { DangerPanel } from "../danger/_panel";
import { TeamsPanel } from "../teams/_panel";
import {
  Team,
  TeamMembership,
  User,
  PendingTeamAssignment,
  type TeamDoc,
  type TeamMembershipDoc,
  type UserDoc,
  type PendingTeamAssignmentDoc,
} from "@/lib/db/models";
import { planEntitlements } from "@/lib/plans/entitlements";
import type {
  UpdateWorkspaceBusinessInput,
  UpdateWorkspaceBrandingInput,
  PublicPageSettingsInput,
  HitpayCountry,
  SupportedCurrency,
} from "@/lib/validators/workspace";

const OWNER_ONLY_SLUGS = new Set(["workspace", "public-page", "danger", "teams"]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("app.sidebar");
  return { title: t("settings") };
}

export default async function SettingsCatchallPage({
  params,
}: {
  params: Promise<{ locale: string; catchall?: string[] }>;
}) {
  const { locale, catchall } = await params;
  setRequestLocale(locale);

  const { role, workspace } = await requireOrg();

  const slug = catchall?.[0];
  if (slug && OWNER_ONLY_SLUGS.has(slug) && role !== "owner") {
    notFound();
  }

  const rawTeams = await Team.find({ workspaceId: workspace._id })
    .sort({ isDefault: -1, createdAt: 1 })
    .lean<TeamDoc[]>();

  const teams = rawTeams.map((t) => ({
    id: String(t._id),
    name: t.name,
    color: t.color,
    isDefault: t.isDefault ?? false,
    memberCount: t.memberCount ?? 0,
  }));

  const { maxTeams, maxMembersPerTeam } = planEntitlements(
    workspace.plan as "free" | "starter" | "pro",
  );

  // Pull workspace members + their team assignments in parallel. Only run for
  // the owner role since non-owners can't reach this slug (notFound above).
  const [memberUsers, memberships, pendingInviteRows] =
    role === "owner"
      ? await Promise.all([
          User.find({ "memberships.workspaceId": workspace._id })
            .select({ clerkUserId: 1, email: 1, name: 1, avatarUrl: 1 })
            .lean<UserDoc[]>(),
          TeamMembership.find({ workspaceId: workspace._id })
            .select({ clerkUserId: 1, teamId: 1, role: 1 })
            .lean<TeamMembershipDoc[]>(),
          PendingTeamAssignment.find({ workspaceId: workspace._id })
            .sort({ createdAt: -1 })
            .lean<PendingTeamAssignmentDoc[]>(),
        ])
      : [[], [], []];

  const membershipsByUser = new Map<
    string,
    { teamId: string; role: "member" | "lead" }[]
  >();
  for (const m of memberships) {
    const list = membershipsByUser.get(m.clerkUserId) ?? [];
    list.push({
      teamId: String(m.teamId),
      role: (m.role ?? "member") as "member" | "lead",
    });
    membershipsByUser.set(m.clerkUserId, list);
  }

  const members = memberUsers.map((u) => ({
    clerkUserId: u.clerkUserId,
    email: u.email,
    name: u.name ?? "",
    avatarUrl: u.avatarUrl ?? null,
    teams: membershipsByUser.get(u.clerkUserId) ?? [],
  }));

  const pendingInvites = pendingInviteRows.map((p) => ({
    email: p.email,
    teamIds: (p.teamIds ?? []).map((id) => String(id)),
    leadOnTeamIds: (p.leadOnTeamIds ?? []).map((id) => String(id)),
    invitedAt: (p as { createdAt?: Date }).createdAt?.toISOString() ?? "",
  }));

  const businessDefaults: UpdateWorkspaceBusinessInput = {
    name: workspace.name,
    slug: workspace.slug,
    businessType: workspace.businessType as UpdateWorkspaceBusinessInput["businessType"],
    country: (workspace.country ?? "PH") as HitpayCountry,
    currency: workspace.currency as SupportedCurrency,
    timezone: workspace.timezone ?? "Asia/Manila",
  };

  const brandingDefaults: UpdateWorkspaceBrandingInput = {
    logoUrl: workspace.branding?.logoUrl ?? null,
    logoCloudinaryPublicId: workspace.branding?.logoCloudinaryPublicId ?? null,
    primaryColor: workspace.branding?.primaryColor ?? "#111111",
    secondaryColor: workspace.branding?.secondaryColor ?? "#f5f5f5",
    tagline: workspace.branding?.tagline ?? "",
    description: workspace.branding?.description ?? "",
  };

  const publicPageDefaults: PublicPageSettingsInput = {
    seoTitle: workspace.publicPage?.seoTitle ?? "",
    seoDescription: workspace.publicPage?.seoDescription ?? "",
    inquiryRecipientEmail: workspace.publicPage?.inquiryRecipientEmail ?? "",
  };

  const mountPath =
    locale === routing.defaultLocale ? "/settings" : `/${locale}/settings`;

  return (
    <SettingsUserProfile path={mountPath} role={role}>
      <CustomPage
        slug="customize"
        labelKey="customize"
        labelIcon={<Palette className="size-4" />}
      >
        <CustomizePanel />
      </CustomPage>
      <CustomPage
        slug="workspace"
        labelKey="workspace"
        labelIcon={<Building2 className="size-4" />}
        ownerOnly
      >
        <div className="flex flex-col gap-8">
          <WorkspaceBusinessForm defaults={businessDefaults} />
          <WorkspaceBrandingForm defaults={brandingDefaults} />
        </div>
      </CustomPage>
      <CustomPage
        slug="teams"
        labelKey="teams"
        labelIcon={<UsersRound className="size-4" />}
        ownerOnly
      >
        <TeamsPanel
          teams={teams}
          plan={workspace.plan as "free" | "starter" | "pro"}
          maxTeams={maxTeams}
          maxMembersPerTeam={maxMembersPerTeam}
          members={members}
          pendingInvites={pendingInvites}
          ownerClerkUserId={workspace.ownerUserId}
        />
      </CustomPage>
      <CustomPage
        slug="public-page"
        labelKey="publicPage"
        labelIcon={<Globe className="size-4" />}
        ownerOnly
      >
        <PublicPageSettingsForm
          slug={workspace.slug}
          publishedAt={workspace.publicPage?.publishedAt ?? null}
          defaults={publicPageDefaults}
          locale={locale}
        />
      </CustomPage>
      <CustomPage
        slug="danger"
        labelKey="danger"
        labelIcon={<AlertTriangle className="size-4" />}
        ownerOnly
      >
        <DangerPanel workspaceName={workspace.name} workspaceSlug={workspace.slug} />
      </CustomPage>
    </SettingsUserProfile>
  );
}
