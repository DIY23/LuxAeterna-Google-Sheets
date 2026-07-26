# Lux Aeterna — TSV Exporter for Google Sheets

A small Google Apps Script that adds a **Lux Aeterna** menu to a Google
Sheet's toolbar, letting you export the active tab (or every tab at once)
as `.tsv` files, downloaded straight to your browser's default download
folder. No add-on install, no external server — just paste the script
into the Sheet's own Apps Script project.

## Features

- Export the active tab, or all tabs in one click.
- Exports a configurable range per tab, so you can keep labels/notes
  outside the exported area (default: skips row 1 and column A).
- Blank cells in the default (cue) export range — including unselected
  dropdown/validation cells — are filled with `NULL` instead of being
  left empty.
- Special-cases a tab named `DURATIONS` with its own range, dynamic row
  count, and a fixed output filename (`durations.tsv`). Blanks in this
  export are left as-is, not filled with `NULL`.
- Blocks specific tabs (e.g. `MOVIES`) from ever being exported.
- Batch export downloads one `.tsv` per tab, staggered slightly so
  Chrome doesn't block multiple simultaneous downloads.

## Install

1. Open the Google Sheet you want to export from.
2. Go to **Extensions → Apps Script**.
3. Delete any boilerplate code in `Code.gs` and paste in the full
   contents of [`LuxAeterna_tsv_exporter.gs`](./LuxAeterna_tsv_exporter.gs).
4. Save the project (**Ctrl+S** / **Cmd+S**).
5. In the function dropdown at the top, select `onOpen`, then click
   **Run**. The first run will prompt you to authorize the script
   (Sheets access) — click **Review permissions → Advanced → Go to
   [project name] (unsafe) → Allow**. This warning is normal for
   personal/unpublished scripts and isn't a sign anything is wrong.
6. Reload the Google Sheet. A **Lux Aeterna** menu will now appear in
   the toolbar.

> This is a **container-bound script** — it only exists inside the Sheet
> you pasted it into. To use it in another Sheet, either repeat the
> install steps there, or keep one Sheet as a template and duplicate it
> going forward (**File → Make a copy**).

## Usage

From the **Lux Aeterna** menu:

- **Download active tab as TSV** — exports just the currently open tab.
- **Download all tabs as TSV** — exports every tab in the spreadsheet,
  one file per tab.

Files are named `lxae_<tab name>.tsv` by default, `durations.tsv` for
the `DURATIONS` tab, and blocked tabs (e.g. `MOVIES`) are skipped
entirely — with an on-screen notice if you try to export one directly.

## Configuration

All behavior is controlled by constants at the top of
`LuxAeterna_tsv_exporter.gs`:

| Constant | Purpose |
|---|---|
| `EXPORT_START_ROW`, `EXPORT_START_COL` | Top-left corner of the default export range (1-indexed). |
| `EXPORT_ROWS`, `EXPORT_COLS` | Size of the default export range. |
| `BLANK_FILL_VALUE` | String used to fill blank cells in the default export range (default: `"NULL"`). Cells already containing this value are left untouched. |
| `DURATIONS_SHEET_NAME` | Tab name that triggers the special-case range/filename. |
| `DURATIONS_START_ROW`, `DURATIONS_START_COL`, `DURATIONS_COLS` | Range used for that tab (row count is automatic, down to the last row with data). |
| `BLOCKED_SHEET_NAMES` | Array of tab names that are never exported. |
| `FILENAME_PREFIX` | Prefix applied to standard export filenames. |

Edit these values directly in the script and save to change behavior —
no other code changes needed.

## Notes & limitations

- Apps Script has no access to your local filesystem — it triggers a
  standard browser download, which always lands in your browser's
  default Downloads location. There's no way to choose a destination
  folder from the script itself.
- Tab name matches (`DURATIONS`, `MOVIES`, etc.) are case-sensitive and
  exact.
- Very large batch exports (dozens+ of tabs) may trigger a one-time
  browser prompt asking to allow multiple downloads from the same
  site — this is expected and only needs to be approved once.

## Credits

Developed by Tom Vincke ([@DIY23](https://github.com/DIY23)), with
development assistance from Claude Sonnet 5 (Anthropic).

## License

[MIT](./LICENSE)
