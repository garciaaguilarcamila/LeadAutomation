// ============================================================
//  Config.gs — Configuración central del sistema
// ============================================================

/**
 * ▶️ Ejecutar UNA SOLA VEZ para guardar todas las API keys.
 * Añade aquí todas las keys de SerpApi que tengas.
 */
function saveApiKeys() {
  PropertiesService.getScriptProperties().setProperties({
    // ── Pool de SerpApi — añade tantas cuentas como tengas ────
    "SERPAPI_POOL_cuenta1": "",
    "SERPAPI_POOL_cuenta2": "",
    // "SERPAPI_POOL_cuenta3": "TU_TERCERA_KEY_AQUI",

    // ── Otras APIs ────────────────────────────────────────────
    CLAUDE_API_KEY:          "",
    PAGESPEED_API_KEY:       "",
    CUSTOM_SEARCH_API_KEY:   "",
    CUSTOM_SEARCH_ENGINE_ID: ""
  });
  Logger.log("✅ API keys guardadas en ScriptProperties.");
  try { SpreadsheetApp.getUi().alert("✅ API keys guardadas correctamente."); } catch(e) {}
}



var _props = PropertiesService.getScriptProperties();

var CONFIG = {

  // ── APIs generales ───────────────────────────────────────────
  CLAUDE_API_KEY:          _props.getProperty("CLAUDE_API_KEY")          || "",
  PAGESPEED_API_KEY:       _props.getProperty("PAGESPEED_API_KEY")       || "",
  CUSTOM_SEARCH_API_KEY:   _props.getProperty("CUSTOM_SEARCH_API_KEY")   || "",
  CUSTOM_SEARCH_ENGINE_ID: _props.getProperty("CUSTOM_SEARCH_ENGINE_ID") || "",

  // ── Pool de SerpApi ──────────────────────────────────────────
  // Aliases en orden de prioridad. Deben coincidir con las keys
  // guardadas en saveApiKeys() como "SERPAPI_POOL_<alias>".
  // Cuando una key agota sus 100 búsquedas/mes, pasa a la siguiente.
  SERPAPI_KEYS_POOL: [
    "cuenta1",
    "cuenta2",
    // "cuenta3",  // ← descomenta al añadir más cuentas
  ],
  SERPAPI_MAX_REQUESTS_PER_KEY: 100,  // límite del plan gratuito

  // ── Búsqueda de empresas ─────────────────────────────────────
  SEARCH_QUERY:           "empresas",
  SEARCH_LOCATION:        "Sevilla",
  SEARCH_RESULTS_PER_RUN: 20,         // para demo masiva: ejecutar 5 veces = 100 leads

  // ── Google Sheet ─────────────────────────────────────────────
  SHEET_NAME: "Leads",

  BATCH_SIZE:       5,
  AUDIT_BATCH_SIZE: 5,

  // ── Seguimiento ──────────────────────────────────────────────
  FOLLOWUP_DAYS: 2,

  // ── Emails ───────────────────────────────────────────────────
  TEST_MODE:   false,
  TEST_EMAIL:  "",

  SENDER_NAME:    "Pepita- Sagatech",
  EMAIL1_SUBJECT: "Hemos analizado la web de {empresa} — resultados gratuitos",
  EMAIL2_SUBJECT: "Seguimiento: informe SEO gratuito para {empresa}",

  // ── Calendly ─────────────────────────────────────────────────
  BOOKING_LINK: "",

  // ── Google Drive ─────────────────────────────────────────────
  DRIVE_FOLDER_NAME: "Informes SEO Leads",

  // ── Trigger ──────────────────────────────────────────────────
  TRIGGER_MINUTES: 30,

  // ── Columnas de la Sheet (índice basado en 1) ─────────────────
  COL: {
    EMPRESA:          1,
    TELEFONO:         2,
    WEB:              3,
    EMAIL_DETECTADO:  4,
    EMAIL_CONFIANZA:  5,
    ESTADO:           6,
    DOC_URL:          7,
    EMAIL1_FECHA:     8,
    EMAIL2_FECHA:     9,
    FOLLOWUP_FECHA:   10,
    ERROR:            11
  },

  // ── Estados del pipeline ──────────────────────────────────────
  STATE: {
    NUEVO:      "NUEVO",
    ENRIQUECER: "ENRIQUECER",
    AUDITAR:    "AUDITAR",
    INFORME:    "INFORME",
    ENVIAR1:    "ENVIAR1",
    ESPERAR2:   "ESPERAR2",
    ENVIAR2:    "ENVIAR2",
    FINAL:      "FINAL",
    SIN_EMAIL:  "SIN_EMAIL",
    ERROR:      "ERROR"
  }
};