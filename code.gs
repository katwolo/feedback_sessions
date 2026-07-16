// URL raw de GitHub donde vive el frontend. Cambia la rama/ruta si mueves el archivo.
var GITHUB_INDEX_URL = 'https://raw.githubusercontent.com/katwolo/feedback_sessions/claude/teacher-evaluation-code-gs-3mkzol/index.html';

// ID del Google Sheet donde se exportan las evaluaciones
var SPREADSHEET_ID = '1CBaAA7ew3zWmthPP8Xba5prZDJ8_IdNfLj8mIUONylg';

// Correos con permiso para abrir la app. Añade aquí más direcciones separadas por coma.
// Esta comprobación solo es fiable si el despliegue exige inicio de sesión
// (Implementar > Quién tiene acceso: "Solo yo" o "Cualquiera de tu organización").
var CORREOS_AUTORIZADOS = ['ivanfoios@gmail.com'];

var NOMBRE_INDICE = "📋 Índice";
var NOMBRE_CONFIGURACION = "🔧 Configuración";
var NOMBRE_HISTORIAL = "🗄 Historial";

function doGet() {
  var email = Session.getActiveUser().getEmail();
  if (CORREOS_AUTORIZADOS.indexOf(email) === -1) {
    return HtmlService.createHtmlOutput(
        '<p style="font-family:sans-serif;padding:2rem;text-align:center;color:#475569;">Acceso no autorizado.</p>')
        .setTitle('Acceso denegado');
  }

  var html = obtenerIndexDesdeGitHub();
  return HtmlService.createHtmlOutput(html)
      .setTitle('Evaluador Docente')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Descarga index.html desde GitHub, usando una caché corta para no pedirlo en cada carga
function obtenerIndexDesdeGitHub() {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'index_html';
  var html = cache.get(cacheKey);

  if (!html) {
    var response = UrlFetchApp.fetch(GITHUB_INDEX_URL, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      throw new Error('No se pudo cargar index.html desde GitHub (código ' + response.getResponseCode() + ')');
    }
    html = response.getContentText();
    cache.put(cacheKey, html, 300); // 5 minutos
  }

  return html;
}

// Lista los cursos activos de Google Classroom donde el usuario es profesor
function listarCursosClassroom() {
  var cursos = [];
  var pageToken;

  do {
    var respuesta = Classroom.Courses.list({
      teacherId: 'me',
      courseStates: ['ACTIVE'],
      pageToken: pageToken
    });
    (respuesta.courses || []).forEach(function(curso) {
      cursos.push({ id: curso.id, nombre: curso.name });
    });
    pageToken = respuesta.nextPageToken;
  } while (pageToken);

  cursos.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });
  return cursos;
}

// Devuelve el alumnado real de un curso de Classroom (claseId = courseId)
function getEstudiantes(claseId) {
  var alumnos = [];
  var pageToken;

  do {
    var respuesta = Classroom.Courses.Students.list(claseId, {
      pageSize: 100,
      pageToken: pageToken
    });
    (respuesta.students || []).forEach(function(alumno) {
      var nombre = (alumno.profile && alumno.profile.name) || {};
      var nombreCompleto = nombre.familyName
          ? nombre.familyName + ', ' + nombre.givenName
          : (nombre.fullName || 'Alumno sin nombre');
      alumnos.push({ id: alumno.userId, nombre: nombreCompleto });
    });
    pageToken = respuesta.nextPageToken;
  } while (pageToken);

  alumnos.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });
  return alumnos;
}

// Lee los criterios de evaluación configurados para un módulo, validando que sus pesos sumen 100
function obtenerCriterios(modulo) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarConfiguracion(ss);

  var filas = hoja.getDataRange().getValues();
  var criterios = [];

  for (var i = 1; i < filas.length; i++) { // fila 0 = cabecera
    var modReferencia = String(filas[i][0]).trim();
    var nombreCriterio = String(filas[i][1]).trim();
    var peso = Number(filas[i][2]);

    if (modReferencia === modulo && nombreCriterio && !isNaN(peso)) {
      criterios.push({ nombre: nombreCriterio, peso: peso });
    }
  }

  if (criterios.length === 0) {
    return [{ nombre: "Nota", peso: 100 }];
  }

  var sumaPesos = criterios.reduce(function(acumulado, c) { return acumulado + c.peso; }, 0);
  if (Math.round(sumaPesos) !== 100) {
    throw new Error('Los pesos de los criterios de "' + modulo + '" suman ' + sumaPesos +
        '%, deben sumar 100%. Revisa la pestaña "' + NOMBRE_CONFIGURACION + '".');
  }

  return criterios;
}

// Ejecuta esta función una vez manualmente desde el editor (Ejecutar > configurarRegistro)
// para organizar la hoja de cálculo aunque todavía no se haya exportado ninguna clase.
function configurarRegistro() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  asegurarIndice(ss);
  asegurarConfiguracion(ss);
  asegurarHistorial(ss);
}

// Exporta las notas a una pestaña del Google Sheet vinculado (SPREADSHEET_ID).
// Si la pestaña ya existe y no se ha confirmado, no escribe nada y avisa de cuándo fue la última exportación.
function exportarAGoogleSheets(datos, confirmado) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  asegurarIndice(ss);
  asegurarConfiguracion(ss);

  var criterios = obtenerCriterios(datos.modulo);

  var nombrePestaña = datos.clase + " - " + datos.modulo;
  if (datos.desdoblamiento && datos.desdoblamiento !== "General") {
    nombrePestaña += " (" + datos.desdoblamiento + ")";
  }
  // Limitar longitud del nombre de la pestaña por restricciones de Google Sheets (máx 30 chars)
  nombrePestaña = nombrePestaña.substring(0, 30);

  var yaExiste = !!ss.getSheetByName(nombrePestaña);
  if (yaExiste && !confirmado) {
    return {
      necesitaConfirmacion: true,
      ultimaActualizacion: obtenerUltimaActualizacion(ss, nombrePestaña)
    };
  }

  // Solo se exportan alumnos con al menos un criterio relleno (permite exportar un desdoblamiento parcial)
  var evaluaciones = datos.evaluaciones
      .map(function(item) {
        var notas = {};
        criterios.forEach(function(c) {
          var valor = item.notas ? item.notas[c.nombre] : undefined;
          if (valor !== undefined && valor !== null && valor !== "") {
            notas[c.nombre] = Number(valor);
          }
        });
        return { nombre: item.nombre, notas: notas };
      })
      .filter(function(item) { return Object.keys(item.notas).length > 0; });

  evaluaciones.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });

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

  var cabecera = ["Nombre del Alumno"]
      .concat(criterios.map(function(c) { return c.nombre + " (" + c.peso + "%)"; }))
      .concat(["Nota Final"]);
  sheet.appendRow(cabecera);

  // Calcular la nota final ponderada de cada alumno con los pesos oficiales del servidor
  var filas = evaluaciones.map(function(item) {
    var fila = [item.nombre];
    var notaFinal = 0;
    var criteriosCompletos = true;

    criterios.forEach(function(c) {
      var valor = item.notas[c.nombre];
      fila.push(valor !== undefined ? valor : "");
      if (valor !== undefined) {
        notaFinal += valor * (c.peso / 100);
      } else {
        criteriosCompletos = false;
      }
    });

    fila.push(criteriosCompletos ? Math.round(notaFinal * 100) / 100 : "");
    return fila;
  });

  if (filas.length > 0) {
    sheet.getRange(5, 1, filas.length, cabecera.length).setValues(filas);
  }

  // Formatear cabecera
  sheet.getRange("A1:D2").setFontWeight("bold");
  sheet.getRange(4, 1, 1, cabecera.length).setFontWeight("bold").setBackground("#f3f4f6");
  sheet.getRange(4, cabecera.length).setBackground("#fef3c7");
  if (filas.length > 0) {
    sheet.getRange(5, cabecera.length, filas.length, 1).setFontWeight("bold");
  }
  sheet.autoResizeColumns(1, cabecera.length);

  // Anclar la pestaña justo después del índice
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(ss.getSheetByName(NOMBRE_INDICE).getIndex() + 1);

  var fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  actualizarIndice(ss, nombrePestaña, datos, evaluaciones.length, fecha);
  registrarHistorial(ss, datos, evaluaciones, fecha);

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

// Crea (si no existe) la pestaña donde el profesor configura los criterios de evaluación por módulo
function asegurarConfiguracion(ss) {
  var hoja = ss.getSheetByName(NOMBRE_CONFIGURACION);
  if (hoja) return hoja;

  hoja = ss.insertSheet(NOMBRE_CONFIGURACION, 1);

  var cabecera = ["Módulo", "Criterio", "Peso (%)"];
  hoja.getRange(1, 1, 1, cabecera.length).setValues([cabecera])
      .setFontWeight("bold").setBackground("#4f46e5").setFontColor("#ffffff");

  var ejemplo = [
    ["Socio-Deportivo", "Actitud", 20],
    ["Socio-Deportivo", "Trabajo en grupo", 30],
    ["Socio-Deportivo", "Examen", 50]
  ];
  hoja.getRange(2, 1, ejemplo.length, 3).setValues(ejemplo)
      .setFontColor("#94a3b8").setFontStyle("italic");

  hoja.getRange("E1").setValue(
      "Añade una fila por cada criterio de cada módulo. Los pesos de un mismo módulo deben sumar 100.")
      .setFontStyle("italic").setFontColor("#64748b");

  hoja.setColumnWidths(1, 2, 180);
  hoja.setColumnWidth(3, 100);
  hoja.setFrozenRows(1);

  return hoja;
}

// Crea (si no existe) la pestaña de historial append-only: nunca se borra, solo se añade
function asegurarHistorial(ss) {
  var hoja = ss.getSheetByName(NOMBRE_HISTORIAL);
  if (hoja) return hoja;

  hoja = ss.insertSheet(NOMBRE_HISTORIAL);

  var cabecera = ["Fecha", "Curso", "Módulo", "Clase", "Desdoblamiento", "Alumno", "Criterio", "Nota"];
  hoja.getRange(1, 1, 1, cabecera.length).setValues([cabecera])
      .setFontWeight("bold").setBackground("#4f46e5").setFontColor("#ffffff");

  hoja.setColumnWidths(1, cabecera.length, 130);
  hoja.setFrozenRows(1);

  return hoja;
}

// Añade una fila por cada alumno y criterio exportado, sin borrar nunca el historial previo
function registrarHistorial(ss, datos, evaluaciones, fecha) {
  var hoja = asegurarHistorial(ss);
  var filas = [];

  evaluaciones.forEach(function(alumno) {
    Object.keys(alumno.notas).forEach(function(criterio) {
      filas.push([fecha, datos.curso, datos.modulo, datos.clase, datos.desdoblamiento,
          alumno.nombre, criterio, alumno.notas[criterio]]);
    });
  });

  if (filas.length > 0) {
    hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
  }
}

// Busca en el Índice la fecha de la última exportación de una pestaña, o null si nunca se exportó
function obtenerUltimaActualizacion(ss, nombrePestaña) {
  var indice = ss.getSheetByName(NOMBRE_INDICE);
  if (!indice) return null;

  var datosIndice = indice.getDataRange().getValues();
  for (var i = 4; i < datosIndice.length; i++) {
    if (datosIndice[i][0] === nombrePestaña) {
      return datosIndice[i][6]; // columna "Última actualización"
    }
  }
  return null;
}

// Añade o actualiza la fila del índice correspondiente a una pestaña de clase
function actualizarIndice(ss, nombrePestaña, datos, nAlumnos, fecha) {
  var indice = ss.getSheetByName(NOMBRE_INDICE);
  var datosIndice = indice.getDataRange().getValues();
  var filaExistente = -1;

  for (var i = 4; i < datosIndice.length; i++) {
    if (datosIndice[i][0] === nombrePestaña) {
      filaExistente = i + 1; // getRange usa índice base 1
      break;
    }
  }

  var gid = ss.getSheetByName(nombrePestaña).getSheetId();
  var enlace = '=HYPERLINK("#gid=' + gid + '"; "Abrir")';
  var fila = [nombrePestaña, datos.curso, datos.modulo, datos.clase, datos.desdoblamiento, nAlumnos, fecha, enlace];

  if (filaExistente > 0) {
    indice.getRange(filaExistente, 1, 1, fila.length).setValues([fila]);
  } else {
    indice.appendRow(fila);
  }
}
