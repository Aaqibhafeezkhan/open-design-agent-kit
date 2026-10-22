<!-- generated from tokens.css by audit-design-system-consistency.mjs; do not edit -->

## Color

- **Primary:** `#4f46e5` — Token from style foundations.
- **Secondary:** `#111111` — Token from style foundations.
- **Success:** `#10b981` — Token from style foundations.
- **Warning:** `#f59e0b` — Token from style foundations.
- **Danger:** `#ef4444` — Token from style foundations.
- **Surface:** `#ffffff` — Token from style foundations.
- **Text:** `#111827` — Token from style foundations.
- **Neutral:** `#ffffff` — Derived from the surface token for official format compatibility.

- Favor Primary (#4f46e5) for CTA emphasis.
- Use Surface (#ffffff) for large backgrounds and cards.
- Keep body copy on Text (#111827) for legibility.

## Typography

- **Scale:** 12/14/16/18/24/36/54/76
- **Families:** primary=IBM Plex Serif, display=IBM Plex Serif, mono=JetBrains Mono
- **Weights:** 100, 200, 300, 400, 500, 600, 700, 800, 900
- Headings should carry the style personality; body text should optimize scanability and contrast.

## Spacing & Grid

- **Spacing scale:** 4/8/12/16/20/24/32/48
- Keep vertical rhythm consistent across sections and components.
- Align columns and modules to a predictable grid; avoid ad-hoc offsets.

## Components

- Buttons: primary action uses `#4f46e5`; secondary actions stay neutral.
- Inputs: strong focus-visible states, clear labels, and predictable error messaging.
- Cards/sections: use consistent radii, spacing, and elevation strategy across the page.

## Motion & Interaction

- Use subtle transitions that emphasize Primary (#4f46e5) as the interaction signal.
- Default to short, purposeful transitions (150–250ms) with stable easing.
- Ensure hover, focus-visible, active, disabled, and loading states are explicit.
