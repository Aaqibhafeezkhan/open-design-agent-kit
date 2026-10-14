import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  modeOf,
  parseColorEntries,
  primaryMode,
  parsePrimaryFont,
  parseFonts,
  parseTypeScale,
  parseRadii,
  parseScreenMargin,
  mapTypeScale,
  parseQuickReference,
  parseAccentOn,
  quickReferenceAgreement,
  extractIosTokens,
  classifyIosCandidates,
  parseAppName,
  parseSummary,
  extractIosDesignSystemScaffold,
  summarizeExtractions,
  MOBILE_CATEGORY,
} from '../iosExtraction.mjs';

// The real awesome-ios-design-md shape: nine numbered sections, §2 colour
// bullets, §3 hierarchy table, §9 Quick Color Reference.
function fixtureDesignMd({ colors, quickRef = '', font = '- **Primary**: `Spotify Mix` (proprietary)', typeRows, components = '- Corner radius: 6pt\n- Corner radius: 12pt\n- Corner radius: 500pt', layout = '- Standard margin: 20pt horizontal' } = {}) {
  return `# Design System Inspiration of Test (iOS)

## 1. Visual Theme & Atmosphere

A test app.

## 2. Color Palette & Roles

${colors}

## 3. Typography Rules

### Font Family
${font}
- **Fallback Stack**: \`-apple-system\`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
${typeRows ?? `| Screen Title | X | 28pt | 700 | 1.15 | 0 | |
| Section Header | X | 22pt | 700 | 1.2 | 0 | |
| Track Title | X | 16pt | 600 | 1.25 | 0 | |
| Body | X | 15pt | 400 | 1.4 | 0 | |
| Meta | X | 12pt | 400 | 1.3 | 0 | |
| Tab Label | X | 11pt | 700 | 1.0 | 0 | |`}

## 4. Component Stylings

${components}

## 5. Layout Principles

${layout}

## 6. Depth & Elevation

## 7. Do's and Don'ts

## 8. Responsive Behavior

## 9. Agent Prompt Guide

### Quick Color Reference
${quickRef}

### Example Component Prompts
- "Build a thing."
`;
}

const DARK_FIRST = `### Primary
- **Spotify Green** (\`#1DB954\`): Primary CTA, "Follow" button.
- **Green Pressed** (\`#169C46\`): Pressed state.

### Canvas & Surfaces (Dark — default)
- **Canvas Black** (\`#121212\`): Primary dark canvas.
- **Surface 1** (\`#181818\`): Card backgrounds, elevated shelves.
- **Divider** (\`#2A2A2A\`): Hairline dividers.

### Text
- **Text Primary** (\`#FFFFFF\`): Track titles.
- **Text Secondary** (\`#B3B3B3\`): Artist names, metadata.
- **Text Tertiary** (\`#6A6A6A\`): Disabled.

### Light Mode (Limited Use)
- **Light Canvas** (\`#FFFFFF\`)
- **Light Text** (\`#121212\`)

### Semantic
- **Error Red** (\`#F15E6C\`): Playback errors.`;

const DARK_FIRST_QR = `- Canvas: \`#121212\`
- Surface 1 (cards): \`#181818\`
- Divider: \`#2A2A2A\`
- Primary text: \`#FFFFFF\`
- Secondary text: \`#B3B3B3\`
- Spotify Green (action): \`#1DB954\``;

test('modeOf names a mode only when exactly one is mentioned', () => {
  assert.equal(modeOf('Canvas & Surfaces (Dark Mode)'), 'dark');
  assert.equal(modeOf('Light Canvas'), 'light');
  assert.equal(modeOf('Text (light / dark)'), null);
  assert.equal(modeOf('Semantic'), null);
});

test('parseColorEntries reads inline light/dark pairs and a hex inside the bold name', () => {
  const md = fixtureDesignMd({
    colors: `### Semantic
- **Income Green** (\`#1FA971\` light / \`#2FCB8F\` dark): Money in.

### Canvas & Surfaces (Dark — Default)
- **Chat Canvas (\`#313338\`)**: The pane where messages live.`,
  });
  const [income, chat] = parseColorEntries(md);
  assert.deepEqual(income.byMode, { light: '#1FA971', dark: '#2FCB8F' });
  assert.equal(chat.name, 'Chat Canvas');
  assert.equal(chat.hex, '#313338');
  assert.equal(chat.mode, 'dark');
});

test('primaryMode reads the subsection headings', () => {
  const heading = (h) => primaryMode(fixtureDesignMd({ colors: `### ${h}\n- **Canvas** (\`#FAF9F6\`): Background.` })).mode;
  assert.equal(heading('Canvas & Surfaces (Dark — default)'), 'dark');
  assert.equal(heading('Canvas & Surfaces (Light only)'), 'light');
  assert.equal(heading('Light Mode (Limited Use)'), 'dark');
  assert.equal(heading('Dark Mode (Not Used)'), 'light');
  assert.equal(heading('No Light Mode'), 'dark');
});

test('primaryMode falls back to an unqualified canvas, then to light', () => {
  assert.deepEqual(primaryMode(fixtureDesignMd({ colors: '### Canvas\n- **Canvas** (`#0A0A0F`): The void.' })), { mode: 'dark', why: 'unqualified canvas' });
  assert.deepEqual(primaryMode(fixtureDesignMd({ colors: '### Canvas (Light)\n- **Canvas** (`#FFFFFF`): Background.' })).mode, 'light');
});

test('extractIosTokens picks every role for a dark-first app and §9 agrees', () => {
  const x = extractIosTokens(fixtureDesignMd({ colors: DARK_FIRST, quickRef: DARK_FIRST_QR }));
  assert.equal(x.mode, 'dark');
  assert.deepEqual(
    Object.fromEntries(Object.entries(x.roles).map(([k, v]) => [k, v.hex])),
    { accent: '#1DB954', bg: '#121212', surface: '#181818', fg: '#FFFFFF', muted: '#B3B3B3', border: '#2A2A2A' },
  );
  for (const role of Object.keys(x.agreement)) assert.equal(x.agreement[role], 'agree', role);
  assert.equal(x.semantic.danger.hex, '#F15E6C');
  assert.equal(x.hasLightAndDark, true);
});

test('a brand-named canvas is found through its description', () => {
  const x = extractIosTokens(
    fixtureDesignMd({
      colors: `### Primary
- **Hinge Black** (\`#1A1A1A\`): The brand colour.
- **Hinge Cream** (\`#FDF8F2\`): The signature canvas — every screen background.`,
    }),
  );
  assert.equal(x.roles.bg.hex, '#FDF8F2');
});

test('light mode prefers the card colour over a grouped "Surface Gray"', () => {
  const x = extractIosTokens(
    fixtureDesignMd({
      colors: `### Canvas, Surfaces & Dividers
- **Canvas White** (\`#FFFFFF\`): Primary canvas everywhere.
- **Surface Gray** (\`#F5F7FA\`): Section backgrounds.
- **Card White** (\`#FFFFFF\`): Balance card and wallet item cards.`,
    }),
  );
  assert.equal(x.roles.surface.name, 'Card White');
});

test('muted prefers "Text Muted" over a body-text "Text Secondary", and never takes tertiary', () => {
  const withMuted = extractIosTokens(
    fixtureDesignMd({
      colors: `### Text
- **Text Primary** (\`#001435\`): Primary text.
- **Text Secondary** (\`#2C2E2F\`): Body text on lighter contexts.
- **Text Muted** (\`#687173\`): Metadata — dates.
- **Text Tertiary** (\`#9DA3A6\`): Placeholders.`,
    }),
  );
  assert.equal(withMuted.roles.muted.hex, '#687173');
  const withTertiary = extractIosTokens(
    fixtureDesignMd({
      colors: `### Text
- **Text Secondary** (\`#9A9AA5\`): Contributor names, units.
- **Text Tertiary** (\`#6A6A73\`): Very low-emphasis metadata.`,
    }),
  );
  assert.equal(withTertiary.roles.muted.hex, '#9A9AA5');
});

test('a neutral primary gives way to a chromatic primary-button colour', () => {
  const x = extractIosTokens(
    fixtureDesignMd({
      colors: `### Primary (Monochrome)
- **Pure Black** (\`#000000\`): Light mode text.

### Interactive
- **Primary Button Blue** (\`#0095F6\`): The "Follow" pill buttons.`,
    }),
  );
  assert.equal(x.roles.accent.hex, '#0095F6');
  assert.equal(x.roles.accent.why, 'neutral primary, used the CTA colour');
});

test('within Primary, the entry described as the primary action wins', () => {
  const x = extractIosTokens(
    fixtureDesignMd({
      colors: `### Primary
- **Booking Blue** (\`#003580\`): Brand surfaces — top app bar, Genius banner.
- **CTA Blue** (\`#0071C2\`): Primary action — "Search", "Reserve", links.`,
    }),
  );
  assert.equal(x.roles.accent.hex, '#0071C2');
});

test('a dedicated chrome accent beats the first of several data colours', () => {
  const x = extractIosTokens(
    fixtureDesignMd({
      colors: `### Primary — The Three Activity Rings
- **Move** (\`#FA114F\`): Move ring.
- **Exercise** (\`#92E82A\`): Exercise ring.

### Interactive / Chrome Accent
- **Move-Pink Accent** (\`#FF375F\`): The single chrome accent — active tab tint, primary CTA.`,
    }),
  );
  assert.equal(x.roles.accent.hex, '#FF375F');
});

test('accent-on comes from the accent-filled button in §4', () => {
  const md = fixtureDesignMd({ colors: '', components: '**Primary Pill**\n- Background: `#FF3464` (Hot Coral)\n- Text: `#FFFFFF`, Inter 16pt\n- Corner radius: 12pt' });
  assert.equal(parseAccentOn(md, '#FF3464'), '#FFFFFF');
  assert.equal(parseAccentOn(md, '#1DB954'), null);
  const words = fixtureDesignMd({ colors: '', components: '- Background: `#0088CC` (accent)\n- Text: white, SF Pro Text 17pt' });
  assert.equal(parseAccentOn(words, '#0088CC'), '#FFFFFF');
  const both = fixtureDesignMd({ colors: '', components: '- Background: transparent or `#4F97FF` filled\n- Text: `#4F97FF` (text) / `#FFFFFF` (filled)' });
  assert.equal(parseAccentOn(both, '#4F97FF'), '#FFFFFF');
});

test('the app canvas beats a chat wallpaper for --bg', () => {
  const x = extractIosTokens(
    fixtureDesignMd({
      colors: `### Canvas & Surfaces
- **Chat Wallpaper (Light)** (\`#ECE5DD\`): The doodle-wallpaper background.
- **App Canvas (Light)** (\`#FFFFFF\`): Chat list and settings screens.`,
    }),
  );
  assert.equal(x.roles.bg.hex, '#FFFFFF');
});

test('a brand-identifier "card" entry does not beat Surface 1, and a coloured "Text Muted …" is not muted', () => {
  const x = extractIosTokens(
    fixtureDesignMd({
      colors: `### Brand Identifiers
- **Card Black** (\`#0A0A0A\`): Card surface emboss on the physical card.

### Canvas, Surfaces & Dividers
- **Canvas Black** (\`#000000\`): Primary canvas — every screen.
- **Surface 1** (\`#0F0F0F\`): Elevated surfaces — bottom sheets, cards.

### Text
- **Text Secondary** (\`#9E9E9E\`): Metadata — date stamps.
- **Text Muted Green** (\`#005C16\`): The faint green ghost of an empty amount.`,
    }),
  );
  assert.equal(x.roles.surface.hex, '#0F0F0F');
  assert.equal(x.roles.muted.hex, '#9E9E9E');
});

test('separate display and body faces, and the free substitute, go into the font stacks', () => {
  const font = `- **Display (hero stats)**: \`Trade Gothic Next\` (proprietary)
- **Body / metadata**: \`SF Pro Text\` — system body
- **Fallback stack**: \`'Arial Narrow Bold', sans-serif\`
- **Web/marketing Google Fonts substitute**: \`Oswald\` (close enough)`;
  const md = fixtureDesignMd({ colors: DARK_FIRST, font });
  assert.deepEqual(parseFonts(md), { display: 'Trade Gothic Next', body: 'SF Pro Text', substitute: 'Oswald' });
  const scaffold = extractIosDesignSystemScaffold({ category: 'fitness', app: 'nrc', designMd: md, readmeMd: '' }, new Set(), new Set());
  assert.match(scaffold.tokensCss, /--font-display: "Trade Gothic Next", "Oswald", -apple-system/);
  assert.match(scaffold.tokensCss, /--font-body: -apple-system/);
  assert.ok(!scaffold.notes.some((n) => n.includes('proprietary')));
});

test('typography, radii and margin parsing', () => {
  const md = fixtureDesignMd({ colors: DARK_FIRST });
  assert.equal(parsePrimaryFont(md), 'Spotify Mix');
  assert.deepEqual(parseTypeScale(md), { sizes: [11, 12, 15, 16, 22, 28], body: 15, bodyLeading: 1.4 });
  assert.deepEqual(parseRadii(md), { min: 6, median: 12, max: 12 });
  assert.deepEqual(parseRadii(fixtureDesignMd({ colors: '', components: '- Shape: 16pt radius\n- Radius: 24pt' })), { min: 16, median: 24, max: 24 });
  assert.equal(parseScreenMargin(md), 20);
  assert.equal(parseScreenMargin(fixtureDesignMd({ colors: '', layout: '- Bubble inner padding: 9pt vertical, 13pt horizontal\n- Thread side insets: 12pt' })), 12);
});

test('mapTypeScale keeps the contract tiers ascending around the body size', () => {
  const t = mapTypeScale({ sizes: [11, 12, 15, 16, 22, 28], body: 15 });
  assert.equal(t['--text-base'], 15);
  const order = ['--text-xs', '--text-sm', '--text-base', '--text-lg', '--text-xl', '--text-2xl', '--text-3xl', '--text-4xl'].map((k) => t[k]);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('quickReferenceAgreement matches by label, by light/dark pair, and by the accent brand word', () => {
  const qr = parseQuickReference(
    fixtureDesignMd({ colors: '', quickRef: '- Hot Coral (brand / CTA): `#FF3464`\n- Divider: `#E4E7EB` light / `#243A57` dark\n- Spotify Green: `#1DB954`' }),
  );
  assert.equal(quickReferenceAgreement(qr, 'border', '#243A57', 'dark'), 'agree');
  assert.equal(quickReferenceAgreement(qr, 'border', '#E4E7EB', 'dark'), 'elsewhere');
  assert.equal(quickReferenceAgreement(qr, 'accent', '#FF3464', 'light'), 'agree');
  assert.equal(quickReferenceAgreement(qr, 'accent', '#1DB954', 'dark', 'Spotify Green'), 'agree');
  assert.equal(quickReferenceAgreement(qr, 'bg', '#000000', 'dark'), 'unlisted');
});

test('classifyIosCandidates uses the -ios id and reports same-brand upstream systems', () => {
  const result = classifyIosCandidates(['spotify', 'monzo', 'calm'], new Set(['spotify']), new Set(['calm-ios']));
  assert.deepEqual(result, { ported: ['calm'], candidate: ['monzo', 'spotify'], sameBrandUpstream: ['spotify'] });
});

test('README name and summary', () => {
  const readme = '# Spotify — iOS design spec\n\nMusic streaming. Dark `#121212` canvas.\n\nMore.';
  assert.equal(parseAppName(readme, 'spotify'), 'Spotify');
  assert.equal(parseAppName('', 'uber-eats'), 'Uber Eats');
  assert.equal(parseSummary(readme), 'Music streaming. Dark `#121212` canvas.');
});

test('extractIosDesignSystemScaffold builds a Mobile Apps package with attribution', () => {
  const scaffold = extractIosDesignSystemScaffold(
    { category: 'music', app: 'spotify', designMd: fixtureDesignMd({ colors: DARK_FIRST, quickRef: DARK_FIRST_QR }), readmeMd: '# Spotify — iOS design spec\n\nMusic streaming.\n' },
    new Set(['spotify']),
    new Set(),
  );
  assert.equal(scaffold.id, 'spotify-ios');
  assert.equal(scaffold.collision, null);
  assert.equal(scaffold.manifest.category, MOBILE_CATEGORY);
  assert.equal(scaffold.manifest.name, 'Spotify (iOS)');
  assert.match(scaffold.manifest.source.origin, /MIT/);
  assert.match(scaffold.tokensCss, /--bg: #121212;\n/);
  assert.match(scaffold.tokensCss, /--accent: #1DB954;\n/);
  assert.match(scaffold.tokensCss, /--accent-on: #000000;/);
  assert.match(scaffold.tokensCss, /--font-body: "Spotify Mix", -apple-system/);
  assert.doesNotMatch(scaffold.tokensCss, /TODO/);
  assert.match(scaffold.designMd, /^# Design System Inspired by Spotify \(iOS\)\n\n> Category: Mobile Apps\n> Music streaming\./);
  assert.match(scaffold.designMd, /## 1\. Visual Theme/);
  assert.match(scaffold.designMd, /MIT License\.\n$/);
  assert.ok(scaffold.notes.some((n) => n.includes('web "spotify" system')));
});

test('extractIosDesignSystemScaffold flags missing roles and an existing id', () => {
  const scaffold = extractIosDesignSystemScaffold(
    { category: 'fitness', app: 'calm', designMd: fixtureDesignMd({ colors: '### Primary\n- **Calm Blue** (`#2A6FD6`): The single accent.' }), readmeMd: '' },
    new Set(),
    new Set(['calm-ios']),
  );
  assert.equal(scaffold.collision, 'local');
  assert.match(scaffold.notes[0], /COLLISION/);
  assert.match(scaffold.tokensCss, /--bg: #FFFFFF; \/\* TODO: not found/);
  assert.ok(scaffold.notes.some((n) => n.startsWith('--bg: nothing found')));
  assert.ok(scaffold.notes.some((n) => n.startsWith('No §9 Quick Color Reference')));
});

test('summarizeExtractions counts coverage and agreement', () => {
  const good = extractIosTokens(fixtureDesignMd({ colors: DARK_FIRST, quickRef: DARK_FIRST_QR }));
  const bare = extractIosTokens(fixtureDesignMd({ colors: '### Primary\n- **Blue** (`#2A6FD6`): Accent.' }));
  const s = summarizeExtractions([good, bare]);
  assert.equal(s.total, 2);
  assert.equal(s.roles.accent.found, 2);
  assert.equal(s.roles.bg.found, 1);
  assert.equal(s.roles.bg.agree, 1);
  assert.equal(s.clean, 1);
});
