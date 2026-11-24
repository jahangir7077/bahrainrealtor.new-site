# Design system — Phase 1B.2

## Status and scope

Phase 1B.2 is authorized for the reusable visual foundation only. It is not a
final homepage or production design. No property listings, SEO landing pages,
navigation, localization workflow, integrations, or later-phase features are
included. The public SEO routes, keyword ownership, domain, and URL migration
requirements remain unchanged.

## Visual identity

The approved direction combines premium luxury with a practical property
portal: a light theme, navy-led hierarchy, selective champagne-gold accents,
and dark premium surfaces. English and Arabic are designed as equal-quality
directions. No third-party branding, photography, or property claims are used.

## Color tokens and contrast

Color values are centralized in `src/styles/tokens.css`. Primary navy remains
the dominant brand color; champagne gold is decorative or used with navy text,
not as text on white/ivory.

| Foreground | Background | Contrast | Use |
| --- | --- | ---: | --- |
| Navy `#10243A` | White `#FFFFFF` | 15.72:1 | Primary text, controls, focus |
| Charcoal `#263238` | White `#FFFFFF` | 13.16:1 | Body text |
| Slate `#64748B` | White `#FFFFFF` | 4.76:1 | Secondary text |
| Navy `#10243A` | Gold `#C4A36B` | 6.59:1 | Text on gold buttons |
| White `#FFFFFF` | Navy `#10243A` | 15.72:1 | Text on dark premium surfaces |
| Success `#166534` | `#F0FDF4` | 6.81:1 | Success status |
| Warning `#713F12` | `#FFFBEB` | 8.36:1 | Warning status |
| Error `#B91C1C` | `#FEF2F2` | 5.91:1 | Error status |
| Navy `#10243A` | `#EFF6FF` | 14.45:1 | Informational status |
| Disabled `#475569` | `#E2E8F0` | 6.15:1 | Disabled control text |

Ratios were calculated from the sRGB relative luminance formula. Text pairs
listed exceed WCAG AA's 4.5:1 normal-text threshold; large text requires
3:1. The slate control border on white is 4.76:1 against its adjacent surface.
Focus rings use navy on light surfaces and gold on navy surfaces. These
calculations do not replace browser-based assessment of every rendered state.

## Typography and font licensing

The approved families are Playfair Display for English display headings,
Inter for English body/interface, and Tajawal for Arabic. The family stacks
and responsive rem-based sizes are declared in `src/styles/typography.css`.
Arabic uses increased line-height and normal letter spacing.

The Google Fonts upstream directories identify all three families under the
SIL Open Font License 1.1:

- [Playfair Display license and metadata](https://github.com/google/fonts/tree/main/ofl/playfairdisplay)
- [Inter license and metadata](https://github.com/google/fonts/tree/main/ofl/inter)
- [Tajawal license and metadata](https://github.com/google/fonts/tree/main/ofl/tajawal)
- [SIL Open Font License 1.1 text](https://openfontlicense.org/open-font-license-official-text/)

No font binaries are included yet. The environment could not resolve
`fonts.googleapis.com` to retrieve WOFF2 assets. This limitation is explicit:
the stacks temporarily fall back to Georgia/Times for display, Segoe UI/Arial
for interface, and Tahoma/Arial for Arabic. No external font request is made.
Before production use, obtain optimized, self-hosted WOFF2 subsets and include
the upstream OFL notices with the assets. The named families must not be
silently treated as bundled or verified in the rendered experience.

## Spacing and responsive layout

Spacing tokens are multiples of 4px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 56,
64, 80, and 96px. Standard, wide, and narrow containers target 1280px,
1440px, and 720px with fluid logical gutters. The grid uses 4 columns on
mobile, 8 at 768px, and 12 at 1024px. Other agreed breakpoints are 480px,
1280px, and 1440px; layouts may fluidly adapt between them. Cards use 12px
radii, buttons 8px, and interactive controls at least 44px high.

CSS uses mobile-first Grid/Flexbox and logical inline/block properties for
RTL. Typography targets: hero 56/36px, H1 48/32px, H2 36/28px, H3 24/22px,
H4 20/18px, body 16px, small 14px, buttons 15–16px (desktop/mobile).

## Components

Components live under `src/components/ui/` and use native Astro/CSS without
client-side hydration:

- `Button`: primary navy, secondary outline, text, and contact-style gold;
  small/medium/large; real button or anchor semantics; disabled and focus
  states. The contact style has no integration.
- `Card`: white, ivory, or dark surface; optional border and small/medium/large
  padding; no property listing content.
- `Badge`: neutral, success, warning, error, informational, and premium.
  Every badge retains readable text; color is not the sole signal.
- `Container`: standard, wide, or narrow responsive width and semantic wrapper.
- `SectionHeading`: levels 2–6, optional eyebrow/description, start or center.
- `FormField`: labeled text/select/textarea visual patterns, help and error
  associations, required and disabled states. It does not collect data.
- `Icon`: small inline SVG arrow/check, decorative by default and labelable
  when meaningful; directional arrow mirrors in RTL.

All controls have visible keyboard focus. Minimum touch target dimensions are
maintained for buttons and fields. Reduced-motion preferences are respected.
Validate form behavior and full keyboard/screen-reader experience again when
functional forms are separately authorized.

## Showcase, assets, and performance

Run `npm run dev`, then visit `/dev/design-system`. This local-only route
demonstrates colors, typography, spacing, component variants, states,
responsive containers, and Arabic RTL. It is server-rendered as HTTP 404 in
production; noindex is additional protection, not the access control.

The showcase uses fictional design specimens only. There are no property
listings, hotlinked photos, external runtime requests, tracking scripts,
icon libraries, client-side JavaScript, or hydration. Keep images local,
licensed, compressed, dimensioned to prevent layout shift, and supplied with
meaningful alternatives if later approved.

## Accessibility and limitations

The implementation targets WCAG 2.2 AA with semantic HTML, labels, text
status, keyboard focus, responsive rem sizing, RTL logical properties, and
reduced motion. Automated checks cover status codes, metadata, headers, design
tokens, selected contrast combinations, and component showcase availability.
They do not constitute a full accessibility audit.

Browser-based visual verification and viewport screenshots were not available
in the implementation environment. Therefore pixel-level rendering,
horizontal overflow at 320/375/768/1024/1440px, assistive-technology behavior,
and full keyboard navigation remain unverified. Lighthouse scores and field
Core Web Vitals are future targets, not results from this local work.
