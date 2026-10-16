# T5 · Branded arcade cabinet

**Based on:** [Pixel Arcade](https://aistudio.google.com/learn/gemini-4-argon-showcase) ([preview image](https://www.gstatic.com/aistudio-static/applets/pixel-arcade/image.png)): a 3D arcade cabinet in a dark, pixelated room, its marquee and screen personalized for the player ("SPACENINJA'S GAME", a fox runner on a title screen), with joysticks and buttons on the control deck.

**What we build:** an upright arcade cabinet as a product shot, skinned with the active design system: the marquee shows the brand name, the screen shows a pixel-art title screen drawn live, and the side art uses the brand's colors.

**Skill:** `3d-object`.

**What it tests:** a product with live content on a screen (a canvas texture that updates), skinning from design tokens, emissive light from the screen, and a pixel-art look that stays crisp. It's the 3D counterpart of `mockup-device-3d`.

## Inputs

- An active design system. Use one with a strong accent color (for example `raycast` or `spotify`), and set it before running.

## Prompt

> Make a 3D product shot of an upright arcade cabinet skinned in our brand: the marquee at the top shows our name lit from behind, the side panels carry bold side art in our colors, and the screen shows a live pixel-art title screen for a game called "Brand Runner", with a small animated character running in place and a blinking "PRESS START". Joysticks and buttons on the control deck. A dark room, with the screen and marquee giving most of the light. Three-quarter view, turning slowly. Export a still, a transparent PNG and a 6-second turntable GIF.

## Answers, if asked

- Brand: the active design system.
- Game art: keep it simple, 16-color pixel art.

## Must have

- [ ] The marquee, side art and screen colors come from the active design system's tokens. Swap the design system and re-run the page: they change.
- [ ] The screen content is drawn live (a canvas texture or similar) and animates, and the pixel art stays sharp, not blurred (nearest-neighbor filtering).
- [ ] The screen and marquee glow and light the control deck and the floor in front.
- [ ] The cabinet profile is right: a slanted screen, the control deck sticking out, and the marquee on top.
- [ ] Joysticks and buttons sit on the deck surface.
- [ ] Exports: a still, a transparent PNG, and a turntable GIF that loops.

## Watch for

- The screen animation tied to frame count, so it runs at the wrong speed in the turntable export (it must run on time, like the turntable).
- A transparent PNG that loses the dark room's mood: the glow must still read on the cabinet itself.
- Text on the marquee drawn as blurry canvas text at low resolution.
