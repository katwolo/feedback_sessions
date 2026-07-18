// ID del Google Sheet on s'exporten les avaluacions
var SPREADSHEET_ID = '1CBaAA7ew3zWmthPP8Xba5prZDJ8_IdNfLj8mIUONylg';

// Clau compartida que el frontend (allotjat a GitHub Pages) ha d'enviar a cada petició.
// No és seguretat real (és visible al codi font públic d'index.html), només evita crides accidentals.
var TOKEN_APP = 'vLBdWTmjvBCu85fbmiT-v58qQVmAWJtD';

var NOM_LLISTAT = "👤 Llistat";
var NOM_CONFIGURACIO = "🔧 Configuració";
var NOM_ALUMNAT = "👥 Alumnat";
var NOM_HISTORIAL = "🗄 Historial";

var COLOR_CAPCALERA = "#4f46e5";
var DESDOBLAMENT_GENERAL = "General";

// ============ API: DISPATCHER (el frontend a GitHub Pages parla amb l'app via fetch) ============

// Peticions de lectura: GET .../exec?action=nomFuncio&param1=...&token=...
function doGet(e) {
  return gestionarPeticio(e.parameter.action, e.parameter);
}

// Peticions d'escriptura: POST amb cos JSON { action, token, ... }.
// Content-Type ha de ser "text/plain" des del client per evitar el preflight CORS.
function doPost(e) {
  var cos = JSON.parse(e.postData.contents);
  return gestionarPeticio(cos.action, cos);
}

function gestionarPeticio(action, params) {
  if (!params || params.token !== TOKEN_APP) {
    return respostaJson({ error: true, message: 'No autoritzat' });
  }

  try {
    var resultat;
    switch (action) {
      case 'listarModuls':
        resultat = listarModuls();
        break;
      case 'listarClasses':
        resultat = listarClasses();
        break;
      case 'listarDesdoblaments':
        resultat = listarDesdoblaments(params.classe);
        break;
      case 'obtenirAlumnes':
        resultat = obtenirAlumnes(params.classe, params.desdoblament);
        break;
      case 'obtenirCriteris':
        resultat = obtenirCriteris(params.modul);
        break;
      case 'exportarAGoogleSheets':
        resultat = exportarAGoogleSheets(params.dades, params.confirmat);
        break;
      case 'llistarSessions':
        resultat = llistarSessions(params.classe, params.modul);
        break;
      case 'obtenirResultatsSessio':
        resultat = obtenirResultatsSessio(params.curs, params.modul, params.classe, params.desdoblament, params.sessioAvaluada);
        break;
      case 'obtenirDetallAlumne':
        resultat = obtenirDetallAlumne(params.curs, params.modul, params.classe, params.desdoblament,
            params.nom, params.cognoms, params.sessioAvaluada);
        break;
      case 'eliminarResultat':
        resultat = eliminarResultat(params.curs, params.modul, params.classe, params.desdoblament,
            params.nom, params.cognoms, params.sessioAvaluada);
        break;
      case 'eliminarSessio':
        resultat = eliminarSessio(params.curs, params.modul, params.classe, params.desdoblament, params.sessioAvaluada);
        break;
      case 'actualitzarResultat':
        resultat = actualitzarResultat(params.curs, params.modul, params.classe, params.desdoblament,
            params.nom, params.cognoms, params.sessioAvaluada, params.notaFinal, params.observacioGrup, params.observacioIndividual);
        break;
      default:
        return respostaJson({ error: true, message: 'Acció desconeguda: ' + action });
    }
    return respostaJson({ error: false, resultat: resultat });
  } catch (err) {
    return respostaJson({ error: true, message: err.message });
  }
}

function respostaJson(objecte) {
  return ContentService.createTextOutput(JSON.stringify(objecte))
      .setMimeType(ContentService.MimeType.JSON);
}

// ============ LECTURA DE CONFIGURACIÓ / LLISTAT (per als desplegables de l'app) ============

// Llista els mòduls configurats (valors únics de la columna Mòdul a "🔧 Configuració")
function listarModuls() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarConfiguracio(ss);

  var files = hoja.getDataRange().getValues();
  var moduls = {};
  for (var i = 1; i < files.length; i++) {
    var m = String(files[i][0]).trim();
    if (m) moduls[m] = true;
  }

  return Object.keys(moduls).sort(function(a, b) { return a.localeCompare(b); });
}

// Llista les classes conegudes (valors únics de la columna Classe a "👤 Llistat")
function listarClasses() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarLlistat(ss);

  var files = hoja.getDataRange().getValues();
  var classes = {};
  for (var i = 1; i < files.length; i++) {
    var classe = String(files[i][4]).trim();
    if (classe) classes[classe] = true;
  }

  return Object.keys(classes).sort(function(a, b) { return a.localeCompare(b); });
}

// Llista els desdoblaments existents per a una classe, sempre amb "General" com a primera opció
function listarDesdoblaments(classe) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarLlistat(ss);

  var files = hoja.getDataRange().getValues();
  var desdoblaments = {};
  for (var i = 1; i < files.length; i++) {
    var classeFila = String(files[i][4]).trim();
    var desdoblament = String(files[i][5]).trim();
    if (classeFila === classe && desdoblament && desdoblament !== DESDOBLAMENT_GENERAL) {
      desdoblaments[desdoblament] = true;
    }
  }

  var llista = Object.keys(desdoblaments).sort(function(a, b) { return a.localeCompare(b); });
  return [DESDOBLAMENT_GENERAL].concat(llista);
}

// Llista els alumnes d'una classe/desdoblament, llegint "👤 Llistat".
// "General" inclou tots els alumnes de la classe, independentment del seu desdoblament assignat.
function obtenirAlumnes(classe, desdoblament) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarLlistat(ss);

  var files = hoja.getDataRange().getValues();
  var alumnes = [];

  for (var i = 1; i < files.length; i++) {
    var nom = String(files[i][0]).trim();
    var cognoms = String(files[i][1]).trim();
    var classeFila = String(files[i][4]).trim();
    var desdoblamentFila = String(files[i][5]).trim();

    if (classeFila !== classe || !nom) continue;
    if (desdoblament !== DESDOBLAMENT_GENERAL && desdoblamentFila !== desdoblament) continue;

    alumnes.push({ nom: nom, cognoms: cognoms });
  }

  alumnes.sort(function(a, b) { return (a.cognoms + a.nom).localeCompare(b.cognoms + b.nom); });
  return alumnes;
}

// Llegeix els criteris d'avaluació configurats per a un mòdul, validant que els pesos sumin 100
function obtenirCriteris(modul) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarConfiguracio(ss);

  var files = hoja.getDataRange().getValues();
  var criteris = [];

  for (var i = 1; i < files.length; i++) {
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

// ============ EXPORTACIÓ ============

// Construeix la clau única d'una fila d'Alumnat (identifica una avaluació concreta)
function construirClau(curs, modul, classe, desdoblament, nom, cognoms, sessioAvaluada) {
  return [curs, modul, classe, desdoblament, nom, cognoms, sessioAvaluada].join('|');
}

// Executa aquesta funció un cop manualment des de l'editor (Executar > configurarRegistre)
// per organitzar el full de càlcul encara que no s'hagi exportat cap avaluació.
function configurarRegistre() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  asegurarLlistat(ss);
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
  asegurarLlistat(ss);

  var criteris = obtenirCriteris(dades.modul);

  // Només s'exporten alumnes amb algun criteri omplert
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
          cognoms: item.cognoms,
          notes: notes,
          observacioGrup: item.observacioGrup || "",
          observacioIndividual: item.observacioIndividual || ""
        };
      })
      .filter(function(item) { return Object.keys(item.notes).length > 0; });

  if (avaluacions.length === 0) {
    throw new Error("No hi ha cap nota per exportar.");
  }

  avaluacions.sort(function(a, b) { return (a.cognoms + a.nom).localeCompare(b.cognoms + b.nom); });

  // Localitzar files existents a Alumnat per la mateixa clau única
  var dadesAlumnat = fullAlumnat.getDataRange().getValues();
  var filaPerClau = {};
  for (var i = 1; i < dadesAlumnat.length; i++) {
    var clauExistent = construirClau(dadesAlumnat[i][1], dadesAlumnat[i][2], dadesAlumnat[i][3],
        dadesAlumnat[i][4], dadesAlumnat[i][5], dadesAlumnat[i][6], dadesAlumnat[i][7]);
    filaPerClau[clauExistent] = i + 1; // getRange usa índex base 1
  }

  var xocs = [];
  avaluacions.forEach(function(av) {
    var clau = construirClau(dades.curs, dades.modul, dades.classe, dades.desdoblament, av.nom, av.cognoms, dades.sessioAvaluada);
    if (filaPerClau[clau]) xocs.push(filaPerClau[clau]);
  });

  if (xocs.length > 0 && !confirmat) {
    return {
      necessitaConfirmacio: true,
      ultimaActualitzacio: Utilities.formatDate(dadesAlumnat[xocs[0] - 1][0], Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
    };
  }

  var ara = new Date();

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

    var fila = [ara, dades.curs, dades.modul, dades.classe, dades.desdoblament, av.nom, av.cognoms, dades.sessioAvaluada,
        av.observacioGrup, av.observacioIndividual,
        criterisCompletos ? Math.round(notaFinal * 100) / 100 : ""];

    var clau = construirClau(dades.curs, dades.modul, dades.classe, dades.desdoblament, av.nom, av.cognoms, dades.sessioAvaluada);
    if (filaPerClau[clau]) {
      fullAlumnat.getRange(filaPerClau[clau], 1, 1, fila.length).setValues([fila]);
    } else {
      fullAlumnat.appendRow(fila);
    }

    assegurarAlumneAlLlistat(ss, dades, av.nom, av.cognoms);
  });

  registrarHistorial(ss, dades, avaluacions, ara);

  return { success: true, url: ss.getUrl() };
}

// Si un alumne avaluat no existia encara a "👤 Llistat" (afegit a mà des de l'app), el hi afegeix
function assegurarAlumneAlLlistat(ss, dades, nom, cognoms) {
  var hoja = asegurarLlistat(ss);
  var files = hoja.getDataRange().getValues();

  for (var i = 1; i < files.length; i++) {
    if (String(files[i][0]).trim() === nom && String(files[i][1]).trim() === cognoms &&
        String(files[i][4]).trim() === dades.classe) {
      return; // ja existeix
    }
  }

  hoja.appendRow([nom, cognoms, "", dades.curs, dades.classe, dades.desdoblament]);
}

// Afegeix una fila per cada alumne i criteri exportat, sense esborrar mai l'historial previ
function registrarHistorial(ss, dades, avaluacions, ara) {
  var hoja = asegurarHistorial(ss);
  var files = [];

  avaluacions.forEach(function(av) {
    Object.keys(av.notes).forEach(function(criteri) {
      files.push([ara, dades.curs, dades.modul, dades.classe, dades.desdoblament,
          av.nom, av.cognoms, dades.sessioAvaluada, criteri, av.notes[criteri]]);
    });
  });

  if (files.length > 0) {
    hoja.getRange(hoja.getLastRow() + 1, 1, files.length, files[0].length).setValues(files);
  }
}

// ============ VISTA DE RESULTATS (veure / editar / esborrar) ============

// Llista les sessions avaluades d'una classe (agrupades), ordenades de més recent a més antiga.
// "modul" és opcional: si es passa buit, no filtra per mòdul.
function llistarSessions(classe, modul) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarAlumnat(ss);
  var files = hoja.getDataRange().getValues();

  var sessions = {};
  for (var i = 1; i < files.length; i++) {
    var fila = files[i];
    if (String(fila[3]).trim() !== classe) continue;
    if (modul && String(fila[2]).trim() !== modul) continue;

    var clauSessio = [fila[1], fila[2], fila[3], fila[4], fila[7]].join('|');
    if (!sessions[clauSessio]) {
      sessions[clauSessio] = {
        curs: fila[1], modul: fila[2], classe: fila[3], desdoblament: fila[4], sessioAvaluada: fila[7],
        data: fila[0], nAlumnes: 0
      };
    }
    sessions[clauSessio].nAlumnes++;
    if (fila[0] > sessions[clauSessio].data) sessions[clauSessio].data = fila[0];
  }

  var resultat = Object.keys(sessions).map(function(k) { return sessions[k]; });
  resultat.sort(function(a, b) { return b.data - a.data; });
  resultat.forEach(function(s) {
    s.data = Utilities.formatDate(s.data, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  });

  return resultat;
}

// Retorna els resultats (una fila per alumne) d'una sessió concreta ja avaluada
function obtenirResultatsSessio(curs, modul, classe, desdoblament, sessioAvaluada) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarAlumnat(ss);
  var files = hoja.getDataRange().getValues();

  var resultats = [];
  for (var i = 1; i < files.length; i++) {
    var fila = files[i];
    if (String(fila[1]) === String(curs) && fila[2] === modul && fila[3] === classe &&
        fila[4] === desdoblament && fila[7] === sessioAvaluada) {
      resultats.push({
        nom: fila[5], cognoms: fila[6],
        observacioGrup: fila[8], observacioIndividual: fila[9],
        notaFinal: fila[10]
      });
    }
  }

  resultats.sort(function(a, b) { return (a.cognoms + a.nom).localeCompare(b.cognoms + b.nom); });
  return resultats;
}

// Reconstrueix les notes per criteri d'un alumne en una sessió, llegint l'historial
// (Alumnat només guarda la nota final; el desglossament viu a Historial)
function obtenirDetallAlumne(curs, modul, classe, desdoblament, nom, cognoms, sessioAvaluada) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarHistorial(ss);
  var files = hoja.getDataRange().getValues();

  var notes = {};
  for (var i = 1; i < files.length; i++) {
    var fila = files[i];
    if (String(fila[1]) === String(curs) && fila[2] === modul && fila[3] === classe &&
        fila[4] === desdoblament && fila[5] === nom && fila[6] === cognoms && fila[7] === sessioAvaluada) {
      notes[fila[8]] = fila[9]; // files posteriors (reexportacions) sobreescriuen les anteriors
    }
  }

  return notes;
}

// Esborra el resultat d'un sol alumne d'una sessió. L'historial per criteri NO s'esborra.
function eliminarResultat(curs, modul, classe, desdoblament, nom, cognoms, sessioAvaluada) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarAlumnat(ss);
  var files = hoja.getDataRange().getValues();

  for (var i = files.length - 1; i >= 1; i--) {
    var fila = files[i];
    if (String(fila[1]) === String(curs) && fila[2] === modul && fila[3] === classe &&
        fila[4] === desdoblament && fila[5] === nom && fila[6] === cognoms && fila[7] === sessioAvaluada) {
      hoja.deleteRow(i + 1);
    }
  }

  return { success: true };
}

// Esborra tots els resultats d'una sessió sencera (tots els alumnes). L'historial no s'esborra.
function eliminarSessio(curs, modul, classe, desdoblament, sessioAvaluada) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarAlumnat(ss);
  var files = hoja.getDataRange().getValues();

  for (var i = files.length - 1; i >= 1; i--) {
    var fila = files[i];
    if (String(fila[1]) === String(curs) && fila[2] === modul && fila[3] === classe &&
        fila[4] === desdoblament && fila[7] === sessioAvaluada) {
      hoja.deleteRow(i + 1);
    }
  }

  return { success: true };
}

// Actualitza directament la Nota final i les observacions d'un resultat ja existent
// (edició ràpida des de "Resultats"), sense tocar el desglossament per criteri a Historial.
function actualitzarResultat(curs, modul, classe, desdoblament, nom, cognoms, sessioAvaluada, notaFinal, observacioGrup, observacioIndividual) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = asegurarAlumnat(ss);
  var files = hoja.getDataRange().getValues();

  for (var i = 1; i < files.length; i++) {
    var fila = files[i];
    if (String(fila[1]) === String(curs) && fila[2] === modul && fila[3] === classe &&
        fila[4] === desdoblament && fila[5] === nom && fila[6] === cognoms && fila[7] === sessioAvaluada) {
      var valorNota = (notaFinal === '' || notaFinal === null || notaFinal === undefined) ? '' : Number(notaFinal);
      hoja.getRange(i + 1, 1).setValue(new Date());
      hoja.getRange(i + 1, 9, 1, 3).setValues([[observacioGrup || '', observacioIndividual || '', valorNota]]);
      return { success: true };
    }
  }

  throw new Error('No s\'ha trobat aquest resultat per actualitzar.');
}

// ============ FORMAT I ESTRUCTURA DE PESTANYES ============

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

// Aplica un format de data/hora llegible a una columna
function aplicarFormatData(hoja, columna) {
  hoja.getRange(2, columna, 999, 1).setNumberFormat("dd/mm/yyyy hh:mm");
}

// Crea (si no existeix) la pestanya de llistat d'alumnes per classe/desdoblament
function asegurarLlistat(ss) {
  var hoja = ss.getSheetByName(NOM_LLISTAT);
  if (hoja) return hoja;

  hoja = ss.insertSheet(NOM_LLISTAT, 0);

  var capcalera = ["Nom", "Cognoms", "Correu corporatiu", "Curs", "Classe", "Desdoblament"];
  aplicarEstilCapcalera(hoja, capcalera);

  var exemple = [
    ["María", "Álvarez Gómez", "", "26/27", "1º A", "General"],
    ["Javier", "Bernal Ruiz", "", "26/27", "1º A", "Desdoble 1"],
    ["Sofía", "Castro Peña", "", "26/27", "1º A", "Desdoble 2"]
  ];
  hoja.getRange(2, 1, exemple.length, capcalera.length).setValues(exemple)
      .setFontColor("#94a3b8").setFontStyle("italic");

  hoja.setColumnWidths(1, 2, 150);
  hoja.setColumnWidth(3, 200);
  hoja.setColumnWidth(4, 70);
  hoja.setColumnWidth(5, 80);
  hoja.setColumnWidth(6, 110);
  hoja.setFrozenRows(1);
  aplicarFiltre(hoja, capcalera.length);

  return hoja;
}

// Crea (si no existeix) la pestanya on el professor configura els criteris d'avaluació per mòdul
function asegurarConfiguracio(ss) {
  var hoja = ss.getSheetByName(NOM_CONFIGURACIO);
  if (hoja) return hoja;

  hoja = ss.insertSheet(NOM_CONFIGURACIO, 1);

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

  hoja = ss.insertSheet(NOM_ALUMNAT, 2);

  var capcalera = ["Data", "Curs", "Mòdul", "Classe", "Desdobl.", "Nom", "Cognoms",
      "Sessió avaluada", "Observacions grup", "Observacions individual", "Nota final"];
  aplicarEstilCapcalera(hoja, capcalera);

  hoja.setColumnWidth(1, 120);
  hoja.setColumnWidth(2, 70);
  hoja.setColumnWidth(3, 150);
  hoja.setColumnWidth(4, 80);
  hoja.setColumnWidth(5, 90);
  hoja.setColumnWidth(6, 120);
  hoja.setColumnWidth(7, 140);
  hoja.setColumnWidth(8, 170);
  hoja.setColumnWidth(9, 220);
  hoja.setColumnWidth(10, 220);
  hoja.setColumnWidth(11, 90);
  hoja.setFrozenRows(1);

  aplicarFiltre(hoja, capcalera.length);
  aplicarEscalaColor(hoja, 11);
  aplicarFormatData(hoja, 1);

  return hoja;
}

// Crea (si no existeix) la pestanya d'historial append-only: mai s'esborra, només s'afegeix
function asegurarHistorial(ss) {
  var hoja = ss.getSheetByName(NOM_HISTORIAL);
  if (hoja) return hoja;

  hoja = ss.insertSheet(NOM_HISTORIAL);

  var capcalera = ["Data", "Curs", "Mòdul", "Classe", "Desd.", "Nom", "Cognoms", "Sessió avaluada", "Criteri", "Nota"];
  aplicarEstilCapcalera(hoja, capcalera);

  hoja.setColumnWidths(1, capcalera.length, 120);
  hoja.setFrozenRows(1);

  aplicarFiltre(hoja, capcalera.length);
  aplicarEscalaColor(hoja, 10);
  aplicarFormatData(hoja, 1);

  return hoja;
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
