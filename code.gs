// URL raw de GitHub donde vive el frontend. Cambia la rama/ruta si mueves el archivo.
var GITHUB_INDEX_URL = 'https://raw.githubusercontent.com/katwolo/feedback_sessions/claude/teacher-evaluation-code-gs-3mkzol/Index.html';

// ID del Google Sheet donde se exportan las evaluaciones
var SPREADSHEET_ID = '1CBaAA7ew3zWmthPP8Xba5prZDJ8_IdNfLj8mIUONylg';

function doGet() {
  var html = obtenerIndexDesdeGitHub();
  return HtmlService.createHtmlOutput(html)
      .setTitle('Evaluador Docente')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Descarga Index.html desde GitHub, usando una caché corta para no pedirlo en cada carga
function obtenerIndexDesdeGitHub() {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'index_html';
  var html = cache.get(cacheKey);

  if (!html) {
    var response = UrlFetchApp.fetch(GITHUB_INDEX_URL, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      throw new Error('No se pudo cargar Index.html desde GitHub (código ' + response.getResponseCode() + ')');
    }
    html = response.getContentText();
    cache.put(cacheKey, html, 300); // 5 minutos
  }

  return html;
}

// Devuelve la lista de alumnos simulada (puedes adaptarla para que lea de una hoja de cálculo)
function getEstudiantes(curso, modulo, clase, desdoblamiento) {
  // Alumnos de prueba para el prototipo
  return [
    { id: 1, nombre: "Álvarez Gómez, María" },
    { id: 2, nombre: "Bernal Ruiz, Javier" },
    { id: 3, nombre: "Castro Peña, Sofía" },
    { id: 4, nombre: "Delgado Soler, Lucas" },
    { id: 5, nombre: "Escribano Marín, Elena" },
    { id: 6, nombre: "Fernández Sanz, Hugo" },
    { id: 7, nombre: "García Ortiz, Carmen" },
    { id: 8, nombre: "Hernández Cruz, Diego" }
  ];
}

// Exporta las notas a una nueva pestaña del Google Sheet vinculado (SPREADSHEET_ID)
function exportarAGoogleSheets(datos) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var nombrePestaña = datos.clase + " - " + datos.modulo;
  if (datos.desdoblamiento && datos.desdoblamiento !== "General") {
    nombrePestaña += " (" + datos.desdoblamiento + ")";
  }

  // Limitar longitud del nombre de la pestaña por restricciones de Google Sheets (máx 30 chars)
  nombrePestaña = nombrePestaña.substring(0, 30);

  var sheet = ss.getSheetByName(nombrePestaña);
  if (!sheet) {
    sheet = ss.insertSheet(nombrePestaña);
  } else {
    sheet.clear();
  }

  // Escribir cabecera de metadatos
  sheet.appendRow(["Curso:", datos.curso, "Módulo:", datos.modulo]);
  sheet.appendRow(["Grupo:", datos.clase, "Desdoblamiento:", datos.desdoblamiento]);
  sheet.appendRow([]); // Línea de separación
  sheet.appendRow(["Nombre del Alumno", "Nota"]);

  // Preparar y ordenar alfabéticamente a los alumnos por apellidos/nombre
  var filas = [];
  datos.evaluaciones.forEach(function(item) {
    filas.push([item.nombre, item.nota || ""]);
  });

  filas.sort(function(a, b) {
    return a[0].localeCompare(b[0]);
  });

  // Insertar las filas
  if (filas.length > 0) {
    sheet.getRange(5, 1, filas.length, 2).setValues(filas);
  }

  // Formatear un poco la cabecera
  sheet.getRange("A1:D2").setFontWeight("bold");
  sheet.getRange("A4:B4").setFontWeight("bold").setBackground("#f3f4f6");

  return { success: true, url: ss.getUrl() };
}
