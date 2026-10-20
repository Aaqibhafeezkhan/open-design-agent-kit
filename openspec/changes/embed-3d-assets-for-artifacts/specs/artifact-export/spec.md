## ADDED Requirements

### Requirement: Embedded Remote Assets in Standalone Export
The `standalone` export SHALL accept `embedAssets` (default false) and `maxResolution` (default `1k`). With `embedAssets`, it SHALL download every remote asset the page declares (a `3d-scene` page's scene spec `assets`, including each file a glTF model references, or a `3d-object` page's asset comment), embed each as base64 in a single `<script type="application/od-embedded-assets+json">` block keyed by its original URL, and inject an inline runtime that runs before the page's scripts, creates a `blob:` URL for each asset, and maps the original URL to it through three.js's default loading manager URL modifier, with an exact-match `fetch` fallback. Poly Haven assets SHALL be fetched at `maxResolution`. The result SHALL list each embedded asset with its size and the page's total size, SHALL warn from 12 MB and SHALL fail above 16 MB naming the largest assets. An asset that can't be downloaded SHALL be reported and left as its remote URL. The source file SHALL NOT change.

#### Scenario: Courtyard embedded
- **WHEN** the courtyard example is exported with `format: "standalone"` and `embedAssets: true`
- **THEN** the file SHALL render the same scene with no network requests to Poly Haven, and the result SHALL list the HDRI, textures and lantern model with their sizes

#### Scenario: Too large
- **WHEN** the embedded page would exceed 16 MB because the scene uses 4k textures and `maxResolution: "4k"`
- **THEN** the export SHALL fail with the total size and the largest assets named

#### Scenario: Download fails
- **WHEN** one texture URL returns 404
- **THEN** the export SHALL succeed, report that texture as not embedded, and keep its remote URL
