// ============================================================
//  LeadCapture.gs — Captación de leads con SerpApi (Google Maps)
// ============================================================

function fetchLeadsFromSerpApi() {
  Logger.log("=== fetchLeadsFromSerpApi START ===");

  // Obtener key activa del pool (rota automáticamente si una está agotada)
  var serpApiKey, activeAlias;
  try {
    activeAlias = SerpApiManager.getActiveAlias();
    serpApiKey  = SerpApiManager.getActiveKey();
  } catch(e) {
    Logger.log("❌ " + e.message);
    return;
  }

  // Paginación: avanza el offset para no repetir resultados
  var props      = PropertiesService.getScriptProperties();
  var pageOffset = parseInt(props.getProperty("SEARCH_PAGE_OFFSET") || "0");

  var query = CONFIG.SEARCH_QUERY + " en " + CONFIG.SEARCH_LOCATION;
  var url   = "https://serpapi.com/search.json"
    + "?engine=google_maps"
    + "&q="       + encodeURIComponent(query)
    + "&hl=es"
    + "&start="   + pageOffset
    + "&num="     + CONFIG.SEARCH_RESULTS_PER_RUN
    + "&api_key=" + serpApiKey;

  Logger.log("Buscando: " + query + " | Offset: " + pageOffset + " | Key: [" + activeAlias + "]");

  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = resp.getResponseCode();

    // Registrar el uso solo si la llamada fue exitosa
    if (code === 200) {
      SerpApiManager.recordUsage(activeAlias);
    } else {
      Logger.log("SerpApi error HTTP " + code + ": " + resp.getContentText());
      return;
    }

    var data   = JSON.parse(resp.getContentText());
    var places = data.local_results || [];

    if (places.length === 0) {
      Logger.log("Sin más resultados (offset " + pageOffset + "). Reiniciando offset.");
      props.setProperty("SEARCH_PAGE_OFFSET", "0");
      return;
    }

    var added = 0;
    for (var i = 0; i < Math.min(places.length, CONFIG.SEARCH_RESULTS_PER_RUN); i++) {
      var place    = places[i];
      var nombre   = (place.title   || "").trim();
      var web      = (place.website || "").trim();
      var telefono = (place.phone   || "").trim();

      if (!nombre || !web) continue;
      if (!web.startsWith("http")) web = "https://" + web;
      if (leadYaExiste(nombre, web)) {
        Logger.log("⏭️ Ya existe: " + nombre);
        continue;
      }

      addLead(nombre, web, telefono);
      added++;
      Logger.log("✅ Lead añadido: " + nombre + " → " + web);
    }

    // Avanzar offset para la próxima ejecución
    props.setProperty("SEARCH_PAGE_OFFSET", String(pageOffset + CONFIG.SEARCH_RESULTS_PER_RUN));
    Logger.log("=== fetchLeadsFromSerpApi END === Añadidos: " + added
      + " | Próximo offset: " + (pageOffset + CONFIG.SEARCH_RESULTS_PER_RUN));

  } catch (e) {
    Logger.log("ERROR en fetchLeadsFromSerpApi: " + e.message);
  }
}

function leadYaExiste(nombre, web) {
  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === nombre || data[i][2] === web) return true;
  }
  return false;
}

function importFromCSV() {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var csvSheet = ss.getSheetByName("CSV_IMPORT");
  if (!csvSheet) {
    try { SpreadsheetApp.getUi().alert('Crea una hoja llamada "CSV_IMPORT" con columnas: empresa, web, telefono'); } catch(e) {}
    return;
  }

  var data     = csvSheet.getDataRange().getValues();
  var imported = 0;

  for (var i = 0; i < data.length; i++) {
    var row      = data[i];
    var empresa  = (row[0] || "").toString().trim();
    var web      = (row[1] || "").toString().trim();
    var telefono = (row[2] || "").toString().trim();

    if (!empresa) continue;
    if (web && !web.startsWith("http")) web = "https://" + web;
    if (leadYaExiste(empresa, web)) continue;

    addLead(empresa, web, telefono);
    imported++;
  }

  Logger.log("Importados " + imported + " leads desde CSV_IMPORT.");
  try { SpreadsheetApp.getUi().alert("✅ " + imported + " leads importados correctamente."); } catch(e) {}
}

function addLeadManual() {
  var ui       = SpreadsheetApp.getUi();
  var rEmpresa = ui.prompt("Nuevo Lead", "Nombre de la empresa:", ui.ButtonSet.OK_CANCEL);
  if (rEmpresa.getSelectedButton() !== ui.Button.OK) return;

  var rWeb = ui.prompt("Nuevo Lead", "Web de la empresa:", ui.ButtonSet.OK_CANCEL);
  var rTel = ui.prompt("Nuevo Lead", "Teléfono (opcional):", ui.ButtonSet.OK_CANCEL);

  var empresa  = rEmpresa.getResponseText().trim();
  var web      = rWeb.getResponseText().trim();
  var telefono = rTel.getResponseText().trim();

  if (!empresa) { ui.alert("El nombre de empresa es obligatorio."); return; }
  if (web && !web.startsWith("http")) web = "https://" + web;

  addLead(empresa, web, telefono);
  ui.alert("✅ Lead «" + empresa + "» añadido correctamente.");
}