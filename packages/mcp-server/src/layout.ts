// Where designs go in a workspace (openspec desktop-visible-design-folder).
// Classic: everything under the hidden .open-design/ (or OPEN_DESIGN_OUTPUT_DIR),
// as Claude Code, Codex and VS Code expect. Visible: when Claude Desktop names
// the folder (set_open_design_workspace, use_open_design_managed_workspace),
// designs go where people who don't write code will see them, "Open Design/"
// in a connected folder or straight into the managed folder, and exports sit
// beside each design. The settings file and job files stay in .open-design/.
import * as path from 'node:path';
import { holdsRegisteredArtifact } from './managedWorkspace';
import { getOutputDirectory, settingFromEnv } from './env';

export type DesignLayout = 'classic' | 'visible';

/** The visible designs folder inside a connected folder. */
export const VISIBLE_DESIGNS_DIR = 'Open Design';

export interface WorkspaceLayout {
  layout: DesignLayout;
  /** Workspace-relative folder designs, manifests and exports go under ("." for the managed folder). */
  designsDir: string;
}

export function classicLayout(env: NodeJS.ProcessEnv = process.env): WorkspaceLayout {
  return { layout: 'classic', designsDir: settingFromEnv(env.OPEN_DESIGN_OUTPUT_DIR) ? getOutputDirectory() : '.open-design' };
}

/**
 * The layout for a folder Claude Desktop named: classic when OPEN_DESIGN_OUTPUT_DIR is
 * set or the folder's .open-design/ already holds designs, else visible.
 */
export async function desktopLayout(root: string, managed: boolean, env: NodeJS.ProcessEnv = process.env): Promise<WorkspaceLayout> {
  if (settingFromEnv(env.OPEN_DESIGN_OUTPUT_DIR)) return classicLayout(env);
  if (await holdsRegisteredArtifact(path.join(root, '.open-design'))) return { layout: 'classic', designsDir: '.open-design' };
  return { layout: 'visible', designsDir: managed ? '.' : VISIBLE_DESIGNS_DIR };
}
