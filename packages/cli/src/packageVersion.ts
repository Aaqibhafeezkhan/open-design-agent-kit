import { readFileSync } from 'node:fs';
import * as path from 'node:path';

/**
 * This CLI's own version, read from its package.json: one level up from both
 * src/ (tests) and the bundled out/index.js.
 */
export function cliVersion(): string {
  return (JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as { version: string }).version;
}

/**
 * `init` pins the packages it registers to its own version, so the server and
 * preview a project runs match the skills it wrote, and a prerelease `init`
 * (`@next`) doesn't pair its skills with the stable server.
 */
export function pinned(packageName: string, version = cliVersion()): string {
  return `${packageName}@${version}`;
}
