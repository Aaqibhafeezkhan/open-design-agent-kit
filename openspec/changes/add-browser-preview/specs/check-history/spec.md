## ADDED Requirements

### Requirement: Saved Check Runs
Every `check_open_design_artifact` run that renders SHALL save its returned images and a findings summary under `<outputDir>/.checks/<entry-slug>/<timestamp>/`, keep the last 5 runs per entry and delete older ones. It SHALL NOT write under the artifact's own folder or change its manifest. The result text SHALL list the saved image paths and, when an earlier run exists, that run's folder and the change in error and warning counts.

#### Scenario: Second check after a fix
- **WHEN** a page with 2 errors is checked, fixed, and checked again with 0 errors
- **THEN** the second result SHALL list its saved images, name the first run as the previous one, and report errors 2 → 0

#### Scenario: Pruning
- **WHEN** a sixth run of the same entry is saved
- **THEN** only the five newest runs for that entry SHALL remain

### Requirement: Before and After in the Preview
The browser preview SHALL have a Checks panel that lists the open entry's saved runs and shows the selected run's images next to the previous run's images with the same label, with the findings for each. When a check finishes for the open entry while the preview is open in the same process, the panel SHALL show the new run without a manual reload.

#### Scenario: Agent runs a check while the preview is open
- **WHEN** the agent calls `check_open_design_artifact` for the entry shown in the preview
- **THEN** the Checks panel SHALL show the new run beside the previous one

#### Scenario: First run
- **WHEN** only one run exists
- **THEN** the panel SHALL show its images alone and say there is no earlier run
