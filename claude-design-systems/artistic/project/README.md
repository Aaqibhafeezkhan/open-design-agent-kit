> High-contrast, expressive style with creative typography and bold color choices for visually striking interfaces.

## 1. Visual Theme & Atmosphere

High-contrast, expressive style with creative typography and bold color choices for visually striking interfaces.

- **Visual style:** high-contrast, artistic
- **Color stance:** primary, neutral, success, warning, danger
- **Design intent:** Keep outputs recognizable to this style family while preserving usability and readability.

## 2. Color

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

## 3. Typography

- **Scale:** 12/14/17/20/28/42/64/88
- **Families:** primary=Limelight, display=Limelight, mono=JetBrains Mono
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

- Buttons: primary action uses `#9b5b32`; secondary actions stay neutral.
- Inputs: strong focus-visible states, clear labels, and predictable error messaging.
- Cards/sections: use consistent radii, spacing, and elevation strategy across the page.

## 7. Motion & Interaction

- Use subtle transitions that emphasize Primary (#9b5b32) as the interaction signal.
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
