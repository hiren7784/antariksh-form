/**
 * Antariksh Design Studio – Client form receiver (Google Apps Script)
 *
 * What it does
 *   The client form website (https://hiren7784.github.io/antariksh-form/) sends each
 *   filled form here. This script runs as YOU (the studio account), so:
 *     - one row per client is added to the "Client_Responses" tab of this Google Sheet;
 *     - the client's PDF is saved in the Drive folder "Antariksh – Client Forms (PDF)";
 *     - you get an email for every new form.
 *   Clients never get access to this Sheet or the Drive folder.
 *
 * One-time setup (on a computer)
 *   1. Create a new Google Sheet named "Antariksh – Client Forms".
 *   2. Extensions > Apps Script. Delete the sample code, paste this whole file, Save.
 *   3. Pick "setup" in the function list at the top and press Run. Allow access
 *      (Advanced > Go to project > Allow – it is your own script).
 *   4. Deploy > New deployment > type "Web app":
 *        Execute as: Me      Who has access: Anyone
 *      Press Deploy and copy the "Web app URL" (ends with /exec).
 *   5. Send that URL to Claude, who puts it in the website.
 *
 * If you change this code later: Deploy > Manage deployments > Edit (pencil) >
 * Version: New version > Deploy. The URL stays the same.
 */

const SHEET_NAME = 'Client_Responses';
const FOLDER_NAME = 'Antariksh – Client Forms (PDF)';
const NOTIFY = true;          // email the studio for every new form
const NOTIFY_EMAIL = '';      // leave blank to use this Google account's email
const FORM_ID = 'antariksh-client-v1';
const TZ = 'Asia/Kolkata';

const HEADERS = [
  'Received', 'Reference', 'Name', 'Mobile', 'Email', 'Site type', 'BHK / floors',
  'Carpet area (sq ft)', 'Site address', 'Budget', 'Move-in', 'Supervision', 'PDF', 'All answers'
];

function setup() {
  const sh = getSheet_();
  const folder = getFolder_();
  Logger.log('Sheet tab ready: ' + sh.getName());
  Logger.log('PDF folder ready: ' + folder.getUrl());
  if (NOTIFY) Logger.log('New-form emails go to: ' + notifyTo_());
  Logger.log('Next: Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).');
}

/** Open the Web app URL in a browser to check that it is running. */
function doGet() {
  return ContentService.createTextOutput('Antariksh client form receiver is running.');
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Empty request');
    if (e.postData.contents.length > 20 * 1024 * 1024) throw new Error('Request too large');
    const data = JSON.parse(e.postData.contents);
    if (!data || data.form !== FORM_ID) throw new Error('Unknown form');
    if (data.website) return json_({ ok: true, ref: 'IGNORED' });   // spam trap field

    const a = data.answers || {};
    if (!String(a.name || '').trim() || String(a.phone || '').replace(/\D/g, '').length < 10) {
      throw new Error('Name and mobile number are required');
    }

    const now = new Date();
    const ref = 'ADS-CF-' + Utilities.formatDate(now, TZ, 'yyMMdd-HHmmss');

    let pdfUrl = '';
    if (data.pdf) {
      const bytes = Utilities.base64Decode(String(data.pdf));
      if (bytes.length > 15 * 1024 * 1024) throw new Error('PDF too large');
      const name = ref + ' ' + safeName_(a.name) + '.pdf';
      const file = getFolder_().createFile(Utilities.newBlob(bytes, 'application/pdf', name));
      pdfUrl = file.getUrl();
    }

    const size = [a.bhk, a.floors].filter(Boolean).join(' / ');
    getSheet_().appendRow([
      now, ref, cell_(a.name), cell_(a.phone), cell_(a.email), cell_(a.siteType), cell_(size),
      cell_(a.area), cell_(a.address), cell_(a.budget), cell_(a.moveIn), cell_(a.supervision),
      pdfUrl, cell_(data.text, 45000)
    ]);

    if (NOTIFY) notify_(ref, a, pdfUrl);
    return json_({ ok: true, ref: ref });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- helpers ---------- */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#F5E9CC');
    sh.setFrozenRows(1);
    sh.setColumnWidth(14, 420);
  }
  return sh;
}

function getFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* deleted: make a new one */ }
  }
  const found = DriveApp.getFoldersByName(FOLDER_NAME);
  const folder = found.hasNext() ? found.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function notifyTo_() {
  return NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
}

function notify_(ref, a, pdfUrl) {
  const to = notifyTo_();
  if (!to) return;
  const body = [
    'New client requirement form – ' + ref,
    '',
    'Name: ' + (a.name || ''),
    'Mobile: ' + (a.phone || ''),
    'Site: ' + [a.siteType, a.bhk, a.floors].filter(Boolean).join(', '),
    'Carpet area: ' + (a.area || ''),
    'Budget: ' + (a.budget || ''),
    '',
    'PDF: ' + (pdfUrl || 'not attached'),
    'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
  ].join('\n');
  MailApp.sendEmail(to, 'New client form: ' + (a.name || 'Client') + ' (' + ref + ')', body);
}

/** Keeps text as text in the Sheet (no formulas) and within the cell limit. */
function cell_(v, max) {
  let s = v == null ? '' : String(v);
  s = s.slice(0, max || 2000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function safeName_(v) {
  return String(v || 'Client').replace(/[\\/:*?"<>|#%]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Client';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
