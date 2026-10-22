<!-- generated from tokens.css by audit-design-system-consistency.mjs; do not edit -->

## Color

- **Primary:** `#9b5b32` — Token from style foundations.
- **Secondary:** `#8B5CF6` — Token from style foundations.
- **Success:** `#4f8a4f` — Token from style foundations.
- **Warning:** `#c9822f` — Token from style foundations.
- **Danger:** `#b33a3a` — Token from style foundations.
- **Surface:** `#fffdf8` — Token from style foundations.
- **Text:** `#201914` — Token from style foundations.
- **Neutral:** `#fffdf8` — Derived from the surface token for official format compatibility.

- Favor Primary (#9b5b32) for CTA emphasis.
- Use Surface (#fffdf8) for large backgrounds and cards.
- Keep body copy on Text (#201914) for legibility.

## Typography

- **Scale:** 12/14/17/20/28/42/64/88
- **Families:** primary=Playfair Display, display=Playfair Display, mono=JetBrains Mono
- **Weights:** 100, 200, 300, 400, 500, 600, 700, 800, 900
- Headings should carry the style personality; body text should optimize scanability and contrast.

## Spacing & Grid

- **Spacing scale:** 4/8/12/16/20/24/32/48
- Keep vertical rhythm consistent across sections and components.
- Align columns and modules to a predictable grid; avoid ad-hoc offsets.

## Components

- Buttons: primary action uses `#9b5b32`; secondary actions stay neutral.
- Inputs: strong focus-visible states, clear labels, and predictable error messaging.
- Cards/sections: use consistent radii, spacing, and elevation strategy across the page.

## Motion & Interaction

- Use subtle transitions that emphasize Primary (#9b5b32) as the interaction signal.
- Default to short, purposeful transitions (150–250ms) with stable easing.
- Ensure hover, focus-visible, active, disabled, and loading states are explicit.
