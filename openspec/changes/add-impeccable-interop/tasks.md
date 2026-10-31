## 1. Formats

- [ ] 1.1 Install Impeccable in a scratch project (`npx impeccable install`), run `init` and `document`, note where `PRODUCT.md` and `DESIGN.md` are written and their section names
- [ ] 1.2 Run `/impeccable audit` with one of our design systems' `DESIGN.md` at the root; note whether its colours and fonts are picked up; add a heading map to the writer if not

## 2. Read

- [ ] 2.1 Brief: "Product context" from root `PRODUCT.md`, capped at about 1,500 characters; unit tests (missing, short, long)
- [ ] 2.2 Brief: notice when root `DESIGN.md` exists and no design system is active; unit test
- [ ] 2.3 Overview skill: offer to make the root `DESIGN.md` the active design system through `create_open_design_design_system`

## 3. Write

- [ ] 3.1 `set_active_design_system` `writeProjectDesignMd`: exclusive create of the reconciled `DESIGN.md`; returns `written` or `kept-existing`; unit tests
- [ ] 3.2 Overview skill: offer it once in code projects

## 4. Handoff and docs

- [ ] 4.1 Overview skill: after `port_open_design_artifact_to_app`, if `impeccable` is in the agent's skills, suggest `/impeccable polish` or `/impeccable audit` on the ported component
- [ ] 4.2 Regenerate skill copies; drift checks pass
- [ ] 4.3 `docs/guides/impeccable.md`; link from `docs/guides/design-systems.md`

## 5. Verification

- [ ] 5.1 Claude Code with both installed: brief picks up `PRODUCT.md`; root `DESIGN.md` written once and kept on a second ask; handoff line appears after porting
