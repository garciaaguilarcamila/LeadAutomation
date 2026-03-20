// ============================================================
//  Code.gs — Motor principal del pipeline
// ============================================================

/**
 * Procesa cada fila de principio a fin en una sola ejecución:
 * ENRIQUECER → AUDITAR → INFORME → ENVIAR1
 * Máx AUDIT_BATCH_SIZE filas por ejecución.
 */
function runPipeline() {
  Logger.log("=== runPipeline START === " + new Date().toISOString());

  runLeadCapture();

  // ✅ FIX ENVIAR2: procesar follow-ups ANTES de recoger filas pendientes,
  // y luego incluir ENVIAR2 en el batch para que se procesen en esta misma ejecución.
  processFollowUps(CONFIG.BATCH_SIZE);

  var pendingStates = [
    CONFIG.STATE.ENRIQUECER,
    CONFIG.STATE.AUDITAR,
    CONFIG.STATE.INFORME,
    CONFIG.STATE.ENVIAR1,
    CONFIG.STATE.ENVIAR2   // se recogen DESPUÉS de processFollowUps, ya con estado actualizado
  ];

  var pendingRows = [];
  for (var s = 0; s < pendingStates.length; s++) {
    var rows = getRowsByStatus(pendingStates[s]);
    for (var r = 0; r < rows.length; r++) pendingRows.push(rows[r]);
  }

  var toProcess = pendingRows.slice(0, CONFIG.AUDIT_BATCH_SIZE);
  Logger.log("Filas a procesar: " + toProcess.length);

  for (var i = 0; i < toProcess.length; i++) {
    var rowNum = toProcess[i].rowNum;
    try {
      processRowFull(rowNum);
    } catch (e) {
      setError(rowNum, "Pipeline error: " + e.message);
      Logger.log("ERROR fila " + rowNum + ": " + e.message);
    }
    Utilities.sleep(1500);
  }

  Logger.log("=== runPipeline END ===");
}

/**
 * Lleva una fila de principio a fin en una sola llamada:
 * ENRIQUECER → AUDITAR → INFORME → ENVIAR1 → ENVIAR2
 */
function processRowFull(rowNum) {
  var rowData, estado;

  // Paso 1: ENRIQUECER
  rowData = getSheet().getRange(rowNum, 1, 1, 11).getValues()[0];
  estado  = getField(rowData, "ESTADO");
  if (estado === CONFIG.STATE.ENRIQUECER) {
    findEmail(rowNum, rowData);
    Utilities.sleep(1000);
  }

  // Paso 2: AUDITAR
  rowData = getSheet().getRange(rowNum, 1, 1, 11).getValues()[0];
  estado  = getField(rowData, "ESTADO");
  if (estado === CONFIG.STATE.AUDITAR) {
    var auditData = runAudit(rowNum, rowData);
    if (!auditData) return;
    var slim = {
      url: auditData.url, fecha: auditData.fecha,
      scores: auditData.scores, checks: auditData.checks,
      issues: auditData.issues, improvements: auditData.improvements
    };
    PropertiesService.getScriptProperties()
      .setProperty("audit_" + rowNum, JSON.stringify(slim));
    Utilities.sleep(1000);
  }

  // Paso 3: INFORME
  rowData = getSheet().getRange(rowNum, 1, 1, 11).getValues()[0];
  estado  = getField(rowData, "ESTADO");
  if (estado === CONFIG.STATE.INFORME) {
    var cached   = PropertiesService.getScriptProperties().getProperty("audit_" + rowNum);
    var auditObj = cached ? JSON.parse(cached) : runAudit(rowNum, rowData);
    if (!auditObj) return;
    createReport(rowNum, rowData, auditObj);
    PropertiesService.getScriptProperties().deleteProperty("audit_" + rowNum);
    Utilities.sleep(1000);
  }

  // Paso 4: ENVIAR1
  rowData = getSheet().getRange(rowNum, 1, 1, 11).getValues()[0];
  estado  = getField(rowData, "ESTADO");
  if (estado === CONFIG.STATE.ENVIAR1) {
    sendEmail1(rowNum, rowData);
  }

  // Paso 5: ENVIAR2
  // ✅ FIX ENVIAR2: leer el estado actualizado de la sheet (no la variable anterior)
  // para capturar filas que llegaron aquí vía processFollowUps en esta misma ejecución.
  rowData = getSheet().getRange(rowNum, 1, 1, 11).getValues()[0];
  estado  = getField(rowData, "ESTADO");
  if (estado === CONFIG.STATE.ENVIAR2) {
    sendEmail2(rowNum, rowData);
  }
}

// ── Lead Capture ─────────────────────────────────────────────────

function runLeadCapture() {
  Logger.log("=== runLeadCapture START ===");
  fetchLeadsFromSerpApi();
  Logger.log("=== runLeadCapture END ===");
}

function processFollowUps(maxToProcess) {
  var rows  = getRowsByStatus(CONFIG.STATE.ESPERAR2);
  var hoy   = new Date();
  var count = 0;

  for (var i = 0; i < rows.length && count < maxToProcess; i++) {
    var followupRaw   = getField(rows[i].data, "FOLLOWUP_FECHA");
    if (!followupRaw) continue;
    var followupFecha = new Date(followupRaw);
    if (isNaN(followupFecha.getTime())) continue;
    if (followupFecha <= hoy) {
      setStatus(rows[i].rowNum, CONFIG.STATE.ENVIAR2);
      count++;
    }
  }
  return count;
}

// ── Trigger Management ───────────────────────────────────────────

function setupTrigger() {
  removeTriggers();

  // ✅ FIX saveSpreadsheetId: guardar el ID automáticamente al hacer setup,
  // así los triggers funcionan sin necesidad de ejecutar saveSpreadsheetId() aparte.
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());
    Logger.log("✅ Spreadsheet ID guardado automáticamente: " + ss.getId());
  }

  ScriptApp.newTrigger("runPipeline")
    .timeBased()
    .everyMinutes(CONFIG.TRIGGER_MINUTES)
    .create();

  ScriptApp.newTrigger("runLeadCapture")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log("✅ Triggers instalados.");
  SpreadsheetApp.getUi().alert(
    "✅ Pipeline activado.\n\n" +
    "· runPipeline() cada " + CONFIG.TRIGGER_MINUTES + " min\n" +
    "· runLeadCapture() 1 vez/día a las 9:00"
  );
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === "runPipeline" || fn === "runLeadCapture") ScriptApp.deleteTrigger(t);
  });
}

// ── Menú personalizado ───────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 Pipeline")
    .addItem("▶️ Ejecutar Pipeline ahora",         "runPipeline")
    .addItem("🔍 Buscar leads nuevos (SerpApi)",   "runLeadCapture")
    .addSeparator()
    .addItem("➕ Añadir lead manual",              "addLeadManual")
    .addItem("📥 Importar desde hoja CSV_IMPORT", "importFromCSV")
    .addSeparator()
    .addItem("⚙️ Inicializar hoja (primera vez)", "initSheet")
    .addItem("🔑 Guardar API keys (primera vez)", "saveApiKeys")
    .addItem("💾 Guardar ID del spreadsheet",      "saveSpreadsheetId")
    .addItem("⏰ Activar trigger automático",       "setupTrigger")
    .addItem("⛔ Desactivar trigger",              "removeTriggers")
    .addSeparator()
    .addItem("📊 Ver uso de keys SerpApi",         "verEstadoSerpApi")
    .addItem("🔄 Resetear contadores SerpApi",     "resetearContadoresSerpApi")
    .addToUi();
}