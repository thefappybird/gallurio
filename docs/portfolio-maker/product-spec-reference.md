# Drag-and-Drop Portfolio Maker Instruction Manual

## For an Event Booking SaaS for Creatives

This document is a planning and implementation manual for building a fully fledged drag-and-drop portfolio maker inside a SaaS platform for event bookings. The target users are creatives and event professionals such as photographers, videographers, event managers, event planners, makeup artists, stylists, decorators, venues, and similar service providers.

The portfolio maker should allow users to visually build and publish a portfolio using Puck in Next.js. Users should be able to upload images, select fonts, choose colors, customize sections, create booking request forms, and publish a conversion-focused public portfolio.

The core product goal is not merely to build a website builder. The goal is to build a portfolio system that helps creatives convert visitors into booking inquiries.

---

# 1. Product Positioning

## 1.1 Core Product Thesis

The portfolio maker should be treated as a conversion layer inside the larger event-booking SaaS.

The core loop is:

```txt
Creative builds a beautiful portfolio
→ Visitor views the portfolio
→ Visitor trusts the creative
→ Visitor submits a structured booking request
→ Creative manages the lead inside the SaaS
→ Lead becomes a booking
```

Every template, block, form, and dashboard feature should support this loop.

## 1.2 What This Product Is

This product is:

- A drag-and-drop portfolio builder
- A public showcase for creative work
- A lead capture system
- A booking request intake system
- A business profile and brand presentation tool
- A lightweight marketing website builder for creatives
- A conversion-focused extension of the event booking SaaS

## 1.3 What This Product Is Not

This product should not initially try to be:

- A full generic website builder
- A direct competitor to Wix or Squarespace in every category
- A freeform design canvas with unlimited layout control
- A full CMS/blogging platform in the MVP
- A complete e-commerce platform in the MVP
- A complex animation builder
- A code-injection website builder

The strongest differentiation is that this builder is specifically made for bookable creatives.

---

# 2. Competitive Patterns to Emulate

Strong drag-and-drop portfolio makers and creative website builders usually share several common patterns.

## 2.1 Template-First Experience

Users should not start from a blank page.

The product should guide them through:

1. Choosing their creative profession
2. Selecting a portfolio template
3. Adding business and brand details
4. Uploading a hero image or logo
5. Adding services or packages
6. Publishing the portfolio

The user should be able to create a respectable first version within 5 to 10 minutes.

## 2.2 Visual-First Presentation

Creative professionals sell through visuals. The builder should prioritize:

- Large hero images
- Galleries
- Masonry grids
- Video embeds
- Featured projects
- Case studies
- Testimonials
- Service/package sections
- Strong calls to action

The design language should feel like a creative portfolio, not like a generic admin page.

## 2.3 Business Workflow Integration

The portfolio should connect directly to business workflows.

Important integrations include:

- Booking request forms
- Lead inbox
- Service packages
- Availability checking
- Notifications
- Client communication
- Proposals
- Contracts
- Invoices or deposits
- Client galleries
- File delivery

The MVP does not need all of these, but the architecture should allow them later.

## 2.4 Controlled Design Freedom

Users should have freedom to customize their site, but the builder should prevent poor design outcomes.

Use curated design controls such as:

- Font pairings
- Color palettes
- Section templates
- Responsive layouts
- Spacing presets
- Button styles
- Image treatments
- Theme presets

Avoid giving users raw CSS or unlimited arbitrary placement in the MVP.

## 2.5 Mobile-First Output

Most visitors will likely come from mobile links shared through Instagram, TikTok, WhatsApp, referrals, or direct messages.

The portfolio output must be:

- Responsive
- Fast
- Touch-friendly
- Easy to navigate
- Easy to submit a booking request from mobile

## 2.6 SEO and Sharing

Each public portfolio should support:

- Page title
- Meta description
- Open Graph image
- Slug customization
- Canonical URL
- Sitemap inclusion
- Noindex toggle
- Image alt text
- Structured data where relevant

---

# 3. Non-Negotiable Requirements

These requirements should be considered mandatory for the first serious production version.

## 3.1 Template-First Onboarding

Do not open users into a blank canvas.

The onboarding flow should ask:

- What kind of creative are you?
- What kind of events do you serve?
- What visual style do you prefer?
- What is the main goal of your portfolio?
- Do you want to receive booking requests?
- What services or packages do you offer?
- What images do you want to use first?

Example flow:

```txt
User selects: Wedding Photographer
User selects: Clean Luxury Style
User goal: Get booking inquiries
User uploads: 12 images
System creates: One-page portfolio draft with booking form
```

## 3.2 Mobile Preview

The editor must include preview modes for:

- Desktop
- Tablet
- Mobile

Important mobile controls:

- Image crop position
- Stack order
- Hide/show on mobile
- CTA placement
- Section spacing
- Mobile navigation behavior

## 3.3 Section-Level Editing

The editing unit should be a section or block, not individual pixels.

Examples of editable blocks:

- Hero section
- Gallery section
- Services section
- Packages section
- Testimonials section
- FAQ section
- Booking CTA
- About section
- Featured project
- Video showcase
- Contact form

## 3.4 Brand Kit

Each creative should have a reusable brand kit.

The brand kit should include:

- Logo
- Primary font
- Secondary font
- Font pairing preset
- Primary color
- Secondary color
- Accent color
- Background color
- Button style
- Border radius style
- Image treatment
- Social handles
- Default CTA text
- Default contact details

All templates and blocks should inherit from the brand kit by default.

## 3.5 Image Optimization Pipeline

Creatives will upload large media files. The system must protect performance.

Required image features:

- Image upload
- File type validation
- File size validation
- Automatic compression
- Responsive image generation
- WebP or AVIF conversion
- CDN delivery
- Lazy loading
- Placeholder loading state
- Crop/focal point selection
- Alt text
- Image ordering
- Delete protection if image is in use
- Storage quota per plan

## 3.6 Booking Request Integration

The booking form must create structured data inside the SaaS.

A submitted form should create:

- Lead record
- Booking request record
- Contact record
- Event date
- Event type
- Service requested
- Budget range
- Message
- Source portfolio page
- Status
- Notification to the creative
- Optional confirmation email to the visitor

## 3.7 Draft, Publish, and Versioning

Users will make mistakes. The editor must support safe publishing.

Required states:

- Draft
- Published
- Unpublished changes
- Preview URL
- Autosave
- Manual save
- Version history
- Restore previous version

## 3.8 Multi-Tenant Data Security

Every portfolio belongs to a user, business, or tenant.

Required security behavior:

- Tenant isolation
- Authenticated editor access
- Public read-only portfolio access
- Permission checks for media access
- Permission checks for form submissions
- Permission checks for portfolio editing

## 3.9 SEO and Social Sharing

Each page should support:

- SEO title
- SEO description
- Open Graph title
- Open Graph description
- Open Graph image
- Custom slug
- Canonical URL
- Noindex toggle
- Sitemap inclusion
- Alt text for images

## 3.10 Analytics

Track whether the portfolio converts.

Analytics should include:

- Portfolio views
- Unique visitors
- CTA clicks
- Form starts
- Form submissions
- Conversion rate
- Top projects
- Top pages
- Traffic source
- Device type
- Booking request value, if available

---

# 4. Recommended MVP Scope

The MVP should complete the full conversion loop:

```txt
Create portfolio
→ Publish portfolio
→ Visitor views portfolio
→ Visitor submits booking request
→ Creative receives lead
→ Creative responds
```

## 4.1 MVP Portfolio Builder Features

Include:

- 6 to 8 starter templates
- 12 to 15 Puck components
- Brand kit
- Media upload
- One-page portfolio support
- Project/gallery section
- Services/packages section
- Booking request form
- Mobile preview
- Draft/publish workflow
- Public URL
- Basic SEO
- Basic analytics

## 4.2 MVP Templates

Create these initial templates:

1. Wedding Photographer
2. Event Photographer
3. Videographer
4. Event Planner
5. Makeup Artist
6. Decorator or Venue
7. Minimal One-Page Portfolio
8. Corporate Creative Portfolio

## 4.3 MVP Booking Forms

Create these form templates:

1. General Booking Request
2. Photography Booking Request
3. Videography Booking Request
4. Event Planning Request
5. Makeup or Styling Request
6. Venue or Decorator Inquiry

## 4.4 MVP Puck Components

Build these components first:

1. Header
2. Hero
3. Gallery Grid
4. Masonry Gallery
5. Featured Project
6. Services List
7. Package Cards
8. About Section
9. Testimonials
10. FAQ
11. Booking Form
12. CTA Banner
13. Footer
14. Video Block
15. Contact or Social Block

---

# 5. Template Plan

Templates should be built around creative professions and booking intent.

Each template should include:

- Template name
- Target profession
- Recommended use case
- Pages included
- Sections included
- Default Puck JSON
- Default brand kit
- Default booking form
- Sample services/packages
- SEO defaults
- Suggested imagery style

## 5.1 Wedding Photographer Template

Recommended sections:

- Hero with emotional headline
- Featured wedding gallery
- Packages
- Process
- Testimonials
- FAQ
- Booking request form
- Instagram or social proof

Primary CTA:

```txt
Request Wedding Availability
```

## 5.2 Event Photographer Template

Recommended sections:

- Hero
- Gallery by event type
- Services
- Packages
- Featured events
- Testimonials
- Booking CTA

Primary CTA:

```txt
Request Event Coverage
```

## 5.3 Videographer Template

Recommended sections:

- Video hero
- Featured films
- Services
- Packages
- Editing style
- Process
- Testimonials
- Booking form

Primary CTA:

```txt
Request a Video Quote
```

## 5.4 Event Planner Template

Recommended sections:

- Hero
- Event categories
- Portfolio or case studies
- Planning process
- Packages or starting rates
- Testimonials
- Inquiry form

Primary CTA:

```txt
Plan My Event
```

## 5.5 Makeup Artist or Stylist Template

Recommended sections:

- Hero
- Lookbook
- Services
- Pricing
- Travel availability
- Testimonials
- Booking form

Primary CTA:

```txt
Request Makeup Availability
```

## 5.6 Decorator or Venue Template

Recommended sections:

- Hero
- Gallery
- Capacity/details
- Packages
- Location/map
- Preferred vendors
- Inquiry form

Primary CTA:

```txt
Request Venue or Styling Info
```

## 5.7 Minimal One-Page Portfolio Template

Recommended sections:

- Hero
- Gallery
- Services
- About
- Testimonials
- Booking request

Primary CTA:

```txt
Request a Booking
```

## 5.8 Corporate Creative Portfolio Template

Recommended sections:

- Hero
- Client logos
- Case studies
- Services
- Deliverables
- Testimonials
- Inquiry form

Primary CTA:

```txt
Request a Project Quote
```

---

# 6. Page Types

## 6.1 MVP Page Types

Support these first:

1. Home or portfolio landing page
2. Project or event case study page
3. Services page
4. Booking request page
5. About page
6. Contact page

## 6.2 Future Page Types

Plan architecture for:

1. Client galleries
2. Pricing page
3. Blog or tips page
4. Testimonials page
5. FAQ page
6. Press or features page
7. Vendor partner page
8. Digital product or store page
9. Private proposal page

---

# 7. Puck Component Library

The component library is the heart of the builder.

Use Puck for page composition, but expose only curated, production-ready components.

## 7.1 Core Visual Blocks

Build:

- Hero
- Image gallery grid
- Masonry gallery
- Carousel
- Before/after slider
- Video embed
- Featured project
- Case study grid
- Logo cloud
- Testimonial slider
- FAQ accordion
- Stats or counters
- CTA banner
- Contact card
- Map/location block
- Social links
- Instagram or TikTok embed, if supported

## 7.2 Business Blocks

Build:

- Services list
- Pricing/package cards
- Availability CTA
- Booking request form
- Mini lead form
- Add-on selector
- Process or timeline
- Deliverables list
- Contract/payment CTA, later
- Calendar availability embed, later

## 7.3 Trust Blocks

Build:

- Testimonials
- Reviews
- Client logos
- Awards/badges
- Featured publications
- As-seen-in section
- Verified profile badge
- Response time badge
- Completed bookings badge

## 7.4 Navigation and Layout Blocks

Build:

- Header
- Footer
- Sticky booking button
- Section divider
- Two-column content
- Image plus text
- Tabs
- Category filter
- Anchor navigation

---

# 8. Booking Request Form Specification

The booking request form should be configurable but structured.

## 8.1 Default Fields

### Client Details

- Full name
- Email
- Phone number
- Preferred contact method

### Event Details

- Event type
- Event date
- Event time
- Event location
- Number of guests or participants
- Indoor or outdoor
- Venue booked: yes/no

### Service Details

- Service needed
- Package interested in
- Estimated budget
- Add-ons needed
- Inspiration or reference links
- Message/details

### Logistics

- How did you hear about me?
- Urgency or timeline
- Consent checkbox
- Marketing opt-in, optional

## 8.2 Smart Form Behavior

Support:

- Required/optional fields
- Conditional fields
- Hidden source tracking fields
- Spam protection
- Optional file upload
- Multi-step mode
- Single-page quick form mode
- Confirmation message
- Auto-reply email
- Internal notification
- Lead status creation

## 8.3 Profession-Specific Form Questions

### Photographer Questions

- What type of shoot is this?
- How many hours of coverage do you need?
- Do you need prints or albums?
- Do you need a second shooter?

### Videographer Questions

- Do you need a same-day edit?
- Do you need drone footage?
- What final video length do you want?
- Do you need raw footage?

### Event Planner Questions

- Do you need full planning or day-of coordination?
- Do you already have vendors?
- What is your approximate event budget?
- What kind of event style are you aiming for?

### Makeup Artist Questions

- How many people need service?
- Where should the artist travel?
- What time should everyone be ready?
- Do you need a trial session?

### Venue or Decorator Questions

- What is your event date?
- How many guests are expected?
- Do you need styling, venue, or both?
- Do you already have a theme or color palette?

---

# 9. Data Model Plan

Use a hybrid data model.

Puck should manage page layout and section composition. Business-critical data should live in structured tables.

## 9.1 Core Entities

Recommended entities:

```txt
User
BusinessProfile
BrandKit
Portfolio
PortfolioPage
PortfolioPageVersion
PuckPageData
MediaAsset
Project
Service
Package
FormTemplate
FormField
FormSubmission
BookingRequest
Lead
Availability
Notification
Domain
AnalyticsEvent
```

## 9.2 Data That Can Live in Puck JSON

Good candidates for Puck JSON:

- Layout
- Section ordering
- Component props
- Page-specific copy
- Visual settings
- Component-level design settings

## 9.3 Data That Should Be Structured

Store these as database records:

- Services
- Packages
- Projects
- Testimonials
- Booking forms
- Media assets
- Availability
- Leads
- Business profile
- Brand kit
- Form submissions

## 9.4 Dynamic Reference Pattern

A Puck component should be able to reference structured records.

Example:

```ts
GalleryBlock {
  source: "manual" | "project" | "album";
  projectId?: string;
  imageIds?: string[];
}
```

This prevents important business data from being trapped inside page JSON.

---

# 10. Suggested Application Architecture

## 10.1 Dashboard Routes

Recommended dashboard routes:

```txt
/dashboard/portfolio
/dashboard/portfolio/editor/[pageId]
/dashboard/media
/dashboard/forms
/dashboard/booking-requests
/dashboard/services
/dashboard/packages
/dashboard/analytics
/dashboard/settings/brand
/dashboard/settings/domain
```

## 10.2 Public Routes

Recommended public routes:

```txt
/[creativeSlug]
/[creativeSlug]/book
/[creativeSlug]/projects/[projectSlug]
/[creativeSlug]/services
/[creativeSlug]/about
/[creativeSlug]/contact
```

For custom domains:

```txt
/
/book
/projects/[projectSlug]
/services
/about
/contact
```

## 10.3 Core Services

Recommended services:

```txt
PortfolioService
MediaService
FormService
BookingRequestService
LeadService
ThemeService
AnalyticsService
NotificationService
DomainService
```

---

# 11. Media Library Requirements

The media library should allow users to manage creative assets.

## 11.1 Required Features

- Upload images
- Upload videos, if supported
- View uploaded assets
- Organize by folders or tags
- Search media
- Select existing media from editor
- Crop image
- Set focal point
- Replace image
- Add alt text
- Track where asset is used
- Prevent deleting assets currently in use
- Enforce storage quotas by plan

## 11.2 Media Metadata

Each media asset should store:

```txt
id
userId
businessId
fileName
mimeType
fileSize
width
height
storageKey
cdnUrl
altText
folderId
tags
createdAt
updatedAt
```

---

# 12. Theme and Brand System

Users should be able to change global design without manually editing every section.

## 12.1 Brand Kit Fields

Recommended fields:

```txt
logoUrl
primaryFont
secondaryFont
primaryColor
secondaryColor
accentColor
backgroundColor
textColor
buttonStyle
borderRadius
shadowStyle
imageStyle
spacingDensity
```

## 12.2 Theme Presets

Create theme presets such as:

- Minimal
- Editorial
- Luxury
- Bold
- Corporate
- Romantic
- Modern
- Colorful
- Classic
- Clean

## 12.3 Font Pairings

Instead of letting users freely combine any fonts at first, provide curated font pairings.

Example categories:

- Elegant serif + clean sans-serif
- Modern sans-serif + neutral sans-serif
- Editorial display + serif body
- Friendly rounded + simple sans-serif

---

# 13. Publishing and Versioning

## 13.1 Required States

Each portfolio page should support:

```txt
draft
published
archived
```

## 13.2 Version Records

Each saved version should store:

```txt
id
pageId
versionNumber
puckData
createdBy
createdAt
status
```

## 13.3 Publishing Rules

Recommended behavior:

- Editing creates draft changes
- Published page remains stable until user republishes
- User can preview draft before publishing
- User can restore previous versions
- User can unpublish a page

---

# 14. Analytics Specification

## 14.1 Events to Track

Track:

```txt
portfolio_viewed
page_viewed
cta_clicked
booking_form_started
booking_form_submitted
project_viewed
service_clicked
package_clicked
external_social_clicked
```

## 14.2 Analytics Dimensions

Store:

```txt
portfolioId
pageId
businessId
visitorId
sessionId
deviceType
referrer
utmSource
utmMedium
utmCampaign
country
createdAt
```

## 14.3 Dashboard Metrics

Show:

- Views
- Unique visitors
- Booking requests
- Conversion rate
- Top traffic sources
- Top pages
- Top projects
- Most clicked CTA
- Device breakdown

---

# 15. Notification Requirements

## 15.1 Notification Types

When a booking request is submitted, notify the creative through:

- In-app notification
- Email notification
- Optional SMS later
- Optional WhatsApp later

## 15.2 Client Confirmation

Send the visitor a confirmation email if email is provided.

Example confirmation purpose:

```txt
Confirm that the booking request was received.
Set expectations for response time.
Provide a copy of the submitted request.
```

## 15.3 Follow-Up Reminders

Later, add reminders if the creative has not responded to a new lead.

---

# 16. Trust, Safety, and Abuse Prevention

Because users can publish public pages and upload media, safety controls are required.

## 16.1 Upload Safety

Implement:

- File type validation
- File size validation
- Extension validation
- Malware scanning if available
- Upload rate limits
- Storage quotas

## 16.2 Public Form Safety

Implement:

- Rate limiting
- Spam protection
- Bot protection
- IP throttling
- Honeypot field
- reCAPTCHA or Turnstile if needed

## 16.3 Public Page Safety

Implement:

- Report profile/page feature
- Abuse review workflow
- Terms and privacy links
- Content moderation policy
- Ability to disable public portfolio

---

# 17. Accessibility Requirements

The public portfolio pages should be accessible.

Required accessibility behavior:

- Semantic headings
- Alt text for images
- Keyboard navigability
- Visible focus states
- Sufficient color contrast
- Form labels
- Form error messages
- Accessible carousel controls
- Reduced motion support
- Proper button and link semantics

---

# 18. Performance Requirements

The public portfolio must be fast.

## 18.1 Public Page Performance

Requirements:

- Use server-side rendering or static rendering where appropriate
- Cache published pages
- Use CDN-hosted media
- Optimize images
- Lazy-load heavy galleries
- Avoid loading editor code on public pages
- Keep JavaScript minimal on public routes
- Monitor Core Web Vitals

## 18.2 Editor Performance

Requirements:

- Lazy-load heavy editor panels
- Debounce autosave
- Avoid excessive re-renders
- Virtualize large media lists
- Keep Puck component props controlled and predictable

---

# 19. Features to Avoid in the MVP

Avoid building these too early:

- Full freeform page builder
- Full blog engine
- Advanced animation builder
- Full e-commerce
- Client proofing galleries
- Contracts
- Invoices
- Custom code injection
- Template marketplace
- Complex multi-language support
- Deep team permissions
- AI site generation
- White-label custom domains for every plan

Design your architecture so these can be added later, but do not let them block the MVP.

---

# 20. Roadmap

## Phase 1: Portfolio MVP

Build:

- Template selection
- Brand kit
- Puck editor
- Media upload
- Public portfolio
- Booking request form
- Lead inbox
- Notifications
- Basic analytics
- Draft/publish workflow

## Phase 2: Conversion Tools

Build:

- Packages
- Availability/date checking
- Conditional forms
- Testimonials manager
- Case study pages
- Custom domains
- SEO improvements
- Better analytics

## Phase 3: Creative Business Workflow

Build:

- Proposals
- Contracts
- Invoices
- Deposits
- Client galleries
- File delivery
- Calendar sync
- Email automations

## Phase 4: Growth and Marketplace

Build:

- Template marketplace
- AI portfolio generator
- Copy suggestions
- Review imports
- Social media integrations
- Vendor directory
- Public creative marketplace

---

# 21. Codex Implementation Instructions

Use this section as a development planning guide for Codex or another coding agent.

## 21.1 Implementation Principle

Build the system around structured business data plus Puck-powered visual composition.

Do not store all business content only inside Puck JSON.

Puck should manage layout and page-specific content. The database should own reusable business entities such as services, packages, projects, testimonials, forms, leads, media assets, and brand settings.

## 21.2 Suggested Build Order

### Step 1: Create Database Models

Create models for:

```txt
User
BusinessProfile
BrandKit
Portfolio
PortfolioPage
PortfolioPageVersion
MediaAsset
Service
Package
Project
Testimonial
FormTemplate
FormField
FormSubmission
BookingRequest
Lead
AnalyticsEvent
Notification
```

### Step 2: Build Brand Kit Settings

Allow users to set:

- Logo
- Fonts
- Colors
- Button style
- Border radius
- Social links
- Default CTA

### Step 3: Build Media Library

Implement:

- Upload
- List assets
- Select asset from editor
- Delete asset
- Store metadata
- Add alt text
- Add focal point later

### Step 4: Integrate Puck Editor

Create a Puck editor route:

```txt
/dashboard/portfolio/editor/[pageId]
```

The editor should:

- Load page draft data
- Register approved components
- Autosave changes
- Allow preview
- Allow publish

### Step 5: Create Puck Components

Start with:

- Header
- Hero
- GalleryGrid
- ServicesList
- PackageCards
- AboutSection
- Testimonials
- FAQ
- BookingForm
- CTA
- Footer

### Step 6: Build Template System

Create template seed data for:

- Wedding Photographer
- Event Photographer
- Videographer
- Event Planner
- Makeup Artist
- Decorator/Venue
- Minimal One-Page Portfolio
- Corporate Creative Portfolio

Each template should create:

- Portfolio
- Page
- Puck JSON
- Default form
- Default brand kit settings

### Step 7: Build Public Portfolio Renderer

Create public route:

```txt
/[creativeSlug]
```

The public renderer should:

- Load published Puck data
- Render registered components
- Load brand kit
- Load structured records referenced by blocks
- Exclude editor-only JavaScript
- Render SEO metadata

### Step 8: Build Booking Request Form

The booking form should:

- Render from a form schema
- Validate required fields
- Submit to backend
- Create lead
- Create booking request
- Trigger notifications
- Show confirmation message

### Step 9: Build Lead Inbox

Create dashboard route:

```txt
/dashboard/booking-requests
```

Allow users to:

- View new booking requests
- Change status
- See client details
- See event details
- See source portfolio/page
- Reply later via email integration

### Step 10: Add Analytics

Track:

- Page views
- CTA clicks
- Form starts
- Form submissions

Show basic metrics in the dashboard.

---

# 22. Acceptance Criteria

Use these criteria to evaluate the first working version.

## 22.1 User Can Create Portfolio

A user can:

- Select a template
- Edit content in Puck
- Upload images
- Change brand colors
- Change fonts
- Add services
- Add packages
- Save a draft
- Preview the page
- Publish the page

## 22.2 Visitor Can Submit Booking Request

A visitor can:

- Open the public portfolio URL
- View the portfolio on mobile
- Click a booking CTA
- Fill out a booking request form
- Submit the form
- See a confirmation message

## 22.3 Creative Can Manage Lead

The creative can:

- Receive notification
- View booking request in dashboard
- See event details
- See client contact details
- Change lead status

## 22.4 System Is Production-Safe

The system should:

- Enforce tenant access control
- Validate uploads
- Protect form submissions from spam
- Render fast public pages
- Preserve published page while draft is edited
- Allow restoring previous versions

---

# 23. Recommended MVP Definition

The MVP is complete when the following loop works reliably:

```txt
A creative signs up
→ selects a template
→ customizes portfolio using Puck
→ uploads images
→ publishes public portfolio
→ visitor views portfolio
→ visitor submits booking request
→ creative receives and manages the lead
```

Do not expand into advanced website-builder features until this loop works smoothly.

---

# 24. Final Product Direction

The drag-and-drop portfolio maker should be beautiful, controlled, fast, and directly tied to bookings.

The best version of this feature is not a generic site builder. It is a specialized portfolio and booking funnel for creative professionals.

The key product promise should be:

```txt
Build a beautiful portfolio, showcase your creative work, and turn visitors into booking inquiries.
```
