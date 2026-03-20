🚀 LeadAutomationPro

Sistema automatizado de captación y contacto de leads SEO — desarrollado íntegramente en Google Apps Script.


📋 Descripción
LeadAutomationPro es un sistema de automatización de marketing que permite a una agencia de marketing/SEO captar, analizar y contactar empresas de forma automática y sin intervención manual.
El sistema busca empresas locales en Google Maps, analiza la calidad de su web mediante Google Lighthouse, genera un informe SEO personalizado en PDF y lo envía por correo electrónico con una propuesta de mejora.

💡 100% Google Apps Script — Sin n8n, Zapier ni Make. Todo el flujo se ejecuta dentro del ecosistema de Google: sin nodos externos, sin webhooks intermedios y sin dependencias de terceros.


⚙️ ¿Cómo funciona?
El sistema opera como un pipeline de estados. Cada lead avanza automáticamente por las siguientes etapas:
EstadoDescripciónENRIQUECERBúsqueda del email de la empresa (scraping HTML, Google Search, formularios)AUDITARAnálisis web con Google PageSpeed Insights (móvil y escritorio)INFORMEGeneración del PDF con el informe SEO y subida a Google DriveENVIAR1Envío del primer email con el informe adjunto y botón de CalendlyESPERAR2Espera N días configurables antes del seguimientoENVIAR2Envío del segundo email de seguimiento automáticoFINALProceso completado para ese leadSIN_EMAILEmail no encontrado → gestión manual visible en la hoja
El motor principal (Code.gs) ejecuta el pipeline cada 30 minutos mediante un trigger automático de Apps Script.

🔧 Módulos del sistema
📍 Captación de leads

Búsqueda de empresas locales vía SerpApi (Google Maps)
3 empresas nuevas por ejecución (respeta el límite de 100 búsquedas/mes gratuitas)
Detección y descarte automático de duplicados
Ejecución diaria automática a las 9:00

📧 Búsqueda de email (3 capas)

Scraping HTML — mailto:, emails visibles, emails ofuscados y datos Schema.org/JSON-LD
Google Programmable Search — emails indexados en Google para el dominio
Detección de formulario — como alternativa si no hay email disponible

📊 Auditoría SEO

Análisis con Google PageSpeed Insights API
Puntuaciones Lighthouse: rendimiento, SEO, accesibilidad y buenas prácticas
Checks técnicos: HTTPS, title, meta description, H1, viewport, Open Graph y canonical
Resultados en móvil y escritorio

📄 Generación de informe PDF

Informe personalizado generado en Google Docs y exportado a PDF
Incluye: resumen ejecutivo, tabla Lighthouse con código de colores, checks técnicos, problemas detectados y recomendaciones priorizadas
Subido a Google Drive con acceso público por enlace

✉️ Envío de emails

Email 1: informe PDF adjunto + botón de reserva de llamada gratuita vía Calendly
Email 2: seguimiento automático N días después (configurable)
Formato HTML responsive enviado desde Gmail


🛠️ Tecnologías utilizadas

Google Apps Script
Google Sheets — base de datos del pipeline
Google Drive — almacenamiento de informes PDF
Gmail — envío de emails
Google PageSpeed Insights API
SerpApi — captación de leads desde Google Maps


📁 Informes generados
Todos los informes PDF se guardan automáticamente en una carpeta de Google Drive con permisos de acceso público por enlace, organizados por empresa y fecha de análisis.
