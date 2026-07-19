import type { ReactNode } from "react";
import { Instagram, Facebook, Linkedin } from "lucide-react";
import { getTranslations } from "next-intl/server";

function RedditIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.612.612-1.856.822-2.512.822-.656 0-1.909-.21-2.512-.822a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

const ICON_CLASS = "h-5 w-5";

export async function SocialLinks() {
  const t = await getTranslations("marketing.contact.social");

  const links: Array<{ href?: string; label: string; icon: ReactNode }> = [
    { href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL, label: t("instagram"), icon: <Instagram className={ICON_CLASS} aria-hidden="true" /> },
    { href: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL, label: t("facebook"), icon: <Facebook className={ICON_CLASS} aria-hidden="true" /> },
    { href: process.env.NEXT_PUBLIC_SOCIAL_REDDIT_URL, label: t("reddit"), icon: <RedditIcon className={ICON_CLASS} /> },
    { href: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL, label: t("linkedin"), icon: <Linkedin className={ICON_CLASS} aria-hidden="true" /> },
  ];

  const active = links.filter((link): link is { href: string; label: string; icon: ReactNode } => Boolean(link.href));

  if (active.length === 0) return null;

  return (
    <div className="flex items-center gap-4">
      {active.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.label}
          className="text-muted-foreground transition-colors hover:text-brand"
        >
          {link.icon}
        </a>
      ))}
    </div>
  );
}
