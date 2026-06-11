# Handoff: portamed — Landing Page (Direction A)

## Overview
Marketing/landing page for **portamed**, a telehealth + health-tourism platform connecting
international patients with accredited clinics and specialists in Türkiye. This package documents
the desktop landing page in **two themes** (light "Editorial Calm" and dark/glow). Both themes share
identical content, layout, and section order — only color tokens differ.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that show the
intended look and behavior. They are **not production code to copy directly**. The HTML file is a
"Design Component" (`.dc.html`) that depends on a small runtime to render, so treat it as a visual
spec, not a drop-in component.

Your task is to **recreate this design in your existing codebase**, using its established framework,
component library, and patterns (React, Vue, SwiftUI, etc.). If the project has no UI environment
yet, pick the most appropriate framework and implement there. Match the spec below precisely; map
the visuals onto your own design-system primitives where you have them.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and layout are specified below with
exact values. Recreate the UI pixel-perfectly using your codebase's libraries. Photographic areas
are shown as striped placeholders — swap in real imagery (see Assets).

---

## Design Tokens

### Colors — shared
| Token | Hex | Use |
|---|---|---|
| `teal` (primary) | `#0E9E97` | Primary buttons, accents, links, logo ring (light) |
| `teal-deep` | `#0A7D77` | Link text, hover on light |
| `teal-bright` | `#5FD0C7` | Accent on dark, logo "med", glow ring |
| `teal-glow` | `#7FE9E0` | Logo ring stroke on dark, glow highlights |
| `emerald` | `#0A3F39` | Dark panels/cards on light theme, CTA accents |
| `emerald-900` | `#072E29` | Trust strip / footer bg (dark theme) |
| `ink` | `#14211F` | Primary text (light), dark icon bg |
| `gold` | `#C6A664` | Premium price badge (dark theme), optional accent |

### Colors — light theme ("Editorial Calm")
| Token | Hex | Use |
|---|---|---|
| `bg` | `#E4E2DC` | Page backdrop (outside the page frame) |
| `surface` | `#F7F5EF` | Page/card surface (ivory) |
| `surface-alt` | `#F2EFE7` | Trust strip, doctors panel, footer |
| `text` | `#14211F` | Headings/body |
| `text-muted` | `#5C6663` | Secondary text |
| `text-soft` | `#3A4744` | Nav items |
| `border` | `rgba(20,33,31,.08)` | Hairline borders |

### Colors — dark theme
| Token | Hex | Use |
|---|---|---|
| `bg` | `#05201C` | Page surface |
| `surface` | `#0A3F39` | Cards, nav chrome |
| `surface-alt` | `#072E29` | Trust strip, doctors panel, footer |
| `text` | `#F4F1E8` | Headings/body (ivory) |
| `text-muted` | `#9FC0BA` | Secondary text |
| `text-soft` | `#B9D2CE` | Nav items |
| `border` | `rgba(95,208,199,.12)` | Hairline borders |

### Typography
- **Display / headings:** `Newsreader`, serif. Weight 500 (occasionally 400). Negative tracking
  `-0.015em` on large sizes. (Google Fonts: Newsreader, opsz 6–72.)
- **Body / UI:** `Hanken Grotesk`, sans-serif. Weights 300/400/500/600/700.
- **Logo wordmark:** Hanken Grotesk 700, letter-spacing `-0.035em`, all lowercase `portamed`.

Type scale used:
| Role | Font | Size / line-height / weight |
|---|---|---|
| Hero H2 | Newsreader | 62px / 1.04 / 500 |
| Section H3 | Newsreader | 38px / 1.08 / 500 |
| Testimonial quote | Newsreader | 27px / 1.3 / 400 |
| Stat number | Newsreader | 30px / 1 / 500 |
| Step number | Newsreader | 34px / 1 / 500 |
| Body large | Hanken Grotesk | 18px / 1.6 / 400 |
| Body | Hanken Grotesk | 14.5px / 1.6 |
| Card title | Hanken Grotesk | 16.5px / 600 |
| Small / meta | Hanken Grotesk | 13px / 500 |
| Eyebrow label | Hanken Grotesk | 12.5px / 600, letter-spacing 0.12em, uppercase |

### Spacing & shape
- Section vertical padding: `64–72px`. Horizontal page padding: `48px`.
- Card radius: `18px`. Panel radius: `20px`. Page frame radius: `18px`. Pills/buttons: `999px`.
- Grid gaps: cards `18px`, panels `20px`, step columns `22px`.
- Soft shadow (cards/floats): `0 22px 48px -22px rgba(20,33,31,.5)`.
- Page max-width: **1320px** content; hero grid `1.05fr 0.95fr`, gap `44px`.

### The logo (portal ring)
- Wordmark `portamed`, all lowercase, Hanken Grotesk 700, tracking `-0.035em`.
- The **"o" is replaced by an ellipse "portal ring"**: `rx≈20, ry≈33` (tall oval), rotated `-18°`,
  stroke ≈ `6.5–7.5` (scales with size), `stroke-linecap: round`. "med" is colored teal.
- **Light:** ring stroke `#0E9E97`, no glow.
- **Dark:** ring stroke `#7FE9E0` + soft glow. Glow = a radial-gradient halo BEHIND the ring
  (`radial-gradient(circle closest-side, rgba(127,233,224,.5), transparent ~74%)`) plus a *small*
  `drop-shadow(0 0 3–4px rgba(95,208,199,.95))` on the stroke. **Do not** use a large `drop-shadow`
  blur as the only glow — the SVG filter region clips it into a visible rectangle. Put the bloom in
  the background halo element instead.

---

## Screens / Views

There is one screen (the landing page), delivered in two themes. Sections top-to-bottom:

### 1. Nav bar
- Layout: flex row, `justify-content: space-between`, `gap: 36px`, padding `22px 48px`, bottom hairline.
- Left: logo (`flex-shrink: 0`). Center: menu links (`flex: 1; justify-content: center; gap: 34px`):
  Treatments · How it works · Doctors · For clinics. Right (`flex-shrink: 0`): `EN · TR` toggle,
  "Sign in" text link, primary pill button "Free consultation".
- Button: teal bg `#0E9E97`, white text, `padding: 11px 20px`, radius 999px, 14px/600.

### 2. Hero
- Two-column grid `1.05fr 0.95fr`, gap 44px, padding `72px 48px 64px`, vertically centered.
- Left column:
  - Eyebrow pill: "Health tourism & telehealth", teal-tinted bg, dot + text, `white-space: nowrap`.
  - H2 (Newsreader 62px/500): "Your gateway to world-class care in Türkiye."
  - Paragraph (18px, muted, max-width ~46ch).
  - Button row: primary "Plan my treatment" (teal pill) + secondary "Talk to a doctor now"
    (outlined pill with a circular play glyph).
  - Stats row: three stats (20k+ International patients · 40+ Accredited clinics · 4.9★ Patient
    rating) separated by 1px vertical dividers. Numbers in Newsreader 30px.
- Right column: portrait image placeholder (radius 22px, aspect 4/5) with two floating cards:
  - Bottom-left card: doctor avatar + name "Dr. Elif Yıldız / Hair transplant · Istanbul" +
    "Video consult — Today 16:30" chip.
  - Top-right badge: "All-inclusive from / €1,490" (emerald on light; gold on dark).

### 3. Trust strip
- Full-width band, alt surface, top hairline, padding `24px 48px`, flex row gap 40px.
- Label "Accredited & trusted" + 5 monochrome logo placeholder bars (opacity ~0.5).

### 4. Treatment packages
- Header row: eyebrow "Treatment packages" + H3 "Curated journeys, transparent pricing." +
  right-aligned "View all 60+ →".
- 4-column grid, gap 18px. Three product cards (image placeholder 4/3 + title + meta + price
  "€1,490 from") and one accent card ("Not sure where to start?" with a contrasting CTA pill).
  - Light accent card: emerald `#0A3F39` bg, white CTA pill.
  - Dark accent card: teal `#0E9E97` bg, dark CTA pill.

### 5. How it works
- Centered header: eyebrow "How it works" + H3 "Four steps, fully taken care of."
- 4-column grid. Each column has a top border (first = teal 2px, rest = faint), big serif step
  number (01–04, teal), bold title, muted description.
  - 01 Free assessment · 02 Tailored plan · 03 Arrive & heal · 04 Follow-up at home.

### 6. Doctors + AI assistant (split)
- Grid `1.3fr 1fr`, gap 20px.
- Left "Meet the specialists" panel (alt surface): header + "All doctors →" link; 3-column grid of
  doctor cards (square avatar placeholder + name + specialty).
- Right "AI health assistant" panel (ink `#14211F` on light; teal `#0E9E97` on dark): label + chat
  bubbles (a user question bubble + an assistant reply bubble) + "Ask the assistant" button.

### 7. Testimonial
- Emerald panel `#0A3F39`, radius 20px, padding 48px. Grid `0.9fr 1.4fr`.
- Left: square portrait placeholder. Right: 5 stars, serif quote (27px), name "James W. · United
  Kingdom", meta "Hair transplant · 2 nights in Istanbul".

### 8. CTA band
- Teal `#0E9E97` panel, radius 20px, padding 56px, centered text.
- H3 (Newsreader 40px) "Ready to open the door to your care?" + paragraph + two buttons
  ("Plan my treatment" solid, "Talk to a doctor" translucent).

### 9. Footer
- Alt surface, top hairline, padding `44px 48px`, flex row space-between.
- Left: logo + one-line description. Right: three link columns (Care / Company / Support).

---

## Interactions & Behavior
- **Language toggle** `EN · TR`: switches all copy between English and Turkish (i18n). Active locale
  highlighted; inactive dimmed.
- **Theme**: light vs dark is a top-level theme choice. Recommend implementing as a theme token set
  (CSS variables / theme provider) so the same components render both. (Pick one as default; the two
  are provided so the team can choose — or support a toggle.)
- **Buttons / links**: standard hover (darken/lighten ~6–8%, or raise shadow on cards). Pills keep
  999px radius.
- **CTAs** route to: "Plan my treatment" → treatment-plan intake flow; "Talk to a doctor now" →
  telehealth booking; "Get my plan" → free-assessment form; "Ask the assistant" → AI assistant.
- **Responsive** (not in this desktop mock — implement): collapse hero to single column < ~900px;
  packages 4→2→1 columns; nav → hamburger on mobile; keep 44px min tap targets.

## State Management
- `locale: 'en' | 'tr'` (persist to localStorage / cookie).
- `theme: 'light' | 'dark'` (if a toggle is offered; else a build constant).
- Data: treatment packages, doctors, testimonials should come from CMS/API — the mock hardcodes
  sample content. Model: `Package { title, meta, priceFrom, image }`,
  `Doctor { name, specialty, photo }`, `Testimonial { quote, name, country, meta, photo }`.

## Assets
- **Logo**: portal-ring wordmark. Recreate as inline SVG per the logo spec above (no raster needed).
  A standalone logo reference is included: `Porta Med Logo.dc.html`.
- **Photography**: hero portrait, package thumbnails, doctor headshots, testimonial portrait — all
  shown as striped placeholders. Supply real licensed images (clinic/patient/Istanbul imagery).
- **Fonts**: Newsreader + Hanken Grotesk (Google Fonts). Self-host or load via `<link>`.
- **Partner/accreditation logos**: 5 placeholder bars in the trust strip — replace with real
  accreditation marks (e.g. JCI) and partner logos.
- **Icons**: minimal (play glyph, dot, arrow "→", star "★") — use your icon set.

## Files
- `portamed Landing A.dc.html` — the full landing page, both themes stacked (light then dark),
  each inside a labeled browser-frame.
- `Porta Med Logo.dc.html` — logo system reference (wordmark, ring construction, app icon, glow).
- `screenshots/01–04-landing.png` — light theme (hero → packages → how-it-works → testimonial/CTA).
- `screenshots/05–08-landing.png` — dark theme (same section order).

> Note: `.dc.html` files render via a design runtime. Open them in the design tool to view, or read
> the markup as a structural/style reference. All values needed to rebuild are in this README.
