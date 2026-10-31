import * as assert from 'node:assert';
import * as path from 'node:path';
import { LAUNCH_PORT_BASE, launchPortFor, npxBesideNode, openDesignLaunchEntry } from '../../setup/claudeLaunch';

describe('Claude Desktop launch entry', () => {
  it('gives each project a stable port in 5317–5416', () => {
    const a = launchPortFor('/Users/sam/projects/cafe');
    const b = launchPortFor('/Users/sam/projects/shop');
    assert.strictEqual(launchPortFor('/Users/sam/projects/cafe'), a);
    for (const p of [a, b]) assert.ok(p >= LAUNCH_PORT_BASE && p < LAUNCH_PORT_BASE + 100, String(p));
    assert.notStrictEqual(a, b);
  });

  it('uses the npx beside the running Node when there is one', () => {
    const node = path.join('/home/sam/.nvm/versions/node/v22.11.0/bin', 'node');
    assert.strictEqual(npxBesideNode(node, () => true, 'linux'), path.join(path.dirname(node), 'npx'));
    assert.strictEqual(npxBesideNode(node, () => false, 'linux'), 'npx');
    assert.strictEqual(npxBesideNode('C:\\Program Files\\nodejs\\node.exe', () => true, 'win32'), path.join(path.dirname('C:\\Program Files\\nodejs\\node.exe'), 'npx.cmd'));
  });

  it('pins the CLI version and starts the preview on the newest design at the project port', () => {
    const entry = openDesignLaunchEntry({ workspaceRoot: '/w', version: '1.2.3', npx: 'npx' });
    assert.deepStrictEqual(entry, {
      name: 'open-design-preview',
      runtimeExecutable: 'npx',
      runtimeArgs: ['-y', '@feimacode/open-design-agent-kit@1.2.3', 'preview', '--no-open', '--root-latest', '--port', String(launchPortFor('/w'))],
      port: launchPortFor('/w'),
    });
  });
});
