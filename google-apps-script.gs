/**
 * Christening RSVP + searchable invited guest list
 *
 * Google Sheet tabs used:
 *   1) Guest List
 *      A Guest ID | B Guest Name | C Attendance | D Dietary Notes | E Responded At
 *   2) RSVP Responses (automatic history log)
 *
 * Put invited names in Guest List column B. IDs in column A are created automatically.
 */

const GUEST_SHEET_NAME = 'Guest List';
const RESPONSE_SHEET_NAME = 'RSVP Responses';
const GUEST_HEADERS = ['Guest ID', 'Guest Name', 'Attendance', 'Dietary Notes', 'Responded At'];
const RESPONSE_HEADERS = ['Timestamp', 'Guest ID', 'Guest Name', 'Attendance', 'Dietary Notes'];
const GUEST_INDEX_CACHE_KEY = 'guest-search-index';
const GUEST_INDEX_CACHE_SECONDS = 60;

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === 'search') {
      const callback = String(e.parameter.callback || '');
      if (!/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
        return jsonResponse_({ ok:false, error:'Invalid callback.' });
      }

      const query = String(e.parameter.q || '').trim();
      const payload = searchGuests_(query);
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    ensureSheets_();
    return jsonResponse_({ ok:true, message:'Christening RSVP endpoint is online.' });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok:false, error:String(error) });
  }
}

function doPost(e) {
  try {
    const data = parseRequest_(e);
    const guestId = String(data.guest_id || '').trim();
    const guestName = String(data.guest_name || '').trim();
    const attending = String(data.attending || '').trim();
    const dietaryNotes = String(data.dietary_notes || '').trim();

    if (!guestId || !guestName) {
      return jsonResponse_({ ok:false, error:'Please select a guest from the invited list.' });
    }
    if (!attending) {
      return jsonResponse_({ ok:false, error:'Attendance response is required.' });
    }

    const guestSheet = getGuestSheet_();
    ensureGuestIds_(guestSheet);
    const values = guestSheet.getDataRange().getValues();
    let matchedRow = -1;

    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === guestId && String(values[i][1]).trim() === guestName) {
        matchedRow = i + 1;
        break;
      }
    }

    if (matchedRow === -1) {
      return jsonResponse_({ ok:false, error:'Guest was not found on the invited list.' });
    }

    const respondedAt = new Date();
    guestSheet.getRange(matchedRow, 3, 1, 3).setValues([[
      sanitizeCell_(attending),
      sanitizeCell_(dietaryNotes),
      respondedAt
    ]]);
    CacheService.getScriptCache().remove(GUEST_INDEX_CACHE_KEY);

    const responseSheet = getResponseSheet_();
    responseSheet.appendRow([
      respondedAt,
      sanitizeCell_(guestId),
      sanitizeCell_(guestName),
      sanitizeCell_(attending),
      sanitizeCell_(dietaryNotes)
    ]);

    return jsonResponse_({ ok:true });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok:false, error:String(error) });
  }
}

function searchGuests_(query) {
  if (query.length < 2) return { ok:true, guests:[] };

  const normalizedQuery = normalize_(query);
  const guests = [];
  const index = getGuestIndex_();

  for (let i = 0; i < index.length && guests.length < 8; i++) {
    const guest = index[i];
    if (guest.normalizedName.includes(normalizedQuery)) {
      guests.push({ id:guest.id, name:guest.name, attendance:guest.attendance });
    }
  }

  return { ok:true, guests:guests };
}

function getGuestIndex_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(GUEST_INDEX_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cachedAfterLock = cache.get(GUEST_INDEX_CACHE_KEY);
    if (cachedAfterLock) return JSON.parse(cachedAfterLock);

    const sheet = getGuestSheet_();
    const lastRow = sheet.getLastRow();
    const index = [];
    if (lastRow >= 2) {
      const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
      let idsChanged = false;

      for (let i = 0; i < values.length; i++) {
        const id = String(values[i][0] || '').trim();
        const name = String(values[i][1] || '').trim();
        const attendance = String(values[i][2] || '').trim();
        if (!name) continue;

        if (!id) {
          values[i][0] = Utilities.getUuid();
          idsChanged = true;
        }
        index.push({
          id: String(values[i][0]).trim(),
          name: name,
          attendance: attendance,
          normalizedName: normalize_(name)
        });
      }

      if (idsChanged) {
        sheet.getRange(2, 1, values.length, 1).setValues(values.map(row => [row[0]]));
      }
    }

    const serialized = JSON.stringify(index);
    if (Utilities.newBlob(serialized).getBytes().length <= 90000) {
      cache.put(GUEST_INDEX_CACHE_KEY, serialized, GUEST_INDEX_CACHE_SECONDS);
    }
    return index;
  } finally {
    lock.releaseLock();
  }
}

function onEdit(e) {
  if (e && e.range && e.range.getSheet().getName() === GUEST_SHEET_NAME) {
    CacheService.getScriptCache().remove(GUEST_INDEX_CACHE_KEY);
  }
}

function ensureSheets_() {
  getGuestSheet_();
  getResponseSheet_();
}

function getGuestSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(GUEST_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(GUEST_SHEET_NAME);
  setupHeaders_(sheet, GUEST_HEADERS);
  return sheet;
}

function getResponseSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(RESPONSE_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(RESPONSE_SHEET_NAME);
  setupHeaders_(sheet, RESPONSE_HEADERS);
  return sheet;
}

function setupHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (current.join('|') !== headers.join('|')) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function ensureGuestIds_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const range = sheet.getRange(2, 1, lastRow - 1, 2);
  const values = range.getValues();
  let changed = false;

  for (let i = 0; i < values.length; i++) {
    const id = String(values[i][0] || '').trim();
    const name = String(values[i][1] || '').trim();
    if (name && !id) {
      values[i][0] = Utilities.getUuid();
      changed = true;
    }
  }

  if (changed) range.setValues(values);
}

function normalize_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRequest_(e) {
  if (!e) return {};
  if (e.parameter && Object.keys(e.parameter).length) return e.parameter;
  if (e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (_) { return {}; }
  }
  return {};
}

function sanitizeCell_(value) {
  const text = String(value).trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
