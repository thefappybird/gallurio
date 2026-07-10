# Gallurio Public Compliance Pages Scope

## Objective

Create the minimum public-facing pages required to make Gallurio presentable for Paddle review and early beta credibility.

This task is for implementing **content structure only**. Do not over-design these pages. The visual design, layout refinements, branding, spacing, components, and final UX decisions will be handled separately.

The goal is to publish a credible SaaS public shell that clearly explains:

- What Gallurio is
- Who it is for
- What the product does
- How pricing/beta access works
- How terms, privacy, refunds, and support are handled
- That payments will be processed through Paddle when paid plans go live

Gallurio should be framed as a **software/SaaS product for creative professionals**, not as a photography/event service provider.

---

## Product Context

Gallurio is a SaaS platform for photographers, videographers, event creatives, and service-based creative businesses.

Core product direction:

- Portfolio builder
- Public creative business pages
- Gallery/content presentation
- Booking inquiry forms
- Business profile/workspace setup
- Future subscription plans
- Paddle as Merchant of Record for payments

The product may still be in beta. The site should be honest about that while still looking credible and production-ready enough for review.

---

## Implementation Requirements

Create the following public routes:

```txt
/
 /pricing
 /terms
 /privacy
 /refunds
 /contact
```

Use normal app routing conventions for the existing project.

Each page should be publicly accessible without authentication.

Do not require a logged-in session to view any of these pages.

Do not connect live Paddle checkout unless explicitly configured elsewhere. These pages are informational and compliance-oriented.

---

## Content Tone

Use a professional, clear, SaaS-oriented tone.

Avoid:

- Overpromising
- Fake testimonials
- Empty lorem ipsum
- Claims about features that do not exist
- Positioning Gallurio as the seller of photography/event services
- Legal language that is too aggressive or overly complex

Prefer:

- Plain English
- Honest beta language
- Clear product positioning
- Simple compliance copy
- Easily editable content sections

---

## Page 1: Landing Page

Route:

```txt
/
```

Purpose:

Explain what Gallurio is and make the product credible to visitors, beta users, and Paddle reviewers.

### Required Sections

#### Hero

Headline:

```txt
Create a polished booking-ready portfolio for your creative business.
```

Body:

```txt
Gallurio helps photographers, videographers, event creatives, and service-based studios build beautiful portfolio pages, collect booking inquiries, and manage their client-facing presence in one workspace.
```

Supporting line:

```txt
Built for creatives who want a professional online presence without rebuilding everything from scratch.
```

CTA buttons/links:

```txt
Join the Beta
View Pricing
```

#### What is Gallurio?

Include copy explaining:

```txt
Gallurio is a portfolio and booking platform for creative professionals. It gives users tools to create a public-facing page, showcase their work, receive booking requests, and organize client-facing business details.
```

#### Built for Creative Businesses

Include a short list:

```txt
Photographers
Videographers
Event planners
Makeup artists
Stylists
Creative studios
Independent service providers
```

#### Key Features

Include these feature blocks:

```txt
Portfolio builder
Create a clean, professional portfolio page using flexible sections, gallery blocks, service details, and visual layouts made for creative work.

Booking inquiry forms
Let visitors send booking requests directly through a user page, including event dates, contact details, service preferences, and project notes.

Business workspace
Manage public profile content, business details, and booking-related setup from one dashboard.

Custom branding
Adjust colors, typography, imagery, and page style so the portfolio feels aligned with the user's creative identity.

Client-ready pages
Publish a page designed to look credible, simple, and easy for potential clients to understand.
```

#### Beta Notice

Include:

```txt
Gallurio is currently in beta. Some features may change as we improve the product, refine the experience, and gather feedback from early users.

During beta, access may be limited and certain paid features may not yet be available.
```

#### Final CTA

Include:

```txt
Start building your creative workspace with Gallurio.
Join the beta and help shape the platform before public launch.
```

Button/link:

```txt
Join the Beta
```

---

## Page 2: Pricing Page

Route:

```txt
/pricing
```

Purpose:

Give Paddle and users a clear understanding of pricing intent, even if real paid plans are not live yet.

### Required Sections

#### Header

Headline:

```txt
Simple plans for creative professionals and studios.
```

Body:

```txt
Gallurio is currently in beta. Paid subscriptions are planned for public launch after beta testing. Pricing, feature limits, and plan details may change before the final release.
```

#### Beta Access Plan

Plan name:

```txt
Beta Plan
```

Price:

```txt
Free during beta
```

Description:

```txt
For early users who want to test Gallurio, build a portfolio, and help shape the product.
```

Feature list:

```txt
Portfolio page builder
Basic gallery sections
Business profile setup
Booking inquiry form
Workspace dashboard
Early access to new features
```

CTA:

```txt
Join the Beta
```

#### Planned Paid Plans

Create three planned plan sections. These do not need real prices yet unless pricing has already been finalized.

##### Starter

Description:

```txt
For independent creatives who need a simple portfolio and booking inquiry page.
```

Planned features:

```txt
Published portfolio page
Customizable page sections
Image galleries
Booking inquiry form
Basic business profile
Email support
```

##### Studio

Description:

```txt
For growing creative businesses that need more flexibility and stronger client-facing tools.
```

Planned features:

```txt
Everything in Starter
More portfolio sections
Advanced gallery layouts
Service/package presentation
Custom branding options
Priority support
```

##### Business

Description:

```txt
For teams, studios, or creative businesses with more advanced operational needs.
```

Planned features:

```txt
Everything in Studio
Team-oriented workspace features
Expanded booking setup
Advanced customization
Higher usage limits
Priority feature access
```

#### Billing Notice

Include:

```txt
When paid subscriptions become available, payments will be processed securely by Paddle, our Merchant of Record. Paddle may handle payment processing, tax calculation, invoices, billing support, and eligible refund processing.

No real payments are collected during the beta unless clearly stated at checkout.
```

#### Pricing Transparency

Include:

```txt
Final subscription prices will be published before paid plans go live. Users will be able to review the price, billing period, and subscription terms before completing any payment.
```

---

## Page 3: Terms of Service

Route:

```txt
/terms
```

Purpose:

Publish basic SaaS terms for review and early users.

Add a visible effective date placeholder:

```txt
Effective Date: [Month Day, Year]
```

### Required Sections

#### Introduction

Include:

```txt
These Terms of Service govern your access to and use of Gallurio, including our website, application, portfolio tools, booking inquiry features, and related services.

By using Gallurio, you agree to these Terms. If you do not agree, you should not use the service.
```

#### 1. About Gallurio

Include:

```txt
Gallurio is a software platform that helps creative professionals and businesses create portfolio pages, present their services, and receive booking inquiries.

Gallurio does not directly provide photography, videography, event planning, or other creative services to end clients. Users of Gallurio are responsible for the services they offer through their own pages.
```

#### 2. Eligibility

Include:

```txt
You may use Gallurio only if you are able to enter into a legally binding agreement. If you use Gallurio on behalf of a business, organization, or studio, you confirm that you are authorized to accept these Terms on its behalf.
```

#### 3. Accounts

Include:

```txt
You may need to create an account to use certain Gallurio features. You are responsible for keeping your login credentials secure and for all activity under your account.

You agree to provide accurate information and to update it when necessary.
```

#### 4. Beta Access

Include:

```txt
Gallurio may offer beta access before public launch. During beta, features may be incomplete, changed, limited, suspended, or removed at any time.

Beta access does not guarantee continued free access, future feature availability, or permanent account availability.
```

#### 5. User Content

Include:

```txt
Users may upload, publish, or submit content such as images, text, business information, service descriptions, portfolio materials, and booking form content.

Users retain ownership of their content. By using Gallurio, users grant Gallurio permission to host, store, display, process, and transmit their content as needed to operate and improve the service.

Users are responsible for ensuring that they have the rights, licenses, and permissions needed for any content uploaded or published.
```

#### 6. Prohibited Content and Use

Include:

```txt
Users agree not to use Gallurio to upload, publish, distribute, or promote content that is unlawful, harmful, abusive, misleading, infringing, or otherwise inappropriate.
```

List prohibited behavior:

```txt
Violating applicable laws or regulations
Infringing the intellectual property rights of others
Uploading malicious code or attempting to disrupt the service
Misrepresenting identity, business, or services
Using the service for fraud, spam, or deceptive activity
Attempting to access accounts, systems, or data without permission
```

Include:

```txt
Gallurio may remove content or suspend accounts that violate these Terms.
```

#### 7. Bookings and Client Inquiries

Include:

```txt
Gallurio may allow visitors to submit booking inquiries through user-created pages. These inquiries do not guarantee a confirmed booking unless separately agreed between the Gallurio user and their client.

Gallurio is not responsible for disputes, payments, cancellations, service quality, schedules, or agreements between Gallurio users and their clients unless explicitly stated otherwise.
```

#### 8. Subscriptions and Payments

Include:

```txt
Some Gallurio features may require a paid subscription.

When paid plans become available, billing may be processed by Paddle, our Merchant of Record. Paddle may handle payment processing, taxes, invoices, billing support, and applicable refund workflows.

Users will be shown applicable pricing and billing terms before completing a purchase.
```

#### 9. Cancellations

Include:

```txt
Users may cancel subscriptions according to the cancellation process available in their account or through the billing flow provided.

Cancellation generally prevents future renewal charges, but it may not automatically result in a refund unless required by law or approved under the applicable refund process.
```

#### 10. Service Changes

Include:

```txt
Gallurio may update, modify, suspend, or discontinue parts of the service at any time. Gallurio may also change features, plans, pricing, or usage limits as the product evolves.

Where appropriate, Gallurio will make reasonable efforts to notify users of material changes.
```

#### 11. Intellectual Property

Include:

```txt
Gallurio, including its software, design, branding, interface, features, and related materials, is owned by Gallurio or its licensors.

Users may not copy, modify, reverse engineer, resell, or exploit any part of Gallurio except as permitted by these Terms or applicable law.
```

#### 12. Disclaimer

Include:

```txt
Gallurio is provided on an “as is” and “as available” basis. Gallurio does not guarantee that the service will be uninterrupted, error-free, secure, or suitable for every business need.
```

#### 13. Limitation of Liability

Include:

```txt
To the maximum extent permitted by law, Gallurio will not be liable for indirect, incidental, special, consequential, or punitive damages, including lost profits, lost data, business interruption, or reputational harm.
```

#### 14. Termination

Include:

```txt
Gallurio may suspend or terminate access if a user violates these Terms, misuses the service, creates risk for other users, or uses the service in a way that may harm Gallurio or third parties.

Users may stop using Gallurio at any time.
```

#### 15. Contact

Include:

```txt
For questions about these Terms, contact us at:

[support@gallurio.com]
```

---

## Page 4: Privacy Policy

Route:

```txt
/privacy
```

Purpose:

Publish a basic privacy policy explaining what Gallurio collects, why, and how third-party processors like Paddle may be involved.

Add a visible effective date placeholder:

```txt
Effective Date: [Month Day, Year]
```

### Required Sections

#### Introduction

Include:

```txt
This Privacy Policy explains how Gallurio collects, uses, stores, and protects information when users access the website, application, and related services.
```

#### 1. Information We Collect

Create subsections:

##### Account Information

```txt
This may include name, email address, login details, business name, workspace information, and account preferences.
```

##### Business and Portfolio Information

```txt
This may include public profile details, service descriptions, images, galleries, branding settings, portfolio content, and other materials users choose to upload or publish.
```

##### Booking Inquiry Information

```txt
When visitors submit inquiries through a Gallurio page, Gallurio may collect information such as names, email addresses, event dates, project details, messages, and other form responses.
```

##### Usage Information

```txt
Gallurio may collect technical and usage data such as device information, browser type, IP address, pages viewed, actions taken, timestamps, and diagnostic logs.
```

##### Payment Information

```txt
When paid features become available, payments may be processed by Paddle, Gallurio’s Merchant of Record. Gallurio does not directly store full payment card details. Paddle may collect and process billing details, payment information, tax information, and invoices according to its own terms and privacy practices.
```

#### 2. How We Use Information

List:

```txt
Provide and operate Gallurio
Create and manage user accounts
Publish and display portfolio pages
Process booking inquiries
Improve product features and user experience
Provide support and respond to requests
Maintain security and prevent abuse
Analyze usage and performance
Comply with legal and billing obligations
```

#### 3. User Content and Public Pages

Include:

```txt
Content published on a Gallurio portfolio page may be visible to the public. This may include business names, images, services, descriptions, contact options, and other information users choose to make public.

Users are responsible for ensuring that published content does not include private or sensitive information that they do not want publicly available.
```

#### 4. Sharing of Information

Include:

```txt
Gallurio may share information with trusted service providers that help operate the platform, such as hosting providers, authentication providers, analytics tools, email services, file storage providers, and payment processors.

Gallurio may also share information when required by law, to protect rights, to prevent fraud or abuse, or as part of a business transfer such as a merger, acquisition, or sale of assets.

Gallurio does not sell personal information.
```

#### 5. Data Storage and Security

Include:

```txt
Gallurio uses reasonable technical and organizational measures to protect information. However, no system can be guaranteed to be completely secure.

Users are responsible for keeping account credentials safe and notifying Gallurio if they believe their account has been compromised.
```

#### 6. Data Retention

Include:

```txt
Gallurio retains information for as long as needed to provide the service, comply with legal obligations, resolve disputes, enforce agreements, and maintain legitimate business records.

Users may request account deletion or data removal by contacting Gallurio, subject to legal, technical, or operational limitations.
```

#### 7. Cookies and Similar Technologies

Include:

```txt
Gallurio may use cookies and similar technologies to keep users signed in, remember preferences, analyze usage, improve performance, and support security.

Users can control cookies through browser settings, but disabling some cookies may affect how the service works.
```

#### 8. International Use

Include:

```txt
Gallurio may be accessed from different countries. Information may be processed in countries where Gallurio or its service providers operate.

By using Gallurio, users understand that information may be transferred and processed outside their country of residence, subject to applicable law.
```

#### 9. Children’s Privacy

Include:

```txt
Gallurio is not intended for children. Gallurio does not knowingly collect personal information from children under the age required by applicable law.

If someone believes a child has provided personal information to Gallurio, they should contact Gallurio so the information can be reviewed and removed if appropriate.
```

#### 10. Changes to This Policy

Include:

```txt
Gallurio may update this Privacy Policy from time to time. When material changes are made, Gallurio may notify users through the service, by email, or by updating the effective date.
```

#### 11. Contact

Include:

```txt
For privacy questions or requests, contact us at:

[support@gallurio.com]
```

---

## Page 5: Refund Policy

Route:

```txt
/refunds
```

Purpose:

Clearly state beta/payment/refund expectations and Paddle’s role.

Add a visible effective date placeholder:

```txt
Effective Date: [Month Day, Year]
```

### Required Sections

#### 1. Beta Period

Include:

```txt
Gallurio is currently in beta. If no paid subscription or real payment is collected during beta, no refund is required because no charge has been made.

If paid beta access is offered in the future, the applicable price and refund terms will be shown before checkout.
```

#### 2. Subscriptions

Include:

```txt
When paid plans become available, Gallurio subscriptions may be billed monthly, annually, or according to the billing period shown at checkout.

Users may cancel their subscription to prevent future renewal charges. After cancellation, access may continue until the end of the current billing period unless otherwise stated.
```

#### 3. Refund Requests

Include:

```txt
Refund requests are reviewed on a case-by-case basis.
```

Approval may depend on:

```txt
The date of purchase
The billing period
Product usage
Account activity
Technical issues
Duplicate charges
Applicable consumer protection laws
Paddle’s payment and refund process
```

Include:

```txt
Submitting a refund request does not guarantee that a refund will be approved.
```

#### 4. Paddle as Merchant of Record

Include:

```txt
Payments for Gallurio may be processed by Paddle, Gallurio’s Merchant of Record. Paddle may handle payment processing, taxes, invoices, billing support, and eligible refund processing.

If a user purchases a Gallurio subscription through Paddle, their billing statement may show Paddle or a related Paddle billing descriptor.
```

#### 5. Non-Refundable Situations

Include:

```txt
Unless required by law, refunds may not be provided for:
```

List:

```txt
Unused time in a billing period after cancellation
Failure to cancel before renewal
Temporary lack of use
Change of mind after substantial use
Issues caused by incorrect account setup or user-provided information
```

Include:

```txt
Gallurio will still review reasonable requests, especially where there are technical or billing issues.
```

#### 6. How to Request a Refund

Include:

```txt
To request a refund, contact us at:

[support@gallurio.com]
```

Ask users to include:

```txt
Account email
Business or workspace name
Date of payment
Reason for the request
Relevant screenshots or billing details
```

Include:

```txt
Gallurio may ask for additional information to verify the payment and review the request.
```

#### 7. Cancellations

Include:

```txt
Users may cancel their subscription through account settings or the billing management flow provided.

Cancellation stops future renewals but does not automatically refund previous payments unless a refund is approved or required by law.
```

---

## Page 6: Contact Page

Route:

```txt
/contact
```

Purpose:

Give users and Paddle reviewers a clear support/contact path.

### Required Sections

#### Header

Headline:

```txt
Need help with Gallurio?
```

Body:

```txt
For support, beta access questions, account concerns, billing issues, or general inquiries, contact us at:

[support@gallurio.com]
```

#### Support Topics

List:

```txt
Beta access
Account setup
Portfolio pages
Booking inquiry forms
Billing and subscriptions
Refund requests
Bug reports
Feature feedback
Partnership or business inquiries
```

#### Response Time

Include:

```txt
We aim to respond as soon as reasonably possible. During beta, response times may vary as we continue developing and improving Gallurio.

For urgent account or billing concerns, please include as much relevant detail as possible so we can review the request efficiently.
```

#### Business Information

Include placeholders:

```txt
Gallurio
[Business Legal Name, if applicable]
[Business Address or Registered Country, if applicable]
Email: [support@gallurio.com]
```

---

## Navigation Requirements

Add links to these public pages where appropriate.

Minimum footer links:

```txt
Pricing
Terms
Privacy
Refunds
Contact
```

Recommended header links:

```txt
Pricing
Contact
Join the Beta
```

Footer links should be visible on all public pages.

---

## Technical Requirements

- All pages must be server-renderable/static-renderable where appropriate.
- Pages must be accessible without authentication.
- Avoid relying on user workspace data for these public pages.
- Avoid fetching private app data for these routes.
- Avoid adding Paddle checkout buttons unless the project already has a clear beta/payment flow.
- Use placeholders for contact/legal details where exact business information is not available.
- Keep content easy to edit later.
- Use semantic HTML headings.
- Ensure pages are readable on mobile and desktop.
- Do not add fake pricing if final prices are not confirmed.
- Do not add fake company registration numbers or addresses.
- Do not add fake testimonials or customer logos.

---

## Paddle Review Notes

These pages should help communicate that:

```txt
Gallurio is a SaaS product.
Gallurio sells software access, not direct photography or event services.
Paddle will be the Merchant of Record for future paid subscriptions.
Users can understand pricing intent before paying.
Users can find refund, privacy, terms, and support information.
The product can be beta-stage while still having credible public policies.
```

---

## Acceptance Criteria

The task is complete when:

```txt
/ is publicly available and explains Gallurio clearly.
/pricing is publicly available and explains beta access plus planned paid subscriptions.
/terms is publicly available and includes SaaS terms.
/privacy is publicly available and explains data collection, public content, booking inquiries, and Paddle payment handling.
/refunds is publicly available and explains cancellations, refund requests, beta payment status, and Paddle’s role.
/contact is publicly available and includes a support email placeholder.
All public pages are linked in the footer.
No page requires authentication.
No lorem ipsum remains.
No fake testimonials, fake prices, fake legal details, or fake company information were added.
The implementation leaves final visual design decisions open.
```

---

## Out of Scope

Do not implement:

```txt
Final visual design system
Custom illustrations
Final marketing copy polish
Live Paddle checkout
Subscription checkout logic
User billing portal
Paddle webhook handling
Authentication changes
Database schema changes
Admin CMS editing
Analytics events
SEO metadata beyond basic titles/descriptions
Legal counsel review
```

---

## Suggested Basic Metadata

Use simple page titles and descriptions.

```txt
Home
Title: Gallurio — Portfolio and Booking Tools for Creative Businesses
Description: Create a polished portfolio page, showcase your work, and collect booking inquiries with Gallurio.

Pricing
Title: Pricing — Gallurio
Description: View Gallurio beta access and planned subscription options for creative professionals and studios.

Terms
Title: Terms of Service — Gallurio
Description: Read the terms that govern access to and use of Gallurio.

Privacy
Title: Privacy Policy — Gallurio
Description: Learn how Gallurio collects, uses, stores, and protects information.

Refunds
Title: Refund Policy — Gallurio
Description: Learn how Gallurio handles cancellations, refunds, and Paddle payment processing.

Contact
Title: Contact — Gallurio
Description: Contact Gallurio for support, beta access, billing questions, and general inquiries.
```

---

## Final Reminder for the Agent

Focus on implementing the public page structure and content.

Do not make major product, design, or pricing decisions.

Use placeholders where exact business details are missing.

Keep the copy credible, simple, and SaaS-oriented.

---

## Presentation & Layout (as implemented)

Design direction: Committed color strategy through the existing Studio
Ledger palette (`--brand` hue 195, no new brand color) — the landing page
earns more teal weight than the app itself, everything else stays flat and
content-first. Every page verified at 375/768/1280px; all logical Tailwind
utilities (`ms/me/ps/pe/start/end/text-start`), never physical
`left/right/ml/mr` — see `docs/i18n/arabic-rtl.md` for known pitfalls.

### Landing (`/`) — "Draft B / Committed Teal"

1. Sticky header (logo, Pricing, Contact, Sign in, Join the Beta,
   `ThemeToggle`, `LocaleSwitcher`) and footer both render with the app's
   `.dark` theme tokens scoped to this route only (`usePathname() === "/"`
   in `marketing-header.tsx` / `marketing-footer.tsx`) — every other
   marketing page keeps the default light chrome.
2. Hero: dark section, headline + body + single "Join the Beta" CTA, with a
   breakout product screenshot (`portfolio-builder-canvas.png`) bleeding
   into the section below via negative margin.
3. Merged two-column "What is Gallurio?" + "Built for Creative Businesses"
   section, light ground, sized to absorb the hero's breakout image.
4. Three alternating full-bleed tonal feature panels (card / muted / brand
   tint via `color-mix(in oklch, var(--brand) 10%, var(--background))`),
   each pairing a screenshot with copy: Portfolio builder ↔
   `portfolio-builder-canvas.png`, Business workspace ↔
   `dashboard-overview.png`, Booking inquiry forms ↔
   `bookings-calendar.png`.
5. Lighter text-only pair (Custom branding, Client-ready pages) — no
   screenshots.
6. Manifesto: brand-teal blockquote band, the page's one fully "drenched"
   moment.
7. Pricing teaser (`_components/pricing-teaser.tsx`): Free / Pro
   (monthly-yearly toggle) / Beta Tester cards, links out to `/pricing` for
   the full comparison, with a disclaimer noting prices are planned and may
   change before public launch (kept consistent with `/pricing`'s own
   "planned" framing).
8. Beta Notice — plain text, quiet tone.
9. Final CTA — dark bookend section matching the hero, headline + Join the
   Beta button.

Screenshots ship at their final filenames so the build/deploy works
immediately; overwrite the same paths with real captures when available:

| Path | Content | Capture notes |
|---|---|---|
| `public/marketing/screenshots/portfolio-builder-canvas.png` | Puck editor canvas, a live draft mid-edit (populated blocks, not empty state) | Desktop ≥1600px wide, light mode, no browser chrome |
| `public/marketing/screenshots/dashboard-overview.png` | Main workspace dashboard, populated with realistic data | Desktop ≥1600px wide, light mode, no browser chrome |
| `public/marketing/screenshots/bookings-calendar.png` | Bookings/inquiries calendar, month view, mixed event statuses visible | Desktop ≥1600px wide, light mode, no browser chrome |

Reveal animations use the app's existing `MotionObserver` /
`[data-anim]` system (not landing-specific), which already falls back to an
instant/no-motion state under `prefers-reduced-motion: reduce`.

### Pricing / Terms / Privacy / Refunds / Contact

Shared marketing shell (same header/footer, light chrome). Pricing
highlights the Beta Plan card (brand ring, "Join the Beta"), then
Starter/Studio/Business in `repeat(auto-fit, minmax(280px,1fr))` with a
quiet "Planned" tag instead of buy buttons, plus the Billing Notice and
Pricing Transparency text below. Terms/Privacy/Refunds are single-column
prose (65–75ch) with sequential `h2` sections per the content above, no
TOC. Contact is header + mailto link + support-topics list + response-time
note, no form.
