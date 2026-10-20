/**
 * Google Apps Script endpoint for Angel Spinner 9000.
 * Spin records go to "Slot Results"; shop redemptions go to "Shop Redemptions".
 */
const SLOT_SHEET_NAME = "Slot Results";
const REDEMPTION_SHEET_NAME = "Shop Redemptions";

function doPost(e) {
  try {
    const record = JSON.parse(e.postData.contents || "{}");
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (record.recordType === "redemption") appendRedemption(spreadsheet, record);
    else appendSlotResult(spreadsheet, record);
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendSlotResult(spreadsheet, record) {
  const sheet = getOrCreateSheet(spreadsheet, SLOT_SHEET_NAME, [
    "Timestamp (UTC)", "Reel 1", "Reel 2", "Reel 3", "Result Title",
    "Result Message", "Points Earned", "Total Points After Spin",
    "Spins Remaining", "Bonus Spins Earned Today", "Total Prizes Won"
  ]);
  const symbols = Array.isArray(record.symbols) ? record.symbols : [];
  sheet.appendRow([
    record.timestamp || new Date().toISOString(), symbols[0] || "", symbols[1] || "", symbols[2] || "",
    record.resultTitle || "", record.resultMessage || "", Number(record.pointsEarned) || 0,
    Number(record.totalPoints) || 0, Number(record.spinsRemaining) || 0,
    Number(record.bonusSpinsEarnedToday) || 0, Number(record.totalPrizesWon) || 0
  ]);
}

function appendRedemption(spreadsheet, record) {
  const sheet = getOrCreateSheet(spreadsheet, REDEMPTION_SHEET_NAME, [
    "Timestamp (UTC)", "Reward Redeemed", "Points Spent", "Remaining Points",
    "Spins Remaining", "Bonus Spins Earned Today", "Total Prizes Won"
  ]);
  sheet.appendRow([
    record.timestamp || new Date().toISOString(), record.reward || "",
    Number(record.pointsSpent) || 0, Number(record.remainingPoints) || 0,
    Number(record.spinsRemaining) || 0, Number(record.bonusSpinsEarnedToday) || 0,
    Number(record.totalPrizesWon) || 0
  ]);
}
