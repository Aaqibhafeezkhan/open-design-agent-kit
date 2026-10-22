<!-- generated from tokens.css by audit-design-system-consistency.mjs; do not edit -->

## Color

- **Primary:** `#ff6b00` — Token from style foundations.
- **Secondary:** `#F59E0B` — Token from style foundations.
- **Success:** `#2e9d57` — Token from style foundations.
- **Warning:** `#ffb020` — Token from style foundations.
- **Danger:** `#e5484d` — Token from style foundations.
- **Background:** `#fff8d7` — Token from style foundations.
- **Surface:** `#ffffff` — Token from style foundations.
- **Text:** `#1d1836` — Token from style foundations.
- **Neutral:** `#ffffff` — Derived from the surface token for official format compatibility.

- Favor Primary (#ff6b00) for CTA emphasis.
- Use Surface (#ffffff) for large backgrounds and cards.
- Keep body copy on Text (#1d1836) for legibility.

## Typography

- **Scale:** 12/14/16/18/24/36/54/76
- **Families:** primary=Limelight, display=Limelight, mono=JetBrains Mono
- **Weights:** 400
- Headings should carry the style personality; body text should optimize scanability and contrast.

## Spacing & Grid

- **Spacing scale:** 4/8/12/16/20/24/32/48
- Keep vertical rhythm consistent across sections and components.
- Align columns and modules to a predictable grid; avoid ad-hoc offsets.

## Components

- Buttons: primary action uses `#ff6b00`; secondary actions stay neutral.
- Inputs: strong focus-visible states, clear labels, and predictable error messaging.
- Cards/sections: use consistent radii, spacing, and elevation strategy across the page.

## Motion & Interaction

- Use subtle transitions that emphasize Primary (#ff6b00) as the interaction signal.
- Default to short, purposeful transitions (150–250ms) with stable easing.
- Ensure hover, focus-visible, active, disabled, and loading states are explicit.
