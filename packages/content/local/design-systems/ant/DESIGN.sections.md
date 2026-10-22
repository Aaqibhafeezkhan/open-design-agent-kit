<!-- generated from tokens.css by audit-design-system-consistency.mjs; do not edit -->

## Color

- **Primary:** `#d32029` — Token from style foundations.
- **Secondary:** `#8B5CF6` — Token from style foundations.
- **Success:** `#22a06b` — Token from style foundations.
- **Warning:** `#faad14` — Token from style foundations.
- **Danger:** `#cf1322` — Token from style foundations.
- **Surface:** `#f7f8fa` — Token from style foundations.
- **Text:** `#1f1f1f` — Token from style foundations.
- **Neutral:** `#f7f8fa` — Derived from the surface token for official format compatibility.

- Favor Primary (#d32029) for CTA emphasis.
- Use Surface (#f7f8fa) for large backgrounds and cards.
- Keep body copy on Text (#1f1f1f) for legibility.

## Typography

- **Scale:** 12/14/16/18/22/32/48/64
- **Families:** primary=Ant Sans, display=Ant Sans, mono=SF Mono
- **Weights:** 100, 200, 300, 400, 500, 600, 700, 800, 900
- Headings should carry the style personality; body text should optimize scanability and contrast.

## Spacing & Grid

- **Spacing scale:** 4/8/12/16/20/24/32/48
- Keep vertical rhythm consistent across sections and components.
- Align columns and modules to a predictable grid; avoid ad-hoc offsets.

## Components

- Buttons: primary action uses `#d32029`; secondary actions stay neutral.
- Inputs: strong focus-visible states, clear labels, and predictable error messaging.
- Cards/sections: use consistent radii, spacing, and elevation strategy across the page.

## Motion & Interaction

- Use subtle transitions that emphasize Primary (#d32029) as the interaction signal.
- Default to short, purposeful transitions (150–250ms) with stable easing.
- Ensure hover, focus-visible, active, disabled, and loading states are explicit.
