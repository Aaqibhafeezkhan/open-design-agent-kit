import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  commentsSidecarPath,
  mergeArtifactComments,
  readArtifactComments,
  readCommentCrop,
  resolveArtifactComments,
  writeArtifactComments,
  writeCommentCrop,
  type ArtifactComment,
} from '../../workspace/artifactComments';

async function makeTempWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'od-ext-comments-'));
}

const sampleComment: ArtifactComment = {
  id: 'c1',
  selector: '.hero h1',
  htmlHint: '<h1>Welcome</h1>',
  note: 'Make this bigger',
  status: 'open',
  createdAt: '2026-09-19T00:00:00.000Z',
  updatedAt: '2026-09-19T00:00:00.000Z',
};

describe('artifactComments', () => {
  it('returns an empty array when no sidecar exists yet', async () => {
    const workspaceRoot = await makeTempWorkspace();
    const comments = await readArtifactComments(workspaceRoot, 'page.html');
    assert.deepStrictEqual(comments, []);
  });

  it('writes and reads back comments via the sidecar file', async () => {
    const workspaceRoot = await makeTempWorkspace();
    await writeArtifactComments(workspaceRoot, 'page.html', [sampleComment]);

    const sidecarExists = await fs
      .access(path.join(workspaceRoot, commentsSidecarPath('page.html')))
      .then(() => true)
      .catch(() => false);
    assert.strictEqual(sidecarExists, true);

    const comments = await readArtifactComments(workspaceRoot, 'page.html');
    assert.deepStrictEqual(comments, [sampleComment]);
  });

  it('returns an empty array for a malformed sidecar rather than throwing', async () => {
    const workspaceRoot = await makeTempWorkspace();
    await fs.writeFile(path.join(workspaceRoot, commentsSidecarPath('page.html')), 'not json');
    const comments = await readArtifactComments(workspaceRoot, 'page.html');
    assert.deepStrictEqual(comments, []);
  });

  it('rejects an entryPath that escapes the workspace', async () => {
    const workspaceRoot = await makeTempWorkspace();
    await assert.rejects(readArtifactComments(workspaceRoot, '../outside.html'));
    await assert.rejects(writeArtifactComments(workspaceRoot, '../outside.html', []));
  });

  it('keeps both comments when two writers merge at the same time', async () => {
    const workspaceRoot = await makeTempWorkspace();
    await writeArtifactComments(workspaceRoot, 'page.html', [sampleComment]);
    const a: ArtifactComment = { ...sampleComment, id: 'c-a', note: 'from VS Code', updatedAt: '2026-10-19T00:00:01.000Z' };
    const b: ArtifactComment = { ...sampleComment, id: 'c-b', note: 'from the browser', updatedAt: '2026-10-19T00:00:02.000Z' };
    await Promise.all([mergeArtifactComments(workspaceRoot, 'page.html', [a]), mergeArtifactComments(workspaceRoot, 'page.html', [b])]);
    const ids = (await readArtifactComments(workspaceRoot, 'page.html')).map((c) => c.id).sort();
    assert.deepStrictEqual(ids, ['c-a', 'c-b', 'c1']);
  });

  it('keeps the later updatedAt when the same comment is merged twice', async () => {
    const workspaceRoot = await makeTempWorkspace();
    await writeArtifactComments(workspaceRoot, 'page.html', [{ ...sampleComment, status: 'resolved', updatedAt: '2026-10-19T00:00:05.000Z' }]);
    await mergeArtifactComments(workspaceRoot, 'page.html', [{ ...sampleComment, status: 'sent', updatedAt: '2026-10-19T00:00:01.000Z' }]);
    assert.strictEqual((await readArtifactComments(workspaceRoot, 'page.html'))[0].status, 'resolved');
  });

  it('deletes a comment and its crop', async () => {
    const workspaceRoot = await makeTempWorkspace();
    await writeArtifactComments(workspaceRoot, 'page.html', [sampleComment]);
    assert.strictEqual(await writeCommentCrop(workspaceRoot, 'page.html', 'c1', Buffer.from('png')), 'page.html.comments/c1.png');
    assert.ok(await readCommentCrop(workspaceRoot, 'page.html', 'c1'));
    await mergeArtifactComments(workspaceRoot, 'page.html', [], ['c1']);
    assert.deepStrictEqual(await readArtifactComments(workspaceRoot, 'page.html'), []);
    assert.strictEqual(await readCommentCrop(workspaceRoot, 'page.html', 'c1'), undefined);
  });

  it('rejects a crop id that could leave the crops folder', async () => {
    const workspaceRoot = await makeTempWorkspace();
    await assert.rejects(writeCommentCrop(workspaceRoot, 'page.html', '../x', Buffer.from('png')));
  });

  it('resolves comments by id and reports unknown ids', async () => {
    const workspaceRoot = await makeTempWorkspace();
    await writeArtifactComments(workspaceRoot, 'page.html', [sampleComment]);
    assert.deepStrictEqual(await resolveArtifactComments(workspaceRoot, 'page.html', ['c1', 'nope']), { resolved: ['c1'], unknown: ['nope'] });
    assert.strictEqual((await readArtifactComments(workspaceRoot, 'page.html'))[0].status, 'resolved');
  });
});
