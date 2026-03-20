// ============================================================
//  ReportGen.gs — Generador de Informes SEO (Google Docs → PDF)
// ============================================================

function createReport(rowNum, rowData, auditData) {

  var empresa = getField(rowData, "EMPRESA");
  var web     = getField(rowData, "WEB");

  try {

    var folder = getOrCreateFolder(CONFIG.DRIVE_FOLDER_NAME);
    var titulo = "Informe SEO — " + empresa + " — " + auditData.fecha;

    var doc  = DocumentApp.create(titulo);
    DriveApp.getFileById(doc.getId()).moveTo(folder);

    var body = doc.getBody();

    buildReportContent(body, empresa, web, auditData);

    doc.saveAndClose();

    var pdfBlob = DriveApp.getFileById(doc.getId()).getAs("application/pdf");
    pdfBlob.setName(titulo + ".pdf");

    var pdfFile = folder.createFile(pdfBlob);

    pdfFile.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW
    );

    DriveApp.getFileById(doc.getId()).setTrashed(true);

    updateRow(rowNum, { DOC_URL: pdfFile.getUrl() });

    setStatus(rowNum, CONFIG.STATE.ENVIAR1);

    Logger.log("Informe PDF creado: " + pdfFile.getUrl());

  } catch (e) {

    setError(rowNum, "ReportGen error: " + e.message);

  }

}



// ── Construcción del informe ─────────────────────────────

function buildReportContent(body, empresa, web, auditData) {

  var s = auditData.scores;

  body.clear();



  // ───────────── PORTADA ─────────────

  var portada = body.appendParagraph("INFORME SEO");
  portada.setHeading(DocumentApp.ParagraphHeading.TITLE);
  portada.setAttributes({
    [DocumentApp.Attribute.FONT_SIZE]: 30,
    [DocumentApp.Attribute.BOLD]: true,
    [DocumentApp.Attribute.FOREGROUND_COLOR]: "#1F2937"
  });

  body.appendParagraph(empresa)
    .setAttributes({
      [DocumentApp.Attribute.FONT_SIZE]: 18,
      [DocumentApp.Attribute.BOLD]: true
    });

  body.appendParagraph("Web analizada: " + web);
  body.appendParagraph("Fecha del análisis: " + auditData.fecha);

  body.appendParagraph("Preparado por " + CONFIG.SENDER_NAME)
    .setAttributes({
      [DocumentApp.Attribute.ITALIC]: true,
      [DocumentApp.Attribute.FONT_SIZE]: 11
    });

  body.appendPageBreak();



  // ───────────── CABECERA ─────────────

  var header = body.appendParagraph("Informe de Auditoría SEO");
  header.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  header.setAttributes({
    [DocumentApp.Attribute.FONT_SIZE]: 22,
    [DocumentApp.Attribute.BOLD]: true,
    [DocumentApp.Attribute.FOREGROUND_COLOR]: "#1F2937"
  });



  body.appendParagraph("Empresa: " + empresa)
    .setAttributes({ [DocumentApp.Attribute.BOLD]: true });

  body.appendParagraph("Web analizada: " + web)
    .setAttributes({ [DocumentApp.Attribute.ITALIC]: true });

  body.appendHorizontalRule();



  // ───────────── RESUMEN ─────────────

  appendHeading(body, "1. Resumen Ejecutivo", DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(
    "Se ha realizado un análisis inicial del estado SEO de la web de " +
    empresa +
    ". Este informe resume el rendimiento técnico, la optimización SEO básica y las principales oportunidades de mejora detectadas."
  );



  // ───────────── SCORES ─────────────

  appendHeading(body, "2. Puntuaciones de rendimiento", DocumentApp.ParagraphHeading.HEADING2);

  styleTable(body.appendTable([

    ["Categoría", "Móvil", "Escritorio"],

    ["Rendimiento", formatScore(s.performance_mobile), formatScore(s.performance_desktop)],

    ["SEO", formatScore(s.seo_mobile), formatScore(s.seo_desktop)],

    ["Accesibilidad", formatScore(s.accessibility_mobile), "—"],

    ["Buenas prácticas", formatScore(s.bestPractices_mobile), "—"]

  ]));



  // ───────────── CHECKS ─────────────

  appendHeading(body, "3. Checks técnicos", DocumentApp.ParagraphHeading.HEADING2);

  var c = auditData.checks;

  styleTable(body.appendTable([

    ["Check", "Estado", "Detalle"],

    ["HTTPS", c.https ? "Correcto" : "No detectado", c.https ? "Sitio seguro" : "Sin certificado SSL"],

    ["Title", c.hasTitle ? "Correcto" : "Falta", c.hasTitle ? (c.titleLength + " caracteres") : "No encontrado"],

    ["Meta Description", c.hasMetaDesc ? "Correcto" : "Falta", c.hasMetaDesc ? (c.metaDescLength + " caracteres") : "No encontrada"],

    ["H1", c.hasH1 ? "Correcto" : "Falta", c.hasH1 ? (c.h1Count + " encontrado/s") : "No detectado"],

    ["Viewport", c.hasViewport ? "Correcto" : "No detectado", c.hasViewport ? "Optimizado para móvil" : "Falta meta viewport"],

    ["Open Graph", c.hasOpenGraph ? "Detectado" : "No detectado", ""],

    ["Canonical", c.hasCanonical ? "Detectado" : "No detectado", ""]

  ]));



  // ───────────── PROBLEMAS ─────────────

  appendHeading(body, "4. Problemas detectados", DocumentApp.ParagraphHeading.HEADING2);

  if (auditData.issues && auditData.issues.length > 0) {

    auditData.issues.forEach(function(issue) {

      body.appendListItem(issue).setGlyphType(DocumentApp.GlyphType.BULLET);

    });

  } else {

    body.appendParagraph("No se detectaron problemas críticos evidentes.");

  }



  // ───────────── RECOMENDACIONES ─────────────

  appendHeading(body, "5. Recomendaciones", DocumentApp.ParagraphHeading.HEADING2);

  if (auditData.improvements && auditData.improvements.length > 0) {

    auditData.improvements.forEach(function(rec, i) {

      body.appendListItem((i + 1) + ". " + rec)
        .setGlyphType(DocumentApp.GlyphType.NUMBER);

    });

  }



  // ───────────── CTA FINAL ─────────────

  body.appendHorizontalRule();

  appendHeading(body, "¿Quieres mejorar estos resultados?", DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(
    "Podemos revisar este análisis contigo en una llamada gratuita y explicarte qué mejoras tendrían mayor impacto en el posicionamiento de tu web."
  );

  var link = body.appendParagraph(CONFIG.BOOKING_LINK);

  link.setAttributes({
    [DocumentApp.Attribute.BOLD]: true,
    [DocumentApp.Attribute.FONT_SIZE]: 12,
    [DocumentApp.Attribute.FOREGROUND_COLOR]: "#2563EB"
  });

  body.appendParagraph("\n— " + CONFIG.SENDER_NAME)
    .setAttributes({
      [DocumentApp.Attribute.ITALIC]: true
    });

}



// ── utilidades ─────────────────────────

function appendHeading(body, text, level) {

  var p = body.appendParagraph(text);

  p.setHeading(level);

  if (level === DocumentApp.ParagraphHeading.HEADING2) {

    p.setAttributes({
      [DocumentApp.Attribute.FOREGROUND_COLOR]: "#1F2937"
    });

  }

  return p;

}



function formatScore(score) {

  if (score === null || score === undefined) return "N/A";

  var icon = "●";

  return icon + " " + score + "/100";

}



function styleTable(table) {

  var headerRow = table.getRow(0);

  for (var c = 0; c < headerRow.getNumCells(); c++) {

    headerRow.getCell(c).setBackgroundColor("#1F2937");

    headerRow.getCell(c).editAsText()
      .setForegroundColor("#FFFFFF")
      .setBold(true);

  }

  for (var r = 1; r < table.getNumRows(); r++) {

    var row = table.getRow(r);

    var bg  = (r % 2 === 0) ? "#F3F4F6" : "#FFFFFF";

    for (var col = 0; col < row.getNumCells(); col++) {

      row.getCell(col).setBackgroundColor(bg);

    }

  }

}



function getOrCreateFolder(name) {

  var it = DriveApp.getFoldersByName(name);

  return it.hasNext() ? it.next() : DriveApp.createFolder(name);

}