# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-07-25

### Added
- Initial public release.
- Menu-driven export of the active tab as a `.tsv` file.
- Batch export of all tabs as individual `.tsv` files, staggered to
  avoid browser multi-download blocking.
- Configurable export range (start row/column, row/column count),
  defaulting to skipping row 1 and column A for labels/notes.
- Special-case handling for a `DURATIONS` tab: dedicated range
  (columns A–B, skipping row 1, dynamic row count) and fixed output
  filename (`durations.tsv`).
- Configurable list of blocked tab names (e.g. `MOVIES`) that are
  excluded from batch export and rejected with an on-screen message
  if exported directly.
- Configurable filename prefix for standard exports.
