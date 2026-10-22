> Game-inspired fantasy aesthetic with bold, premium visuals, rich color palettes, and immersive thematic elements.

## 1. Visual Theme & Atmosphere

Game-inspired fantasy aesthetic with bold, premium visuals, rich color palettes, and immersive thematic elements.

- **Visual style:** bold, premium
- **Color stance:** primary, secondary, success, warning, danger, info
- **Design intent:** Keep outputs recognizable to this style family while preserving usability and readability.

## 2. Color

- **Primary:** `#c084fc` — Token from style foundations.
- **Secondary:** `#FDC800` — Token from style foundations.
- **Success:** `#39ff88` — Token from style foundations.
- **Warning:** `#fff34d` — Token from style foundations.
- **Danger:** `#ff4d8d` — Token from style foundations.
- **Surface:** `#111126` — Token from style foundations.
- **Text:** `#f8f7ff` — Token from style foundations.
- **Neutral:** `#111126` — Derived from the surface token for official format compatibility.

- Favor Primary (#c084fc) for CTA emphasis.
- Use Surface (#111126) for large backgrounds and cards.
- Keep body copy on Text (#f8f7ff) for legibility.

## 3. Typography

- **Scale:** 12/14/16/18/24/36/54/76
- **Families:** primary=New Rocker, display=New Rocker, mono=IBM Plex Mono
- **Weights:** 100, 200, 300, 400, 500, 600, 700, 800, 900
- Headings should carry the style personality; body text should optimize scanability and contrast.

## 4. Spacing & Grid

- **Spacing scale:** 8pt baseline grid
- Keep vertical rhythm consistent across sections and components.
- Align columns and modules to a predictable grid; avoid ad-hoc offsets.

## 5. Layout & Composition

- Prefer clear content blocks with consistent internal padding.
- Keep hierarchy obvious: headline → support text → primary action.
- Use whitespace to separate concerns before adding borders or shadows.

## 6. Components

- Buttons: primary action uses `#c084fc`; secondary actions stay neutral.
- Inputs: strong focus-visible states, clear labels, and predictable error messaging.
- Cards/sections: use consistent radii, spacing, and elevation strategy across the page.

## 7. Motion & Interaction

- Use subtle transitions that emphasize Primary (#c084fc) as the interaction signal.
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
