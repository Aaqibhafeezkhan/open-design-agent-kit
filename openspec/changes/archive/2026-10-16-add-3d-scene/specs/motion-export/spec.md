## MODIFIED Requirements

### Requirement: Duration Resolution
Without `duration`, the system SHALL use the sum of `data-duration` values on frame elements, else `window.odScene.duration` when it is a positive number (a 3D camera path), else the longest finite CSS or Web animation end time, else 6 seconds when only infinite animations exist, capped at 60 seconds, and SHALL say which rule was used.

#### Scenario: HyperFrames-style storyboard
- **WHEN** a page has eight frames with `data-duration` totalling 30000 ms
- **THEN** the export SHALL be 30 seconds long and report that the duration came from `data-duration`

#### Scenario: 3D camera path
- **WHEN** a 3D scene sets `window.odScene.duration = 12` and is exported as MP4 without `duration`
- **THEN** the export SHALL be 12 seconds long and report that the duration came from the 3D scene
