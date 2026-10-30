## ADDED Requirements

### Requirement: Gallery Address and Switch
The content SHALL include `packages/content/local/gallery.json` with the gallery's `url` (an `https` URL ending in `/`) and a boolean `live`. The content sync check SHALL fail when either is missing or invalid. While `live` is `false`, no tool result, inline view or skill instruction SHALL contain a gallery link.

#### Scenario: Gallery not live
- **WHEN** `gallery.json` has `live: false` and the agent calls `show_open_design_examples`
- **THEN** the result SHALL have no `gallery` field and the view SHALL show no gallery link

#### Scenario: Invalid address
- **WHEN** `gallery.json` has `url: "feimacode.github.io"`
- **THEN** the content sync check SHALL fail naming the `url` field

### Requirement: Gallery Link in Picker Results
While the gallery is live, `show_open_design_examples` and `show_open_design_design_systems` SHALL return a `gallery` object with the `url` of the matching hub (`examples/` or `design-systems/` under the gallery address). When the call had a `query`, the URL SHALL carry it as the hub's filter hash (`#q=<encoded query>`). A call with `ids` SHALL return the plain hub URL.

#### Scenario: Examples with a query
- **WHEN** the gallery is live and the agent calls `show_open_design_examples` with `query: "café"`
- **THEN** `gallery.url` SHALL be `<gallery url>examples/#q=caf%C3%A9`

#### Scenario: Design-system shortlist
- **WHEN** the gallery is live and the agent calls `show_open_design_design_systems` with `ids: ["kami", "editorial"]`
- **THEN** `gallery.url` SHALL be `<gallery url>design-systems/`

### Requirement: Gallery Link in the Inline Views
While the gallery is live, the inline examples and design-systems views SHALL show a **See them all in the gallery** link under the tiles, opening `gallery.url` through the host's link request. Where the host doesn't support opening links, the views SHALL NOT show it.

#### Scenario: Host opens links
- **WHEN** the host advertises link support and the user clicks **See them all in the gallery**
- **THEN** the view SHALL ask the host to open `gallery.url`

#### Scenario: Host without link support
- **WHEN** the host doesn't advertise link support
- **THEN** the view SHALL show no gallery link

### Requirement: Design System Page Link on Register
While the gallery is live, `register_open_design_artifact` SHALL return `designSystem: { id, galleryUrl }`, with `galleryUrl` set to `<gallery url>design-systems/<id>/`, when the `designSystemId` it records names a bundled (`built-in`) design system. It SHALL NOT return `galleryUrl` for any other design system or when the artifact records none.

#### Scenario: Bundled design system
- **WHEN** the gallery is live and the agent registers an artifact made with `kami`
- **THEN** the result SHALL include `designSystem.galleryUrl` ending in `design-systems/kami/`

#### Scenario: Generated design system
- **WHEN** the agent registers an artifact made with a design system extracted from a URL
- **THEN** the result SHALL have no `designSystem.galleryUrl`

### Requirement: Every Returned Page Exists
While the gallery is live, the Gallery workflow SHALL build every bundled design system and remixable example, whatever its `all` input, so that every `galleryUrl` the server can return has a page.

#### Scenario: Pilot input while live
- **WHEN** the gallery is live and the workflow runs with `all` off
- **THEN** it SHALL still build every bundled design system and example

### Requirement: When the Agent Links the Gallery
The overview skill and the `open-design-new` prompt SHALL tell the agent, while the gallery is live:
- On a **browsing** request (the person wants to look before deciding, e.g. "show me some examples", "what styles are there?"), to show the in-chat gallery where it is in the tools and then add one line linking `gallery.url`, if it hasn't linked the gallery earlier in the conversation.
- When a design is **ready**, to name its design system with a link to `designSystem.galleryUrl` in the ready sentence, the first time that design system is used in the conversation.
- Never to link the gallery before building on a **concrete** request, and never in a recurring job run.

#### Scenario: Browsing request in Desktop Chat
- **WHEN** a user in Desktop Chat asks "what kinds of posters can you make?"
- **THEN** the agent SHALL call `show_open_design_examples` and add one line linking its `gallery.url`

#### Scenario: Concrete request
- **WHEN** a user asks "make a poster for our seed swap on Saturday"
- **THEN** the agent's replies before the design is ready SHALL contain no gallery link

#### Scenario: Second design in the same style
- **WHEN** the agent finishes a second design with the same design system in the same conversation
- **THEN** its ready message SHALL NOT repeat the design system's gallery link

#### Scenario: Recurring job run
- **WHEN** the agent finishes a design during a recurring job run
- **THEN** its report SHALL contain no gallery link
