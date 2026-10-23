import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fillVoiceRegion, voiceRegionIsCurrent, VOICE_START, VOICE_END } from '../voice.mjs';
import { loadLocalPrompts } from '../localPrompts.mjs';

test('fillVoiceRegion replaces only the marked region', () => {
  const text = `Intro.\n\n${VOICE_START}\nold\n${VOICE_END}\n\nFlow.`;
  const filled = fillVoiceRegion(text, 'Talk plainly.');
  assert.equal(filled, `Intro.\n\n${VOICE_START}\nTalk plainly.\n${VOICE_END}\n\nFlow.`);
  assert.ok(voiceRegionIsCurrent(filled, 'Talk plainly.'));
  assert.ok(!voiceRegionIsCurrent(text, 'Talk plainly.'));
  assert.ok(!voiceRegionIsCurrent('no markers', 'Talk plainly.'));
  assert.throws(() => fillVoiceRegion('no markers', 'x'));
});

test('local prompts get the voice block and must include its placeholder', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-voice-'));
  await fs.mkdir(path.join(root, 'prompts'));
  await fs.writeFile(path.join(root, 'voice.md'), 'Talk plainly.\n');
  await fs.writeFile(path.join(root, 'prompts', 'a.md'), '---\nname: a\ndescription: d\n---\nBrief: {{brief}}\n\n{{voice}}\n\nDo it.\n');
  const [prompt] = await loadLocalPrompts(root);
  assert.equal(prompt.body, 'Brief: {{brief}}\n\nTalk plainly.\n\nDo it.');
  await fs.writeFile(path.join(root, 'prompts', 'b.md'), '---\nname: b\ndescription: d\n---\nBrief: {{brief}}\n');
  await assert.rejects(loadLocalPrompts(root), /b\.md must contain \{\{voice\}\}/);
});
