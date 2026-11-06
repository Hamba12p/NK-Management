# NK Udada Staff Hub design system

## Phase 1 — audit inventory

Read-only audit of `src/app/globals.css`, the dashboard shell components, all dashboard pages, shared components, and page/component source under `src`. The findings below are representative locations for patterns found in the broader scan; they are not a claim that only those individual occurrences exist.

### High severity

- **Dark mode leaves fixed palette colors in place.** The dark selector changes surfaces and text but does not change `--purple`, `--purple-lt`, `--gold`, or `--rust`; existing Tailwind color utilities consequently retain light-theme values. This makes eyebrow/date copy, active navigation, settings tabs, and banners unreadable or visually discordant. [src/app/globals.css:7-25,87-98](../src/app/globals.css) [src/components/Sidebar.tsx:132,151](../src/components/Sidebar.tsx) [src/components/PageHeader.tsx:11-14](../src/components/PageHeader.tsx) [src/app/dashboard/settings/page.tsx:91,98](../src/app/dashboard/settings/page.tsx)
- **Sidebar role badge has the wrong contrast context.** The role class uses plum text on a translucent plum background while the sidebar itself is plum. [src/lib/utils.ts:15-19](../src/lib/utils.ts) [src/components/Sidebar.tsx:151](../src/components/Sidebar.tsx)
- **Important notification UI bypasses theme tokens.** The bell, popover, read/unread rows, saved banner, buttons, and focus colors use hard-coded light colors, including fixed white surfaces. [src/components/notifications/NotificationCenter.tsx:121-136](../src/components/notifications/NotificationCenter.tsx) [src/components/notifications/NotificationEnableBanner.tsx:118-130](../src/components/notifications/NotificationEnableBanner.tsx) [src/components/notifications/NotificationSettings.tsx:180-224](../src/components/notifications/NotificationSettings.tsx)
- **Text is being assigned the wrong palette names.** `--gold` is pink and `--green` is dark grey, so intent and contrast cannot be reasoned about from token names. [src/app/globals.css:11-16](../src/app/globals.css)
- **Some declared text colors fail WCAG AA in the light theme.** Pink `#ea519d` is only 3.12:1 on cream; it is not suitable for small copy. The previous color aliases also allow saturated or dark status colors to be used indiscriminately for small labels. [src/app/globals.css:11-16](../src/app/globals.css) [src/app/dashboard/announcements/page.tsx:275-276](../src/app/dashboard/announcements/page.tsx)

### Medium severity

- **Search has two competing borders and focus treatments.** Its wrapper draws a border while the global input rule draws another; the wrapper also has a separate focus color. [src/components/GlobalSearch.tsx:99-110](../src/components/GlobalSearch.tsx) [src/app/globals.css:207-230](../src/app/globals.css)
- **Focus rings are inconsistent and often hard-coded.** Examples include a direct hex in Settings, custom notification focus colors, `focus:ring-gold`, and `outline-none` on search/editor controls. [src/app/dashboard/settings/page.tsx:98,110](../src/app/dashboard/settings/page.tsx) [src/components/notifications/NotificationEnableBanner.tsx:129-130](../src/components/notifications/NotificationEnableBanner.tsx) [src/components/DocumentModal.tsx:203-222](../src/components/DocumentModal.tsx) [src/components/GlobalSearch.tsx:108](../src/components/GlobalSearch.tsx)
- **Generic borders are too faint to meet the 3:1 UI-boundary target.** The previous `#dccfd6` border on cream is 1.38:1. Cards, tables, form controls, and menus share this token. [src/app/globals.css:20,151-184,207-224](../src/app/globals.css)
- **Component geometry is not consistently tokenized.** Global cards use `.55rem`, primary buttons `.45rem`, and inputs `.4rem`, while pages mix Tailwind `rounded`, `rounded-md`, `rounded-lg`, and larger radii. Heading and label sizes likewise alternate between bespoke values and utility sizes. [src/app/globals.css:151-220](../src/app/globals.css) [src/components/PageHeader.tsx:11-16](../src/components/PageHeader.tsx)
- **A number of pages/components hard-code colors or use default Tailwind status ramps.** Notification UI is the clearest example; announcements also uses built-in `green-50`/`green-700`, and the consent flow contains literal cream/plum colors. [src/app/dashboard/announcements/page.tsx:275-276](../src/app/dashboard/announcements/page.tsx) [src/components/obx/LegalConsentStep.tsx:111-170](../src/components/obx/LegalConsentStep.tsx)
- **Status colors are inconsistent and sometimes semantically misleading.** Success uses the broken green token in some pages, rust elsewhere, and pink/gold is used for pins, pending indicators, and text interchangeably. [src/app/dashboard/page.tsx:74-99](../src/app/dashboard/page.tsx) [src/app/dashboard/announcements/page.tsx:218-276,316-341](../src/app/dashboard/announcements/page.tsx) [src/lib/utils.ts:15-19](../src/lib/utils.ts)

### Low severity / polish

- **Hover and disabled states rely on opacity rather than intentional states.** Sidebar, links, disabled buttons, and overlays use white/black with opacity; this makes resulting colors dependent on the underlying surface and harder to check in both themes. [src/components/Sidebar.tsx:108-161,201-221](../src/components/Sidebar.tsx) [src/components/Header.tsx:30](../src/components/Header.tsx) [src/components/notifications/NotificationSettings.tsx:197-224](../src/components/notifications/NotificationSettings.tsx)
- **The sidebar collapse button uses the dark sidebar fill but a low-contrast fixed outline/text relationship in dark mode.** Its chevron lacks a reliable theme-aware foreground. [src/components/Sidebar.tsx:221-226](../src/components/Sidebar.tsx)
- **Mobile layout has separate interaction styling from desktop.** The menu trigger and dismiss overlay use fixed white/black opacity colors, while the topbar reserves mobile space with a padding utility and hides search. The panel is scrollable, but its colors and focus treatment do not follow the theme. [src/components/Sidebar.tsx:199-215](../src/components/Sidebar.tsx) [src/components/DashboardTopbar.tsx:10-18](../src/components/DashboardTopbar.tsx)
- **Empty states and tables use shared surfaces but inherit assorted local spacing and rounded classes.** Shared empty illustration is token-colored, while page-specific empty copy, table heading, and card treatments vary. [src/components/EmptyState.tsx:12-13](../src/components/EmptyState.tsx) [src/app/globals.css:151-185](../src/app/globals.css)

The scan found 250 legacy palette utility occurrences in 39 component/page files and 350 occurrences of white/black literals, opacity, or inline-color patterns in 44 component/page files. The focused scan also found raw hex values in shared components, notifications, and the consent experience. Intentional animation opacity, image treatments, and data visualization are not automatically color defects; they still need to use theme-safe styling where they render interface content.

## Phase 2 — design decisions

### Palette and ramps

Keep the warm editorial identity: cream, plum, and pink remain the core; **teal** and **apricot** are the only new hues. Teal `#2f6f73` is muted enough to sit beside plum and the existing pink, and it gives success/data a cool counterpoint without adding a competing saturated color. Apricot `#e0a458` is sandy and warm, close to the cream family; it is reserved for pending/warning markers and small illustration details. The existing rust hue remains for danger. The intended visual weight is roughly 60% surfaces, 30% plum structure/actions, and 10% combined status accents—not a literal per-screen pixel count.

The ramps are generated by tinting each 500 color with white and shading it with black. Use the 50–300 tints for quiet fills, 400–600 for boundaries and accents, and 700–900 for accessible text on light surfaces.

| Step | Plum | Pink | Teal | Apricot | Rust |
|---:|---|---|---|---|---|
| 50 | `#f8f4f6` | `#fef6fa` | `#f5f8f8` | `#fdfaf7` | `#fbf6f4` |
| 100 | `#f2e9ee` | `#fdeef5` | `#eaf1f1` | `#fcf6ee` | `#f8ede8` |
| 200 | `#ddc9d4` | `#fad4e6` | `#cbdbdc` | `#f7e8d5` | `#edd2c6` |
| 300 | `#c9a8ba` | `#f7b9d8` | `#acc5c7` | `#f3dbbc` | `#e3b7a3` |
| 400 | `#a06787` | `#f085ba` | `#6d9a9d` | `#e9bf8a` | `#cd825f` |
| 500 | `#782653` | `#ea519d` | `#2f6f73` | `#e0a458` | `#b84c1a` |
| 600 | `#662047` | `#c74585` | `#285e62` | `#be8b4b` | `#9c4116` |
| 700 | `#541b3a` | `#a4396e` | `#214e50` | `#9d733e` | `#813512` |
| 800 | `#42152e` | `#812d56` | `#1a3d3f` | `#7b5a30` | `#652a0e` |
| 900 | `#300f21` | `#5e203f` | `#132c2e` | `#5a4223` | `#4a1e0a` |

`#ea519d` is 3.12:1 on cream: reserve it for large text, icons, fills, and markers. Use the readable pink shade `#a4396e` (5.67:1 on cream), plum/teal/rust ramp shades, or apricot text `#8a5a12` for small text. In dark mode, accent variants are `#d17ba8` (plum), `#f06fae` (pink), `#5fb3b3` (teal), and `#e3b05a` (apricot); rust uses `#ffab84`.

### Semantic tokens and theme

Components consume semantic `surface`, `surface-raised`, `border`, `text`, `text-muted`, `accent`, `accent-text`, `success`, `warning`, `danger`, and `focus-ring` tokens. Palette variables remain underneath. `--gold` remains a deprecated alias of pink, and `--green` a deprecated alias of teal; `--purple` remains a deprecated alias of plum. New code should use semantic variables or the explicit palette ramp.

| Semantic | Light | Dark |
|---|---|---|
| Page background | `#f8f4f1` | `#141315` |
| Surface | `#f8f4f1` | `#1d1b1e` |
| Raised surface | `#fffaf7` | `#262428` |
| Border | `#8a7f86` | `#807a83` |
| Text | `#392f35` | `#ece8ea` |
| Muted text | `#6e646a` | `#a9a2a6` |
| Accent | `#782653` | `#d17ba8` |
| Accent text | `#ffffff` | `#241820` |
| Success | `#2f6f73` | `#5fb3b3` |
| Warning | `#8a5a12` | `#e3b05a` |
| Danger | `#813512` | `#ffab84` |
| Focus ring | `#782653` | `#f06fae` |

Dark mode uses a neutral warm-grey monochrome for the shell. The sidebar also becomes raised warm-grey, with a plum/pink active marker rather than remaining a large plum block; this keeps the requested monochrome foundation and prevents old plum labels from disappearing against a dark plum rail. The light sidebar retains its plum identity.

Raw palette ramps stay fixed between themes. Deprecated hue aliases now resolve through semantic tokens in both themes: `--purple` follows plum, `--gold` follows pink, `--green` follows success/teal, and `--rust` follows danger. Surface compatibility aliases (`--cream`, `--warm`, `--muted`, `--background`, and `--foreground`) also follow their semantic variables. All surface, border, text, focus, sidebar, switch, and legacy hue aliases are deliberately overridden for dark mode.

### Contrast checks

Ratios use the WCAG relative-luminance formula and are rounded to two decimals. Body copy targets 4.5:1; large text and meaningful UI boundaries target 3:1.

| Foreground / boundary | Background | Ratio | Result |
|---|---|---:|---|
| Light text `#392f35` | Cream `#f8f4f1` | 11.77:1 | Pass |
| Light muted `#6e646a` | Cream `#f8f4f1` | 5.20:1 | Pass |
| Plum `#782653` | Cream `#f8f4f1` | 8.73:1 | Pass |
| Pink `#ea519d` | Cream `#f8f4f1` | 3.12:1 | Large/UI only |
| Pink text `#a4396e` | Cream `#f8f4f1` | 5.67:1 | Pass |
| Teal `#2f6f73` | Cream `#f8f4f1` | 5.27:1 | Pass |
| Apricot text `#8a5a12` | Cream `#f8f4f1` | 5.41:1 | Pass |
| Semantic danger `#813512` | Cream `#f8f4f1` | 7.83:1 | Pass |
| White button text `#ffffff` | Plum button `#782653` | 9.54:1 | Pass |
| Light border `#8a7f86` | Cream `#f8f4f1` | 3.52:1 | Pass |
| Light border `#8a7f86` | Raised `#fffaf7` | 3.71:1 | Pass |
| Light border `#8a7f86` | Muted surface `#efe3e7` | 3.08:1 | Pass |
| Light sidebar border `#c9a8ba` | Plum `#782653` | 4.45:1 | Pass |
| Dark text `#ece8ea` | Page `#141315` | 15.26:1 | Pass |
| Dark text `#ece8ea` | Raised `#262428` | 12.67:1 | Pass |
| Dark muted `#a9a2a6` | Raised `#262428` | 6.16:1 | Pass |
| Dark muted `#a9a2a6` | Surface `#1d1b1e` | 6.85:1 | Pass |
| Dark plum `#d17ba8` | Page `#141315` | 6.27:1 | Pass |
| Dark pink `#f06fae` | Page `#141315` | 6.69:1 | Pass |
| Dark teal `#5fb3b3` | Page `#141315` | 7.57:1 | Pass |
| Dark apricot `#e3b05a` | Page `#141315` | 9.37:1 | Pass |
| Dark button text `#241820` | Plum button `#d17ba8` | 5.80:1 | Pass |
| Dark button text `#241820` | Pink button `#f06fae` | 6.19:1 | Pass |
| Dark active text `#f06fae` | Active surface `#353236` | 4.57:1 | Pass |
| Dark border `#807a83` | Raised/sidebar `#262428` | 3.68:1 | Pass |
| Dark border `#807a83` | Muted surface `#302d32` | 3.25:1 | Pass |

The border values are intentionally stronger than the original suggested dark border: the proposed `#353236` is only 1.22:1 against the raised surface and cannot meet the stated 3:1 boundary target. The original light border similarly measured 1.38:1. Sidebar borders use their own light/dark token so they remain visible against the plum rail and grey rail respectively.

## Implementation and review notes

- Apply semantic theme tokens in shared CSS and Tailwind first, then migrate shared UI, page-level colors, state styles, and focus rings.
- Standardize controls to a 2px semantic focus outline, a 1px token border, and shared radius tokens: 6px small, 8px controls, 12px cards, and pill-shaped badges. Layout spacing uses Tailwind's existing 4px spacing scale; shared headers use a consistent 32px section break and cards use 24px padding, while responsive grid gaps retain the nearest scale step. Keep display headings in Playfair Display, body in DM Sans, and tags in DM Mono.
- Use opacity only for intentional decorative/hover overlays and semantic token tints; disabled controls use explicit muted surface/text tokens rather than opacity. `border-subtle` is reserved for decorative separators, while meaningful control and card boundaries use the stronger `border` token.
- No routes, copy, feature behavior, or data logic are intended to change.

### Deliberate exceptions

- The standalone volunteer badge SVG in `src/app/obx/badge/page.tsx` keeps its own fixed brand palette so downloaded certificates do not change appearance with the Hub theme.
- `src/app/layout.tsx` and `src/app/manifest.ts` retain static browser/PWA theme metadata. These platform metadata values cannot follow the client-side theme attribute; the light cream/plum branding remains the conservative default.
- Progress indicators retain inline `width` values because those are data-driven geometry, not color styling; their track and fill colors use semantic tokens.
- Raster brand artwork and its baked-in colors are not recolored by the UI theme.

### Cumulative review

The final source-level review covers Home, Documents, Announcements, Workspace, all four Settings tabs, Onboarding, Meetings, Team, Volunteers, Classes, Learners, expanded/collapsed sidebar states, and mobile sidebar/topbar treatment in both themes. Shared focus, form, table, notification, banner, badge, empty-state, and disabled-state styling was checked alongside those routes. The local browser rendered the login screen in both palette modes and at mobile width; the protected `/dashboard` route redirected to `/login` because no authenticated session was available, so authenticated page states could not be visually exercised. The theme does not alter routes, content, or data behavior.
