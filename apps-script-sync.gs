/**
 * Garden Grow Petty Cash — Live Sync receiver.
 *
 * SETUP (one time):
 * 1. Go to sheets.google.com, create a new blank spreadsheet.
 *    Name it something like "Garden Grow Petty Cash — Live".
 * 2. In the menu: Extensions -> Apps Script.
 * 3. Delete anything in the editor and paste this whole file in.
 * 4. Click Deploy (top right) -> New deployment.
 *    - Click the gear icon next to "Select type" -> choose "Web app".
 *    - Description: anything, e.g. "Petty cash sync".
 *    - Execute as: Me.
 *    - Who has access: Anyone.
 *    - Click Deploy.
 * 5. It will ask you to authorize — click through the Google warning
 *    screens (Advanced -> Go to project (unsafe) is expected here,
 *    since this is your own unpublished script, not a public app).
 * 6. Copy the "Web app URL" it gives you (ends in /exec).
 * 7. Send that URL back — it gets pasted into one line of the app's
 *    code (SYNC_URL), then every driver's phone syncs to this sheet
 *    automatically, with nothing for them to do.
 *
 * If you ever change the script, you must create a "New deployment"
 * again (not just save) for the change to take effect on the live URL,
 * OR use "Manage deployments" -> edit -> New version on the same URL.
 */

const SHEET_NAME = 'Transactions';
const HEADERS = [
  'ID', 'Synced At', 'Driver', 'Type', 'Date', 'Time', 'Category',
  'Description', 'Amount', 'Company Amount', 'Me Amount', 'Paid By',
  'Supplier', 'Site', 'Receipt No', 'Vehicle', 'Remarks', 'Given By',
  'Has Photo'
];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const records = body.records || [];
    const sheet = getOrCreateSheet_();
    const existingIds = getExistingIds_(sheet);

    const rows = [];
    records.forEach(function (r) {
      if (existingIds.has(r.id)) return; // already synced earlier — skip duplicate
      rows.push([
        r.id || '',
        new Date(),
        r.driver || '',
        r.type || '',
        r.date || '',
        r.time || '',
        r.category || '',
        r.note || '',
        r.amount || 0,
        r.companyAmount || '',
        r.meAmount || '',
        r.payMode ? String(r.payMode).toUpperCase() : '',
        r.supplier || '',
        r.site || '',
        r.receiptNo || '',
        r.vehicle || '',
        r.remarks || '',
        r.givenBy || '',
        r.photo ? 'Y' : ''
      ]);
    });

    if (rows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
    }

    return jsonResponse_({ ok: true, added: rows.length });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  // Also returns every synced record, so any phone can pull down what the
  // OTHER phone has pushed up and show a combined view in its own app UI
  // (not just in the spreadsheet). Visiting the URL in a browser still shows
  // this same JSON — that's the expected "health check" look.
  try {
    const sheet = getOrCreateSheet_();
    const lastRow = sheet.getLastRow();
    const records = [];
    if (lastRow >= 2) {
      const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
      values.forEach(function (row) {
        if (!row[0]) return; // skip blank rows
        records.push({
          id: row[0],
          driver: row[2],
          type: row[3],
          date: row[4],
          time: row[5],
          category: row[6],
          note: row[7],
          amount: row[8],
          companyAmount: row[9],
          meAmount: row[10],
          payMode: row[11] ? String(row[11]).toLowerCase() : '',
          supplier: row[12],
          site: row[13],
          receiptNo: row[14],
          vehicle: row[15],
          remarks: row[16],
          givenBy: row[17]
          // Photos are NOT synced (only a Y/N flag is stored), so a record
          // pulled from the cloud never carries photo image data.
        });
      });
    }
    return jsonResponse_({ ok: true, message: 'Garden Grow Petty Cash sync endpoint is live.', records: records });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getExistingIds_(sheet) {
  const lastRow = sheet.getLastRow();
  const ids = new Set();
  if (lastRow < 2) return ids;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  values.forEach(function (row) { if (row[0]) ids.add(String(row[0])); });
  return ids;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
