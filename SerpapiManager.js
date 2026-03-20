// ============================================================
//  SerpApiManager.gs — Gestión de pool de claves SerpApi
//  Rota automáticamente entre cuentas cuando una se agota.
// ============================================================

var SerpApiManager = {

  /**
   * Devuelve la API key activa con cuota disponible.
   * Si la actual está agotada, pasa automáticamente a la siguiente.
   * @returns {string} API key válida
   */
  getActiveKey: function() {
    this._checkMonthlyReset();

    var pool = CONFIG.SERPAPI_KEYS_POOL;

    for (var i = 0; i < pool.length; i++) {
      var alias = pool[i];
      var usage = this._getUsage(alias);

      if (usage < CONFIG.SERPAPI_MAX_REQUESTS_PER_KEY) {
        Logger.log("🔑 SerpAPI activa: [" + alias + "] uso: " + usage + "/" + CONFIG.SERPAPI_MAX_REQUESTS_PER_KEY);
        return this._getKeyByAlias(alias);
      } else {
        Logger.log("⚠️ SerpAPI [" + alias + "] agotada (" + usage + "/" + CONFIG.SERPAPI_MAX_REQUESTS_PER_KEY + "), probando siguiente...");
      }
    }

    throw new Error("❌ Todas las claves SerpAPI han agotado su cuota mensual. Añade más cuentas en saveApiKeys() y Config.gs.");
  },

  /**
   * Registra un uso tras una llamada exitosa a SerpApi.
   * Llamar siempre después de cada fetch exitoso.
   * @param {string} alias — alias de la key usada
   */
  recordUsage: function(alias) {
    if (!alias) return;
    var current = this._getUsage(alias);
    PropertiesService.getScriptProperties()
      .setProperty("SERPAPI_USAGE_" + alias, String(current + 1));
    Logger.log("📊 SerpAPI [" + alias + "] uso registrado: " + (current + 1) + "/" + CONFIG.SERPAPI_MAX_REQUESTS_PER_KEY);
  },

  /**
   * Devuelve el alias de la key actualmente activa (la primera con cuota).
   * @returns {string|null}
   */
  getActiveAlias: function() {
    var pool = CONFIG.SERPAPI_KEYS_POOL;
    for (var i = 0; i < pool.length; i++) {
      if (this._getUsage(pool[i]) < CONFIG.SERPAPI_MAX_REQUESTS_PER_KEY) {
        return pool[i];
      }
    }
    return null;
  },

  /**
   * Muestra el estado de uso de todas las keys del pool en el log.
   */
  logPoolStats: function() {
    var pool = CONFIG.SERPAPI_KEYS_POOL;
    Logger.log("=== Estado del pool SerpAPI ===");
    for (var i = 0; i < pool.length; i++) {
      var alias   = pool[i];
      var usage   = this._getUsage(alias);
      var restant = CONFIG.SERPAPI_MAX_REQUESTS_PER_KEY - usage;
      Logger.log("[" + alias + "] Usadas: " + usage + " | Restantes: " + restant);
    }
  },

  /**
   * Resetea manualmente los contadores de uso de todas las keys.
   * Útil si añades cuentas nuevas o para testing.
   */
  resetAllUsage: function() {
    var pool = CONFIG.SERPAPI_KEYS_POOL;
    for (var i = 0; i < pool.length; i++) {
      PropertiesService.getScriptProperties().deleteProperty("SERPAPI_USAGE_" + pool[i]);
    }
    PropertiesService.getScriptProperties()
      .setProperty("SERPAPI_LAST_RESET", new Date().toISOString());
    Logger.log("🔄 Contadores SerpAPI reseteados.");
    try { SpreadsheetApp.getUi().alert("✅ Contadores SerpAPI reseteados."); } catch(e) {}
  },

  // ── Métodos internos ─────────────────────────────────────────

  _getKeyByAlias: function(alias) {
    var key = PropertiesService.getScriptProperties().getProperty("SERPAPI_POOL_" + alias);
    if (!key) throw new Error("No se encontró la key para el alias [" + alias + "]. Ejecuta saveApiKeys().");
    return key;
  },

  _getUsage: function(alias) {
    var val = PropertiesService.getScriptProperties().getProperty("SERPAPI_USAGE_" + alias);
    return val ? parseInt(val, 10) : 0;
  },

  _checkMonthlyReset: function() {
    var props        = PropertiesService.getScriptProperties();
    var lastResetStr = props.getProperty("SERPAPI_LAST_RESET");

    if (!lastResetStr) {
      props.setProperty("SERPAPI_LAST_RESET", new Date().toISOString());
      return;
    }

    var daysDiff = (new Date() - new Date(lastResetStr)) / (1000 * 60 * 60 * 24);
    if (daysDiff >= 30) {
      Logger.log("🔄 Reset mensual automático de cuotas SerpAPI (" + Math.floor(daysDiff) + " días).");
      this.resetAllUsage();
    }
  }
};

// ── Funciones de menú ────────────────────────────────────────────

function verEstadoSerpApi() {
  SerpApiManager.logPoolStats();
  try { SpreadsheetApp.getUi().alert("✅ Estado del pool mostrado en el log de Apps Script."); } catch(e) {}
}

function resetearContadoresSerpApi() {
  SerpApiManager.resetAllUsage();
}