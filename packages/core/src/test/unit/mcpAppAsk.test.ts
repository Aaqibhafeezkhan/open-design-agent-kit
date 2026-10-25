// The preview MCP App's ask view (openspec add-mcp-app-ask-view): the schema
// and its limits, image references, the answer message both ways, the text
// fallback and the feedback chips' messages.
import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { saveCheckRun } from '../../export/checkHistory';
import { writeArtifactManifest } from '../../vendored/artifactCreate';
import {
  ASK_MAX_BYTES,
  askAnswersMessage,
  askFallbackText,
  feedbackChipMessage,
  parseAskAnswersMessage,
  parseAskImageRef,
  parseAskSchema,
  type AskSchema,
} from '../../preview/mcpApp/protocol';
import { buildArtifactAskImage } from '../../preview/server/mcpApp';

const options = (n: number, prefix = 'o') => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, label: `Option ${i}` }));

const POSTER: AskSchema = {
  title: 'A few quick questions',
  questions: [
    { id: 'where', text: 'Where will it be used?', kind: 'single', options: [{ id: 'printed', label: 'Printed' }, { id: 'screen', label: 'On screen' }] },
    { id: 'mood', text: 'Which moods?', kind: 'multi', options: [{ id: 'dark', label: 'Dark' }, { id: 'bold', label: 'Bold' }, { id: 'calm', label: 'Calm' }] },
    { id: 'words', text: 'Any words it must say?', kind: 'text' },
  ],
};

describe('preview MCP App ask view', () => {
  describe('schema', () => {
    it('accepts three single-choice questions with four options each, defaulting kind to single', () => {
      const parsed = parseAskSchema({ questions: ['a', 'b', 'c'].map((id) => ({ id, text: `Question ${id}?`, options: options(4) })) });
      assert.ok(parsed.ok, parsed.ok ? '' : parsed.message);
      assert.ok(parsed.schema.questions.every((q) => q.kind === 'single' && q.options?.length === 4));
    });

    it('rejects a raw image URL, listing the allowed reference kinds', () => {
      const parsed = parseAskSchema({ questions: [{ id: 'look', text: 'Which?', options: [{ id: 'a', label: 'A', imageRef: 'https://example.com/a.png' }] }] });
      assert.ok(!parsed.ok);
      assert.match(parsed.message, /designSystem:<id>, example:<skillId>, artifact:<entryPath>, checkRun:<entryPath>/);
      assert.ok(!parseAskSchema({ questions: [{ id: 'look', text: 'Which?', options: [{ id: 'a', label: 'A', imageRef: 'example:data:text/html,<b>' }] }] }).ok);
    });

    it('reads image references, with an optional check run id', () => {
      assert.deepStrictEqual(parseAskImageRef('designSystem:stripe'), { kind: 'designSystem', value: 'stripe' });
      assert.deepStrictEqual(parseAskImageRef('checkRun:.open-design/a/a.html#2026-10-24T10-00-00'), { kind: 'checkRun', value: '.open-design/a/a.html', runId: '2026-10-24T10-00-00' });
      assert.deepStrictEqual(parseAskImageRef('checkRun:.open-design/a/a.html'), { kind: 'checkRun', value: '.open-design/a/a.html' });
      assert.strictEqual(typeof parseAskImageRef('picture:x'), 'string');
    });

    it('holds to four questions, eight options, 120-character labels and 2 KB', () => {
      const q = (id: string) => ({ id, text: 'Q?', options: options(2) });
      assert.match((parseAskSchema({ questions: ['a', 'b', 'c', 'd', 'e'].map(q) }) as { message: string }).message, /at most 4/);
      assert.match((parseAskSchema({ questions: [{ id: 'a', text: 'Q?', options: options(9) }] }) as { message: string }).message, /at most 8/);
      assert.match((parseAskSchema({ questions: [{ id: 'a', text: 'Q?', options: [{ id: 'x', label: 'x'.repeat(121) }] }] }) as { message: string }).message, /1–120/);
      const big = { questions: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: 'Q'.repeat(150), options: options(8).map((o) => ({ ...o, label: 'L'.repeat(100) })) })) };
      assert.match((parseAskSchema(big) as { message: string }).message, new RegExp(`under ${ASK_MAX_BYTES}`));
    });

    it('rejects duplicate ids, the reserved "you-pick" id, unknown defaults and options on a text question', () => {
      assert.ok(!parseAskSchema({ questions: [{ id: 'a', text: 'Q?', options: options(1) }, { id: 'a', text: 'Q?', options: options(1) }] }).ok);
      assert.ok(!parseAskSchema({ questions: [{ id: 'a', text: 'Q?', options: [{ id: 'you-pick', label: 'Me' }] }] }).ok);
      assert.ok(!parseAskSchema({ questions: [{ id: 'a', text: 'Q?', options: options(2), default: 'nope' }] }).ok);
      assert.ok(!parseAskSchema({ questions: [{ id: 'a', text: 'Q?', kind: 'text', options: options(2) }] }).ok);
      assert.ok(!parseAskSchema({ questions: [{ id: 'a', text: 'Q?', kind: 'multi' }] }).ok);
      assert.ok(parseAskSchema({ questions: [{ id: 'a', text: 'Q?', kind: 'multi', options: options(2), default: ['o1'] }] }).ok);
    });
  });

  describe('the answer message', () => {
    it('has a readable id = label line and a machine line that read back the same', () => {
      const answers = { where: 'printed', mood: ['dark', 'bold'], words: 'Open late' };
      const message = askAnswersMessage(POSTER, answers);
      assert.strictEqual(message.split('\n')[0], 'Answers: where = Printed; mood = Dark, Bold; words = Open late');
      assert.deepStrictEqual(parseAskAnswersMessage(message), answers);
    });

    it('says "You pick" and leaves unanswered questions out', () => {
      const message = askAnswersMessage(POSTER, { where: 'you-pick', mood: [] });
      assert.match(message, /^Answers: where = You pick\n/);
      assert.deepStrictEqual(parseAskAnswersMessage(message), { where: 'you-pick' });
    });

    it("can't be broken out of by a typed answer", () => {
      const message = askAnswersMessage(POSTER, { words: 'a --> <script>x</script> -- b' });
      const machine = message.split('\n')[1];
      assert.strictEqual(machine.indexOf('-->'), machine.length - 3, 'the comment closes only at the end');
      assert.ok(!machine.includes('<script'));
      assert.deepStrictEqual(parseAskAnswersMessage(message), { words: 'a --> <script>x</script> -- b' });
    });

    it('still reads when a host strips the comment', () => {
      assert.deepStrictEqual(parseAskAnswersMessage('Answers: where = Printed; mood = Dark'), { where: 'Printed', mood: 'Dark' });
    });
  });

  it('a host without MCP Apps gets one numbered message to ask', () => {
    const text = askFallbackText(POSTER);
    assert.match(text, /Ask the user these in one message:/);
    assert.match(text, /1\. Where will it be used\?: Printed \/ On screen \/ You pick/);
    assert.match(text, /2\. Which moods\? \(pick any\)/);
    assert.match(text, /3\. Any words it must say\? \(a short answer\)/);
  });

  it('feedback chips name the artifact and the next step', () => {
    assert.match(feedbackChipMessage('a.html', 'good'), /"a\.html" looks good/);
    assert.match(feedbackChipMessage('a.html', 'change'), /Ask me what to change/);
    assert.match(feedbackChipMessage('a.html', 'another'), /show_open_design_questions/);
  });

  it('an artifact picture is its latest check screenshot, else its page; a check run has no page fallback', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-ask-'));
    const entryPath = '.open-design/poster/poster.html';
    await fs.mkdir(path.join(root, path.dirname(entryPath)), { recursive: true });
    await fs.writeFile(path.join(root, entryPath), '<!doctype html><html><body><h1>Poster</h1></body></html>');
    await writeArtifactManifest({ workspaceRoot: root, entryPath, artifactManifest: { kind: 'html', renderer: 'html', exports: ['html'], title: 'Poster' } });
    const base = { workspaceRoot: root, outputDir: '.open-design', entryPath };
    const page = await buildArtifactAskImage({ ...base, imageRef: `artifact:${entryPath}`, pageFallback: true });
    assert.match(page.html ?? '', /Poster/);
    const none = await buildArtifactAskImage({ ...base, imageRef: `checkRun:${entryPath}`, pageFallback: false });
    assert.ok(!none.html && !none.image && /No check run/.test(none.fallback ?? ''));
    const jpg = Buffer.from('/9j/4AAQSkZJRg==', 'base64');
    await saveCheckRun(root, '.open-design', entryPath, { mode: 'quick', findings: [], images: [{ label: 'desktop', data: jpg, width: 1, height: 1 }] });
    const shot = await buildArtifactAskImage({ ...base, imageRef: `artifact:${entryPath}`, pageFallback: true });
    assert.match(shot.image ?? '', /^data:image\/jpeg;base64,/);
    const missing = await buildArtifactAskImage({ ...base, entryPath: 'nope.html', imageRef: 'artifact:nope.html', pageFallback: true });
    assert.match(missing.fallback ?? '', /No artifact/);
  });
});
