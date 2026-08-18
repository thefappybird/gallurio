# SEO and distribution handoff

Durable record of work deferred out of the `feat/seo-crawl-and-compare-pages` branch. That branch
ships the crawl foundation (robots, llms.txt, sitemap, canonical/hreflang, JSON-LD, the
"Powered by Gallurio" portfolio backlink) and the first ten comparison pages. Everything below is
the next set of decisions and work, not yet built.

Strategy in one line: rank and get quoted for competitor-intent searches, using price as the wedge.
Pro is PHP 250/mo and PHP 2500/yr, which lands near USD 4/mo and about USD 3.50/mo billed annually,
against competitors at USD 16-36. Every price surface already localizes per visitor via
`getDisplayPricing()` (`lib/pricing/localPricing.ts`), so the argument works in any market without
per-region content.

---

## 1. Free tools - open question, not a spec

The instinct is to absorb the free tier into free tools. Worth stating the tension plainly before
designing anything: **they are two different products.**

- **Free tools** are ungated public utilities. No account, no email wall. They exist to earn
  backlinks and rank for high-intent queries. Putting a login in front of one destroys the only
  reason to build it.
- **The free tier** is a one-month free Pro that hard-gates to `/subscribe` when it expires. It is
  a trial with a forcing function, not a permanent tier.

Merging them collapses into one of two bad outcomes: gate the tools and lose the links, or give
Pro features away permanently and lose the trial's pressure.

**The plausible middle, to decide later:** tools stay fully ungated and stateless, and the CTA is
"save this into a real workspace." The tool computes; the account persists. That makes a tool a
conversion surface rather than a tier — no overlap with billing at all.

### Candidates

| Tool | Route | Build notes |
|---|---|---|
| Package pricing calculator | `/tools/package-pricing-calculator` | Pure client-side, no new deps. Targets "photography package pricing" queries. |
| Quote / contract generator | `/tools/quote-generator` | Reuses `@react-pdf/renderer` and `lib/invoices/InvoiceDocument.tsx`. Highest link value, because the output is a shareable file. |
| Event timeline builder | `/tools/event-timeline-builder` | Client-side, same PDF export path. |

**Hard constraint for any of them:** persist nothing. No PII stored, no DB write, no `workspaceId`
anywhere. That keeps the tools entirely outside tenancy scope and out of the endpoint-hardening
checklist. If a tool ever needs to save, it stops being a tool and becomes an app feature.

Ship the pricing calculator alone first and measure it before building the second.

---

## 2. Comparison page backlog

Ten pages ship on the current branch: HoneyBook, Dubsado, Studio Ninja, 17hats, Squarespace,
Pixieset, Wix, Notion, Google Sheets, Google Forms + email.

The rest, by tier. Pricing figures are indicative and **must be re-verified at write time** with a
source link and a `checkedOn` date in frontmatter — stale competitor pricing is comparative
advertising exposure.

### A. Creative and event CRMs (closest overlap, highest volume)
Tave (~$25) - Sprout Studio (~$30) - Iris Works (~$30) - Bloom (~$25) - ShootQ - Light Blue -
StudioCloud - Session

### B. Event and wedding planning platforms
Aisle Planner (~$40) - Planning Pod (~$60) - Rock Paper Coin - Timeline Genius - Perfect Venue -
Tripleseat - Event Temple

### C. Drag-and-drop site builders (what creatives use instead of a CRM)
Webflow (~$14-23) - Showit (~$19) - Format (~$12) - Zenfolio (~$15) - SmugMug (~$13) -
Adobe Portfolio - Carrd (~$19/yr) - Canva Sites - Framer - Durable - Google Sites -
WordPress + Elementor

### D. Gallery delivery (adjacent, often bought alongside)
Pic-Time (~$20) - ShootProof (~$20) - CloudSpot (~$20) - Zenfolio - SmugMug

### E. Scheduling and booking
Calendly (~$12) - Acuity (~$20) - Square Appointments - Setmore - SimplyBook.me - Fresha -
Vagaro (~$30) - Booksy

### F. General freelancer and small-business CRMs
Bonsai (~$21) - Moxie (~$16) - Plutio (~$15) - Indy (~$12) - HubSpot free tier - Zoho CRM (~$14) -
Pipedrive (~$14)

### G. Record-keeping and general workspace tools
Excel - Airtable (~$20) - Coda - Trello (~$5) - Asana (~$11) - ClickUp (~$7) - Monday (~$9)

### H. Forms and intake
Typeform (~$25) - Jotform (~$34) - Tally - Fillout - Cognito Forms

### I. Invoicing
Wave - Zoho Invoice - FreshBooks (~$19) - QuickBooks (~$30) - Invoice Ninja

### Rules carried forward from the first ten

- Tier A is a feature-parity comparison. Tiers C/D/E/H are **not** — those tools are not CRMs, so
  write them as "one workspace vs a stack of four subscriptions." A feature table against a website
  builder is dishonest and reads as such.
- Tier G is "a spreadsheet does not send an invoice."
- Every page links to two or three siblings. The internal mesh is what makes the set rank as a set
  instead of as orphans.
- Every page carries an FAQ block feeding `buildFaqLd()` and a "who this is not for" section. The
  second one reads as credible to humans and gives an LLM the nuance that makes it willing to cite
  the page.
- No competitor logos or wordmarks. Naming a competitor in text is nominative use and is fine.

---

## 3. Distribution

### Directory listings - do these first

Cheapest, most durable, and they are heavily represented in LLM retrieval corpora, so they serve
the AI-answer goal directly alongside the SEO one. They are also the legitimate route into
"alternative to X" results without writing a word.

G2 - Capterra - GetApp - Software Advice - AlternativeTo - SaaSHub - Slant - Product Hunt -
StackShare - Crozdesk

Each needs: consistent product description, the localized price story, at least a handful of real
customer reviews, and a link back. Do not buy reviews.

### Other channels, in rough order of return

1. **Facebook Groups.** For most event-vendor niches these are larger and more active than Reddit,
   and the moderation is friendlier to a vendor who participates honestly.
2. **YouTube / short-form.** Screen recordings: "set up your booking page in five minutes." Ranks
   in its own right and gives every comparison page an embeddable asset.
3. **Wedding and event media backlinks.** Vendor-tool roundups and guest posts. Real editorial
   links, which is what actually moves domain authority.
4. **Reddit Ads.** Cheap, targets specific subreddits directly, zero ToS exposure. This does the
   job that multi-account posting was imagined for.
5. **Reddit organic**, per the rules below.

### Reddit operating rules

**One branded account. Disclosure in the comment itself, every time.**

Creating multiple accounts to post as unrelated users - including the pattern of "asking a
question" that the product conveniently answers - is account manipulation under Reddit's content
policy and undisclosed endorsement under FTC guidance. The practical cost is worse than the legal
one: when it is caught, moderators add the domain to AutoModerator blocklists across subreddits
permanently, which kills the honest channel too and follows the domain into search.

Working rules for whoever runs the account:

- Answer questions where the answer is genuinely useful even if the reader never signs up.
- Disclose affiliation in the same comment, not in a bio. "I build Gallurio, so take this with
  that in mind" is enough.
- Most photography subreddits ban promotion outright. The value there is presence and answers,
  never posts.
- Several business subreddits run weekly self-promotion threads. Those are the sanctioned way in -
  use them instead of working around them.
- Read each subreddit's rules before the first comment. They differ a lot.

### Subreddit list

**Verify each before use.** Some may be renamed, private, or inactive, and every one has its own
self-promotion rule.

**Photography and video**
r/photography - r/AskPhotography - r/WeddingPhotography - r/photomarketing - r/photostudio -
r/videography - r/Filmmakers - r/Cinematography - r/portraits - r/EventProduction

**Weddings and events**
r/weddingplanning - r/wedding - r/Weddingsunder10k - r/EventPlanning - r/eventprofs - r/DJs -
r/Catering - r/floristry - r/WeddingsCanada - r/AustralianWeddings

**Small business and freelance** (several run weekly self-promo threads)
r/smallbusiness - r/Entrepreneur - r/EntrepreneurRideAlong - r/freelance - r/sweatystartup -
r/indiebiz - r/Business_Ideas - r/AdvancedEntrepreneur - r/startups

**Launch and feedback** (promotion is on-topic here, not merely tolerated)
r/SideProject - r/alphaandbetausers - r/IMadeThis - r/roastmystartup - r/SomebodyMakeThis -
r/GrowthHacking - r/microsaas - r/SaaS

**Marketing and SEO** (for the content itself, and to learn what ranks)
r/SEO - r/marketing - r/DigitalMarketing - r/AskMarketing - r/content_marketing

**Tool-adjacent** (where people actively ask for alternatives - highest intent on the list)
r/Notion - r/Airtable - r/squarespace - r/Wix - r/webflow - r/nocode - r/CRM

**Regional**
r/Philippines - r/phinvest - r/Indonesia - r/Thailand - r/singapore - r/malaysia - r/dubai -
r/UAE - r/india - r/southafrica

---

## 4. "Powered by Gallurio" and the orphan removeBranding key

`plans.pro.features.removeBranding` — "Remove Gallurio branding" — exists in all five message
catalogs, which initially looked like a conflict with putting the mark on every published page.

It is not. The key is orphaned: `PLAN_CATALOG`'s Pro entry lists `unlimitedBookings`,
`publicPageControls`, `invoicePdfs`, `clientManagement` and `teamManagement`, and nothing else
references `removeBranding`. It has never rendered on the pricing page or anywhere else, so no
customer has been promised branding removal.

The branch therefore ships the mark on **every** published portfolio, free and paid alike, as a
plain followed link — which is the behaviour that actually compounds, since paid workspaces are the
ones with traffic worth passing back.

Two follow-ups, neither blocking:

- **Delete the orphan key** from all five catalogs, or implement what it promises. Leaving a
  feature string lying around invites someone to wire it up by accident.
- **If branding removal is ever sold**, it needs a real field on `Workspace.publicPage` plus a
  settings toggle, and the SEO arithmetic should be re-examined first — every workspace that
  switches it off is a backlink removed.

## 5. /blog was descoped from this branch

The original plan paired a `/blog` section with `/compare`. It shipped without one, deliberately:
there is no blog content written, and an empty section is worse than no section — it wastes crawl
budget and looks abandoned.

What exists: `lib/content/entries.ts` already accepts `kind: "blog"` and reads `content/blog/*.mdx`.
Adding the section is a `content/blog/` directory plus two routes mirroring `/compare`, and both the
sitemap and `llms.txt` pick it up from the same index with no further wiring.

One trap to know about: `listEntries("blog")` throws today because `content/blog/` does not exist —
`readdirSync` on a missing directory. Nothing calls it, so nothing breaks, but create the directory
in the same change that first calls it.

## 6. Open items

- Confirm Caddy on the VPS does not strip or 403 AI-crawler user agents before requests reach Next
  (`docs/modules/hosting-ops.md`). An allow rule in `robots.txt` means nothing if the edge rejects
  the request.
- Re-verify every competitor price at write time.
- Decide the free-tools / free-tier relationship (section 1) before any tool is built.
- Once the first ten comparison pages have search data, use it to reorder the backlog in section 2
  rather than shipping tiers in order.
