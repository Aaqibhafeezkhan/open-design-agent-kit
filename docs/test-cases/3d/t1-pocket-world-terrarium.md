# T1 · Pocket world terrarium

**Based on:** [Pocket World Terrarium](https://aistudio.google.com/learn/gemini-4-argon-showcase) ([preview image](https://www.gstatic.com/aistudio-static/applets/pocket-world-terrarium/image.png)): a faceted low-poly planet with tiny houses, trees, a lighthouse and a lake, floating inside a clear glass orb on a turned walnut-and-brass stand, on a windowsill with a succulent.

**What we build:** the orb on its stand as a product shot, turning slowly. No world-builder controls.

**Skill:** `3d-object`.

**What it tests:** glass that reads as glass, a turned wooden stand, many small props on a curved surface, and keeping a busy object readable. The current `3d-object` skill should handle this, so it's the baseline case.

## Inputs

None.

## Prompt

> Make a 3D hero shot of a pocket-world terrarium: a small faceted low-poly planet floating inside a clear glass orb, which rests on a turned walnut stand with a brass rim. On the planet: a few dozen tiny trees, half a dozen little houses with red roofs, a striped lighthouse, a small turquoise lake and a patch of snow at the top. Soft daylight, a pale lilac background, turning slowly. Then export a still, a transparent PNG and a turntable MP4.

## Answers, if asked

- Brand or design system: none; use the colors in the prompt.
- Size: 1600×1200 still.

## Must have

- [ ] The glass reads as glass: you can see the planet through it, with a highlight or reflection on the sphere. Not an opaque or flat grey disc.
- [ ] The planet floats clear of the glass and the stand, centered in the orb.
- [ ] Props sit on the planet's surface, standing out along its normal. None float or sink.
- [ ] The stand has a turned profile with a visible brass rim, and the orb sits in it without passing through.
- [ ] Facets are visible on the planet (flat shading), not a smooth ball.
- [ ] Exports: a still; a transparent PNG with no background around the stand; a turntable that loops.

## Watch for

- `transmission` glass in software WebGL: it may render black or opaque. A fallback of `opacity` plus `envMap` reflections is acceptable if it reads as glass.
- Props placed by random scatter that end up underwater or inside each other.
- A low-angle shot that shows the planet's underside is empty.
