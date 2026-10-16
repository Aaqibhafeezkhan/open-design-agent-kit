# 3d-asset-sources Specification

## Purpose
CC0 3D assets from Poly Haven: the `find_open_design_3d_assets` tool returns HDRI, texture and model files with direct CDN URLs, polite API use with fail-soft behavior, and the rules for loading found assets (CDN, URL maps for glTF includes, offline copies).
## Requirements

### Requirement: 3D Asset Search Tool
The system SHALL provide `find_open_design_3d_assets`, taking `query` (required), `type` (`hdri`, `texture` or `model`, required), `limit` (1–10, default 5) and `resolution` (`1k` or `2k`, default `1k`), that searches Poly Haven's public API and returns, for each hit, its id, name, categories, dimensions (models), thumbnail URL and the direct CDN file URLs a three.js page needs at that resolution: the `.hdr` for an HDRI; the diffuse, normal (GL), roughness and AO/roughness/metal maps for a texture; the `.gltf` and a map from each relative path the `.gltf` refers to (its `.bin` and textures) to that file's CDN URL, for a model. Every result SHALL state the license (CC0) and the credit line "Powered by Poly Haven (polyhaven.com)". The tool SHALL NOT write files. It SHALL be available in VS Code and over MCP.

#### Scenario: Find a lantern
- **WHEN** the tool is called with `query: "lantern"`, `type: "model"`
- **THEN** it SHALL return up to five models whose names, tags or categories match, each with a `.gltf` URL on `dl.polyhaven.org`, its included files, `CC0`, and the credit line

#### Scenario: No match
- **WHEN** nothing matches the query
- **THEN** the tool SHALL say so and suggest broader terms, without an error

### Requirement: Polite API Use
Requests to `api.polyhaven.com` SHALL send a User-Agent naming the kit and its repository, SHALL time out after 10 seconds, and SHALL fetch the asset list for a type at most once per process (cached), plus one file listing per returned hit.

#### Scenario: Two searches
- **WHEN** two model searches run in the same session
- **THEN** the model list SHALL be fetched once

### Requirement: Fail Soft
When the API is unreachable or returns something unexpected, the tool SHALL return a short error naming the problem and telling the agent to fall back to procedural materials and `RoomEnvironment`; it SHALL NOT throw.

#### Scenario: Offline
- **WHEN** the network is down
- **THEN** the tool SHALL return the fallback advice as text

### Requirement: Using Found Assets
The `3d-scene` and `3d-object` skills SHALL direct the agent to load found assets from their CDN URLs (HDRIs through `RGBELoader` and `PMREMGenerator`, textures with sRGB color space for diffuse maps, models through `GLTFLoader` with a `LoadingManager` URL modifier that maps each included relative path to its CDN URL, measured and rescaled to their layout size), to record each in the scene spec's `assets` (or a comment, for `3d-object`), and, for offline use, to download the files into `assets/` keeping the glTF folder layout and point the page at the local copies.

#### Scenario: Offline copy
- **WHEN** the user asks for a design that works without a connection
- **THEN** the agent SHALL download the asset files into `assets/` and load them from there
