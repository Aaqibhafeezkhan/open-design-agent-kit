# T4 · Desk diorama

**Based on:** [Desk Racer](https://aistudio.google.com/learn/gemini-4-argon-showcase) ([preview image](https://www.gstatic.com/aistudio-static/applets/desk-racer/image.png)): a miniature kart track built over a real desk, with a gantry start line, red-and-white curbs, raised track sections on pillars, and a glowing keyboard looming beside it. Google's guide walks through how it was built.

**What we build:** a still diorama of our own desk with a miniature track on it, framed like the photo. No driving or physics.

**What it tests:** matching a real photo: camera angle, horizon and scale (workflow 6 in the guide), plus a scale change late in the run (the guide's 1:87 → 1:150 step).

## Inputs

- `inputs/desk-1.jpg`, `inputs/desk-2.jpg`: two photos of a real desk you own, taken from roughly seated eye level. Include a keyboard, a mug and one other object. No people or private documents in frame.

## Prompt

> Using the photos of my desk in `inputs/`, build a 3D diorama of the desk with a miniature racing track winding around the objects on it: a start gantry with a checkered banner, red-and-white curbs, and a raised section on thin pillars. Match the first photo's framing: before building anything, work out the camera angle, the camera height and the horizon line from the photo, and overlay a numbered grid on it to read off where each object sits. The desk objects should be the size they really are, with the track at 1:87 scale. Export a still from the photo's camera.

Then, as a second message:

> The track feels cramped. Change to 1:150 scale and move the camera closer, so the track looks the same size on screen but the road is wider and the desk objects tower over it.

## Answers, if asked

- Track style: arcade, not realistic.
- Lighting: match the room in the photo.

## Must have

- [ ] Before building, the agent states the camera angle, height and horizon line from the photo, and makes a grid overlay of it.
- [ ] The still from the photo's camera lines up with photo 1: desk edge, keyboard and mug within a few percent of their place in the frame. Check by overlaying the still on the photo at 50% opacity.
- [ ] Objects are their real sizes relative to each other: the mug is about as tall as a keyboard is deep.
- [ ] Track pillars stand on the desk or on objects, flush. None float or pass through.
- [ ] After the scale change: the kart and track are about the same size on screen, the road is about twice as wide relative to the desk objects, and nothing else moved.
- [ ] Export: a still from the photo's camera, before and after the scale change.

## Watch for

- The camera's field of view guessed rather than worked out, so perspective doesn't match even when the positions do.
- The objects modeled as primitives that don't resemble the real ones. Acceptable at baseline; note it for the Blender bridge.
- The scale change applied to the desk objects too.
