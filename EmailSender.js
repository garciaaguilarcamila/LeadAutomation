// ============================================================
//  EmailSender.gs — Envío de emails con Gmail
// ============================================================

/**
 * Envía el primer email con el informe PDF adjunto.
 * FIX 4: si no hay email válido → estado SIN_EMAIL (visible, no se pierde)
 *         en vez de avanzar silenciosamente a ESPERAR2.
 */
function sendEmail1(rowNum, rowData) {
  var email   = getField(rowData, "EMAIL_DETECTADO");
  var empresa = getField(rowData, "EMPRESA");
  var docUrl  = getField(rowData, "DOC_URL");

  // FIX 4: sin email válido → marcar SIN_EMAIL para gestión manual explícita
  if (!email || email.startsWith("SIN_") || email.startsWith("FORMULARIO:") || !isValidEmail(email)) {
    Logger.log("Email 1: sin email válido para " + empresa + ". Estado → SIN_EMAIL.");
    updateRow(rowNum, {
      ERROR: "Sin email válido — requiere gestión manual. Detectado: " + (email || "nada")
    });
    setStatus(rowNum, CONFIG.STATE.SIN_EMAIL);
    return;
  }

  try {
    var subject     = CONFIG.EMAIL1_SUBJECT.replace("{empresa}", empresa);
    var htmlBody    = buildEmail1Html(empresa, docUrl);
    var attachments = [];

    if (docUrl && docUrl.includes("drive.google.com")) {
      var fileId = extractDriveFileId(docUrl);
      if (fileId) {
        var file = DriveApp.getFileById(fileId);
        attachments.push(file.getAs("application/pdf"));
      }
    }

var destinatario = CONFIG.TEST_MODE ? CONFIG.TEST_EMAIL : email;
GmailApp.sendEmail(destinatario, subject, "", {
      htmlBody:    htmlBody,
      name:        CONFIG.SENDER_NAME,
      attachments: attachments
    });

    var hoy = new Date();
    updateRow(rowNum, {
      EMAIL1_FECHA:   Utilities.formatDate(hoy, "Europe/Madrid", "dd/MM/yyyy HH:mm"),
      FOLLOWUP_FECHA: addDays(hoy, CONFIG.FOLLOWUP_DAYS),
      ERROR:          ""   // limpiar error previo si lo había
    });
    setStatus(rowNum, CONFIG.STATE.ESPERAR2);
    Logger.log("✉️ Email 1 enviado a " + email + " (" + empresa + ")");

  } catch (e) {
    setError(rowNum, "sendEmail1 error: " + e.message);
  }
}

/**
 * Envía el segundo email de seguimiento.
 * FIX 4: si no hay email (no debería llegar aquí, pero por seguridad) → FINAL con nota.
 */
function sendEmail2(rowNum, rowData) {
  var email   = getField(rowData, "EMAIL_DETECTADO");
  var empresa = getField(rowData, "EMPRESA");
  var docUrl  = getField(rowData, "DOC_URL");

  // FIX 4: guardia explícita — si llegó aquí sin email, no descartamos silenciosamente
  if (!email || !isValidEmail(email)) {
    Logger.log("Email 2: sin email válido para " + empresa + ". Estado → SIN_EMAIL.");
    updateRow(rowNum, {
      ERROR: "sendEmail2: sin email válido para follow-up — revisión manual"
    });
    setStatus(rowNum, CONFIG.STATE.SIN_EMAIL);
    return;
  }

  try {
    var subject  = CONFIG.EMAIL2_SUBJECT.replace("{empresa}", empresa);
    var htmlBody = buildEmail2Html(empresa, docUrl);

var destinatario = CONFIG.TEST_MODE ? CONFIG.TEST_EMAIL : email;
GmailApp.sendEmail(destinatario, subject, "", {
      htmlBody: htmlBody,
      name:     CONFIG.SENDER_NAME
    });

    updateRow(rowNum, {
      EMAIL2_FECHA: Utilities.formatDate(new Date(), "Europe/Madrid", "dd/MM/yyyy HH:mm"),
      ERROR:        ""
    });
    setStatus(rowNum, CONFIG.STATE.FINAL);
    Logger.log("✉️ Email 2 enviado a " + email + " (" + empresa + ")");

  } catch (e) {
    setError(rowNum, "sendEmail2 error: " + e.message);
  }
}

// ── Plantillas HTML de emails ────────────────────────────────────

function buildEmail1Html(empresa, docUrl) {

var informeBtn = docUrl
? '<a href="'+docUrl+'" style="background:#2563eb;color:white;padding:14px 26px;border-radius:6px;text-decoration:none;font-weight:500;">Ver informe SEO</a>'
: "";

var reservaBtn =
'<a href="'+CONFIG.BOOKING_LINK+'" style="background:#111827;color:white;padding:14px 26px;border-radius:6px;text-decoration:none;font-weight:500;">Reservar llamada</a>';

return `
<html>
<body style="margin:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="padding:40px 0;">

<table width="600" style="background:#ffffff;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,0.06);">

<tr>
<td style="padding:30px 40px;border-bottom:1px solid #eee;">
<h2 style="margin:0;color:#111827;font-weight:600;">
Análisis SEO gratuito
</h2>
</td>
</tr>

<tr>
<td style="padding:40px;color:#374151;font-size:15px;line-height:1.7;">

<p>Hola,</p>

<p>
Soy <strong>${CONFIG.SENDER_NAME}</strong>.
He revisado brevemente la web de <strong>${empresa}</strong> y he detectado
algunas oportunidades de mejora en SEO.
</p>

<p>
He preparado un pequeño informe con los puntos más relevantes.
</p>

<div style="margin:30px 0;text-align:center;">
${informeBtn}
</div>

<p>
Si te parece interesante, podemos comentarlo en una llamada breve
y explicarte qué mejoras podrían tener mayor impacto.
</p>

<div style="margin:25px 0;text-align:center;">
${reservaBtn}
</div>

<p>
Un saludo,<br>
<strong>${CONFIG.SENDER_NAME}</strong>
</p>

</td>
</tr>

<tr>
<td style="background:#f9fafb;padding:16px;text-align:center;font-size:11px;color:#9ca3af;">
Si no deseas recibir más correos, responde con BAJA.
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;
}

function buildEmail2Html(empresa, docUrl) {
  var reservaBtn = '<a href="' + CONFIG.BOOKING_LINK + '" style="background:#34a853;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;margin:8px 0;">📅 Reservar Llamada Gratuita (30 min)</a>';

  return '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">'
    + '<div style="background:linear-gradient(135deg,#34a853,#1b5e20);padding:30px;border-radius:10px 10px 0 0;text-align:center;">'
    + '<h1 style="color:#fff;margin:0;font-size:22px;">👋 Solo un recordatorio</h1></div>'
    + '<div style="background:#fff;padding:30px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 10px 10px;">'
    + '<p>Hola,</p>'
    + '<p>Te escribo de nuevo porque hace unos días te envié el <strong>informe SEO gratuito de '
    + empresa + '</strong> y quería asegurarme de que llegó correctamente.</p>'
    + '<p>Si tienes dudas sobre los resultados o quieres que los revisemos juntos, '
    + 'la llamada gratuita sigue disponible:</p>'
    + '<p style="text-align:center;">' + reservaBtn + '</p>'
    + '<p>Si ya lo revisaste y no es el momento, lo entiendo perfectamente y no vuelvo a escribirte.</p>'
    + '<p>Un saludo,<br><strong>' + CONFIG.SENDER_NAME + '</strong></p>'
    + '</div>'
    + '<p style="color:#999;font-size:11px;text-align:center;margin-top:10px;">'
    + 'Si no deseas recibir más correos de este tipo, responde con "BAJA" en el asunto.</p>'
    + '</body></html>';
}

// ── Utilidades ───────────────────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function extractDriveFileId(url) {
  var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}