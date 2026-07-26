/**
 * LUX AETERNA — TSV EXPORTER FOR GOOGLE SHEETS
 * ------------------------------------------------
 * Adds a "Lux Aeterna" menu to the toolbar to export the active tab
 * (or all tabs) as .tsv files, downloaded straight to the browser.
 *
 * Setup: Extensions -> Apps Script -> paste this file -> Save ->
 * run `onOpen` once to authorize -> reload the Sheet.
 *
 * Version: 1.0.2
 * Date:    2026-07-26
 * Author:  Tom Vincke (github.com/DIY23)
 * Developed with assistance from Claude (Anthropic).
 * License: MIT
 */

// ------------------------------------------------------------
// CONFIG — tweak these to change what gets exported and how
// ------------------------------------------------------------

// Default range applied to every tab EXCEPT the special cases below.
// Row/column indices are 1-based (1 = row/column A).
const EXPORT_START_ROW = 2;  // skip row 1 (left free for labels/notes)
const EXPORT_START_COL = 2;  // skip column A (left free for labels/notes)
const EXPORT_ROWS = 8;       // number of rows to export from the start row
const EXPORT_COLS = 7;       // number of columns to export from the start col

// Blank cells in the default (cue) range are exported as this string
// instead of being left empty. This covers both truly empty cells and
// dropdown/validation cells left unselected. If a cell already contains
// this exact string, it's left untouched.
const BLANK_FILL_VALUE = "NULL";

// Special case: a tab with this exact name gets its own range/filename.
const DURATIONS_SHEET_NAME = "DURATIONS";
const DURATIONS_START_ROW = 2;   // skip row 1
const DURATIONS_START_COL = 1;   // start at column A (no column skipped)
const DURATIONS_COLS = 2;        // only export the first 2 columns
// Row count is determined dynamically, based on column A (see below).
// Note: blank cells in the DURATIONS export are NOT filled with
// BLANK_FILL_VALUE — only the default (cue) range gets that treatment.

// Special case: tabs with these exact names are never exported.
const BLOCKED_SHEET_NAMES = ["MOVIES", "MOVIES - Helper list", "EMPTY CUE"];

// Prefix applied to all filenames except the DURATIONS special case.
const FILENAME_PREFIX = "lxae_";


// ------------------------------------------------------------
// MENU SETUP — runs automatically whenever the Sheet is opened
// ------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Lux Aeterna')
    .addItem('Download active tab as TSV', 'exportActiveSheetAsTsvLocal')
    .addItem('Download all tabs as TSV', 'exportAllSheetsAsTsvLocal')
    .addToUi();
}


// ------------------------------------------------------------
// CORE HELPERS
// ------------------------------------------------------------

/**
 * Reads a specific range from a sheet and converts it to a TSV string.
 * Tabs and newlines inside cell values are replaced with spaces so they
 * can't corrupt the TSV structure.
 *
 * If fillBlanks is true, any cell that's empty (or whitespace-only —
 * covers both truly blank cells and unselected dropdown/validation
 * cells) is replaced with BLANK_FILL_VALUE. Cells that already contain
 * BLANK_FILL_VALUE are left untouched.
 */
function sheetToTsv_(sheet, startRow, startCol, numRows, numCols, fillBlanks) {
  const range = sheet.getRange(startRow, startCol, numRows, numCols);
  const data = range.getValues();

  return data.map(row =>
    row.map(cell => {
      let val = (cell === null || cell === undefined) ? "" : String(cell);
      val = val.replace(/\t/g, " ").replace(/\r?\n/g, " ");

      if (fillBlanks && val.trim() === "") {
        return BLANK_FILL_VALUE;
      }
      return val;
    }).join("\t")
  ).join("\n");
}

/**
 * Finds the number of rows in the DURATIONS tab that actually contain
 * data, based on column A. getLastRow() isn't reliable for this tab
 * because other columns hold a formula that returns "" instead of a
 * truly empty cell — Sheets still counts those rows as non-blank.
 * Column A has no such formula, so it's used as the source of truth.
 *
 * Returns the number of rows to export, starting from DURATIONS_START_ROW
 * (minimum of 1, to avoid a zero/negative range if the tab is empty).
 */
function findDurationsRowCount_(sheet) {
  const numRowsToCheck = sheet.getMaxRows() - DURATIONS_START_ROW + 1;
  const colAValues = sheet
    .getRange(DURATIONS_START_ROW, DURATIONS_START_COL, numRowsToCheck, 1)
    .getValues();

  let lastRealRow = 0;
  for (let i = colAValues.length - 1; i >= 0; i--) {
    if (String(colAValues[i][0]).trim() !== "") {
      lastRealRow = i + 1; // convert 0-based loop index to a 1-based row count
      break;
    }
  }

  return Math.max(lastRealRow, 1);
}

/**
 * Decides how a given sheet should be exported: which range to use and
 * what the output filename should be. Centralizes all the per-sheet
 * naming logic in one place so both export functions stay in sync.
 *
 * Returns:
 *   - { tsv, fileName } for exportable sheets
 *   - null for sheets that should be skipped (e.g. a blocked tab)
 */
function exportForSheet_(sheet) {
  const name = sheet.getName();

  // Blocked tab: never export this one.
  if (BLOCKED_SHEET_NAMES.includes(name)) {
    return null;
  }

  // Special case: DURATIONS tab uses its own range and filename.
  // Blanks are NOT filled with BLANK_FILL_VALUE here.
  if (name === DURATIONS_SHEET_NAME) {
    const numRows = findDurationsRowCount_(sheet);
    const tsv = sheetToTsv_(sheet, DURATIONS_START_ROW, DURATIONS_START_COL, numRows, DURATIONS_COLS, false);
    return { tsv, fileName: "durations.tsv" };
  }

  // Default case (cue tabs): standard range, prefixed filename, and
  // blank cells filled with BLANK_FILL_VALUE.
  const tsv = sheetToTsv_(sheet, EXPORT_START_ROW, EXPORT_START_COL, EXPORT_ROWS, EXPORT_COLS, true);
  return { tsv, fileName: `${FILENAME_PREFIX}${name}.tsv` };
}

/**
 * Builds a tiny, invisible HTML dialog that auto-triggers a browser
 * download for the given data URL, then closes itself. This is the
 * only way Apps Script can push a file to the user's local machine —
 * it has no direct filesystem access outside of Google Drive.
 */
function triggerDownloadDialog_(dataUrl, fileName, closeDelayMs) {
  const html = HtmlService.createHtmlOutput(`
    <html><body>
      <a id="dl" href="${dataUrl}" download="${fileName}"></a>
      <script>
        document.getElementById('dl').click();
        setTimeout(function() { google.script.host.close(); }, ${closeDelayMs});
      </script>
    </body></html>
  `).setWidth(1).setHeight(1);

  SpreadsheetApp.getUi().showModalDialog(html, 'Downloading...');
}


// ------------------------------------------------------------
// EXPORT: ACTIVE TAB ONLY
// ------------------------------------------------------------
function exportActiveSheetAsTsvLocal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();

  const result = exportForSheet_(sheet);

  // Blocked tab: inform the user instead of exporting.
  if (result === null) {
    SpreadsheetApp.getUi().alert(
      `The "${sheet.getName()}" tab can't be exported.`
    );
    return;
  }

  const { tsv, fileName } = result;
  const base64Data = Utilities.base64Encode(tsv, Utilities.Charset.UTF_8);
  const dataUrl = `data:text/tab-separated-values;base64,${base64Data}`;

  triggerDownloadDialog_(dataUrl, fileName, 300);
}


// ------------------------------------------------------------
// EXPORT: ALL TABS AT ONCE
// ------------------------------------------------------------
function exportAllSheetsAsTsvLocal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = ss.getSheets();

  // Silently skip any blocked tab(s) — exportForSheet_ returns null for those.
  const exportable = allSheets
    .map(sheet => ({ sheet, result: exportForSheet_(sheet) }))
    .filter(entry => entry.result !== null);

  // One hidden <a download> link per tab, each with its own base64 data URL.
  const links = exportable.map((entry, i) => {
    const { tsv, fileName } = entry.result;
    const base64Data = Utilities.base64Encode(tsv, Utilities.Charset.UTF_8);
    const dataUrl = `data:text/tab-separated-values;base64,${base64Data}`;
    return `<a id="dl${i}" href="${dataUrl}" download="${fileName}"></a>`;
  }).join("\n");

  // Click each link with a staggered delay so the browser treats them as
  // separate user-triggered downloads instead of one big burst (which
  // Chrome and other browsers may block).
  const clicks = exportable.map((entry, i) =>
    `setTimeout(function() { document.getElementById('dl${i}').click(); }, ${i * 400});`
  ).join("\n");

  const totalDelay = exportable.length * 400 + 300;

  const html = HtmlService.createHtmlOutput(`
    <html><body>
      ${links}
      <script>
        ${clicks}
        setTimeout(function() { google.script.host.close(); }, ${totalDelay});
      </script>
    </body></html>
  `).setWidth(1).setHeight(1);

  SpreadsheetApp.getUi().showModalDialog(html, 'Downloading...');
}
