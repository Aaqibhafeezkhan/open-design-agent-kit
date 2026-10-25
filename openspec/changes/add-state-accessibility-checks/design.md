## Context

`checkPage(browser, page, viewports, maxImages, diagram)` opens the artifact once per viewport, runs `collectPreflight` and `collectHorizontalScroll(PHONE_MAX_WIDTH)`, screenshots, and stores the run in `.open-design/.checks/`. The page is a Playwright `Page` on Chromium. Contrast in `collectPreflight` already resolves backgrounds through ancestors with `parseColor` and `luminance`.

## Goals / Non-Goals

**Goals:** catch the state-dependent failures WCAG 2.2 AA cares about most for generated designs; keep a normal check under about 3 extra seconds; reuse the existing contrast maths and finding shape.

**Non-Goals:** a full WCAG audit (axe-core covers ARIA and naming, and is a separate decision); screen-reader testing; checking `:active` and `:disabled` (rarely broken in a way contrast catches, and disabled controls are exempt from contrast); colour-blindness simulation; keyboard trap detection (needs a tab-walk; maybe later).

## Decisions

### Force states through CDP, not by moving the mouse

`page.hover()` triggers one element at a time and leaves transitions mid-flight; `:focus-visible` only matches after keyboard input. `CSS.forcePseudoState` on a CDP session sets `hover` or `focus-visible` per node without events, so the pass can read computed styles directly. Transitions are disabled for the pass with an injected `*{transition:none!important}` so the read value is the end state. The cost is that scripted hover effects (JS `mouseenter`) are missed; noted in the docs.

### What counts as a visible focus change

Compare the default and forced `:focus-visible` computed styles of the element and its `::after`/`::before`: a focus indicator exists when `outline-style` is not `none` with width ≥ 1px, or `box-shadow`, `border-color`, `background-color` or `text-decoration` changes. Browsers' default outline counts as visible, so only pages that remove it (`outline: none`) without a replacement fail. This is the common agent mistake.

### 320px, not 280px

The study's note said 280px. WCAG 1.4.10 Reflow is defined at 320 CSS px, so the render uses 320. It applies only to fluid pages: posters, cards and decks are fixed canvases, and `fluid-canvas` designs report per shape already.

### Tap targets at the mobile viewport only

At 1440px the pointer is a mouse and 24px is not the bar. At 390px, sizes are measured from the bounding box; the spacing exception (a 24px circle centred on the target that doesn't intersect another target or its circle) is implemented as in SC 2.5.8. Inline links in running text are exempt, as the SC allows.

### Reduced motion by sampling

With `reducedMotion: 'reduce'` emulated, wait 500ms, then `document.getAnimations()` for CSS animations and transitions still running with duration > 200ms, plus two `getBoundingClientRect` samples 200ms apart on elements that have `will-change: transform` or inline transforms, to catch JS loops. Three.js canvases are exempt (3D has its own review views).

### Budget

| Pass | Renders | Typical cost |
|---|---|---|
| states | 0 (same page) | ~60 elements × 2 states, ~1 s |
| reflow | 1 | ~0.7 s |
| reduced motion | 1 | ~0.8 s |

Screenshots: none unless an error, then one crop per pass, counted against `maxImages`.

## Risks / Trade-offs

- **Contrast over images and gradients** is unknowable from styles; like `contrast` today, those elements are skipped and the skip is counted in the report.
- **CDP is Chromium-only.** Fine for the kit's export browser; the code checks for a CDP session and skips with a note otherwise.
- **More findings at once.** A page could jump from 2 to 15 findings. Mitigation: findings are grouped by code with the first 5 selectors listed, and the skill's two-round limit stays.

### Implementation notes

- `state-contrast` reports only a drop the state causes (lower than the default-state ratio and under the bar); low contrast in the default state stays the `contrast` check's.
- `:focus` is forced together with `:focus-visible`, so a page's `:focus { outline: none }` rule applies, as it would for a keyboard user.
- `tap-target` runs at every checked viewport up to 480 px wide (the phone viewport by default). Touching circles count as intersecting (half a pixel of tolerance).
- `reflow` skips its sideways-scroll finding when the phone viewport already reported `horizontal-scroll` as an error, and its clipped-text findings for elements already reported as `overflow`.
- Measured on three bundled examples (web-prototype, dashboard, docs-page), two runs each, `maxImages: 3`: 3.1–3.2 s without the state checks, 3.6–3.7 s with them (+0.4–0.6 s).

## Open Questions

- Should axe-core be bundled as an optional pass later? Out of scope here; the bundle-size question deserves its own change.
