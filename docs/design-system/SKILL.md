---
name: sapphire2-design
description: Use this skill to generate well-branded interfaces and assets for Sapphire2, a poker session record & management tool, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping. Sapphire2 forks PC and mobile into different UIs sharing tokens — use this skill to keep both consistent.
user-invocable: true
---

# Sapphire2 design skill

You are designing for **Sapphire2** — a data‑dense, minimal, light/dark poker
session tracker. Two products in one shell: a desktop power‑user tool and a
mobile one‑hand tool. They share tokens, not components.

## Read this first

1. [`README.md`](README.md) — product context, content fundamentals, visual
   foundations, iconography. Read end to end before designing anything.
2. [`colors_and_type.css`](colors_and_type.css) — canonical tokens. These
   are the **only** colours/type values you should use. Names follow shadcn.
3. [`ui_kits/desktop/`](ui_kits/desktop/) — desktop primitives + screens.
4. [`ui_kits/mobile/`](ui_kits/mobile/) — mobile primitives + screens.
5. [`preview/`](preview/) — Design System tab specimens. Reference for what
   "correct" looks like at the smallest unit.

## Working rules

* **Tokens come from `colors_and_type.css`.** Don't invent new colours or
  hardcode hex; use `var(--primary)`, `var(--success)`, etc.
* **Noto Sans + Noto Sans Mono.** Sans for everything, mono for every number. Body
  is 13 on desktop, 14 on mobile. No display sizes.
* **PC ≠ mobile.** If you're building a phone view, use bottom nav + card
  lists + bottom sheets. If desktop, sidebar + tables + dialogs. Never mix.
* **Borders, not shadows**, for separation. Shadows are only for floating
  surfaces (popover, dropdown, dialog, toast).
* **Lucide icons only**, stroke 2. Custom glyphs live in `assets/glyphs/`
  for chip / cards / tournament / sapphire mark.
* **No emoji**, **no exclamation points**, **no gradients** in chrome,
  **no centred modals on mobile**, **no decorative imagery** in product views.
* **Sentence case** in all UI copy. "Add session," not "Add Session".

## Modes of work

### Visual artifact (slides, mocks, throwaway prototype)

1. Copy `colors_and_type.css` and the assets you need into your output.
2. Build static HTML referencing the tokens.
3. For high‑fidelity screens, pull primitives from the matching UI kit
   (desktop or mobile) rather than rebuilding.
4. Show light AND dark when relevant — the system is dual‑first.

### Production code

1. Use shadcn/ui primitives unmodified — they pick up the tokens.
2. Wire tokens into Tailwind v4 via `@theme inline` mapping in your
   `globals.css` (see the example at the top of `colors_and_type.css`).
3. For numeric values: wrap in a `.num` span or use the `Money` component
   pattern from `ui_kits/desktop/primitives.jsx`.

## When this skill is invoked without other guidance

Ask the user:

1. What surface are you designing? (which screen, or a new feature)
2. Desktop, mobile, or both?
3. Mock for review, or production code?
4. Any data shape constraints, or should I use sample poker data?

Then act as an expert designer — output either HTML artifacts (for mocks)
or production‑quality React/Tailwind code (for production work).
