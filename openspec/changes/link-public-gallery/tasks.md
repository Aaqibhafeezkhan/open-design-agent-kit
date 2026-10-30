## 1. Gallery address and switch

- [ ] 1.1 `packages/content/local/gallery.json`: `{ "url": "https://feimacode.github.io/open-design-agent-kit/", "live": false }`
- [ ] 1.2 Content sync check: fail on a missing or non-`https` `url`, a `url` not ending in `/`, or a non-boolean `live`; test
- [ ] 1.3 `ContentIndex`: `getGallery()` returning `{ url, live }`, plus shared helpers `galleryHubUrl(kind, query?)` and `galleryDesignSystemUrl(detail)` (`built-in` only); unit tests

## 2. Tool results

- [ ] 2.1 `showExamples` and `showDesignSystems`: add `gallery: { url }` while live (query as `#q=`, plain hub for `ids`); unit tests for live, not live, query and shortlist
- [ ] 2.2 `registerArtifact`: add `designSystem: { id, galleryUrl }` while live when the recorded `designSystemId` is built-in; unit tests for built-in, generated and none
- [ ] 2.3 `packages/mcp-server/src/index.ts`: mention the new fields in the three tool descriptions

## 3. Inline views

- [ ] 3.1 Examples and design-systems views: **See them all in the gallery** footer, opened with the host's `openLink`; hidden without link support or a `gallery` field
- [ ] 3.2 Tests with the reference host bridge (`openLinks` on and off)

## 4. Skill text

- [ ] 4.1 Overview skill: the browsing rule (in-chat gallery, then one gallery line, once per conversation) next to "Picking by eye"
- [ ] 4.2 Overview skill: the ready-sentence design-system link, once per design system per conversation; never on concrete requests before the design, never in job runs
- [ ] 4.3 `packages/content/local/prompts/new.md`: the browsing rule for an empty or browsing request
- [ ] 4.4 Regenerate skill copies and prompts; content drift check passes

## 5. Gallery build

- [ ] 5.1 `scripts/build-gallery.ts`: read `gallery.json`; use its `url` as the default `--base-url`; use the shared spoke-URL helper
- [ ] 5.2 `.github/workflows/gallery.yml`: force `--all` while `live` is `true`
- [ ] 5.3 `gallery/README.md`: the switch and what turning it on does

## 6. Docs

- [ ] 6.1 `docs/reference/tools.md`: `gallery` on the two picker tools, `designSystem.galleryUrl` on register

## 7. Verification

- [ ] 7.1 With `live: false`: no gallery link in any tool result, view or reply (Desktop Chat, browsing and concrete requests)
- [ ] 7.2 With `live: true` locally: Desktop Chat "show me some examples" shows the inline gallery plus one gallery line; the footer link opens the hub
- [ ] 7.3 With `live: true`: a poster made with Kami ends with the Kami page link once; a second Kami design in the same chat doesn't repeat it
- [ ] 7.4 Evals (`npm run evals --only` on a vague brief and shop-pack): no gallery links before the design
