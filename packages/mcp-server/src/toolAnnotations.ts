import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

// MCP tool annotations for every tool (openspec inline-preview-in-place, "Tool
// Annotations"): hints a host uses to decide how much to ask before a call.
// Every listed tool must have an entry; a unit test checks it.

/** Only reads, or returns text such as instructions: changes nothing. */
const READS: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
/** Reads, and looks things up outside this machine. */
const READS_ONLINE: ToolAnnotations = { readOnlyHint: true, openWorldHint: true };
/** Writes in the workspace (or the session's settings), adding or updating its own files. */
const WRITES: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
/** Writes in the workspace and may replace a file's content. */
const OVERWRITES: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
/** Writes, and reaches a service outside this machine (a website, a host, Figma, Canva, a shop). */
const WRITES_ONLINE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };

export const TOOL_ANNOTATIONS: Record<string, ToolAnnotations> = {
  list_open_design_skills: READS,
  list_open_design_design_systems: READS,
  recommend_open_design_design_systems: READS,
  prepare_open_design_brief: READS,
  create_open_design_design_system: READS,
  port_open_design_artifact_to_app: READS,
  pull_open_design_figma_frame: READS,
  get_open_design_artifact: READS,
  show_open_design_artifact: READS,
  show_open_design_examples: READS,
  show_open_design_design_systems: READS,
  show_open_design_questions: READS,
  get_open_design_preview_state: READS,
  list_open_design_integrations: READS,
  list_open_design_print_houses: READS,
  find_open_design_3d_assets: READS_ONLINE,

  read_open_design_source: WRITES,
  prepare_open_design_exploration: WRITES,
  compare_open_design_exploration: WRITES,
  choose_open_design_direction: WRITES,
  register_open_design_artifact: WRITES,
  open_open_design_preview: WRITES,
  save_open_design_comment: WRITES,
  set_active_design_system: WRITES,
  prepare_open_design_component_library: WRITES,
  remix_open_design_example: WRITES,
  export_open_design_artifact: WRITES,
  add_open_design_diagram_runtime: WRITES,
  check_open_design_artifact: WRITES,
  adapt_open_design_artifact: WRITES,
  create_open_design_qr_code: WRITES,
  start_open_design_job_run: WRITES,
  finish_open_design_job_run: WRITES,
  set_open_design_workspace: WRITES,
  use_open_design_managed_workspace: WRITES,
  set_up_open_design_browser_pane: WRITES,

  write_open_design_file: OVERWRITES,

  extract_open_design_design_system: WRITES_ONLINE,
  publish_open_design_artifact: WRITES_ONLINE,
  publish_open_design_artifact_to_canva: WRITES_ONLINE,
  publish_open_design_artifact_to_shop: WRITES_ONLINE,
  push_open_design_artifact_to_figma: WRITES_ONLINE,
  restore_open_design_artifact: { ...WRITES_ONLINE, destructiveHint: true },
};
