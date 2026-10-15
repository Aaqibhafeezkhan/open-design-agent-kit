# T2 · Gothic chess set

**Based on:** [Wizard Chess 3D](https://aistudio.google.com/learn/gemini-4-argon-showcase) ([preview image](https://www.gstatic.com/aistudio-static/applets/wizard-chess-3d/image.png)): ivory and black-and-gold sculpted pieces on a black board edged with gold runes, in a stone Gothic hall with arches, pillars and a fire brazier.

**What we build:** the set as a product shot: board, all 32 pieces in their starting positions, and a dim stone hall behind it. No gameplay, AI or capture animations. Stretch goal: one piece shatters into stone shards when clicked.

**What it tests:** a family of turned pieces that each read as the right piece, two contrasting materials, warm point light from a fire, and an environment behind the object. The baseline skill places the object on an empty stage, so how it handles the hall shows whether we need `3d-scene`.

## Inputs

None.

## Prompt

> Make a 3D product shot of a Gothic chess set. White pieces in carved ivory, black pieces in black stone with gold trim, each piece clearly recognizable (the knight is a horse head, the king has a cross, the rook has battlements). All 32 pieces in their starting positions on a black board with a gold border engraved with runes. Behind it, a dim stone hall with pointed arches, pillars and an iron fire brazier giving warm, flickering light. Three-quarter view from the white side, turning slowly. Export a still and a turntable MP4.

Stretch, as a follow-up:

> Make a piece shatter into stone shards that fall onto the board when I click it.

## Answers, if asked

- Brand or design system: none.
- Turntable: rotate the camera around the board, not the hall.

## Must have

- [ ] Six distinct piece shapes, each recognizable at overview distance. The knight isn't a cylinder with a bump.
- [ ] 32 pieces, each centered on its square, sitting on the board.
- [ ] Ivory and black-stone materials differ in roughness and color. Gold trim reads as metal.
- [ ] The brazier's light is warm, casts on the board, and flickers without changing the framing.
- [ ] The hall is visible, but darker and less detailed than the set; it doesn't compete with it.
- [ ] Exports: a still and a turntable that loops.
- [ ] Stretch: shards come from the clicked piece, fall, and land on the board without passing through it.

## Watch for

- The knight: the hardest shape to make from lathe profiles alone. A good case for a Blender bridge later.
- 32 pieces × detailed profiles going over the triangle budget. Instancing should share geometry between pieces of the same type.
- The hall swallowing the frame, so the set is small and unreadable.
