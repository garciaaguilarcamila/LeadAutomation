// ============================================================
//  SheetHelper.gs — Lectura y escritura en Google Sheet
// ============================================================

function getSheet() {
  var ss;
  var savedId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (savedId) {
    ss = SpreadsheetApp.openById(savedId);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error(
      "No se pudo obtener el spreadsheet. " +
      "Abre el spreadsheet y ejecuta setupTrigger() o saveSpreadsheetId() desde el menú."
    );
    // Guardarlo para ejecuciones futuras vía trigger
    PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());
    Logger.log("✅ Spreadsheet ID guardado automáticamente: " + ss.getId());
  }
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error('No se encontró la hoja "' + CONFIG.SHEET_NAME + '". Ejecuta initSheet() primero.');
  }
  return sheet;
}

/**
 * ✅ FIX: saveSpreadsheetId ahora también está disponible como función independiente
 * por si el usuario quiere ejecutarla manualmente.
 * setupTrigger() ya la llama automáticamente — normalmente no es necesario ejecutar esto por separado.
 */
function saveSpreadsheetId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log("ERROR: Abre el spreadsheet antes de ejecutar esto.");
    SpreadsheetApp.getUi().alert("❌ Error: Abre el spreadsheet antes de ejecutar esto.");
    return;
  }
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());
  Logger.log("✅ Spreadsheet ID guardado: " + ss.getId());
  SpreadsheetApp.getUi().alert("✅ ID guardado correctamente. Los triggers ya funcionarán.");
}

function initSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  var cabecera = [
    "empresa", "telefono", "web", "email_detectado",
    "email_confianza", "estado", "doc_url",
    "email1_fecha", "email2_fecha", "followup_fecha", "error"
  ];

  sheet.getRange(1, 1, 1, cabecera.length).setValues([cabecera]);
  sheet.getRange(1, 1, 1, cabecera.length)
    .setFontWeight("bold")
    .setBackground("#1a73e8")
    .setFontColor("#FFFFFF");
  sheet.setFrozenRows(1);

  // ✅ FIX: guardar el ID también al inicializar la hoja
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());

  Logger.log("✅ Hoja inicializada correctamente.");
  SpreadsheetApp.getUi().alert('✅ Hoja "' + CONFIG.SHEET_NAME + '" inicializada. Ya puedes usar el pipeline.');
}

function getRowsByStatus(estado) {
  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data   = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  var result = [];

  for (var i = 0; i < data.length; i++) {
    if (data[i][CONFIG.COL.ESTADO - 1] === estado) {
      result.push({ rowNum: i + 2, data: data[i] });
    }
  }
  return result;
}

function updateRow(rowNum, updates) {
  var sheet = getSheet();
  for (var campo in updates) {
    var colIndex = CONFIG.COL[campo];
    if (colIndex) sheet.getRange(rowNum, colIndex).setValue(updates[campo]);
  }
}

function setStatus(rowNum, estado) {
  var sheet = getSheet();
  sheet.getRange(rowNum, CONFIG.COL.ESTADO).setValue(estado);

  var colores = {
    "NUEVO":      "#E8F0FE",
    "ENRIQUECER": "#FFF3CD",
    "AUDITAR":    "#FFF3CD",
    "INFORME":    "#D4EDDA",
    "ENVIAR1":    "#D4EDDA",
    "ESPERAR2":   "#FCE8B2",
    "ENVIAR2":    "#B7E1CD",
    "FINAL":      "#34A853",
    "SIN_EMAIL":  "#FF6D00",
    "ERROR":      "#F4C7C3"
  };

  var cell = sheet.getRange(rowNum, CONFIG.COL.ESTADO);
  cell.setBackground(colores[estado] || "#FFFFFF");

  if (estado === "FINAL" || estado === "SIN_EMAIL") {
    cell.setFontColor("#FFFFFF").setFontWeight("bold");
  } else {
    cell.setFontColor("#000000").setFontWeight("normal");
  }
}

function setError(rowNum, msg) {
  setStatus(rowNum, CONFIG.STATE.ERROR);
  getSheet().getRange(rowNum, CONFIG.COL.ERROR).setValue(msg);
  Logger.log("ERROR fila " + rowNum + ": " + msg);
}

function addLead(empresa, web, telefono) {
  var sheet  = getSheet();
  var newRow = new Array(11).fill("");
  newRow[CONFIG.COL.EMPRESA  - 1] = empresa  || "";
  newRow[CONFIG.COL.WEB      - 1] = web      || "";
  newRow[CONFIG.COL.TELEFONO - 1] = telefono || "";
  newRow[CONFIG.COL.ESTADO   - 1] = web ? CONFIG.STATE.ENRIQUECER : CONFIG.STATE.NUEVO;
  sheet.appendRow(newRow);
}

function getField(rowData, campo) {
  return rowData[CONFIG.COL[campo] - 1];
}

function testInit() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("SS ID: " + (ss ? ss.getId() : "NULL"));
  
  var sheet = ss.getSheetByName("Leads");
  Logger.log("Hoja Leads existe: " + (sheet ? "SÍ" : "NO"));
  
  if (sheet) {
    sheet.getRange(1,1).setValue("TEST");
    Logger.log("Escribió TEST en A1");
  }
}

function testInitDebug() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("Buscando hoja: '" + CONFIG.SHEET_NAME + "'");
  
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  Logger.log("Hoja encontrada: " + (sheet ? "SÍ" : "NO"));

  var cabecera = [
    "empresa", "telefono", "web", "email_detectado",
    "email_confianza", "estado", "doc_url",
    "email1_fecha", "email2_fecha", "followup_fecha", "error"
  ];

  sheet.getRange(1, 1, 1, cabecera.length).setValues([cabecera]);
  Logger.log("Cabecera escrita");

  sheet.getRange(1, 1, 1, cabecera.length)
    .setFontWeight("bold")
    .setBackground("#1a73e8")
    .setFontColor("#FFFFFF");
  Logger.log("Formato aplicado");

  sheet.setFrozenRows(1);
  Logger.log("Filas congeladas");
}

function testSerpApi() {
  var props     = PropertiesService.getScriptProperties();
  var cityIndex = parseInt(props.getProperty("SEARCH_CITY_INDEX") || "0");
  var location  = CONFIG.SEARCH_LOCATIONS[cityIndex % CONFIG.SEARCH_LOCATIONS.length];
  
  Logger.log("Ciudad actual: " + location);
  Logger.log("SerpApi Key: " + (CONFIG.SERPAPI_KEY ? CONFIG.SERPAPI_KEY.substring(0,10) + "..." : "VACÍA"));

  var url = "https://serpapi.com/search.json"
    + "?engine=google_maps"
    + "&q=" + encodeURIComponent("restaurantes en " + location)
    + "&hl=es"
    + "&num=3"
    + "&api_key=" + CONFIG.SERPAPI_KEY;

  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log("HTTP Status: " + resp.getResponseCode());
  Logger.log("Respuesta: " + resp.getContentText().substring(0, 500));
}
