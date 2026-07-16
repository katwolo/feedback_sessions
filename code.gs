// URL raw de GitHub on viu el frontend. Canvia la branca/ruta si mous l'arxiu.
var GITHUB_INDEX_URL = 'https://raw.githubusercontent.com/katwolo/feedback_sessions/claude/teacher-evaluation-code-gs-3mkzol/index.html';

// ID del Google Sheet on s'exporten les avaluacions
var SPREADSHEET_ID = '1CBaAA7ew3zWmthPP8Xba5prZDJ8_IdNfLj8mIUONylg';

// Correus amb permís per obrir l'app. Afegeix aquí més adreces separades per coma.
// Aquesta comprovació només és fiable si el desplegament exigeix inici de sessió
// (Implementar > Qui té accés: "Només jo" o "Qualsevol usuari de la teva organització").
var CORREUS_AUTORITZATS = ['ivanfoios@gmail.com'];

var NOM_CONFIGURACIO = "🔧 Configuració";
var NOM_ALUMNAT = "👥 Alumnat";
var NOM_HISTORIAL = "🗄 Historial";

var COLOR_CAPCALERA = "#4f46e5";

function doGet() {
  var email = Session.getActiveUser().getEmail();
  if (CORREUS_AUTORITZATS.indexOf(email) === -1) {
    return HtmlService.createHtmlOutput(
        '<p style="font-family:sans-serif;padding:2rem;text-align:center;color:#475569;">Accés no autoritzat.</p>')
        .setTitle('Accés denegat');
  }

  var html = obtenirIndexDesDeGitHub();
  return HtmlService.createHtmlOutput(html)
      .setTitle('Avaluador Docent')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Descarrega index.html des de GitHub, amb una memòria cau curta per no demanar-lo a cada càrrega
function obtenirIndexDesDeGitHub() {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'index_html';
  var html = cache.get(cacheKey);

  if (!html) {
    var response = UrlFetchApp.fetch(GITHUB_INDEX_URL, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      throw new Error('No s\'ha pogut carregar index.html des de GitHub (codi ' + response.getResponseCode() + ')');
    }
    html = response.getContentText();
    cache.put(cacheKey, html, 300); // 5 minuts
  }

  return html;
}

// Llista les classes conegudes (valors únics de la columna Classe a "👥 Alumnat")
function listarClasses() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarAlumnat(ss);

  var files = hoja.getDataRange().getValues();
  var classes = {};

  for (var i = 1; i < files.length; i++) { // fila 0 = capçalera
    var classe = String(files[i][3]).trim();
    if (classe) classes[classe] = true;
  }

  return Object.keys(classes).sort(function(a, b) { return a.localeCompare(b); });
}

// Llista els alumnes ja coneguts d'una classe (valors únics de la columna Alumnat)
function obtenirAlumnes(classe) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarAlumnat(ss);

  var files = hoja.getDataRange().getValues();
  var alumnes = {};

  for (var i = 1; i < files.length; i++) {
    var classeFila = String(files[i][3]).trim();
    var nom = String(files[i][5]).trim();
    if (classeFila === classe && nom) alumnes[nom] = true;
  }

  return Object.keys(alumnes).sort(function(a, b) { return a.localeCompare(b); });
}

// Llegeix els criteris d'avaluació configurats per a un mòdul, validant que els pesos sumin 100
function obtenirCriteris(modul) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarConfiguracio(ss);

  var files = hoja.getDataRange().getValues();
  var criteris = [];

  for (var i = 1; i < files.length; i++) { // fila 0 = capçalera
    var modulReferencia = String(files[i][0]).trim();
    var nomCriteri = String(files[i][1]).trim();
    var pes = Number(files[i][2]);

    if (modulReferencia === modul && nomCriteri && !isNaN(pes)) {
      criteris.push({ nom: nomCriteri, pes: pes });
    }
  }

  if (criteris.length === 0) {
    return [{ nom: "Nota", pes: 100 }];
  }

  var sumaPesos = criteris.reduce(function(acumulat, c) { return acumulat + c.pes; }, 0);
  if (Math.round(sumaPesos) !== 100) {
    throw new Error('Els pesos dels criteris de "' + modul + '" sumen ' + sumaPesos +
        '%, han de sumar 100%. Revisa la pestanya "' + NOM_CONFIGURACIO + '".');
  }

  return criteris;
}

// Construeix la clau única d'una fila d'Alumnat (identifica una avaluació concreta)
function construirClau(curs, modul, classe, desdoblament, alumne, sessioAvaluada) {
  return [curs, modul, classe, desdoblament, alumne, sessioAvaluada].join('|');
}

// Executa aquesta funció un cop manualment des de l'editor (Executar > configurarRegistre)
// per organitzar el full de càlcul encara que no s'hagi exportat cap avaluació.
function configurarRegistre() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  asegurarConfiguracio(ss);
  asegurarAlumnat(ss);
  asegurarHistorial(ss);
  netejarFullDefecte(ss);
}

// Exporta les notes d'una sessió avaluada. Fa "upsert" a "👥 Alumnat" (actualitza si ja existeix
// la mateixa clau, si no l'afegeix) i sempre afegeix el desglossament per criteri a "🗄 Historial".
function exportarAGoogleSheets(dades, confirmat) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var fullAlumnat = asegurarAlumnat(ss);
  asegurarConfiguracio(ss);
  asegurarHistorial(ss);

  var criteris = obtenirCriteris(dades.modul);

  // Només es exporten alumnes amb algun criteri omplert
  var avaluacions = dades.evaluacions
      .map(function(item) {
        var notes = {};
        criteris.forEach(function(c) {
          var valor = item.notes ? item.notes[c.nom] : undefined;
          if (valor !== undefined && valor !== null && valor !== "") {
            notes[c.nom] = Number(valor);
          }
        });
        return {
          nom: item.nom,
          notes: notes,
          observacioGrup: item.observacioGrup || "",
          observacioIndividual: item.observacioIndividual || ""
        };
      })
      .filter(function(item) { return Object.keys(item.notes).length > 0; });

  if (avaluacions.length === 0) {
    throw new Error("No hi ha cap nota per exportar.");
  }

  avaluacions.sort(function(a, b) { return a.nom.localeCompare(b.nom); });

  // Localitzar files existents a Alumnat per la mateixa clau única
  var dadesAlumnat = fullAlumnat.getDataRange().getValues();
  var filaPerClau = {};
  for (var i = 1; i < dadesAlumnat.length; i++) {
    var clauExistent = construirClau(dadesAlumnat[i][1], dadesAlumnat[i][2], dadesAlumnat[i][3],
        dadesAlumnat[i][4], dadesAlumnat[i][5], dadesAlumnat[i][6]);
    filaPerClau[clauExistent] = i + 1; // getRange usa índex base 1
  }

  var xocs = [];
  avaluacions.forEach(function(av) {
    var clau = construirClau(dades.curs, dades.modul, dades.classe, dades.desdoblament, av.nom, dades.sessioAvaluada);
    if (filaPerClau[clau]) xocs.push(filaPerClau[clau]);
  });

  if (xocs.length > 0 && !confirmat) {
    return {
      necessitaConfirmacio: true,
      ultimaActualitzacio: dadesAlumnat[xocs[0] - 1][0] // columna Data
    };
  }

  var ara = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

  avaluacions.forEach(function(av) {
    var notaFinal = 0;
    var criterisCompletos = true;

    criteris.forEach(function(c) {
      var valor = av.notes[c.nom];
      if (valor !== undefined) {
        notaFinal += valor * (c.pes / 100);
      } else {
        criterisCompletos = false;
      }
    });

    var fila = [ara, dades.curs, dades.modul, dades.classe, dades.desdoblament, av.nom, dades.sessioAvaluada,
        av.observacioGrup, av.observacioIndividual,
        criterisCompletos ? Math.round(notaFinal * 100) / 100 : ""];

    var clau = construirClau(dades.curs, dades.modul, dades.classe, dades.desdoblament, av.nom, dades.sessioAvaluada);
    if (filaPerClau[clau]) {
      fullAlumnat.getRange(filaPerClau[clau], 1, 1, fila.length).setValues([fila]);
    } else {
      fullAlumnat.appendRow(fila);
    }
  });

  registrarHistorial(ss, dades, avaluacions, ara);

  return { success: true, url: ss.getUrl() };
}

// Aplica el format de capçalera comú (negreta, fons indigo, text blanc) a la primera fila
function aplicarEstilCapcalera(hoja, capcalera) {
  hoja.getRange(1, 1, 1, capcalera.length).setValues([capcalera])
      .setFontWeight("bold").setBackground(COLOR_CAPCALERA).setFontColor("#ffffff");
}

// Crea un filtre bàsic sobre la pestanya (amb marge per a files futures), si encara no en té
function aplicarFiltre(hoja, numCols) {
  if (hoja.getFilter()) return;
  hoja.getRange(1, 1, 1000, numCols).createFilter();
}

// Aplica una escala de color vermell-groc-verd a una columna de notes
function aplicarEscalaColor(hoja, columna) {
  var rang = hoja.getRange(2, columna, 999, 1);
  var regla = SpreadsheetApp.newConditionalFormatRule()
      .setGradientMaxpoint("#34a853")
      .setGradientMidpointWithValue("#fbbc04", SpreadsheetApp.InterpolationType.NUMBER, "5")
      .setGradientMinpoint("#ea4335")
      .setRanges([rang])
      .build();

  var regles = hoja.getConditionalFormatRules();
  regles.push(regla);
  hoja.setConditionalFormatRules(regles);
}

// Crea (si no existeix) la pestanya on el professor configura els criteris d'avaluació per mòdul
function asegurarConfiguracio(ss) {
  var hoja = ss.getSheetByName(NOM_CONFIGURACIO);
  if (hoja) return hoja;

  hoja = ss.insertSheet(NOM_CONFIGURACIO, 0);

  var capcalera = ["Mòdul", "Criteri", "Pes (%)"];
  aplicarEstilCapcalera(hoja, capcalera);

  var exemple = [
    ["Individuals Aigua", "Diu l'objectiu de la sessió", 10],
    ["Individuals Aigua", "Bona presentació", 10],
    ["Individuals Aigua", "Coordinació grupal", 20],
    ["Individuals Aigua", "Activitats adients als participants", 20],
    ["Individuals Aigua", "Els participants s'ho han passat molt bé", 40]
  ];
  hoja.getRange(2, 1, exemple.length, 3).setValues(exemple)
      .setFontColor("#94a3b8").setFontStyle("italic");

  hoja.getRange("E1").setValue(
      "Afegeix una fila per cada criteri de cada mòdul. Els pesos d'un mateix mòdul han de sumar 100.")
      .setFontStyle("italic").setFontColor("#64748b");

  hoja.setColumnWidths(1, 2, 200);
  hoja.setColumnWidth(3, 100);
  hoja.setFrozenRows(1);

  return hoja;
}

// Crea (si no existeix) la pestanya de resultats "👥 Alumnat"
function asegurarAlumnat(ss) {
  var hoja = ss.getSheetByName(NOM_ALUMNAT);
  if (hoja) return hoja;

  hoja = ss.insertSheet(NOM_ALUMNAT, 1);

  var capcalera = ["Data", "Curs", "Mòdul", "Classe", "Desdobl.", "Alumnat",
      "Sessió avaluada", "Observacions grup", "Observacions individual", "Nota final"];
  aplicarEstilCapcalera(hoja, capcalera);

  hoja.setColumnWidth(1, 110);
  hoja.setColumnWidth(2, 70);
  hoja.setColumnWidth(3, 150);
  hoja.setColumnWidth(4, 80);
  hoja.setColumnWidth(5, 90);
  hoja.setColumnWidth(6, 180);
  hoja.setColumnWidth(7, 170);
  hoja.setColumnWidth(8, 220);
  hoja.setColumnWidth(9, 220);
  hoja.setColumnWidth(10, 90);
  hoja.setFrozenRows(1);

  aplicarFiltre(hoja, capcalera.length);
  aplicarEscalaColor(hoja, 10);

  return hoja;
}

// Crea (si no existeix) la pestanya d'historial append-only: mai s'esborra, només s'afegeix
function asegurarHistorial(ss) {
  var hoja = ss.getSheetByName(NOM_HISTORIAL);
  if (hoja) return hoja;

  hoja = ss.insertSheet(NOM_HISTORIAL);

  var capcalera = ["Data", "Curs", "Mòdul", "Classe", "Desd.", "Alumnat", "Sessió avaluada", "Criteri", "Nota"];
  aplicarEstilCapcalera(hoja, capcalera);

  hoja.setColumnWidths(1, capcalera.length, 130);
  hoja.setFrozenRows(1);

  aplicarFiltre(hoja, capcalera.length);
  aplicarEscalaColor(hoja, 9);

  return hoja;
}

// Afegeix una fila per cada alumne i criteri exportat, sense esborrar mai l'historial previ
function registrarHistorial(ss, dades, avaluacions, ara) {
  var hoja = asegurarHistorial(ss);
  var files = [];

  avaluacions.forEach(function(av) {
    Object.keys(av.notes).forEach(function(criteri) {
      files.push([ara, dades.curs, dades.modul, dades.classe, dades.desdoblament,
          av.nom, dades.sessioAvaluada, criteri, av.notes[criteri]]);
    });
  });

  if (files.length > 0) {
    hoja.getRange(hoja.getLastRow() + 1, 1, files.length, files[0].length).setValues(files);
  }
}

// Elimina la pestanya en blanc per defecte d'un Sheet nou, si segueix buida
function netejarFullDefecte(ss) {
  ["Hoja 1", "Sheet1", "Full1"].forEach(function(nom) {
    var full = ss.getSheetByName(nom);
    if (full && ss.getSheets().length > 1 && full.getLastRow() === 0) {
      ss.deleteSheet(full);
    }
  });
}
