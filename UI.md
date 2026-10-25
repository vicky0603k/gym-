# UI — How to design screens for this product

**For any AI agent (Claude Code, Kiro) or developer touching a screen.** Read after `DESIGN.md` and `REAL_WORLD_STANDARD.md`.

`DESIGN.md` says *what* the screens contain. `REAL_WORLD_STANDARD.md` sets the quality bar. This file says *how* to design them and *which tools* to use, so the result looks like a product a designer made for one Indian gym, not a generated template.

**Precedence:** `PRD.md` > `DESIGN.md` > `REAL_WORLD_STANDARD.md` > this file. If this file suggests something that changes `DESIGN.md` (palette, fonts, layout), propose it, get the human's approval, then update `DESIGN.md` and add an ADR to `docs/decisions.md`. Never change the design system silently in a component.

**Applied 25 October 2026:** §3 (the light "Iron & Volt" theme) is now the design system in `DESIGN.md` §2 (ADR-012).

---

## 1. What "designed, not generated" means here

Generated UI comes from defaults nobody chose: the first font, the first colour, the same card grid on every page. Designed UI comes from decisions that trace back to the subject. Before designing anything, hold the subject in your head:

- **The place:** a neighbourhood gym in India. Rubber floor, iron plates, a front desk with a paper register, a WhatsApp group, a UPI QR stuck on the counter.
- **The member:** 18–40, mid-range Android, 4G, one hand, bright gym light, sweaty thumb. Opens the app for 5 seconds to check in.
- **The owner:** phone-first, not technical, checks the dashboard between sessions. Wants to know who to call today and how much money is due.
- **The domain's own artifacts:** the membership card, the counter receipt, the attendance register, the plate colours, the gate. These are better sources for visual ideas than any style menu.

The test, from `REAL_WORLD_STANDARD.md`: *would the owner feel proud showing this screen to his members, and would a member trust it with their money?*

### Signature ideas
Spend the boldness in one place. These come from the subject. The approved direction uses the first two — see §3.3.
- **Member home as a real membership card:** gym name and logo, member name, plan, "Valid till 14 Feb 2027" set large. The thing members already carry, made digital.
- **Weekly goal as plates loading on a bar:** each visit adds a plate; the week's target is a full bar. Replaces the generic progress ring with something only a gym app would have.
- **Receipt that looks like a counter receipt:** tear edge, receipt number, forwardable on WhatsApp (`REAL_WORLD_STANDARD.md` §7).

---

## 2. Audit of 25 October 2026 (before the Iron & Volt theme)

Run with the `avoid-ai-design` scanner over `src/` (157 files) plus a manual pass over `tailwind.config.ts`, `globals.css` and `layout.tsx`. Result: **0 P0, 6 P1, 5 P2** from the scanner; the most important items were found by hand.

| # | Finding | Where | Priority | What to do |
|---|---|---|---|---|
| 1 | **Font declared but never loaded.** `Inter` is named in `fontFamily.sans` but nothing loads it, so every screen renders in the phone's system font (catalog T7 + T1). | `tailwind.config.ts`, `src/app/layout.tsx` | High | Load Archivo with `next/font` (built into Next.js, no new dependency) — see §3.2. |
| 2 | **Pinch-zoom disabled.** `maximumScale: 1, userScalable: false` blocks zoom for low-vision users (WCAG 1.4.4). | `src/app/layout.tsx` viewport | High | Remove both. Inputs are already 16px, so iOS will not auto-zoom. |
| 3 | **Palette sits in a known generated cluster:** tinted near-black `#0B0F0C` + one acid-lime accent `#B5FF47` (catalog SD2). | `tailwind.config.ts` | High | **Decided:** the owner chose the light *Iron & Volt* direction. Implement §3. |
| 4 | Emoji used as an icon (`📱`). | `src/components/install-prompt.tsx` L26, L53 | Medium | Lucide icon or a small drawn illustration of the install steps. `REAL_WORLD_STANDARD.md` §1 bans emoji as UI icons. |
| 5 | Loading skeletons are generic grey lines, not shaped like the content. | `src/components/states.tsx` `LoadingSkeleton` | Medium | Per-screen skeletons that match the real layout (`REAL_WORLD_STANDARD.md` §5). |
| 6 | Landing page uses a letter-mark logo and a gradient panel with a dumbbell icon and slogan. | `src/app/(public)/page.tsx` | Medium | Replace with the gym's real logo and photos (`docs/assets.md`, `GAPS.md` §B). |
| 7 | Global `min-h-[48px]` on every `a` and `button` also inflates inline text links. | `src/app/globals.css` base layer | Low | Scope the rule to interactive controls (`.btn-*`, nav, list actions), keep 48px there. |
| 8 | Middle-dot metadata strings (`A · B · C`) in rows (SD4d). | Red List row, member sections, add-ons, landing | Judgment | Acceptable in dense owner rows where it saves space. On member screens and the landing page, prefer labelled lines. |
| 9 | Headline counts flagged as an accented word (SD5). | `owner/add-ons/page.tsx` L35, `owner/renewals/page.tsx` L33 | False positive | It is a count, not decoration. Keep; add `avoid-ai-design-ignore: SD5`. |
| 10 | `→` flagged in a doc comment. | `src/utils/money.ts` L15 | False positive | No change. |

Already good, keep it: all text passes WCAG AA; 48px tap targets; reduced-motion respected on the goal ring; four UI states exist on every list; ₹ and dates in Indian format.

---

## 3. The chosen direction — "Iron & Volt" (light)

**Approved by the owner on 25 October 2026**, from three mockups (Plate Blue, Sand & Sport Orange, Iron & Volt). It replaces the dark theme in `DESIGN.md` §2. Polishing screens one by one without a locked direction causes design drift between pages, so implement this as one theme module before any other screen work.

**The idea:** white and black like a sportswear brand, with one neon-yellow "volt" highlight and tall, condensed numbers. Light, high-contrast, readable in bright gym light.

### 3.1 Colour tokens
| Token | Value | Role |
|---|---|---|
| `background` | `#FFFFFF` | Page ground |
| `surface` | `#F3F3EF` | Cards, bottom nav, sidebar |
| `surface-2` | `#E8E8E2` | Chips, skeletons, hover, empty plate slots |
| `border` | `#E2E2DC` | Dividers, card outlines |
| `border-strong` | `#7A7A72` | Input outlines (4.3:1 on white — meets the 3:1 rule for form controls) |
| `foreground` | `#0E0E0E` | Text, icons, black buttons, the membership card |
| `muted` | `#5E5E58` | Secondary text (6.5:1 on white, 5.9:1 on surface) |
| `accent` | `#C6F432` | Volt. **Fill only** — primary button, active nav pill, goal met, Active/Paid badges, the date on the black membership card |
| `accent-foreground` | `#0E0E0E` | Text on volt (15:1) |
| `accent-muted` | `#B4E11F` | Volt hover/pressed |
| `success` | `#2E7D0F` | Success text and icons (5.2:1 on white) |
| `warning` | `#B45309` | Warnings only — due soon, pending, paused (5.0:1) |
| `danger` | `#C62828` | Risk only — Red List, expired, failed payment (5.6:1) |

**The one rule that matters:** volt on white is **1.3:1** — unreadable. Volt is never used for text, icons, focus rings or thin strokes on a light surface. It is used as a fill with black text on top, or as text on the black (`foreground`) surface, where it is 15:1.

### 3.2 Type
- **Archivo** (variable, with a width axis), loaded with `next/font/google`: `subsets: ["latin", "latin-ext"]` (`latin-ext` carries the ₹ sign) and `axes: ["wdth"]`, exposed as `--font-archivo` and used for `fontFamily.sans`. Remove the unloaded `Inter`.
- Checked on 25 Oct 2026 against 36 Google Fonts: Archivo includes **₹ (U+20B9)** and **tabular figures**. (Poppins, Outfit, Urbanist, Barlow, Onest, Red Hat Display and others fail one of the two — do not swap to them.)
- **Body and UI:** Archivo at normal width, 400/500/600/700. Member body text ≥ 16px; no functional text below 12px.
- **Display figures** (expiry date, "3 of 4" visits, KPIs, prices): Archivo condensed — `font-stretch: 72%`, weight 800–900, `tabular-nums`, tight tracking. Implement as the `.kpi-number` and a new `.num-display` class in `globals.css`; never hand-roll these styles per screen.
- Uppercase is allowed only on the big condensed hero figures (e.g. `14 FEB 2027` on the membership card). Everything else stays sentence case.

### 3.3 Signature details (from the approved mockup)
- **Member home membership card:** black (`foreground`) card, gym name and plan at the top, "Valid till" label, the expiry date large in condensed volt, days left below. Status text on the black card uses `background` at 70% opacity; an urgent "days left" turns into a small `warning` pill with white text (do not put `warning` text directly on black — it fails contrast).
- **Weekly goal as plates:** the week's target shown as segments that fill black as visits come in (the mockup's "plates on a bar"). The existing ring in `weekly-goal-card.tsx` may stay for the first pass if it is restyled to a black stroke on a `surface-2` track.
- **Primary action in volt:** "Scan to check in" and other primary buttons are volt with black text. Secondary actions are black or outlined.
- **Active navigation:** the active icon sits on a black tile in the bottom nav, as in the approved mockup C (`group-aria-[current=page]:bg-foreground`); volt row in the owner desktop sidebar.
- **Components:** primitives live in `src/components/ui/` (cva + tailwind-merge, shadcn pattern): `Button`/`ButtonLink`, `Card`, `Badge`, `Page`/`PageHeader`/`Section`, `List`/`ListRow`, `Avatar`, `Stat`, `Chips`, `VisitSegments`. New screens use these instead of hand-written class strings.

### 3.4 Implementation checklist (one module, in this order)
1. Update `DESIGN.md` §2 to these tokens and add **ADR-012 — Light "Iron & Volt" theme replaces the dark theme** to `docs/decisions.md` (why: the owner chose it; the dark lime look read as a generic template; light reads better in bright gyms).
2. `tailwind.config.ts`: the tokens in §3.1, `border-strong`, remove `darkMode: "class"`, `fontFamily.sans` → `var(--font-archivo)`.
3. `src/app/layout.tsx`: load Archivo as above; drop `className="dark"`; `themeColor` `#FFFFFF`; **remove `maximumScale: 1` and `userScalable: false`** (audit item 2); `Toaster theme="light"`.
4. `src/app/globals.css`: `color-scheme: light`; `.input` → white ground, `border-strong` outline, focus ring in `foreground`; `.kpi-number` and `.num-display` as in §3.2.
5. `src/app/manifest.ts`: `background_color` and `theme_color` `#FFFFFF`. Checkboxes in `addon-form.tsx` and `plan-form.tsx`: `accent-[#B5FF47]` → `accent-foreground`.
6. **Sweep every `text-accent` (36 places in 25 Oct 2026 code — `grep -rnE "text-accent($|[^-])" src`)** and replace by meaning:
   - icons and headings → `text-foreground`
   - links → `text-foreground underline underline-offset-4`
   - success states (check-in success, payment confirmed, "goal met", savings line, "welcome back") → `text-success`
   - selected filter chips (Members, Red List) → `border-foreground bg-foreground text-background`
   - Active / Paid / Returned badges (`status-badge.tsx`, member `sections.tsx`) → `bg-accent text-accent-foreground`
   - `nav-link.tsx` active → `text-foreground`, with the volt pill from §3.3
   - only keep `text-accent` where the element sits on a black surface
7. Also replace `stroke-accent`, `border-accent`, `ring-accent` and `bg-accent/10` on light surfaces using the same rule (volt is a fill, not a line or tint).
8. Landing page placeholder panel (`(public)/page.tsx`): replace the lime gradient with a black panel, volt icon, white text — until real photos arrive (`GAPS.md` §B).
9. Gate QR screen and camera view: stay as they are structurally; check that every text and icon on them is readable on the new colours.
10. Verify per §7 and §9: build, tests, scanner, screenshots at 375px of every reachable screen in all four states.

Later, once the gym's logo arrives (`docs/assets.md`), the volt accent may be swapped for the gym's own brand colour **through the tokens only** — re-check every contrast figure in §3.1 when that happens.

---

## 4. Libraries

`TECH_STACK.md` is binding. No library is swapped or added without an ADR. Prefer what is installed.

### Use (already installed)
| Library | Use it for | Rules |
|---|---|---|
| **Tailwind CSS 3.4** | All styling, through tokens in `tailwind.config.ts` | No hex values or arbitrary colours in components. If a token is missing, add it to the config and `DESIGN.md`. Do not upgrade to Tailwind 4 without an ADR. |
| **shadcn/ui pattern** (copied into the repo) | Buttons, inputs, dialogs, tabs, selects | Never ship the untouched shadcn base theme. Every primitive is restyled to this product's tokens. |
| **Radix UI** (`dialog`, `tabs`, `select`, `label`, `slot`) | Accessible behaviour: focus trap, keyboard, ARIA | Bottom sheets on mobile = Radix Dialog positioned at the bottom. |
| **class-variance-authority + clsx + tailwind-merge** (`src/utils/cn.ts`) | Component variants (`size`, `tone`, `state`) | One variant definition per primitive; no copy-pasted class strings. |
| **lucide-react** | All icons | One icon set only. Pick icons for meaning, at one stroke width. Avoid the worn decorative set (Sparkles, Zap, Rocket, Shield) unless they literally mean the thing. |
| **sonner** | Toasts | Restyle to the theme; success toasts state the fact ("Payment verified. Membership extended till 14 Feb 2027"). |
| **react-hook-form + zod** | Forms | Inline errors in the field, plain language. |
| **qrcode / html5-qrcode** | Gate QR, scanner | Style the frame and countdown, not the libraries. |
| **next/font** (part of Next.js) | Loading the chosen face | Self-hosted, no layout shift, no extra dependency. |

### Allowed only with an ADR (when CSS and Radix cannot do it)
| Library | Only if |
|---|---|
| `vaul` | Drag-to-dismiss bottom sheets become a real requirement. |
| `motion` (Framer Motion) | A specific interaction cannot be done with CSS transitions/keyframes. Mind the bundle on low-end phones. |
| A chart library | The dashboard needs a real chart. `DESIGN.md` §1 says owner screens favour action lists over charts; start with hand-built SVG via the `dataviz` skill. |

### Do not use
MUI, Chakra, Mantine, Bootstrap, DaisyUI (a second design system); Aceternity / Magic UI copy-paste effects; GSAP scroll pinning or scroll-jacking; Lottie for decoration; glassmorphism, gradient headline text, coloured glow shadows; a second icon set; hotlinked stock images.

---

## 5. Skills (Claude Code)

These are installed for Claude Code on the original author's machine. Invoke them with the Skill tool by exact name where available. Kiro does not have them; see §7.

### Process — use on every UI task
| Skill | When |
|---|---|
| `superpowers:brainstorming` | Before any new screen, redesign, or the direction pass. Settle the intent with the human first. |
| `superpowers:writing-plans` | Multi-screen work: write the plan before touching code. |
| `superpowers:verification-before-completion` | Before saying a screen is done: screenshots and checks in hand, not assumed. |
| `superpowers:requesting-code-review` | After a screen or module of UI work. |

### Design — the core toolkit
| Skill | Use it for | Do not use it for |
|---|---|---|
| `impeccable:impeccable` | The main design engine: critique, audit, polish, typography, colour, spacing, motion, empty states, responsive (`adapt`), hardening edge cases, UX copy. Its `impeccable-finish-reviewer` agent reviews a finished screen against the direction. | Inventing a new direction per screen. Feed it the locked `DESIGN.md`. |
| `avoid-ai-design` | Scan before and after every UI change: `node C:/Users/Admin/.claude/skills/avoid-ai-design/scripts/detect.mjs src`. Use `detect` mode for audits. | Treating a clean scan as "done" — it only catches code-certain clichés. |
| `taste-skill:redesign-existing-projects` | Upgrading an existing screen without breaking its behaviour. | Ground-up rewrites of working flows. |
| `design-taste-frontend` | The public landing page only (a marketing surface). | App screens — member and owner screens are product UI, not marketing. |
| `ui-ux-pro-max:ui-ux-pro-max` | Lookup data: UX guidelines, font pairings, chart types, accessibility rules. | Picking a style from its menu. Use it as a reference, not a direction. |
| `ui-ux-pro-max:ui-styling` | shadcn/Radix/Tailwind component craft and accessibility details. | — |
| `design-md` | Keeping `DESIGN.md` tokens in a consistent format after the direction pass. | — |
| `dataviz` | Any KPI tile, sparkline, progress meter or chart on the dashboard. | — |
| `anthropic-skills:ux-writing` + `stop-slop` | Button labels, empty states, errors, toasts, WhatsApp templates. Plain, specific, no hype. | Changing what the product promises (no medical or transformation claims, `PRD.md`). |
| `anthropic-skills:webapp-testing` | Driving the app with Playwright to screenshot states and catch console errors. | — |
| `ui-ux-pro-max:banner-design` / Canva | Marketing assets outside the app: the gate standee, social posts, the Open Graph image. | App UI. |

### Skip for this product
`taste-skill:gpt-taste` (heavy GSAP scroll motion — wrong for low-end phones and app UI); the style-preset skills (`brutalist-skill`, `minimalist-skill`, `soft-skill`, `stitch-skill`) as a source of direction — a preset is a menu choice, not a decision from the subject; `awesome-design-md` brand systems copied wholesale (the product must look like the gym's own brand, never like Stripe or Linear).

---

## 6. MCP servers

| Server | Use it for |
|---|---|
| **Playwright** (`mcp__playwright__*`) | The main verification tool. `browser_resize` to **375×812** (and 1280×800 for owner screens), `browser_navigate`, `browser_take_screenshot` of every state, `browser_snapshot` for the accessibility tree, `browser_console_messages` for errors, `browser_emulate_media` for `prefers-reduced-motion`. |
| **REA** (`capture_web_screenshot`, `compare_web_screenshots`) | Before/after comparison of a screen, so a redesign can be shown side by side. |
| **VS Code diagnostics** (`mcp__claude-vscode__getDiagnostics`) | Type and lint errors in the files you touched. |
| **Figma** | Only if the human connects it (it currently needs authorisation). Then designs in Figma become the source of truth for those screens. |
| **Canva** | Marketing assets only (standee, posters, OG image). Never app screens. |

Screens behind login need `npm run dev` against a **test** Supabase project loaded with `seed.sql`. Never point screenshot sessions at production or real member data.

---

## 7. Workflow for every screen

1. **Brainstorm** the change (`superpowers:brainstorming`). State which screen, which states, what changes.
2. **Read** `DESIGN.md` (the contract), the screen's section in `DESIGN.md` §4, and the nearby components.
3. **Baseline:** run the scanner on the files in scope; take Playwright screenshots at 375px of all four states (loading, empty, error, success) plus a long list (200 rows).
4. **Critique** with `impeccable:impeccable` against the locked direction and the checklist in §8.
5. **Plan** the change in a few lines. If it needs a new token, add it to `DESIGN.md` first.
6. **Implement** surgically: keep props, data flow, server actions, validation and accessibility intact. Components stay under ~200 lines (`AGENTS.md`).
7. **Re-scan** — no P0, no unapproved SD tell.
8. **Re-render** — screenshots of all four states at 375px (and 1280px for owner screens); compare before/after.
9. **Finish review** — `impeccable-finish-reviewer` agent or a manual pass against §8.
10. **Verify and report** (`superpowers:verification-before-completion`): `npm run build`, tests, scanner result, screenshots, anything uncertain.

**For Kiro (no skills):** follow the same steps by hand — run the scanner with `node`, take screenshots with Playwright (`npm run test:e2e`, or a browser at 375px), and check §8 line by line.

---

## 8. Craft rules for this app

**Hierarchy**
- One job per screen, visible in 3 seconds. The member home's job is "am I valid, and how is my week". The owner dashboard's job is "who do I call, what money is due".
- The most important number is the largest thing on the screen. Supporting text is smaller and muted, never the same size.
- Not everything is a card. Use cards for things that are objects (a plan, an add-on, a membership); use plain rows with dividers for lists (members, attendance, payments).

**Type**
- One family (two at most), three or four sizes, two or three weights. A clear scale, not 12 sizes.
- Member body text ≥ 16px. Numbers always `tabular-nums`. Amounts with ₹ and `en-IN` grouping via `formatRupees`.
- Sentence case everywhere. No all-caps eyebrow labels above headings.

**Colour**
- Colour carries meaning: accent = primary action and success, red = risk only, amber = warning only. Never decorate with red.
- One dominant ground, one accent, neutrals. No gradients on text; no coloured glow shadows.

**Spacing and shape**
- A 4px base scale with a rhythm: tight inside groups, generous between sections. Flat equal spacing everywhere reads as generated.
- One radius scale (`sm`/`md`/`lg` already in the config), applied consistently. Not `rounded-2xl shadow-lg` on every surface.

**Motion**
- Animate `transform` and `opacity` only (cheap on low-end phones). 120–200ms for UI feedback, up to 700ms for the goal fill. Ease-out, no bounce.
- Motion explains something: the check-in success, the goal filling, a sheet sliding up. No fade-up on every element.
- Always respect `prefers-reduced-motion`.

**Layout and touch**
- Design at 375px first. Primary member actions sit in the thumb zone (bottom). Bottom nav for members, section nav for owners.
- 48px minimum targets for controls; icon-only buttons have a visible text label (`DESIGN.md` §8).
- Owner desktop view uses the extra width for density (tables, side-by-side lists), not for bigger cards.

**States**
- Skeletons shaped like the real content. Empty states that say what happens next and offer the next action. Errors in plain language with Retry. Success states that state the facts.

**Copy**
- Specific over generic: "Checked in at 7:42 AM — 3 of 4 visits this week", not "Success!".
- No hype, no "Elevate your fitness journey", no fake urgency, no medical or transformation claims. Hinglish only where `DESIGN.md` §2 allows it.

**Accessibility (never cut)**
- Contrast ≥ 4.5:1 for body text, visible `:focus-visible` rings, labels on every input, zoom allowed, screen-reader names on icon buttons.

---

## 9. Definition of done for UI work

On top of `AGENTS.md` and `REAL_WORLD_STANDARD.md` §9:

- [ ] Screen follows the tokens in `DESIGN.md`; no hex values or one-off styles in components
- [ ] Scanner: 0 P0, no SD tell that `DESIGN.md` did not approve (approved ones carry an ignore comment)
- [ ] Screenshots at 375px of loading, empty, error and success (owner screens also at 1280px), included in the report
- [ ] Tested with 0 rows and 200 rows
- [ ] Keyboard focus visible, zoom works, reduced motion respected, no console errors
- [ ] Shared first-load JS (88.6 kB on 25 Oct 2026) has not grown by more than ~10 kB without a stated reason
- [ ] Copy reviewed with `ux-writing` / `stop-slop`: no placeholders, no hype, Indian formats

---

## 10. Prompt template for a UI task

Paste this when asking an agent to work on a screen:

```
Work on the UI of [screen / route] only. Read AGENTS.md, DESIGN.md,
REAL_WORLD_STANDARD.md and UI.md first.

1. Use superpowers:brainstorming to confirm the intent with me.
2. Baseline: run the avoid-ai-design scanner on the files in scope and take
   Playwright screenshots at 375px of loading, empty, error and success.
3. Critique with impeccable against DESIGN.md and UI.md §8. Show me the
   plan before editing. Do not change the design system or add a library
   without asking.
4. Implement surgically. Keep all behaviour, validation and accessibility.
5. Re-scan, re-screenshot, run npm run build and tests.
6. Report: files changed, before/after screenshots, scanner result,
   anything uncertain. Then stop.
```
