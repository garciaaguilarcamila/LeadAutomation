// ============================================================
//  EmailFinder.gs — Búsqueda exhaustiva de email en 3 capas
//
//  Capa 1: HTML scraping (home + rutas comunes + JSON-LD + ofuscados)
//  Capa 2: Google Programmable Search API (emails indexados)
//  Capa 3: Detección de formulario de contacto (fallback)
// ============================================================

/**
 * Punto de entrada: busca el email de la empresa y actualiza la fila.
 * @param {number} rowNum
 * @param {Array}  rowData
 */
function findEmail(rowNum, rowData) {
  var web = getField(rowData, "WEB");
  if (!web) {
    setError(rowNum, "Sin URL de web para buscar email");
    return;
  }
  if (!web.startsWith("http")) web = "https://" + web;

  try {
    // ── CAPA 1: Scraping HTML ───────────────────────────────
    var result = searchEmailInHtml(web);

    // ── CAPA 2: Google Programmable Search ─────────────────
    if (!result.email) {
      result = searchEmailViaGoogleSearch(web);
    }

    // ── CAPA 3: Detectar formulario de contacto ────────────
    if (!result.email) {
      result = detectContactForm(web);
    }

    if (result.email) {
      updateRow(rowNum, {
        EMAIL_DETECTADO: result.email,
        EMAIL_CONFIANZA: result.confianza
      });
      setStatus(rowNum, CONFIG.STATE.AUDITAR);
      Logger.log("Email encontrado para " + web + ": " + result.email + " [" + result.confianza + "]");
    } else {
      updateRow(rowNum, {
        EMAIL_DETECTADO: result.nota || "SIN_EMAIL",
        EMAIL_CONFIANZA: "NINGUNA"
      });
      // Continuamos el pipeline aunque no haya email (puede haber formulario)
      setStatus(rowNum, CONFIG.STATE.AUDITAR);
      Logger.log("Sin email para " + web + ". Nota: " + (result.nota || ""));
    }

  } catch (e) {
    setError(rowNum, "EmailFinder error: " + e.message);
  }
}

// ── CAPA 1: HTML Scraping ────────────────────────────────────────

/**
 * Busca emails en el HTML de múltiples rutas del sitio.
 * Estrategias: mailto, regex, emails ofuscados, JSON-LD/Schema.org
 * @param {string} baseUrl
 * @returns {{email: string, confianza: string}|{email: null}}
 */
function searchEmailInHtml(baseUrl) {
  var paths = [
    "", "/contacto", "/contact", "/aviso-legal", "/legal",
    "/privacy", "/politica-de-privacidad", "/sobre-nosotros",
    "/about", "/quienes-somos", "/info", "/contacta-con-nosotros"
  ];

  var domain = extractDomain(baseUrl);

  for (var i = 0; i < paths.length; i++) {
    var url = baseUrl.replace(/\/$/, "") + paths[i];
    try {
      var html = fetchHtml(url);
      if (!html) continue;

      // 1. Buscar mailto: (máxima confianza)
      var mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
      if (mailtoMatch) {
        return { email: mailtoMatch[1], confianza: "ALTA" };
      }

      // 2. Buscar emails visibles con @
      var emailMatch = html.match(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g);
      if (emailMatch) {
        var filtered = emailMatch.filter(function(e) {
          return !e.match(/@(example|test|sentry|wixpress|squarespace|shopify|wordpress|w3\.org)/i)
              && (e.indexOf(domain) > -1 || isGenericBusinessEmail(e));
        });
        if (filtered.length > 0) {
          return { email: filtered[0], confianza: "ALTA" };
        }
      }

      // 3. Buscar emails ofuscados: info [at] dominio [dot] com
      var ofuscated = html.match(/([a-zA-Z0-9._%+\-]+)\s*[\[\(]?at[\]\)]?\s*([a-zA-Z0-9.\-]+)\s*[\[\(]?dot[\]\)]?\s*([a-zA-Z]{2,})/i);
      if (ofuscated) {
        return { email: ofuscated[1] + "@" + ofuscated[2] + "." + ofuscated[3], confianza: "MEDIA" };
      }

      // 4. Buscar en JSON-LD / Schema.org
      var jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatch) {
        for (var j = 0; j < jsonLdMatch.length; j++) {
          try {
            var raw      = jsonLdMatch[j].replace(/<\/?script[^>]*>/gi, "");
            var jsonData = JSON.parse(raw);
            var found    = extractEmailFromJsonLd(jsonData);
            if (found) return { email: found, confianza: "ALTA" };
          } catch (e2) { /* JSON malformado, ignorar */ }
        }
      }

    } catch (e) {
      Logger.log("No accesible: " + url + " — " + e.message);
    }
  }
  return { email: null };
}

/**
 * Extrae email recursivamente de un objeto JSON-LD de Schema.org.
 * @param {Object} obj
 * @returns {string|null}
 */
function extractEmailFromJsonLd(obj) {
  if (!obj) return null;
  if (typeof obj === "string") {
    var m = obj.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    return m ? m[0] : null;
  }
  if (obj.email) return obj.email;
  if (obj.contactPoint) {
    var cp = Array.isArray(obj.contactPoint) ? obj.contactPoint[0] : obj.contactPoint;
    if (cp && cp.email) return cp.email;
  }
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      var found = extractEmailFromJsonLd(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

// ── CAPA 2: Google Programmable Search API ───────────────────────

/**
 * Busca emails indexados en Google para ese dominio.
 * Requiere Google Programmable Search Engine (gratuito hasta 100 queries/día).
 * @param {string} baseUrl
 * @returns {{email: string, confianza: string}|{email: null}}
 */
function searchEmailViaGoogleSearch(baseUrl) {
  if (!CONFIG.CUSTOM_SEARCH_API_KEY || CONFIG.CUSTOM_SEARCH_API_KEY === "TU_CUSTOM_SEARCH_API_KEY_AQUI") {
    Logger.log("Capa 2 (Google Search) omitida: API key no configurada");
    return { email: null };
  }

  var domain  = extractDomain(baseUrl);
  var queries = [
    'site:' + domain + ' "@' + domain + '"',
    'site:' + domain + ' "mailto:"',
    'site:' + domain + ' contacto email'
  ];

  for (var i = 0; i < queries.length; i++) {
    try {
      var searchUrl = "https://www.googleapis.com/customsearch/v1"
        + "?key=" + CONFIG.CUSTOM_SEARCH_API_KEY
        + "&cx="  + CONFIG.CUSTOM_SEARCH_ENGINE_ID
        + "&q="   + encodeURIComponent(queries[i])
        + "&num=5";

      var resp = UrlFetchApp.fetch(searchUrl, { muteHttpExceptions: true });
      var json = JSON.parse(resp.getContentText());

      if (json.items && json.items.length > 0) {
        for (var j = 0; j < json.items.length; j++) {
          var text = (json.items[j].snippet || "") + " " + (json.items[j].title || "");
          var emailMatch = text.match(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/);
          if (emailMatch && emailMatch[1].indexOf(domain) > -1) {
            return { email: emailMatch[1], confianza: "MEDIA" };
          }
        }
      }
    } catch (e) {
      Logger.log("Capa 2 error query " + i + ": " + e.message);
    }
  }
  return { email: null };
}

// ── CAPA 3: Detectar formulario de contacto ──────────────────────

/**
 * Si no hay email, busca si existe un formulario de contacto (fallback).
 * @param {string} baseUrl
 * @returns {{email: null, nota: string}}
 */
function detectContactForm(baseUrl) {
  var contactPaths = ["/contacto", "/contact", "/contacta-con-nosotros", "/get-in-touch"];

  for (var i = 0; i < contactPaths.length; i++) {
    var url = baseUrl.replace(/\/$/, "") + contactPaths[i];
    try {
      var html = fetchHtml(url);
      if (html && html.match(/<form[\s>]/i)) {
        Logger.log("Formulario de contacto detectado en: " + url);
        return { email: null, nota: "FORMULARIO:" + url };
      }
    } catch (e) { /* continuar */ }
  }
  return { email: null, nota: "SIN_EMAIL_NI_FORMULARIO" };
}

// ── Utilidades ───────────────────────────────────────────────────

/**
 * Hace fetch de HTML con headers de navegador real para evitar bloqueos.
 * @param {string} url
 * @returns {string|null}
 */
function fetchHtml(url) {
  var opts = {
    muteHttpExceptions: true,
    followRedirects:    true,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    }
  };
  var resp = UrlFetchApp.fetch(url, opts);
  return resp.getResponseCode() === 200 ? resp.getContentText() : null;
}

/**
 * Extrae el dominio base de una URL (sin www).
 * @param {string} url
 * @returns {string}
 */
function extractDomain(url) {
  var match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)/i);
  return match ? match[1] : url;
}

/**
 * Devuelve true si el prefijo del email es genérico de negocio.
 * @param {string} email
 * @returns {boolean}
 */
function isGenericBusinessEmail(email) {
  var prefixes = ["info", "contacto", "contact", "hola", "hello", "admin", "soporte", "support"];
  return prefixes.indexOf(email.split("@")[0].toLowerCase()) > -1;
}