// URL raw de GitHub donde vive el frontend. Cambia la rama/ruta si mueves el archivo.
var GITHUB_INDEX_URL = 'https://raw.githubusercontent.com/katwolo/feedback_sessions/claude/teacher-evaluation-code-gs-3mkzol/index.html';

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

var NOMBRE_INDICE = "📋 Índice";

// Ejecuta esta función una vez manualmente desde el editor (Ejecutar > configurarRegistro)
// para organizar la hoja de cálculo aunque todavía no se haya exportado ninguna clase.
function configurarRegistro() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  asegurarIndice(ss);
}

// Exporta las notas a una nueva pestaña del Google Sheet vinculado (SPREADSHEET_ID)
function exportarAGoogleSheets(datos) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  asegurarIndice(ss);

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

  // Ajustar ancho de columnas y anclar la pestaña justo después del índice
  sheet.autoResizeColumns(1, 2);
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(ss.getSheetByName(NOMBRE_INDICE).getIndex() + 1);

  actualizarIndice(ss, nombrePestaña, datos);

  return { success: true, url: ss.getUrl() };
}

// Crea (si no existe) la pestaña de Índice con cabecera y formato, y limpia la
// pestaña en blanco que Google Sheets crea por defecto ("Hoja 1" / "Sheet1").
function asegurarIndice(ss) {
  var indice = ss.getSheetByName(NOMBRE_INDICE);

  if (!indice) {
    indice = ss.insertSheet(NOMBRE_INDICE, 0);

    indice.getRange("A1").setValue("Registro de Evaluación Docente")
        .setFontSize(16).setFontWeight("bold").setFontColor("#4f46e5");
    indice.getRange("A2").setValue(
        "Cada exportación desde la app crea o actualiza una pestaña por clase y módulo. Este índice se mantiene solo.")
        .setFontStyle("italic").setFontColor("#64748b");

    var cabecera = ["Pestaña", "Curso", "Módulo", "Clase", "Desdoblamiento", "Nº Alumnos", "Última actualización", "Acceso directo"];
    indice.getRange(4, 1, 1, cabecera.length).setValues([cabecera])
        .setFontWeight("bold").setBackground("#4f46e5").setFontColor("#ffffff");

    indice.setColumnWidths(1, 5, 150);
    indice.setColumnWidth(6, 90);
    indice.setColumnWidth(7, 140);
    indice.setColumnWidth(8, 110);
    indice.setFrozenRows(4);
  }

  // Elimina la pestaña en blanco por defecto de un Sheet nuevo, si sigue vacía
  ["Hoja 1", "Sheet1"].forEach(function(nombre) {
    var hojaDefecto = ss.getSheetByName(nombre);
    if (hojaDefecto && ss.getSheets().length > 1 && hojaDefecto.getLastRow() === 0) {
      ss.deleteSheet(hojaDefecto);
    }
  });

  return indice;
}

// Añade o actualiza la fila del índice correspondiente a una pestaña de clase
function actualizarIndice(ss, nombrePestaña, datos) {
  var indice = ss.getSheetByName(NOMBRE_INDICE);
  var datosIndice = indice.getDataRange().getValues();
  var filaExistente = -1;

  for (var i = 4; i < datosIndice.length; i++) {
    if (datosIndice[i][0] === nombrePestaña) {
      filaExistente = i + 1; // getRange usa índice base 1
      break;
    }
  }

  var fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  var gid = ss.getSheetByName(nombrePestaña).getSheetId();
  var enlace = '=HYPERLINK("#gid=' + gid + '"; "Abrir")';
  var fila = [nombrePestaña, datos.curso, datos.modulo, datos.clase, datos.desdoblamiento, datos.evaluaciones.length, fecha, enlace];

  if (filaExistente > 0) {
    indice.getRange(filaExistente, 1, 1, fila.length).setValues([fila]);
  } else {
    indice.appendRow(fila);
  }
}
