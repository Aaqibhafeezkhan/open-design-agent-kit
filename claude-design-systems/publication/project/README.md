> Print-inspired visual language for books, magazines, and reports with editorial grids and expressive typography.

## 1. Visual Theme & Atmosphere

Print-inspired visual language for books, magazines, and reports with editorial grids and expressive typography.

- **Visual style:** modern, editorial
- **Color stance:** primary, neutral, success, warning, danger
- **Design intent:** Keep outputs recognizable to this style family while preserving usability and readability.

## 2. Color

- **Primary:** `#c1121f` — Token from style foundations.
- **Secondary:** `#0A1829` — Token from style foundations.
- **Success:** `#0f8a3b` — Token from style foundations.
- **Warning:** `#d99a00` — Token from style foundations.
- **Danger:** `#b00020` — Token from style foundations.
- **Surface:** `#f6f6f6` — Token from style foundations.
- **Text:** `#0b0b0b` — Token from style foundations.
- **Neutral:** `#f6f6f6` — Derived from the surface token for official format compatibility.

- Favor Primary (#c1121f) for CTA emphasis.
- Use Surface (#f6f6f6) for large backgrounds and cards.
- Keep body copy on Text (#0b0b0b) for legibility.

## 3. Typography

- **Scale:** desktop-first expressive scale
- **Families:** primary=Georgia, display=Franklin Gothic, mono=IBM Plex Mono
- **Weights:** 100, 200, 300, 400, 500, 600, 700, 800, 900
- Headings should carry the style personality; body text should optimize scanability and contrast.

## 4. Spacing & Grid

- **Spacing scale:** 4/8/12/16/20/24/32/48
- Keep vertical rhythm consistent across sections and components.
- Align columns and modules to a predictable grid; avoid ad-hoc offsets.

## 5. Layout & Composition

- Prefer clear content blocks with consistent internal padding.
- Keep hierarchy obvious: headline → support text → primary action.
- Use whitespace to separate concerns before adding borders or shadows.

## 6. Components

- Buttons: primary action uses `#c1121f`; secondary actions stay neutral.
- Inputs: strong focus-visible states, clear labels, and predictable error messaging.
- Cards/sections: use consistent radii, spacing, and elevation strategy across the page.

## 7. Motion & Interaction

- Use subtle transitions that emphasize Primary (#c1121f) as the interaction signal.
- Default to short, purposeful transitions (150–250ms) with stable easing.
- Ensure hover, focus-visible, active, disabled, and loading states are explicit.

## 8. Voice & Brand

- Tone should reflect the visual style: concise, confident, and product-specific.
- Keep microcopy action-oriented and avoid generic filler language.
- Preserve the style identity in headlines while keeping UI labels literal and clear.

## 9. Anti-patterns

- Do not introduce off-palette colors when an existing token can solve the problem.
- Do not flatten hierarchy by using the same type size/weight for all text.
- Do not add decorative effects that reduce readability or accessibility.
- Do not mix unrelated visual metaphors in the same interface.

## Not synced from Open Design

- --motion-fast skipped: Claude design systems have no motion family.
- --motion-base skipped: Claude design systems have no motion family.
- --ease-standard skipped: Claude design systems have no motion family.
- Written as literal colours computed from color-mix(): --accent-hover, --accent-active. They won't follow later edits to the colours they mix.
- Fonts are named by family only (hosted faces); no font files were copied.
- No components or assets: Open Design design systems carry tokens and guidance only.
