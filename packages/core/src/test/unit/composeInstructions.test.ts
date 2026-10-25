import * as assert from 'node:assert';
import { composeInstructions, craftRequirementsFor, resolveCraftSections } from '../../generation/composeInstructions';

describe('composeInstructions', () => {
  it('includes the skill body, brief, and suggested entry path', () => {
    const text = composeInstructions({
      skillName: 'Landing Page',
      skillBody: 'Write a single-page hero + features + CTA layout.',
      brief: 'A landing page for a coffee subscription.',
      suggestedEntryPath: '.open-design/coffee-subscription/coffee-subscription.html',
    });
    assert.match(text, /Landing Page/);
    assert.match(text, /coffee subscription/);
    assert.match(text, /\.open-design\/coffee-subscription\/coffee-subscription\.html/);
    assert.match(text, /register_open_design_artifact/);
  });

  it('includes the design system body only when provided', () => {
    const withoutDs = composeInstructions({
      skillName: 'Landing Page',
      skillBody: 'body',
      brief: 'brief',
      suggestedEntryPath: 'x.html',
    });
    assert.doesNotMatch(withoutDs, /Active design system/);

    const withDs = composeInstructions({
      skillName: 'Landing Page',
      skillBody: 'body',
      designSystemTitle: 'Starbucks',
      designSystemBody: '# Design System Inspired by Starbucks',
      brief: 'brief',
      suggestedEntryPath: 'x.html',
    });
    assert.match(withDs, /Active design system — Starbucks/);
  });

  it('includes craft sections only when provided', () => {
    const text = composeInstructions({
      skillName: 'Landing Page',
      skillBody: 'body',
      brief: 'brief',
      suggestedEntryPath: 'x.html',
      craftSections: [{ id: 'typography', body: 'Use a clear type scale.' }],
    });
    assert.match(text, /## Craft rules/);
    assert.match(text, /typography/);
  });

  it('nudges toward the existing app only when frameworks were detected', () => {
    const withoutFrameworks = composeInstructions({
      skillName: 'Landing Page',
      skillBody: 'body',
      brief: 'brief',
      suggestedEntryPath: 'x.html',
    });
    assert.doesNotMatch(withoutFrameworks, /already contains an application/);

    const withEmptyFrameworks = composeInstructions({
      skillName: 'Landing Page',
      skillBody: 'body',
      brief: 'brief',
      suggestedEntryPath: 'x.html',
      existingAppFrameworks: [],
    });
    assert.doesNotMatch(withEmptyFrameworks, /already contains an application/);

    const withFrameworks = composeInstructions({
      skillName: 'Landing Page',
      skillBody: 'body',
      brief: 'brief',
      suggestedEntryPath: 'x.html',
      existingAppFrameworks: ['React', 'Next.js'],
    });
    assert.match(withFrameworks, /already contains an application/);
    assert.match(withFrameworks, /Detected: React, Next\.js/);
    assert.match(withFrameworks, /does NOT change where or how you write the artifact/);
  });

  it('omits the collection section when no collectionContext is given', () => {
    const text = composeInstructions({
      skillName: 'Landing Page',
      skillBody: 'body',
      brief: 'brief',
      suggestedEntryPath: 'x.html',
    });
    assert.doesNotMatch(text, /Part of a design collection/);
  });

  it('describes this screen and its siblings when collectionContext is given', () => {
    const text = composeInstructions({
      skillName: 'Onboarding Screen',
      skillBody: 'body',
      brief: 'brief',
      suggestedEntryPath: 'x.html',
      collectionContext: {
        collectionName: 'Fintech Onboarding Flow',
        index: 2,
        total: 4,
        role: 'value-prop',
        siblingScreens: [{ role: 'splash', title: 'Welcome' }],
      },
    });
    assert.match(text, /Part of a design collection/);
    assert.match(text, /screen 2 of 4/);
    assert.match(text, /Fintech Onboarding Flow/);
    assert.match(text, /\*\*value-prop\*\*/);
    assert.match(text, /\*\*splash\*\* — "Welcome"/);
  });

  it('notes when this is the first screen with no siblings yet', () => {
    const text = composeInstructions({
      skillName: 'Onboarding Screen',
      skillBody: 'body',
      brief: 'brief',
      suggestedEntryPath: 'x.html',
      collectionContext: { collectionName: 'Flow', index: 1, total: 3, role: 'splash', siblingScreens: [] },
    });
    assert.match(text, /none yet — this is the first screen/);
  });
});

describe('resolveCraftSections (upstream craft resolution)', () => {
  const all = ['typography', 'color', 'accessibility-baseline', 'anti-ai-slop'].map((id) => ({ id, body: id }));
  const ids = (sections: Array<{ id: string }>) => sections.map((s) => s.id);

  it("uses the skill's requires, in order, and ignores the design system's suggested list", () => {
    const skill = { craftRequires: ['color', 'anti-ai-slop'], mode: 'prototype' as const };
    const designSystem = { craftSuggested: ['color', 'accessibility-baseline'], craftApplies: [], craftExemptions: [] };
    assert.deepStrictEqual(ids(resolveCraftSections(all, craftRequirementsFor(skill, designSystem))), ['color', 'anti-ai-slop']);
  });

  it('gives a skill that declares nothing no craft docs', () => {
    assert.deepStrictEqual(resolveCraftSections(all, craftRequirementsFor({ craftRequires: [], mode: 'prototype' })), []);
    assert.deepStrictEqual(resolveCraftSections(all, craftRequirementsFor({ mode: 'prototype' }, { craftApplies: [], craftExemptions: [] })), []);
  });

  it('always gives decks typography', () => {
    assert.deepStrictEqual(ids(resolveCraftSections(all, craftRequirementsFor({ craftRequires: [], mode: 'deck' }))), ['typography']);
  });

  it("adds the design system's applies and removes its exemptions", () => {
    const skill = { craftRequires: ['color', 'anti-ai-slop'], mode: 'prototype' as const };
    const designSystem = { craftApplies: ['accessibility-baseline'], craftExemptions: ['anti-ai-slop'] };
    assert.deepStrictEqual(ids(resolveCraftSections(all, craftRequirementsFor(skill, designSystem))), ['color', 'accessibility-baseline']);
  });

  it('skips unknown slugs and normalizes and deduplicates the rest', () => {
    const skill = { craftRequires: ['typographic-rhythm', ' Color ', 'color', 'Bad Slug!'], mode: 'prototype' as const };
    assert.deepStrictEqual(ids(resolveCraftSections(all, craftRequirementsFor(skill))), ['color']);
  });

  it('omits the craft section from a brief when nothing resolves', () => {
    const text = composeInstructions({ skillName: 'S', skillBody: 'body', craftSections: [], brief: 'b', suggestedEntryPath: 'x.html' });
    assert.doesNotMatch(text, /Craft rules/);
  });

  it('adds the "Checked in this kit" note with the check codes when anti-ai-slop or accessibility-baseline is included', () => {
    const brief = (ids: string[]) => composeInstructions({ skillName: 'S', skillBody: 'body', craftSections: ids.map((id) => ({ id, body: `${id} rules` })), brief: 'b', suggestedEntryPath: 'x.html' });
    const slop = brief(['typography', 'anti-ai-slop']);
    assert.match(slop, /### anti-ai-slop\n\nanti-ai-slop rules\n\n### Checked in this kit\n\n- \*\*anti-ai-slop\.\*\* The daemon `lint-artifact` linter that section mentions does not run in this kit/);
    for (const code of ['slop-glow', 'card-row', 'uniform-surface', 'type-scale', 'intent', 'emoji']) assert.ok(slop.includes(`\`${code}\``), code);
    assert.doesNotMatch(slop, /accessibility-baseline\.\*\*/);
    const a11y = brief(['accessibility-baseline']);
    for (const code of ['state-contrast', 'focus-visible', 'tap-target', 'reflow', 'reduced-motion']) assert.ok(a11y.includes(`\`${code}\``), code);
    assert.doesNotMatch(a11y, /lint-artifact/);
    assert.doesNotMatch(brief(['typography']), /Checked in this kit/);
  });
});
