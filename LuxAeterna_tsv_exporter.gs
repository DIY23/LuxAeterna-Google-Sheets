/**
 * LUX AETERNA — TSV EXPORTER FOR GOOGLE SHEETS
 * ------------------------------------------------
 * Adds a "Lux Aeterna" menu to the toolbar to export the active tab
 * (or all tabs) as .tsv files, downloaded straight to the browser.
 *
 * Setup: Extensions -> Apps Script -> paste this file -> Save ->
 * run `onOpen` once to authorize -> reload the Sheet.
 *
 * Version: 1.0.0
 * Date:    2026-07-25
 * Author:  Tom Vincke (github.com/DIY23)
 * Developed with assistance from Claude Sonnet 5 (Anthropic).
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
const EXPORT_COLS = 8;       // number of columns to export from the start col

// Special case: a tab with this exact name gets its own range/filename.
const DURATIONS_SHEET_NAME = "DURATIONS";
const DURATIONS_START_ROW = 2;   // skip row 1
const DURATIONS_START_COL = 1;   // start at column A (no column skipped)
const DURATIONS_COLS = 2;        // only export the first 2 columns
// Row count is determined dynamically (down to the last row with data).

// Special case: tabs with these exact names are never exported.
const BLOCKED_SHEET_NAMES = ["MOVIES"];

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
 */
function sheetToTsv_(sheet, startRow, startCol, numRows, numCols) {
  const range = sheet.getRange(startRow, startCol, numRows, numCols);
  const data = range.getValues();

  return data.map(row =>
    row.map(cell => {
      let val = (cell === null || cell === undefined) ? "" : String(cell);
      return val.replace(/\t/g, " ").replace(/\r?\n/g, " ");
    }).join("\t")
  ).join("\n");
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
  if (name === DURATIONS_SHEET_NAME) {
    const lastRow = sheet.getLastRow();
    // Export down to the last row with data, minimum of 1 row.
    const numRows = Math.max(lastRow - DURATIONS_START_ROW + 1, 1);
    const tsv = sheetToTsv_(sheet, DURATIONS_START_ROW, DURATIONS_START_COL, numRows, DURATIONS_COLS);
    return { tsv, fileName: "durations.tsv" };
  }

  // Default case: standard range and prefixed filename.
  const tsv = sheetToTsv_(sheet, EXPORT_START_ROW, EXPORT_START_COL, EXPORT_ROWS, EXPORT_COLS);
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
