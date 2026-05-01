---
name: Folio
description: A personal job application cockpit — calm, methodical, and direct.
colors:
  carbon-ink: "oklch(0.148 0.008 50)"
  warm-clay: "oklch(0.48 0.12 52)"
  warm-amber: "oklch(0.60 0.10 52)"
  blank-canvas: "oklch(0.99 0.006 50)"
  near-white: "oklch(0.99 0.005 50)"
  pale-smoke: "oklch(0.968 0.006 50)"
  stone-gray: "oklch(0.542 0.008 50)"
  chalk-line: "oklch(0.916 0.006 50)"
  ember-red: "oklch(0.577 0.245 27.325)"
typography:
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  base: "0.625rem"
  xl: "0.875rem"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-default:
    backgroundColor: "{colors.deep-graphite}"
    textColor: "{colors.near-white}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  button-default-hover:
    backgroundColor: "oklch(0.205 0 0 / 0.8)"
    textColor: "{colors.near-white}"
    rounded: "{rounded.md}"
  button-outline:
    backgroundColor: "{colors.blank-canvas}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  badge-status:
    backgroundColor: "oklch(0.556 0 0 / 0.1)"
    textColor: "{colors.stone-gray}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  card-default:
    backgroundColor: "{colors.blank-canvas}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
    height: "36px"
---

# Design System: Folio

## 1. Overview

**Creative North Star: "The Quiet Instrument Panel"**

Folio is built for the long middle of a job search: weeks of careful triage, the daily discipline of moving applications forward, the evening reviews that make the next morning manageable. Its design reflects that reality — composed, purposeful, nothing decorative. Like a well-calibrated instrument panel, every reading earns its position. The interface does not celebrate the search; it supports it.

The system is restrained by design: an achromatic neutral foundation with a single chromatic layer reserved for semantic pipeline status. Color in Folio is never decorative — always informational. The type scale is modest and built for repeated daily use. Surfaces are flat at rest, lifting only under interaction. Warmth comes from proportion and restraint, not tinted backgrounds.

Folio explicitly rejects the corporate-blue anxiety of LinkedIn, Indeed, and Facebook: the notification-badge pressure, the metric-heavy feeds, the aggressive CTAs. Nothing here is trying to sell anything. The interface belongs to one person, during a defined period, doing a specific job.

**Key Characteristics:**
- Achromatic foundation with semantic color only at the pipeline status layer
- Flat surfaces at rest; structural shadows on hover and elevation
- Tight type scale with no display hierarchy — this is a working tool, not a landing page
- Rounded-md (0.5rem) for interactive elements, rounded-xl (0.875rem) for containers
- System font stack: legible, zero loading overhead, no typeface personality imposed

## 2. Colors: The Instrument Palette

The palette is achromatic: grays from near-black to near-white, with a single chromatic exception (Ember Red for destructive and error states) and a semantic status layer that lives exclusively in pipeline badges.

### Primary
- **Warm Clay** (oklch(0.48 0.12 52)): Primary button background and high-emphasis interactive elements. A muted terracotta — warm and earthy without demanding attention. Used sparingly; its presence signals the single most important action on screen.
- **Warm Amber** (oklch(0.60 0.10 52)): Focus rings and active indicators only. The keyboard-navigation signal and the one place interactive state is colored rather than just darkened.
- **Carbon Ink** (oklch(0.148 0.008 50)): All body text, headings, and high-contrast foreground content. Warm-tinted near-black.

### Neutral
- **Blank Canvas** (oklch(0.99 0.006 50)): Page surface and card backgrounds in light mode. Warm cream white — never pure.
- **Near White** (oklch(0.99 0.005 50)): Foreground text on dark backgrounds (primary buttons). Matches Blank Canvas closely.
- **Pale Smoke** (oklch(0.968 0.006 50)): Secondary and muted surfaces, hover fill for ghost/outline buttons. Warm light gray.
- **Stone Gray** (oklch(0.542 0.008 50)): Secondary text, placeholders, metadata labels, timestamps. Warm medium.
- **Chalk Line** (oklch(0.916 0.006 50)): Borders, input strokes, dividers. The quietest visible mark — warm-tinted.

### Tertiary (semantic status layer — badges only)
Pipeline status badges use Tailwind semantic colors at reduced opacity (bg-color/10 to bg-color/20), always with matching text and border. Blue for pending, purple for interviewing, green for offered, yellow for applied, orange for error or expired, red for denied. These colors do not appear anywhere else in the interface.

- **Ember Red** (oklch(0.577 0.245 27.325)): Destructive actions and form validation errors. The only chromatic token in the core system.

### Named Rules
**The Instrument Reading Rule.** Color in Folio is exclusively informational. If a color is not communicating pipeline state, a destructive condition, or an interaction state, it should not be there. Text is never colored for decoration; no element uses color as atmosphere. The warm neutral tint in the background is foundational temperature, not color.

**The One Clay Rule.** Warm Clay (oklch(0.48 0.12 52)) appears only on primary buttons and their immediate hover/active states. It does not appear on text, borders, backgrounds, icons, or any secondary element. Its rarity is the point.

## 3. Typography

**Body Font:** `ui-sans-serif, system-ui, sans-serif` (Tailwind `font-sans` — no custom loading)
**Heading Font:** Same family (`font-heading` aliases `font-sans`)

**Character:** Neutral and immediate. Folio renders in whatever the user's OS considers readable: Inter on macOS, Segoe UI on Windows. No personality is imposed through the typeface — character comes from proportion, weight contrast, and restraint.

### Hierarchy
- **Title** (600 weight, 1rem/16px, 1.3 line-height): Section headings, card titles, modal titles. The practical ceiling for most screens.
- **Body** (400 weight, 0.875rem/14px, 1.5 line-height): Card content, descriptions, form labels, AI chat responses. Line length capped at 65–75ch.
- **Label** (500 weight, 0.75rem/12px, 1.4 line-height): Status badges, metadata, timestamps, secondary annotations.
- **Page heading** (600–700 weight, 1.125–1.25rem): Used only for job detail page titles and top-level report headers — not a recurring pattern.

### Named Rules
**The No-Display Rule.** There is no display or hero type size in Folio. The largest visible text is a job title or section heading. Nothing here is meant to impress at a glance; everything is meant to be read at work.

## 4. Elevation

Folio is flat by default. Depth is a functional signal — it appears in response to state changes, not as atmosphere.

### Shadow Vocabulary
- **At rest — no shadow:** All page surfaces, sidebar, and cards at their default state.
- **Ring only** (`ring-1 ring-foreground/10`): Cards carry a 1px perimeter ring at 10% foreground opacity at rest. Distinguishes card surface from page without requiring a shadow.
- **Hover lift** (`shadow-xs: 0px 4px 8px -1px hsl(0 0% 0% / 0.05)`): Cards on hover. The minimum legible lift.
- **Elevated layer** (`shadow-sm: 0px 4px 8px -1px hsl(0 0% 0% / 0.10), 0px 1px 2px -2px hsl(0 0% 0% / 0.10)`): Dropdowns, popovers, select menus.
- **Floating layer** (`shadow-md`/`shadow-lg`): Dialogs, command menus, tooltips. The highest layer.

### Named Rules
**The Flat-By-Default Rule.** A shadow at rest means nothing — it reads as invisible noise. If a surface needs to be distinguished at rest, use a ring. If it needs to respond to interaction, use a shadow. Never use both as decoration.

## 5. Components

### Buttons
Composed and minimal. Buttons communicate function through label and position, not color. Multiple variants reduce visual weight in context.

- **Shape:** Gently rounded (0.5rem, `rounded-md`) for default and standard sizes.
- **Primary (default):** Deep Graphite background, Near White text, 36px height, 10px horizontal padding. Hover: 80% opacity. Active: 1px downward translate.
- **Outline:** Blank Canvas background, 1px Chalk Line border, shadow-xs. Hover fills to Pale Smoke.
- **Ghost:** Transparent, no border. Hover fills with Pale Smoke. Used for secondary actions inside cards and icon buttons in navigation.
- **Destructive:** Ember Red at 10% opacity background, full-red text, never solid red background.
- **Focus:** 3px ring at 50% opacity of the Focus Ring token — keyboard accessible, invisible to mouse users.

### Status Badges
The most visually distinctive component. Semantic, pill-shaped, always in context.

- **Shape:** Full pill (9999px radius), 20px height, 8px horizontal padding, 12px text.
- **Style:** Muted semantic background (10–20% opacity), matching 1px border, full-opacity semantic text.
- **States:** Researching (neutral), Pending (blue/sky), Applied (yellow/amber), Interviewing (purple/violet), Offered (green/emerald), Denied (red), Withdrawn (neutral), Error and Expired (orange).
- **Rule:** Status badges are the only place color appears outside error states. Always used alongside a job title or within a pipeline view — never as standalone decoration.

### Cards
Flat surfaces that lift on hover. The primary container for job listings and metric summaries.

- **Corner Style:** Gently rounded (0.875rem, `rounded-xl`)
- **Background:** Blank Canvas (oklch(1 0 0))
- **Shadow Strategy:** Ring-only at rest (`ring-1 ring-foreground/10`); shadow-xs on hover
- **Border:** None — the ring replaces it
- **Internal Padding:** 24px standard (`py-6 px-6`); 16px compact (`data-[size=sm]`)

### Inputs / Fields
Stroke-style fields on transparent backgrounds. Maximum legibility, minimum visual weight.

- **Style:** Transparent fill, 1px Chalk Line border, rounded-md (0.5rem), 36px height, 10px horizontal padding.
- **Focus:** 3px ring at 50% Focus Ring opacity; border color shifts to Focus Ring.
- **Placeholder:** Stone Gray — readable but clearly secondary.
- **Error:** Ember Red border, 3px Ember Red ring at 20% opacity.
- **Disabled:** 50% opacity, cursor not-allowed.

### Navigation (Tab-style)
The main page uses tab navigation (Jobs, Companies, Reports).

- **Style:** Text-based tabs, active underline indicator, no background fill panels.
- **Active:** Full foreground opacity, visible bottom indicator.
- **Inactive:** Stone Gray text, no decoration.
- **Hover:** Foreground text.

### Job Card (Signature Component)
The primary working surface of the application. Each card is a job in the pipeline.

A job card shows: job title (font-semibold), company name or hostname (Stone Gray, smaller), a status badge, and a date or metadata annotation. The card links to the full job detail. A status selector is inline on the card — changing status does not navigate away. Cards in RESEARCHING state show a spinner beside the title label.

- **Interaction:** Hover lifts (shadow-xs). Click navigates to job detail.
- **Researching state:** Spinner + "Researching..." label replaces title until scrape completes.
- **Deleted/archived state:** 50% opacity, not removed from view.

## 6. Do's and Don'ts

### Do:
- **Do** use semantic status badge colors for pipeline state communication — they are the only intentional color in the system.
- **Do** use `ring-1 ring-foreground/10` on card surfaces at rest instead of shadows. The ring earns its distinction; a shadow does not.
- **Do** keep button labels direct and actionable: one verb or a short noun phrase. No padding words.
- **Do** cap body text columns at 65–75ch — particularly in job detail and AI chat views.
- **Do** use ghost buttons for secondary actions inside cards and list items. Default (primary) buttons for the single primary action per view.
- **Do** use OKLCH for any new color tokens. Never add hex or HSL values to the `:root` block.
- **Do** flatten shadows on new surfaces at rest. If a surface needs distinction at rest, use a ring.

### Don't:
- **Don't** reproduce the notification-badge anxiety, metric-heavy feeds, or aggressive CTAs of LinkedIn, Indeed, or Facebook. Folio is not trying to sell anything.
- **Don't** add decorative color: no gradient accents, no colored headings, no tinted card backgrounds unless they carry status meaning.
- **Don't** use a display or hero type size. This is a working tool; nothing is meant to be impressive at a glance.
- **Don't** use border-left or border-right greater than 1px as a colored accent stripe on list items or cards. Use background tints or full borders.
- **Don't** nest cards. Page surface and cards are two layers; a third nesting layer is always wrong.
- **Don't** use glassmorphism or backdrop-filter effects — decorative and inconsistent with the instrument panel character.
- **Don't** use shadows on page-level surfaces at rest. Flat-By-Default.
