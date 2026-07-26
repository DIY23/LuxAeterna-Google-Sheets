# Changelog

All notable changes to this project will be documented in this file.

## [1.0.2] - 2026-07-26

### Added
- Blank cells in the default cue-tab export range are now filled with
  `"NULL"` instead of being left empty. This covers both truly blank
  cells and dropdown/validation cells left unselected. Cells that
  already contain `"NULL"` are left untouched. `DURATIONS` exports are
  unaffected by this change.

### Changed
- Added `MOVIES - Helper list` to the list of blocked tab names
  (`BLOCKED_SHEET_NAMES`), alongside the existing `MOVIES` and
  `EMPTY CUE` entries.
- Reduced the default cue-tab export range by one column
  (`EXPORT_COLS`: 8 → 7).

## [1.0.1] - 2026-07-26

### Fixed
- `DURATIONS` tab export no longer includes trailing blank rows. Row
  count is now determined by scanning column A for the last non-empty
  cell, instead of relying on `getLastRow()` — which was returning the
  full formula range (up to 666 rows) since other columns contain a
  formula that evaluates to `""` rather than a truly empty cell.
### Changed
- Added `EMPTY CUE` to the list of blocked tab names (`BLOCKED_SHEET_NAMES`).
  This tab is now skipped during batch export and rejected with an
  on-screen message if exported directly, same as `MOVIES`.

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
