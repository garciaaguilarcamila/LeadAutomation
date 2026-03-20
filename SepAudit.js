// ============================================================
//  SeoAudit.gs — Auditoría SEO con PageSpeed Insights API
// ============================================================

/**
 * Ejecuta la auditoría SEO completa de la web del lead.
 * Devuelve auditData para que ReportGen lo procese.
 * @param {number} rowNum
 * @param {Array}  rowData
 * @returns {Object|null}
 */
function runAudit(rowNum, rowData) {
  var web = getField(rowData, "WEB");
  if (!web) { setError(rowNum, "Sin URL para auditoría SEO"); return null; }
  if (!web.startsWith("http")) web = "https://" + web;

  try {
    Logger.log("Auditando: " + web);

    // ── 1. PageSpeed Insights (mobile + desktop) ────────────
    var mobile  = fetchPageSpeed(web, "mobile");
    var desktop = fetchPageSpeed(web, "desktop");

    // ── 2. Checks básicos desde el HTML ─────────────────────
    var basicChecks = runBasicChecks(web);

    // ── 3. Construir objeto de auditoría ─────────────────────
    var auditData = {
      url:   web,
      fecha: Utilities.formatDate(new Date(), "Europe/Madrid", "dd/MM/yyyy"),
      scores: {
        performance_mobile:   getScore(mobile,  "performance"),
        seo_mobile:           getScore(mobile,  "seo"),
        accessibility_mobile: getScore(mobile,  "accessibility"),
        bestPractices_mobile: getScore(mobile,  "best-practices"),
        performance_desktop:  getScore(desktop, "performance"),
        seo_desktop:          getScore(desktop, "seo")
      },
      checks:       basicChecks,
      issues:       buildIssuesList(basicChecks, mobile, desktop),
      improvements: buildImprovements(basicChecks, mobile, desktop)
    };

    setStatus(rowNum, CONFIG.STATE.INFORME);
    Logger.log("Auditoría completada para " + web);
    return auditData;

  } catch (e) {
    setError(rowNum, "SeoAudit error: " + e.message);
    return null;
  }
}

// ── PageSpeed API ────────────────────────────────────────────────

/**
 * Llama a PageSpeed Insights API.
 * Si no hay API key configurada, funciona igual pero con cuota menor.
 * @param {string} url
 * @param {string} strategy  "mobile" | "desktop"
 * @returns {Object}
 */
function fetchPageSpeed(url, strategy) {
  var apiUrl = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    + "?url="      + encodeURIComponent(url)
    + "&strategy=" + strategy
    + "&category=performance&category=seo&category=accessibility&category=best-practices";

  if (CONFIG.PAGESPEED_API_KEY && CONFIG.PAGESPEED_API_KEY !== "TU_PAGESPEED_API_KEY_AQUI" && CONFIG.PAGESPEED_API_KEY !== "") {
    apiUrl += "&key=" + CONFIG.PAGESPEED_API_KEY;
  }

  var resp = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error("PageSpeed API error " + resp.getResponseCode() + " (" + strategy + ")");
  }
  return JSON.parse(resp.getContentText());
}

/**
 * Extrae puntuación 0-100 de una categoría del JSON de PageSpeed.
 * @param {Object} psJson
 * @param {string} category
 * @returns {number|null}
 */
function getScore(psJson, category) {
  try {
    return Math.round(psJson.lighthouseResult.categories[category].score * 100);
  } catch (e) {
    return null;
  }
}

// ── Checks Básicos desde HTML ────────────────────────────────────

/**
 * Descarga el HTML de la home y verifica elementos SEO esenciales.
 * @param {string} url
 * @returns {Object} checks
 */
function runBasicChecks(url) {
  var checks = {
    https: false, hasTitle: false, titleLength: 0, titleContent: "",
    hasMetaDesc: false, metaDescLength: 0, metaDescContent: "",
    hasH1: false, h1Count: 0, h1Content: "",
    hasCanonical: false, hasViewport: false, hasOpenGraph: false, hasRobots: null
  };

  checks.https = url.startsWith("https://");

  var html = fetchHtml(url);
  if (!html) return checks;

  var titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    checks.hasTitle     = true;
    checks.titleContent = titleMatch[1].trim();
    checks.titleLength  = checks.titleContent.length;
  }

  var metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*?)["']/i)
                   || html.match(/<meta[^>]+content=["']([^"']*?)["'][^>]+name=["']description["']/i);
  if (metaDescMatch) {
    checks.hasMetaDesc     = true;
    checks.metaDescContent = metaDescMatch[1].trim();
    checks.metaDescLength  = checks.metaDescContent.length;
  }

  var h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi);
  if (h1Matches) {
    checks.hasH1     = true;
    checks.h1Count   = h1Matches.length;
    checks.h1Content = h1Matches[0].replace(/<[^>]+>/g, "").trim().substring(0, 80);
  }

  if (html.match(/rel=["']canonical["']/i))    checks.hasCanonical = true;
  if (html.match(/name=["']viewport["']/i))    checks.hasViewport  = true;
  if (html.match(/property=["']og:/i))         checks.hasOpenGraph = true;

  var robotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*?)["']/i);
  if (robotsMatch) {
    checks.hasRobots = robotsMatch[1].toLowerCase().includes("noindex") ? "noindex" : "index";
  }

  return checks;
}

// ── Listados de problemas y mejoras ─────────────────────────────

function buildIssuesList(checks, mobile, desktop) {
  var issues = [];

  if (!checks.https)                       issues.push("⚠️ La web NO usa HTTPS — penalización SEO y confianza del usuario");
  if (!checks.hasTitle)                    issues.push("❌ Sin etiqueta <title> — crítico para SEO");
  else if (checks.titleLength < 30)        issues.push("⚠️ Título demasiado corto (" + checks.titleLength + " caracteres, mínimo 30-60)");
  else if (checks.titleLength > 60)        issues.push("⚠️ Título demasiado largo (" + checks.titleLength + " caracteres, máximo 60)");
  if (!checks.hasMetaDesc)                 issues.push("❌ Sin meta description — afecta al CTR en resultados de búsqueda");
  else if (checks.metaDescLength < 70)     issues.push("⚠️ Meta description muy corta (" + checks.metaDescLength + " caracteres, ideal 120-160)");
  else if (checks.metaDescLength > 160)    issues.push("⚠️ Meta description muy larga (" + checks.metaDescLength + " caracteres, máximo 160)");
  if (!checks.hasH1)                       issues.push("❌ Sin etiqueta H1 — crítico para SEO on-page");
  else if (checks.h1Count > 1)             issues.push("⚠️ Múltiples H1 (" + checks.h1Count + ") — debe haber solo uno por página");
  if (!checks.hasViewport)                 issues.push("⚠️ Sin meta viewport — la web puede no ser responsive");
  if (!checks.hasCanonical)                issues.push("ℹ️ Sin etiqueta canonical — riesgo de contenido duplicado");
  if (checks.hasRobots === "noindex")      issues.push("🚨 NOINDEX activo — Google NO indexa esta web");

  var perfM = getScore(mobile, "performance");
  if (perfM !== null && perfM < 50)        issues.push("🔴 Rendimiento móvil muy bajo (" + perfM + "/100) — afecta posicionamiento");
  else if (perfM !== null && perfM < 80)   issues.push("🟡 Rendimiento móvil mejorable (" + perfM + "/100)");

  var seoM = getScore(mobile, "seo");
  if (seoM !== null && seoM < 70)          issues.push("🔴 Puntuación SEO baja (" + seoM + "/100)");

  if (issues.length === 0) issues.push("✅ No se detectaron problemas críticos evidentes");
  return issues;
}

function buildImprovements(checks, mobile, desktop) {
  var recs = [];

  if (!checks.https)        recs.push("Migrar a HTTPS con un certificado SSL (gratuito con Let's Encrypt)");
  if (!checks.hasTitle || checks.titleLength < 30 || checks.titleLength > 60)
                            recs.push("Optimizar el título de la página (30-60 caracteres, incluir palabra clave principal)");
  if (!checks.hasMetaDesc)  recs.push("Añadir meta description atractiva (120-160 caracteres) para mejorar el CTR");
  if (!checks.hasH1)        recs.push("Añadir un H1 claro con la palabra clave principal de la página");
  if (checks.h1Count > 1)   recs.push("Reducir a un único H1 por página, mover el resto a H2/H3");
  if (!checks.hasViewport)  recs.push("Añadir meta viewport para garantizar responsive design");
  if (!checks.hasOpenGraph) recs.push("Implementar Open Graph tags para mejorar previsualizaciones en redes sociales");
  if (!checks.hasCanonical) recs.push("Añadir etiqueta canonical para evitar problemas de contenido duplicado");

  var perfM = getScore(mobile, "performance");
  if (perfM !== null && perfM < 80)
    recs.push("Mejorar la velocidad de carga en móvil: optimizar imágenes, habilitar caché, minimizar CSS/JS");

  recs.push("Realizar un audit completo de palabras clave y contenido para el sector");
  recs.push("Crear y vincular perfil de Google Business Profile si aún no existe");

  return recs;
}