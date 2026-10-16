# T3 · Pueblo Bonito reconstruction

**Based on:** [Chaco Canyon 3D Ruins](https://aistudio.google.com/learn/gemini-4-argon-showcase) ([preview image](https://www.gstatic.com/aistudio-static/applets/chaco-canyon-3d/image.png)): an aerial reconstruction of Pueblo Bonito (c. AD 850–1150), the D-shaped great house with hundreds of rooms and round kivas, below the canyon's sandstone cliff. Google built it from LiDAR and archival HABS/NPS surveys.

**What we build:** an aerial view of the great house as it stands today (ruined walls), with the cliff behind. No LiDAR terrain and no season or sun controls.

**Skill:** `3d-scene`.

**What it tests:** workflow 6 in Google's guide: a 2D plan with dimensions first, then a 3D scene extruded from it, so proportions don't drift. Hundreds of rooms make it the most demanding scene for geometry count.

## Inputs

- `inputs/pueblo-bonito-plan.*`: a public-domain plan of Pueblo Bonito. The HABS survey drawings in the Library of Congress collection are public domain; a US National Park Service plan works too. Record the source URL in the results notes.

## Prompt

> Build a 3D aerial reconstruction of Pueblo Bonito in Chaco Canyon, from the plan in `inputs/`. It must be spatially accurate, so don't make any 3D yet. First trace a top-down floorplan as an SVG with meter dimensions: the D-shaped outer wall, the room blocks, the plaza and its dividing wall, and every round kiva, with a numbered grid. Show me the SVG. Once I confirm it, build the 3D scene from those coordinates: sandstone walls at ruin heights (taller at the back, low at the front), kivas sunk into the ground, the plaza, and the canyon cliff behind it to the north. Warm late-afternoon light. Export a still from a high three-quarter angle.

## Answers, if asked

- Confirm the SVG if the outer wall, the plaza wall and the great kivas match the plan; ask for one correction pass if they don't.
- Room count: approximate is fine; the layout and proportions matter more.

## Must have

- [ ] An SVG floorplan comes first, with a scale or meter grid, and the agent waits for confirmation.
- [ ] The 3D layout matches the SVG: overlay the 3D top-down view on the SVG and the outer wall, plaza wall and great kivas line up.
- [ ] The outer wall is a D shape with the straight side to the south and the curve toward the cliff.
- [ ] Rooms read as a grid of separate cells, not one solid block.
- [ ] Kivas are round and set below ground level.
- [ ] The cliff is behind the great house to the north, and in scale with it.
- [ ] Export: a still.

## Watch for

- The agent skipping the plan and modeling from memory.
- Walls drifting off the plan's coordinates once in 3D (the failure this workflow exists to prevent).
- Hundreds of separate wall meshes: walls should be merged or instanced to stay within the software WebGL budget.
- Every wall the same height, which loses the terraced form.
