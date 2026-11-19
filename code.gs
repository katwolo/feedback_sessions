// ID del Google Sheet on s'exporten les avaluacions
var SPREADSHEET_ID = '1CBaAA7ew3zWmthPP8Xba5prZDJ8_IdNfLj8mIUONylg';

// ============ ARQUITECTURA I ACCÉS ============
// - La pàgina (index.html) està allotjada a GitHub Pages: qualsevol canvi a GitHub es publica sol.
// - Aquest script només fa d'API: la pàgina li envia peticions POST amb { action, params } i rep JSON.
// - La implementació ha de ser "Executar com: Jo" i "Qui hi té accés: Qualsevol usuari".
// ATENCIÓ: qualsevol persona que tingui l'enllaç de la pàgina (o la URL /exec) pot veure noms, notes i
// correus de l'alumnat, esborrar resultats i enviar correus des del teu compte. No el publiquis.

// Adreça de la pàgina a GitHub Pages (només per mostrar-ne l'enllaç si algú obre la URL /exec directament)
var URL_FRONTEND = 'https://katwolo.github.io/feedback_sessions/';

var NOM_LLISTAT = "👤 Llistat";
var NOM_CONFIGURACIO = "🔧 Configuració";
var NOM_SUPOSITS = "📋 Supòsits";
var NOM_ALUMNAT = "👥 Alumnat";
var NOM_HISTORIAL = "🗄 Historial";
var NOM_COMENTARIS = "💬 Comentaris";

var COLOR_CAPCALERA = "#4f46e5";
var DESDOBLAMENT_GENERAL = "General";

var NOTA_MAXIMA = 10;
var NOTA_APROVAT = 5;
// Si un alumne suspèn (< NOTA_APROVAT) un ítem marcat com a imprescindible, la nota final
// queda limitada a aquest valor com a màxim.
var NOTA_MAX_SI_SUSPEN_IMPRESCINDIBLE = 4;

var TIPUS_CRITERI = ['numeric', 'sino', 'rubrica'];

// Capçaleres completes de cada pestanya. Les columnes noves s'han afegit sempre AL FINAL perquè
// els fulls que ja tenien dades continuïn funcionant (assegurarCapcaleres les completa).
var CAPCALERA_LLISTAT = ["Nom", "Cognoms", "Correu corporatiu", "Curs", "Classe", "Desdoblament", "ID alumne"];
var CAPCALERA_CONFIGURACIO = ["Mòdul", "Criteri", "Pes (%)", "Supòsit", "Tipus", "Nivells", "Imprescindible"];
var CAPCALERA_SUPOSITS = ["Mòdul", "Supòsit", "Data", "Descripció", "Actiu"];
var CAPCALERA_ALUMNAT = ["Data", "Curs", "Mòdul", "Classe", "Desdobl.", "Nom", "Cognoms",
    "Sessió avaluada", "Observacions grup", "Observacions individual", "Nota final",
    "Grup", "Origen nota", "ID alumne", "Correu enviat", "Detall ítems"];
var CAPCALERA_COMENTARIS = ["Comentari", "Mòdul"];
var COMENTARIS_PER_DEFECTE = ["Bona actitud", "Molt bona participació", "Bona comunicació amb el grup",
    "Ha de millorar la puntualitat", "Cal revisar les normes de seguretat"];
var CAPCALERA_HISTORIAL = ["Data", "Curs", "Mòdul", "Classe", "Desd.", "Nom", "Cognoms", "Sessió avaluada",
    "Criteri", "Nota", "Pes (%)", "Tipus", "ID alumne"];

// Índexs (base 0) de les columnes d'Alumnat
var A = { DATA: 0, CURS: 1, MODUL: 2, CLASSE: 3, DESD: 4, NOM: 5, COGNOMS: 6, SESSIO: 7,
    OBS_GRUP: 8, OBS_INDIV: 9, NOTA: 10, GRUP: 11, ORIGEN: 12, ID: 13, CORREU_ENVIAT: 14, DETALL: 15 };
// Índexs (base 0) de les columnes d'Historial
var H = { DATA: 0, CURS: 1, MODUL: 2, CLASSE: 3, DESD: 4, NOM: 5, COGNOMS: 6, SESSIO: 7,
    CRITERI: 8, NOTA: 9, PES: 10, TIPUS: 11, ID: 12 };

// ============ ENTRADA DE L'APP ============

// Peticions de la pàgina: POST amb cos JSON { action, params }.
// El client l'envia amb Content-Type "text/plain" per evitar la comprovació prèvia CORS.
function doPost(e) {
  var cos = {};
  try {
    cos = JSON.parse(e.postData.contents);
  } catch (err) {
    return respostaJson(JSON.stringify({ error: true, message: 'Petició no vàlida' }));
  }
  return respostaJson(api(cos.action, cos.params));
}

// Si algú obre la URL /exec al navegador, li indiquem on és l'app
function doGet() {
  return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:2rem">Aquesta és l\'API de ' +
      'l\'avaluador. L\'app és a <a href="' + escaparHtml(URL_FRONTEND) + '">' + escaparHtml(URL_FRONTEND) + '</a>.</p>')
      .setTitle('Sessions/Supòsits');
}

function respostaJson(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

// Executa una acció i retorna sempre un JSON en text: { error, resultat } o { error, message }
function api(action, params) {
  params = params || {};
  _full = null; _memo = {}; _marcaFull = undefined; // cada petició comença de zero
  try {
    var accio = ACCIONS.hasOwnProperty(action) ? ACCIONS[action] : null;
    if (!accio) throw new Error('Acció desconeguda: ' + action);
    return JSON.stringify({ error: false, resultat: accio(params) });
  } catch (err) {
    return JSON.stringify({ error: true, message: err.message });
  }
}

var ACCIONS = {
  // Lectura
  inicialitzar: function() { return inicialitzar(); },
  listarModuls: function() { return listarModuls(); },
  listarClasses: function() { return listarClasses(); },
  listarDesdoblaments: function(p) { return listarDesdoblaments(p.classe); },
  listarSuposits: function(p) { return listarSuposits(p.modul, p.nomesActius !== false); },
  obtenirAlumnes: function(p) { return obtenirAlumnes(p.classe, p.desdoblament); },
  obtenirCriteris: function(p) { return obtenirCriteris(p.modul, p.suposit); },
  llistarSessions: function(p) { return llistarSessions(p.classe, p.modul); },
  obtenirResultatsSessio: function(p) {
    var r = obtenirResultatsSessio(p.curs, p.modul, p.classe, p.desdoblament, p.sessioAvaluada);
    if (p.ambCriteris) { try { r.criterisActuals = obtenirCriteris(p.modul, p.sessioAvaluada); } catch (err) { r.criterisActuals = []; } }
    return r;
  },
  obtenirDetallAlumne: function(p) { return obtenirDetallAlumne(p.curs, p.modul, p.classe, p.desdoblament, p.alumne, p.sessioAvaluada); },
  obtenirFitxaAlumne: function(p) { return obtenirFitxaAlumne(p.classe, p.alumne); },
  quotaCorreu: function() { return MailApp.getRemainingDailyQuota(); },
  listarCursosClassroom: function() { return listarCursosClassroom(); },
  // Configuració
  obtenirConfiguracio: function() { return obtenirConfiguracio(); },
  desarCriteris: function(p) { return ambBloqueig(function() { return desarCriteris(p.modul, p.suposit, p.criteris); }); },
  desarSuposit: function(p) { return ambBloqueig(function() { return desarSuposit(p.modul, p.nomOriginal, p.suposit); }); },
  duplicarSuposit: function(p) { return ambBloqueig(function() { return duplicarSuposit(p.modul, p.nom, p.nouNom); }); },
  eliminarSuposit: function(p) { return ambBloqueig(function() { return eliminarSuposit(p.modul, p.nom); }); },
  renomenarModul: function(p) { return ambBloqueig(function() { return renomenarModul(p.antic, p.nou); }); },
  eliminarModul: function(p) { return ambBloqueig(function() { return eliminarModul(p.modul); }); },
  importarPlantilla: function(p) { return ambBloqueig(function() { return importarPlantilla(p.plantilla, p.nomModul); }); },
  // Escriptura de resultats
  exportarAGoogleSheets: function(p) { return ambBloqueig(function() { return exportarAGoogleSheets(p.dades, p.confirmat); }); },
  eliminarResultat: function(p) { return ambBloqueig(function() { return eliminarResultat(p.curs, p.modul, p.classe, p.desdoblament, p.alumne, p.sessioAvaluada); }); },
  eliminarSessio: function(p) { return ambBloqueig(function() { return eliminarSessio(p.curs, p.modul, p.classe, p.desdoblament, p.sessioAvaluada); }); },
  actualitzarResultat: function(p) { return ambBloqueig(function() { return actualitzarResultat(p); }); },
  desarItemsResultat: function(p) { return ambBloqueig(function() { return desarItemsResultat(p); }); },
  enviarCorreus: function(p) { return ambBloqueig(function() { return enviarCorreus(p); }); },
  crearInformePdf: function(p) { return crearInformePdf(p.curs, p.modul, p.classe, p.desdoblament, p.sessioAvaluada); },
  desarDesdoblaments: function(p) { return ambBloqueig(function() { return desarDesdoblaments(p.classe, p.assignacions); }); },
  desarComentaris: function(p) { return ambBloqueig(function() { return desarComentaris(p.comentaris); }); },
  importarAlumnesClassroom: function(p) { return ambBloqueig(function() { return importarAlumnesClassroom(p.courseId, p.curs, p.classe, p.desdoblament); }); }
};

// Evita que dues escriptures simultànies (dos professors, dues pestanyes) es trepitgin
function ambBloqueig(funcio) {
  var bloqueig = LockService.getScriptLock();
  if (!bloqueig.tryLock(30000)) {
    throw new Error('El full està ocupat amb una altra operació. Torna-ho a provar en uns segons.');
  }
  try {
    return funcio();
  } finally {
    bloqueig.releaseLock();
  }
}

// ============ UTILITATS ============

// El full s'obre una sola vegada per petició
var _full = null;
function obrirFull() {
  if (!_full) _full = SpreadsheetApp.openById(SPREADSHEET_ID);
  return _full;
}

// ---- Memòria cau (CacheService) de la configuració i del llistat d'alumnes ----
// Cada entrada guarda la "marca" de l'última modificació del full (segons Drive). Si el full ha canviat
// (des de l'app o editant-lo a mà), la marca ja no coincideix i es torna a llegir. Així no es fan servir
// mai dades antigues i, mentre ningú toqui el full, les lectures són instantànies.
var VERSIO_CACHE = 'v3:';
var _memo = {};
var _marcaFull;

function marcaFull() {
  if (_marcaFull === undefined) {
    try { _marcaFull = DriveApp.getFileById(SPREADSHEET_ID).getLastUpdated().getTime(); } catch (err) { _marcaFull = null; }
  }
  return _marcaFull;
}

function llegirAmbCache(clau, funcio) {
  if (_memo.hasOwnProperty(clau)) return _memo[clau];
  var marca = marcaFull();
  var cache = null;
  if (marca !== null) {
    try { cache = CacheService.getScriptCache(); } catch (err) { cache = null; }
  }
  if (cache) {
    var text = cache.get(VERSIO_CACHE + clau);
    if (text) {
      try {
        var desat = JSON.parse(text);
        if (desat.m === marca) return (_memo[clau] = desat.v);
      } catch (err) { /* entrada malmesa: es torna a llegir */ }
    }
  }
  var valor = funcio();
  if (cache) {
    var json = JSON.stringify({ m: marca, v: valor });
    if (json.length < 95000) { try { cache.put(VERSIO_CACHE + clau, json, 21600); } catch (err) { /* massa gran */ } }
  }
  return (_memo[clau] = valor);
}

// Després d'escriure al full: s'esborra la memòria cau afectada
function invalidarCache(claus) {
  claus.forEach(function(k) { delete _memo[k]; });
  _marcaFull = undefined;
  try { CacheService.getScriptCache().removeAll(claus.map(function(k) { return VERSIO_CACHE + k; })); } catch (err) { /* sense cache */ }
}

// Files de "👤 Llistat" (lectura amb memòria cau; per escriure, llegir sempre el full directament)
function filesLlistat() {
  return llegirAmbCache('llistat', function() {
    return llegirFiles(asegurarLlistat(obrirFull()), CAPCALERA_LLISTAT.length).map(function(f) { return f.map(txt); });
  });
}

function txt(valor) {
  return String(valor === null || valor === undefined ? '' : valor).trim();
}

function escaparHtml(text) {
  return String(text === null || text === undefined ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatarData(valor, patro) {
  if (valor instanceof Date) return Utilities.formatDate(valor, Session.getScriptTimeZone(), patro || "dd/MM/yyyy HH:mm");
  return txt(valor);
}

function esBuit(valor) {
  return valor === undefined || valor === null || valor === '';
}

// Llegeix totes les files de dades (sense capçalera), cadascuna amb almenys "amplada" columnes
function llegirFiles(hoja, amplada) {
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return [];
  var files = hoja.getRange(2, 1, ultimaFila - 1, Math.max(amplada, hoja.getLastColumn())).getValues();
  return files.map(function(f) { return f.slice(0, amplada); });
}

// Substitueix totes les files de dades d'una pestanya per "files" en una sola escriptura
function reescriureFiles(hoja, files, amplada) {
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila >= 2) {
    hoja.getRange(2, 1, ultimaFila - 1, Math.max(amplada, hoja.getLastColumn())).clearContent();
  }
  if (files.length > 0) {
    hoja.getRange(2, 1, files.length, amplada).setValues(files);
  }
}

// Afegeix files al final d'una pestanya en una sola escriptura
function afegirFiles(hoja, files, amplada) {
  if (files.length === 0) return;
  hoja.getRange(hoja.getLastRow() + 1, 1, files.length, amplada).setValues(files);
}

// Un alumne s'identifica pel seu ID (correu de Classroom) si en té; si no, per nom + cognoms.
// alumne = { nom, cognoms, id }
function mateixAlumne(nomFila, cognomsFila, idFila, alumne) {
  var idA = txt(idFila), idB = txt(alumne.id);
  if (idA && idB) return idA.toLowerCase() === idB.toLowerCase();
  return txt(nomFila) === txt(alumne.nom) && txt(cognomsFila) === txt(alumne.cognoms);
}

function clauAlumneServidor(alumne) {
  return txt(alumne.id) ? 'id:' + txt(alumne.id).toLowerCase() : 'nom:' + txt(alumne.nom) + '||' + txt(alumne.cognoms);
}

function mateixaSessio(fila, idx, curs, modul, classe, desdoblament, sessio) {
  return txt(fila[idx.CURS]) === txt(curs) && txt(fila[idx.MODUL]) === txt(modul) &&
      txt(fila[idx.CLASSE]) === txt(classe) && txt(fila[idx.DESD]) === txt(desdoblament) &&
      txt(fila[idx.SESSIO]) === txt(sessio);
}

function ordenarAlumnes(llista) {
  return llista.sort(function(a, b) { return (a.cognoms + ' ' + a.nom).localeCompare(b.cognoms + ' ' + b.nom); });
}

// ============ CRITERIS: TIPUS, NIVELLS I CÀLCUL ============

// "Insuficient=2; Suficient=5; Bé=7,5; Excel·lent=10" -> [{ nom, valor }]
function parsejarNivells(text) {
  return txt(text).split(/[;\n]/).map(function(tros) {
    var parts = tros.split('=');
    if (parts.length < 2) return null;
    var valor = Number(String(parts.slice(1).join('=')).trim().replace(',', '.'));
    var nom = parts[0].trim();
    return nom && !isNaN(valor) ? { nom: nom, valor: valor } : null;
  }).filter(function(n) { return n; });
}

function formatarNivells(nivells) {
  return (nivells || []).map(function(n) { return n.nom + '=' + n.valor; }).join('; ');
}

function esSi(valor) {
  var t = txt(valor).toLowerCase();
  return valor === true || t === 'sí' || t === 'si' || t === 'x' || t === 'true' || t === '1';
}

// Valida i normalitza una llista de criteris. Si "permetBuida", una llista buida és vàlida
// (vol dir que el supòsit hereta els criteris del mòdul).
function validarCriteris(criteris, permetBuida) {
  criteris = criteris || [];
  if (criteris.length === 0) {
    if (permetBuida) return [];
    throw new Error('Cal almenys un ítem d\'avaluació.');
  }

  var noms = {};
  var normalitzats = criteris.map(function(c, i) {
    var nom = txt(c.nom);
    if (!nom) throw new Error('L\'ítem ' + (i + 1) + ' no té nom.');
    if (noms[nom.toLowerCase()]) throw new Error('Hi ha dos ítems amb el nom "' + nom + '".');
    noms[nom.toLowerCase()] = true;

    var pes = Number(c.pes);
    if (isNaN(pes) || pes < 0) throw new Error('El pes de "' + nom + '" no és vàlid.');

    var tipus = TIPUS_CRITERI.indexOf(c.tipus) !== -1 ? c.tipus : 'numeric';
    var nivells = [];
    if (tipus === 'rubrica') {
      nivells = Array.isArray(c.nivells) ? c.nivells : parsejarNivells(c.nivells);
      nivells = nivells.filter(function(n) { return txt(n.nom) && !isNaN(Number(n.valor)); })
          .map(function(n) { return { nom: txt(n.nom), valor: Number(n.valor) }; });
      if (nivells.length < 2) throw new Error('La rúbrica "' + nom + '" necessita almenys 2 nivells (Ex: Insuficient=2; Bé=7,5).');
      nivells.forEach(function(n) {
        if (n.valor < 0 || n.valor > NOTA_MAXIMA) throw new Error('Els nivells de "' + nom + '" han d\'estar entre 0 i ' + NOTA_MAXIMA + '.');
      });
    }

    return { nom: nom, pes: pes, tipus: tipus, nivells: nivells, imprescindible: !!c.imprescindible };
  });

  var suma = normalitzats.reduce(function(acc, c) { return acc + c.pes; }, 0);
  if (Math.round(suma * 100) / 100 !== 100) {
    throw new Error('Els pesos sumen ' + (Math.round(suma * 100) / 100) + '%, han de sumar 100%.');
  }
  return normalitzats;
}

// Calcula la nota final ponderada. Mateixa lògica que calcularNotaFinal() a index.html.
function calcularNotaFinal(criteris, notes) {
  var suma = 0;
  var completes = criteris.length > 0;
  var suspenImprescindible = false;

  criteris.forEach(function(c) {
    var valor = notes[c.nom];
    if (esBuit(valor) || isNaN(Number(valor))) {
      completes = false;
      return;
    }
    var n = Number(valor);
    suma += n * (c.pes / 100);
    if (c.imprescindible && n < NOTA_APROVAT) suspenImprescindible = true;
  });

  if (!completes) return { nota: '', limitada: false };
  var nota = Math.round(suma * 100) / 100;
  var limitada = suspenImprescindible && nota > NOTA_MAX_SI_SUSPEN_IMPRESCINDIBLE;
  return { nota: limitada ? NOTA_MAX_SI_SUSPEN_IMPRESCINDIBLE : nota, limitada: limitada };
}

// ============ LECTURA DE CONFIGURACIÓ / LLISTAT ============

function llegirConfiguracio() {
  return llegirAmbCache('config', function() { return llegirConfiguracioDelFull(obrirFull()); });
}

function llegirConfiguracioDelFull(ss) {
  var hoja = asegurarConfiguracio(ss);
  return llegirFiles(hoja, CAPCALERA_CONFIGURACIO.length).map(function(f) {
    var tipus = txt(f[4]).toLowerCase();
    return {
      modul: txt(f[0]), nom: txt(f[1]), pes: Number(f[2]), suposit: txt(f[3]),
      tipus: TIPUS_CRITERI.indexOf(tipus) !== -1 ? tipus : 'numeric',
      nivells: parsejarNivells(f[5]), imprescindible: esSi(f[6])
    };
  }).filter(function(c) { return c.modul && c.nom && !isNaN(c.pes); });
}

function llegirSuposits() {
  return llegirAmbCache('suposits', function() { return llegirSupositsDelFull(obrirFull()); });
}

function llegirSupositsDelFull(ss) {
  var hoja = asegurarSuposits(ss);
  return llegirFiles(hoja, CAPCALERA_SUPOSITS.length).map(function(f) {
    return {
      modul: txt(f[0]), nom: txt(f[1]), data: formatarData(f[2], 'yyyy-MM-dd'),
      descripcio: txt(f[3]), actiu: txt(f[4]) === '' ? true : esSi(f[4])
    };
  }).filter(function(s) { return s.modul && s.nom; });
}

// Tot el que l'app necessita per arrencar, en una sola petició
function inicialitzar() {
  var classes = listarClasses();
  var desdoblaments = {};
  classes.forEach(function(c) { desdoblaments[c] = listarDesdoblaments(c); });
  var moduls = listarModuls();
  var suposits = {};
  moduls.forEach(function(m) { suposits[m] = listarSuposits(m, true); });
  return { moduls: moduls, classes: classes, desdoblaments: desdoblaments, suposits: suposits, comentaris: llegirComentaris() };
}

// ---- Comentaris ràpids (observacions freqüents que s'afegeixen amb un toc) ----
// Mòdul buit = el comentari surt a tots els mòduls
function llegirComentaris() {
  return llegirAmbCache('comentaris', function() {
    return llegirFiles(asegurarComentaris(obrirFull()), CAPCALERA_COMENTARIS.length)
        .map(function(f) { return { text: txt(f[0]), modul: txt(f[1]) }; })
        .filter(function(c) { return c.text; });
  });
}

function desarComentaris(comentaris) {
  var vistos = {};
  var files = (comentaris || []).map(function(c) { return [txt(c.text), txt(c.modul)]; })
      .filter(function(f) {
        var clau = f[0].toLowerCase() + '|' + f[1];
        if (!f[0] || vistos[clau]) return false;
        vistos[clau] = true;
        return true;
      });
  var hoja = asegurarComentaris(obrirFull());
  reescriureFiles(hoja, files, CAPCALERA_COMENTARIS.length);
  invalidarCache(['comentaris']);
  return { desats: files.length };
}

// Llista els mòduls configurats (a "🔧 Configuració" o a "📋 Supòsits")
function listarModuls() {
  var ss = obrirFull();
  var moduls = {};
  llegirConfiguracio().forEach(function(c) { moduls[c.modul] = true; });
  llegirSuposits().forEach(function(s) { moduls[s.modul] = true; });
  return Object.keys(moduls).sort(function(a, b) { return a.localeCompare(b); });
}

// Llista els supòsits d'un mòdul (per defecte només els actius), ordenats per data i nom
function listarSuposits(modul, nomesActius) {
  return llegirSuposits()
      .filter(function(s) { return s.modul === modul && (!nomesActius || s.actiu); })
      .sort(function(a, b) { return (a.data || '9999').localeCompare(b.data || '9999') || a.nom.localeCompare(b.nom); });
}

function listarClasses() {
  var files = filesLlistat();
  var classes = {};
  files.forEach(function(f) { if (txt(f[4])) classes[txt(f[4])] = true; });
  return Object.keys(classes).sort(function(a, b) { return a.localeCompare(b); });
}

// Llista els desdoblaments existents per a una classe, sempre amb "General" com a primera opció
function listarDesdoblaments(classe) {
  var files = filesLlistat();
  var desdoblaments = {};
  files.forEach(function(f) {
    var d = txt(f[5]);
    if (txt(f[4]) === classe && d && d !== DESDOBLAMENT_GENERAL) desdoblaments[d] = true;
  });
  return [DESDOBLAMENT_GENERAL].concat(Object.keys(desdoblaments).sort(function(a, b) { return a.localeCompare(b); }));
}

// Llista els alumnes d'una classe/desdoblament. "General" inclou tota la classe.
// L'ID és el de la columna "ID alumne" o, si no n'hi ha, el correu corporatiu.
function obtenirAlumnes(classe, desdoblament) {
  var files = filesLlistat();
  var alumnes = [];
  files.forEach(function(f) {
    var nom = txt(f[0]);
    if (txt(f[4]) !== classe || !nom) return;
    if (desdoblament !== DESDOBLAMENT_GENERAL && txt(f[5]) !== desdoblament) return;
    alumnes.push({ nom: nom, cognoms: txt(f[1]), id: txt(f[6]) || txt(f[2]), desdoblament: txt(f[5]) || DESDOBLAMENT_GENERAL });
  });
  return ordenarAlumnes(alumnes);
}

// Desa a quin desdoblament va cada alumne d'una classe (columna "Desdoblament" de "👤 Llistat").
// assignacions = [{ alumne: { nom, cognoms, id }, desdoblament }]. Buit o "General" = sense desdoblament.
function desarDesdoblaments(classe, assignacions) {
  classe = txt(classe);
  if (!classe) throw new Error('Falta la classe.');
  var hoja = asegurarLlistat(obrirFull());
  var amplada = CAPCALERA_LLISTAT.length;
  var files = llegirFiles(hoja, amplada);
  var actualitzats = 0;
  var noTrobats = [];

  (assignacions || []).forEach(function(a) {
    var desdoblament = txt(a.desdoblament) || DESDOBLAMENT_GENERAL;
    var trobat = false;
    files.forEach(function(f) {
      if (txt(f[4]) === classe && txt(f[0]) && mateixAlumne(f[0], f[1], txt(f[6]) || txt(f[2]), a.alumne)) {
        trobat = true;
        if (txt(f[5]) !== desdoblament) { f[5] = desdoblament; actualitzats++; }
      }
    });
    if (!trobat) noTrobats.push(txt(a.alumne.nom) + ' ' + txt(a.alumne.cognoms));
  });

  hoja.getRange(2, 6, Math.max(files.length, 1), 1).setValues(files.length ? files.map(function(f) { return [f[5]]; }) : [['']]);
  invalidarCache(['llistat']);
  return { actualitzats: actualitzats, noTrobats: noTrobats };
}

// Criteris aplicables a un supòsit: els propis del supòsit si en té; si no, els del mòdul.
// Si el mòdul no té cap criteri configurat, una sola "Nota" del 100%.
function obtenirCriteris(modul, suposit) {
  var config = llegirConfiguracio().filter(function(c) { return c.modul === modul; });

  var propis = suposit ? config.filter(function(c) { return c.suposit === txt(suposit); }) : [];
  var criteris = propis.length > 0 ? propis : config.filter(function(c) { return !c.suposit; });

  if (criteris.length === 0) {
    return [{ nom: "Nota", pes: 100, tipus: 'numeric', nivells: [], imprescindible: false }];
  }

  try {
    return validarCriteris(criteris, false);
  } catch (err) {
    throw new Error('Configuració de "' + modul + '"' + (propis.length ? ' / "' + suposit + '"' : '') + ': ' +
        err.message + ' Revisa-ho a la pestanya Configurar.');
  }
}

// Tota la configuració agrupada per mòdul (per a la pestanya "Configurar")
function obtenirConfiguracio() {
  var ss = obrirFull();
  var config = llegirConfiguracio();
  var suposits = llegirSuposits();
  var moduls = {};

  function modulPerNom(nom) {
    if (!moduls[nom]) moduls[nom] = { nom: nom, criteris: [], suposits: [] };
    return moduls[nom];
  }

  config.forEach(function(c) {
    if (!c.suposit) modulPerNom(c.modul).criteris.push(c);
  });
  suposits.forEach(function(s) {
    var propis = config.filter(function(c) { return c.modul === s.modul && c.suposit === s.nom; });
    s.criteris = propis;
    s.criterisPropis = propis.length > 0;
    modulPerNom(s.modul).suposits.push(s);
  });
  // Criteris propis d'un supòsit que no existeix a "📋 Supòsits": el creem a la vista perquè es vegi
  config.forEach(function(c) {
    if (!c.suposit) return;
    var m = modulPerNom(c.modul);
    if (!m.suposits.some(function(s) { return s.nom === c.suposit; })) {
      m.suposits.push({ modul: c.modul, nom: c.suposit, data: '', descripcio: '', actiu: true, criterisPropis: true,
          criteris: config.filter(function(x) { return x.modul === c.modul && x.suposit === c.suposit; }) });
    }
  });

  return Object.keys(moduls).sort(function(a, b) { return a.localeCompare(b); }).map(function(k) {
    var m = moduls[k];
    m.suposits.sort(function(a, b) { return (a.data || '9999').localeCompare(b.data || '9999') || a.nom.localeCompare(b.nom); });
    return m;
  });
}

// ============ ESCRIPTURA DE CONFIGURACIÓ ============

function filaConfiguracio(modul, suposit, c) {
  return [modul, c.nom, c.pes, suposit || '', c.tipus, c.tipus === 'rubrica' ? formatarNivells(c.nivells) : '',
      c.imprescindible ? 'Sí' : ''];
}

// Desa (substitueix) els ítems d'un mòdul (suposit buit) o d'un supòsit concret.
// Per a un supòsit, una llista buida vol dir "fer servir els criteris del mòdul".
function desarCriteris(modul, suposit, criteris) {
  modul = txt(modul);
  suposit = txt(suposit);
  if (!modul) throw new Error('Falta el nom del mòdul.');

  var normalitzats = validarCriteris(criteris, !!suposit);
  var ss = obrirFull();
  var hoja = asegurarConfiguracio(ss);
  var amplada = CAPCALERA_CONFIGURACIO.length;

  var files = llegirFiles(hoja, amplada).filter(function(f) {
    return txt(f[0]) && !(txt(f[0]) === modul && txt(f[3]) === suposit);
  });
  normalitzats.forEach(function(c) { files.push(filaConfiguracio(modul, suposit, c)); });

  netejarFormatExemple(hoja, amplada);
  reescriureFiles(hoja, files, amplada);
  invalidarCache(['config']);
  return { success: true };
}

// Crea o actualitza un supòsit. Si es reanomena, també es reanomenen els seus criteris propis.
// (Els resultats ja exportats conserven el nom antic.)
function desarSuposit(modul, nomOriginal, suposit) {
  modul = txt(modul);
  nomOriginal = txt(nomOriginal);
  var nom = txt(suposit && suposit.nom);
  if (!modul || !nom) throw new Error('Cal el mòdul i el nom del supòsit.');

  var ss = obrirFull();
  var hoja = asegurarSuposits(ss);
  var amplada = CAPCALERA_SUPOSITS.length;
  var files = llegirFiles(hoja, amplada).filter(function(f) { return txt(f[0]) || txt(f[1]); });

  var existeix = files.some(function(f) { return txt(f[0]) === modul && txt(f[1]) === nom; });
  if (existeix && nom !== nomOriginal) throw new Error('Ja existeix un supòsit "' + nom + '" a "' + modul + '".');

  var fila = [modul, nom, txt(suposit.data), txt(suposit.descripcio), suposit.actiu === false ? 'No' : 'Sí'];
  var index = -1;
  files.forEach(function(f, i) { if (txt(f[0]) === modul && txt(f[1]) === (nomOriginal || nom)) index = i; });
  if (index >= 0) files[index] = fila; else files.push(fila);
  reescriureFiles(hoja, files, amplada);
  hoja.getRange(2, 3, Math.max(files.length, 1), 1).setNumberFormat('yyyy-mm-dd');

  if (nomOriginal && nomOriginal !== nom) {
    var hojaConfig = asegurarConfiguracio(ss);
    var ampladaConfig = CAPCALERA_CONFIGURACIO.length;
    var config = llegirFiles(hojaConfig, ampladaConfig).filter(function(f) { return txt(f[0]); });
    config.forEach(function(f) { if (txt(f[0]) === modul && txt(f[3]) === nomOriginal) f[3] = nom; });
    reescriureFiles(hojaConfig, config, ampladaConfig);
  }

  invalidarCache(['config', 'suposits']);
  if (suposit.criteris !== undefined) {
    desarCriteris(modul, nom, suposit.criteris);
  }
  return { success: true };
}

function duplicarSuposit(modul, nom, nouNom) {
  var original = llegirSuposits().filter(function(s) { return s.modul === modul && s.nom === nom; })[0];
  if (!original) throw new Error('No s\'ha trobat el supòsit "' + nom + '".');
  var criteris = llegirConfiguracio().filter(function(c) { return c.modul === modul && c.suposit === nom; });
  return desarSuposit(modul, '', {
    nom: nouNom, data: '', descripcio: original.descripcio, actiu: true, criteris: criteris
  });
}

// Esborra un supòsit i els seus criteris propis de la configuració. Els resultats NO s'esborren.
function eliminarSuposit(modul, nom) {
  var ss = obrirFull();
  var hoja = asegurarSuposits(ss);
  reescriureFiles(hoja, llegirFiles(hoja, CAPCALERA_SUPOSITS.length).filter(function(f) {
    return txt(f[0]) && !(txt(f[0]) === modul && txt(f[1]) === nom);
  }), CAPCALERA_SUPOSITS.length);

  var hojaConfig = asegurarConfiguracio(ss);
  reescriureFiles(hojaConfig, llegirFiles(hojaConfig, CAPCALERA_CONFIGURACIO.length).filter(function(f) {
    return txt(f[0]) && !(txt(f[0]) === modul && txt(f[3]) === nom);
  }), CAPCALERA_CONFIGURACIO.length);
  invalidarCache(['config', 'suposits']);
  return { success: true };
}

// Reanomena un mòdul a la configuració i als supòsits (els resultats ja exportats no es toquen)
function renomenarModul(antic, nou) {
  antic = txt(antic);
  nou = txt(nou);
  if (!nou) throw new Error('El nom nou no pot estar buit.');
  if (antic !== nou && listarModuls().indexOf(nou) !== -1) throw new Error('Ja existeix un mòdul "' + nou + '".');

  var ss = obrirFull();
  [[asegurarConfiguracio(ss), CAPCALERA_CONFIGURACIO.length], [asegurarSuposits(ss), CAPCALERA_SUPOSITS.length]]
      .forEach(function(par) {
        var files = llegirFiles(par[0], par[1]).filter(function(f) { return txt(f[0]); });
        files.forEach(function(f) { if (txt(f[0]) === antic) f[0] = nou; });
        reescriureFiles(par[0], files, par[1]);
      });
  invalidarCache(['config', 'suposits']);
  return { success: true };
}

// Esborra un mòdul de la configuració (criteris i supòsits). Els resultats NO s'esborren.
function eliminarModul(modul) {
  var ss = obrirFull();
  [[asegurarConfiguracio(ss), CAPCALERA_CONFIGURACIO.length], [asegurarSuposits(ss), CAPCALERA_SUPOSITS.length]]
      .forEach(function(par) {
        reescriureFiles(par[0], llegirFiles(par[0], par[1]).filter(function(f) {
          return txt(f[0]) && txt(f[0]) !== modul;
        }), par[1]);
      });
  invalidarCache(['config', 'suposits']);
  return { success: true };
}

// Importa una plantilla JSON (exportada des de la pestanya Configurar) com a mòdul nou o existent
function importarPlantilla(plantilla, nomModul) {
  if (typeof plantilla === 'string') plantilla = JSON.parse(plantilla);
  var modul = txt(nomModul) || txt(plantilla && plantilla.nom);
  if (!modul) throw new Error('La plantilla no té nom de mòdul.');

  if ((plantilla.criteris || []).length > 0) desarCriteris(modul, '', plantilla.criteris);
  (plantilla.suposits || []).forEach(function(s) {
    var existeix = llegirSuposits().some(function(x) { return x.modul === modul && x.nom === txt(s.nom); });
    desarSuposit(modul, existeix ? txt(s.nom) : '', {
      nom: s.nom, data: s.data || '', descripcio: s.descripcio || '', actiu: s.actiu !== false,
      criteris: s.criterisPropis ? s.criteris : []
    });
  });
  return { success: true, modul: modul };
}

// ============ EXPORTACIÓ ============

// Executa aquesta funció UN COP manualment des de l'editor (desplegable de funcions > autoritzarTot
// > Executar ▶) per forçar que Google et demani autoritzar TOTS els permisos que fa servir
// l'app (Sheets, Classroom, Drive i enviar correu) en una sola finestra.
function autoritzarTot() {
  var ss = obrirFull();
  Logger.log('Sheets OK: ' + ss.getName());

  var cursos = Classroom.Courses.list({ pageSize: 1 });
  Logger.log('Classroom OK: ' + ((cursos.courses || []).length) + ' curs(os) de prova llegit(s)');

  Logger.log('Drive OK: ' + DriveApp.getRootFolder().getName());

  var correuPropi = Session.getActiveUser().getEmail();
  MailApp.sendEmail(correuPropi, 'Avaluador Docent: autorització completada',
      'Si reps aquest correu, els permisos de Google Sheets, Classroom, Drive i correu ja estan autoritzats correctament.');
  Logger.log('Mail OK: correu de prova enviat a ' + correuPropi + ' (quota restant: ' + MailApp.getRemainingDailyQuota() + ')');
}

// Executa-la un cop manualment per organitzar el full (o actualitzar-ne les columnes)
function configurarRegistre() {
  var ss = obrirFull();
  asegurarLlistat(ss);
  asegurarConfiguracio(ss);
  asegurarSuposits(ss);
  asegurarAlumnat(ss);
  asegurarHistorial(ss);
  asegurarComentaris(ss);
  netejarFullDefecte(ss);
}

// Exporta les notes d'una sessió avaluada. Fa "upsert" a "👥 Alumnat" (actualitza si ja existeix,
// si no l'afegeix) i sempre afegeix el desglossament per criteri (amb el pes usat) a "🗄 Historial".
function exportarAGoogleSheets(dades, confirmat) {
  var ss = obrirFull();
  var fullAlumnat = asegurarAlumnat(ss);
  var amplada = CAPCALERA_ALUMNAT.length;
  var criteris = obtenirCriteris(dades.modul, dades.sessioAvaluada);

  // Només s'exporten alumnes amb algun criteri omplert. Les notes es limiten a 0-10.
  var avaluacions = (dades.evaluacions || []).map(function(item) {
    var notes = {};
    criteris.forEach(function(c) {
      var valor = item.notes ? item.notes[c.nom] : undefined;
      if (!esBuit(valor) && !isNaN(Number(valor))) {
        notes[c.nom] = Math.min(NOTA_MAXIMA, Math.max(0, Number(valor)));
      }
    });
    return {
      nom: txt(item.nom), cognoms: txt(item.cognoms), id: txt(item.id), grup: item.grup || '',
      notes: notes, observacioGrup: item.observacioGrup || '', observacioIndividual: item.observacioIndividual || ''
    };
  }).filter(function(item) { return Object.keys(item.notes).length > 0; });

  if (avaluacions.length === 0) throw new Error("No hi ha cap nota per exportar.");
  ordenarAlumnes(avaluacions);

  var files = llegirFiles(fullAlumnat, amplada);
  function trobarFila(av) {
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (mateixaSessio(f, A, dades.curs, dades.modul, dades.classe, dades.desdoblament, dades.sessioAvaluada) &&
          mateixAlumne(f[A.NOM], f[A.COGNOMS], f[A.ID], av)) return i;
    }
    return -1;
  }

  var indexs = avaluacions.map(trobarFila);
  var primerXoc = indexs.filter(function(i) { return i >= 0; })[0];
  if (primerXoc !== undefined && !confirmat) {
    return { necessitaConfirmacio: true, ultimaActualitzacio: formatarData(files[primerXoc][A.DATA]) };
  }

  var ara = new Date();
  var limitades = [];

  avaluacions.forEach(function(av, k) {
    var calcul = calcularNotaFinal(criteris, av.notes);
    if (calcul.limitada) limitades.push(av.nom + ' ' + av.cognoms);
    var anterior = indexs[k] >= 0 ? files[indexs[k]] : null;

    var detall = criteris.filter(function(c) { return av.notes[c.nom] !== undefined; })
        .map(function(c) { return [c.nom, av.notes[c.nom], c.pes]; });
    var fila = [ara, dades.curs, dades.modul, dades.classe, dades.desdoblament, av.nom, av.cognoms, dades.sessioAvaluada,
        av.observacioGrup, av.observacioIndividual, calcul.nota, av.grup,
        calcul.limitada ? 'Calculada (limitada per imprescindible)' : 'Calculada',
        av.id, anterior ? anterior[A.CORREU_ENVIAT] : '', JSON.stringify(detall)];

    if (anterior) files[indexs[k]] = fila; else files.push(fila);
  });

  reescriureFiles(fullAlumnat, files, amplada);
  assegurarAlumnesAlLlistat(ss, dades, avaluacions);
  registrarHistorial(ss, dades, avaluacions, criteris, ara);

  return { success: true, url: ss.getUrl(), exportats: avaluacions.length, limitades: limitades };
}

// Si un alumne avaluat no existia encara a "👤 Llistat" (afegit a mà des de l'app), el hi afegeix
function assegurarAlumnesAlLlistat(ss, dades, avaluacions) {
  var hoja = asegurarLlistat(ss);
  var files = llegirFiles(hoja, CAPCALERA_LLISTAT.length);
  var nous = [];

  avaluacions.forEach(function(av) {
    var existeix = files.some(function(f) {
      return txt(f[4]) === txt(dades.classe) && mateixAlumne(f[0], f[1], txt(f[6]) || txt(f[2]), av);
    });
    if (!existeix) nous.push([av.nom, av.cognoms, "", dades.curs, dades.classe, dades.desdoblament, av.id]);
  });

  if (nous.length) {
    afegirFiles(hoja, nous, CAPCALERA_LLISTAT.length);
    invalidarCache(['llistat']);
  }
}

// Afegeix una fila per cada alumne i criteri exportat (amb el pes i el tipus usats), sense
// esborrar mai l'historial previ
function registrarHistorial(ss, dades, avaluacions, criteris, ara) {
  var hoja = asegurarHistorial(ss);
  var files = [];

  avaluacions.forEach(function(av) {
    criteris.forEach(function(c) {
      if (av.notes[c.nom] === undefined) return;
      files.push([ara, dades.curs, dades.modul, dades.classe, dades.desdoblament,
          av.nom, av.cognoms, dades.sessioAvaluada, c.nom, av.notes[c.nom], c.pes, c.tipus, av.id]);
    });
  });

  afegirFiles(hoja, files, CAPCALERA_HISTORIAL.length);
}

// ============ VISTA DE RESULTATS ============

// Llista les sessions avaluades d'una classe, de més recent a més antiga. "modul" és opcional.
function llistarSessions(classe, modul) {
  var files = llegirFiles(asegurarAlumnat(obrirFull()), CAPCALERA_ALUMNAT.length);
  var sessions = {};

  files.forEach(function(f) {
    if (txt(f[A.CLASSE]) !== classe) return;
    if (modul && txt(f[A.MODUL]) !== modul) return;

    var clau = [f[A.CURS], f[A.MODUL], f[A.CLASSE], f[A.DESD], f[A.SESSIO]].join('|');
    if (!sessions[clau]) {
      sessions[clau] = { curs: txt(f[A.CURS]), modul: txt(f[A.MODUL]), classe: txt(f[A.CLASSE]),
          desdoblament: txt(f[A.DESD]), sessioAvaluada: txt(f[A.SESSIO]), data: f[A.DATA], nAlumnes: 0, sumaNotes: 0, nNotes: 0 };
    }
    var s = sessions[clau];
    s.nAlumnes++;
    if (!esBuit(f[A.NOTA]) && !isNaN(Number(f[A.NOTA]))) { s.sumaNotes += Number(f[A.NOTA]); s.nNotes++; }
    if (f[A.DATA] > s.data) s.data = f[A.DATA];
  });

  var resultat = Object.keys(sessions).map(function(k) { return sessions[k]; });
  resultat.sort(function(a, b) { return b.data - a.data; });
  resultat.forEach(function(s) {
    s.data = formatarData(s.data);
    s.mitjana = s.nNotes ? Math.round(s.sumaNotes / s.nNotes * 100) / 100 : '';
    delete s.sumaNotes;
    delete s.nNotes;
  });
  return resultat;
}

// Per a una sessió, retorna el desglossament per criteri de cada alumne a partir de l'historial.
// Per a cada alumne només es té en compte la seva ÚLTIMA exportació, així els criteris d'una
// configuració antiga no es barregen amb els actuals.
function desglossamentSessio(ss, curs, modul, classe, desdoblament, sessio) {
  var files = llegirFiles(asegurarHistorial(ss), CAPCALERA_HISTORIAL.length);
  var perAlumne = {};

  files.forEach(function(f) {
    if (!mateixaSessio(f, H, curs, modul, classe, desdoblament, sessio)) return;
    var clau = clauAlumneServidor({ nom: f[H.NOM], cognoms: f[H.COGNOMS], id: f[H.ID] });
    var data = f[H.DATA] instanceof Date ? f[H.DATA].getTime() : 0;
    var actual = perAlumne[clau];
    if (!actual || data > actual.data) {
      perAlumne[clau] = actual = { data: data, notes: {}, ordre: [] };
    }
    if (data === actual.data) {
      var criteri = txt(f[H.CRITERI]);
      if (actual.notes[criteri] === undefined) actual.ordre.push({ nom: criteri, pes: esBuit(f[H.PES]) ? '' : Number(f[H.PES]) });
      actual.notes[criteri] = f[H.NOTA];
    }
  });
  return perAlumne;
}

function buscarDesglossament(perAlumne, alumne) {
  return perAlumne[clauAlumneServidor(alumne)] ||
      perAlumne[clauAlumneServidor({ nom: alumne.nom, cognoms: alumne.cognoms })] || null;
}

// Desglossament desat a la columna "Detall ítems" d'Alumnat: [[criteri, nota, pes], ...].
// Retorna null per a les files antigues (exportades abans d'existir la columna).
function llegirDetallFila(f) {
  var text = txt(f[A.DETALL]);
  if (!text) return null;
  try {
    var llista = JSON.parse(text);
    var detall = { notes: {}, ordre: [] };
    llista.forEach(function(e) {
      detall.notes[e[0]] = e[1];
      detall.ordre.push({ nom: e[0], pes: esBuit(e[2]) ? '' : Number(e[2]) });
    });
    return detall;
  } catch (err) {
    return null;
  }
}

// Retorna els resultats d'una sessió (una fila per alumne) amb el desglossament per criteri.
// Només llegeix "🗄 Historial" si hi ha files antigues sense la columna "Detall ítems".
function obtenirResultatsSessio(curs, modul, classe, desdoblament, sessioAvaluada) {
  var ss = obrirFull();
  var files = llegirFiles(asegurarAlumnat(ss), CAPCALERA_ALUMNAT.length).filter(function(f) {
    return mateixaSessio(f, A, curs, modul, classe, desdoblament, sessioAvaluada);
  });
  var perAlumne = null;
  var criterisVistos = {};
  var criteris = [];

  var alumnes = files.map(function(f) {
    var alumne = { nom: txt(f[A.NOM]), cognoms: txt(f[A.COGNOMS]), id: txt(f[A.ID]) };
    var detall = llegirDetallFila(f);
    if (!detall) {
      if (!perAlumne) perAlumne = desglossamentSessio(ss, curs, modul, classe, desdoblament, sessioAvaluada);
      detall = buscarDesglossament(perAlumne, alumne);
    }
    if (detall) {
      detall.ordre.forEach(function(c) {
        if (!criterisVistos[c.nom]) { criterisVistos[c.nom] = true; criteris.push(c); }
      });
    }
    return {
      nom: alumne.nom, cognoms: alumne.cognoms, id: alumne.id,
      observacioGrup: txt(f[A.OBS_GRUP]), observacioIndividual: txt(f[A.OBS_INDIV]),
      notaFinal: esBuit(f[A.NOTA]) ? '' : Number(f[A.NOTA]),
      grup: txt(f[A.GRUP]), origen: txt(f[A.ORIGEN]) || 'Calculada',
      correuEnviat: formatarData(f[A.CORREU_ENVIAT]),
      notes: detall ? detall.notes : {}
    };
  });

  return { alumnes: ordenarAlumnes(alumnes), criteris: criteris };
}

// Notes per criteri de l'última exportació d'un alumne en una sessió
function obtenirDetallAlumne(curs, modul, classe, desdoblament, alumne, sessioAvaluada) {
  var fila = llegirFiles(asegurarAlumnat(obrirFull()), CAPCALERA_ALUMNAT.length).filter(function(f) {
    return mateixaSessio(f, A, curs, modul, classe, desdoblament, sessioAvaluada) && mateixAlumne(f[A.NOM], f[A.COGNOMS], f[A.ID], alumne);
  })[0];
  var detallFila = fila ? llegirDetallFila(fila) : null;
  if (detallFila) return detallFila.notes;
  var perAlumne = desglossamentSessio(obrirFull(), curs, modul, classe, desdoblament, sessioAvaluada);
  var detall = buscarDesglossament(perAlumne, alumne);
  return detall ? detall.notes : {};
}

// Totes les sessions avaluades d'un alumne d'una classe (fitxa de l'alumne)
function obtenirFitxaAlumne(classe, alumne) {
  var files = llegirFiles(asegurarAlumnat(obrirFull()), CAPCALERA_ALUMNAT.length);
  var sessions = files.filter(function(f) {
    return txt(f[A.CLASSE]) === classe && mateixAlumne(f[A.NOM], f[A.COGNOMS], f[A.ID], alumne);
  }).map(function(f) {
    return {
      ts: f[A.DATA] instanceof Date ? f[A.DATA].getTime() : 0, data: formatarData(f[A.DATA], 'dd/MM/yyyy'),
      curs: txt(f[A.CURS]), modul: txt(f[A.MODUL]), desdoblament: txt(f[A.DESD]), sessioAvaluada: txt(f[A.SESSIO]),
      notaFinal: esBuit(f[A.NOTA]) ? '' : Number(f[A.NOTA]), grup: txt(f[A.GRUP]),
      observacioGrup: txt(f[A.OBS_GRUP]), observacioIndividual: txt(f[A.OBS_INDIV])
    };
  });
  sessions.sort(function(a, b) { return a.ts - b.ts; });
  return sessions;
}

// Esborra el resultat d'un sol alumne d'una sessió. L'historial per criteri NO s'esborra.
function eliminarResultat(curs, modul, classe, desdoblament, alumne, sessioAvaluada) {
  var hoja = asegurarAlumnat(obrirFull());
  var amplada = CAPCALERA_ALUMNAT.length;
  reescriureFiles(hoja, llegirFiles(hoja, amplada).filter(function(f) {
    return !(mateixaSessio(f, A, curs, modul, classe, desdoblament, sessioAvaluada) &&
        mateixAlumne(f[A.NOM], f[A.COGNOMS], f[A.ID], alumne));
  }), amplada);
  return { success: true };
}

// Esborra tots els resultats d'una sessió sencera. L'historial no s'esborra.
function eliminarSessio(curs, modul, classe, desdoblament, sessioAvaluada) {
  var hoja = asegurarAlumnat(obrirFull());
  var amplada = CAPCALERA_ALUMNAT.length;
  reescriureFiles(hoja, llegirFiles(hoja, amplada).filter(function(f) {
    return !mateixaSessio(f, A, curs, modul, classe, desdoblament, sessioAvaluada);
  }), amplada);
  return { success: true };
}

// Edició ràpida des de "Resultats": nota final i observacions. Si la nota final canvia respecte
// de la calculada, es marca com a "Manual" perquè es vegi que ja no surt dels criteris.
function actualitzarResultat(p) {
  var hoja = asegurarAlumnat(obrirFull());
  var amplada = CAPCALERA_ALUMNAT.length;
  var files = llegirFiles(hoja, amplada);

  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (mateixaSessio(f, A, p.curs, p.modul, p.classe, p.desdoblament, p.sessioAvaluada) &&
        mateixAlumne(f[A.NOM], f[A.COGNOMS], f[A.ID], p.alumne)) {
      var valorNota = esBuit(p.notaFinal) ? '' : Number(p.notaFinal);
      if (valorNota !== '' && (isNaN(valorNota) || valorNota < 0 || valorNota > NOTA_MAXIMA)) {
        throw new Error('La nota ha d\'estar entre 0 i ' + NOTA_MAXIMA + '.');
      }
      var notaCanvia = String(valorNota) !== String(esBuit(f[A.NOTA]) ? '' : Number(f[A.NOTA]));
      var origen = notaCanvia ? 'Manual' : (txt(f[A.ORIGEN]) || 'Calculada');

      hoja.getRange(i + 2, A.DATA + 1).setValue(new Date());
      hoja.getRange(i + 2, A.OBS_GRUP + 1, 1, 3).setValues([[p.observacioGrup || '', p.observacioIndividual || '', valorNota]]);
      hoja.getRange(i + 2, A.ORIGEN + 1).setValue(origen);
      return { success: true, origen: origen };
    }
  }
  throw new Error('No s\'ha trobat aquest resultat per actualitzar.');
}

// Desa els ítems (i observacions) d'un alumne d'una sessió ja exportada i, si cal, la nota manual.
// Retorna la sessió actualitzada, així el client no ha de tornar-la a demanar.
function desarItemsResultat(p) {
  exportarAGoogleSheets({
    curs: p.curs, modul: p.modul, classe: p.classe, desdoblament: p.desdoblament, sessioAvaluada: p.sessioAvaluada,
    evaluacions: [{ nom: p.alumne.nom, cognoms: p.alumne.cognoms, id: p.alumne.id || '', grup: p.grup || '',
                    notes: p.notes || {}, observacioGrup: p.observacioGrup || '', observacioIndividual: p.observacioIndividual || '' }]
  }, true);
  if (!esBuit(p.notaManual)) {
    actualitzarResultat({ curs: p.curs, modul: p.modul, classe: p.classe, desdoblament: p.desdoblament, sessioAvaluada: p.sessioAvaluada,
        alumne: p.alumne, notaFinal: p.notaManual, observacioGrup: p.observacioGrup, observacioIndividual: p.observacioIndividual });
  }
  return obtenirResultatsSessio(p.curs, p.modul, p.classe, p.desdoblament, p.sessioAvaluada);
}

// ============ INFORME PDF ============

// Crea un PDF amb els resultats d'una sessió a la carpeta arrel de Drive i en retorna l'enllaç
function crearInformePdf(curs, modul, classe, desdoblament, sessioAvaluada) {
  var dades = obtenirResultatsSessio(curs, modul, classe, desdoblament, sessioAvaluada);
  var notes = dades.alumnes.map(function(a) { return a.notaFinal; }).filter(function(n) { return n !== ''; });
  var mitjana = notes.length ? Math.round(notes.reduce(function(s, n) { return s + n; }, 0) / notes.length * 100) / 100 : '-';
  var aprovats = notes.filter(function(n) { return n >= NOTA_APROVAT; }).length;

  var css = 'body{font-family:Arial,sans-serif;font-size:10pt;color:#1e293b}h1{font-size:15pt;margin:0}' +
      'p{margin:4px 0}table{border-collapse:collapse;width:100%;margin-top:12px}' +
      'th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left;vertical-align:top}' +
      'th{background:#eef2ff}td.n{text-align:center}';
  var html = '<html><head><meta charset="utf-8"><style>' + css + '</style></head><body>' +
      '<h1>' + escaparHtml(sessioAvaluada) + '</h1>' +
      '<p>' + escaparHtml(modul) + ' · ' + escaparHtml(classe) +
      (desdoblament !== DESDOBLAMENT_GENERAL ? ' (' + escaparHtml(desdoblament) + ')' : '') + ' · Curs ' + escaparHtml(curs) + '</p>' +
      '<p>Alumnes: ' + dades.alumnes.length + ' · Mitjana: ' + mitjana + ' · Aprovats: ' + aprovats + '/' + notes.length + '</p>' +
      '<table><tr><th>Alumne</th><th>Grup</th>' +
      dades.criteris.map(function(c) { return '<th>' + escaparHtml(c.nom) + (c.pes !== '' ? ' (' + c.pes + '%)' : '') + '</th>'; }).join('') +
      '<th>Nota final</th><th>Observacions</th></tr>' +
      dades.alumnes.map(function(a) {
        var obs = [a.observacioGrup, a.observacioIndividual].filter(function(o) { return o; }).map(escaparHtml).join('<br>');
        return '<tr><td>' + escaparHtml(a.cognoms + ', ' + a.nom) + '</td><td class="n">' + escaparHtml(a.grup) + '</td>' +
            dades.criteris.map(function(c) { return '<td class="n">' + escaparHtml(esBuit(a.notes[c.nom]) ? '' : a.notes[c.nom]) + '</td>'; }).join('') +
            '<td class="n"><b>' + escaparHtml(a.notaFinal) + '</b>' + (a.origen === 'Manual' ? ' *' : '') + '</td><td>' + obs + '</td></tr>';
      }).join('') +
      '</table><p style="color:#64748b;margin-top:8px">* Nota final ajustada manualment.</p></body></html>';

  var nomFitxer = 'Informe - ' + sessioAvaluada + ' - ' + classe + ' (' + curs + ').pdf';
  var pdf = Utilities.newBlob(html, 'text/html', 'informe.html').getAs('application/pdf').setName(nomFitxer);
  var fitxer = DriveApp.createFile(pdf);
  return { url: fitxer.getUrl(), nom: nomFitxer };
}

// ============ IMPORTACIÓ DES DE GOOGLE CLASSROOM ============

// Llista els cursos actius de Classroom on ets professor (cal el servei avançat "Classroom")
function listarCursosClassroom() {
  var cursos = [];
  var pageToken;
  do {
    var resposta = Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageToken: pageToken });
    (resposta.courses || []).forEach(function(curs) { cursos.push({ id: curs.id, nom: curs.name }); });
    pageToken = resposta.nextPageToken;
  } while (pageToken);

  cursos.sort(function(a, b) { return a.nom.localeCompare(b.nom); });
  return cursos;
}

// Importa (o actualitza) a "👤 Llistat" els alumnes d'un curs de Classroom, amb correu i ID.
// L'ID (el correu, o l'ID de Classroom si no n'hi ha) és el que identifica l'alumne d'ara endavant.
// Els alumnes que ja hi eren CONSERVEN el seu desdoblament; el de la importació només s'aplica als nous.
function importarAlumnesClassroom(courseId, curs, classe, desdoblament) {
  var alumnesClassroom = [];
  var pageToken;
  do {
    var resposta = Classroom.Courses.Students.list(courseId, { pageSize: 100, pageToken: pageToken });
    (resposta.students || []).forEach(function(alumne) {
      var perfil = alumne.profile || {};
      var nom = txt(perfil.name && perfil.name.givenName);
      var cognoms = txt(perfil.name && perfil.name.familyName);
      var correu = txt(perfil.emailAddress);
      if (nom || cognoms) alumnesClassroom.push({ nom: nom, cognoms: cognoms, correu: correu, id: correu || txt(alumne.userId) });
    });
    pageToken = resposta.nextPageToken;
  } while (pageToken);

  var hoja = asegurarLlistat(obrirFull());
  var amplada = CAPCALERA_LLISTAT.length;
  var files = llegirFiles(hoja, amplada);
  var importats = 0, actualitzats = 0;

  alumnesClassroom.forEach(function(al) {
    var index = -1;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      // Mateixa classe i mateix alumne: per ID si tots dos en tenen, si no per nom i cognoms
      if (txt(f[4]) === classe && mateixAlumne(f[0], f[1], txt(f[6]) || txt(f[2]), al)) { index = i; break; }
    }
    var desdoblamentFila = index >= 0 ? (txt(files[index][5]) || desdoblament) : desdoblament;
    var fila = [al.nom, al.cognoms, al.correu, curs, classe, desdoblamentFila, al.id];
    if (index >= 0) { files[index] = fila; actualitzats++; } else { files.push(fila); importats++; }
  });

  netejarFormatExemple(hoja, amplada);
  reescriureFiles(hoja, files, amplada);
  invalidarCache(['llistat']);
  return { importats: importats, actualitzats: actualitzats, total: alumnesClassroom.length };
}

// ============ CORREUS ============

// Mapa de correus de "👤 Llistat" per a una classe, consultable per ID o per nom+cognoms
function mapaCorreus(classe) {
  var files = filesLlistat();
  var mapa = {};
  files.forEach(function(f) {
    if (txt(f[4]) !== classe || !txt(f[2])) return;
    if (txt(f[6])) mapa[clauAlumneServidor({ id: f[6] })] = txt(f[2]);
    mapa[clauAlumneServidor({ id: f[2] })] = txt(f[2]);
    mapa[clauAlumneServidor({ nom: f[0], cognoms: f[1] })] = txt(f[2]);
  });
  return function(alumne) {
    return (txt(alumne.id) && mapa[clauAlumneServidor(alumne)]) ||
        mapa[clauAlumneServidor({ nom: alumne.nom, cognoms: alumne.cognoms })] || '';
  };
}

// Substitueix etiquetes {{clau}} d'una plantilla pels valors corresponents
function substituirPlantilla(text, dades) {
  return String(text).replace(/\{\{(\w+)\}\}/g, function(coincidencia, clau) {
    return dades.hasOwnProperty(clau) ? String(dades[clau]) : coincidencia;
  });
}

// Envia un correu personalitzat (text + HTML) als alumnes seleccionats d'una sessió.
// p.destinataris = [{ nom, cognoms, id }] (si és buit, a tots). Les plantilles admeten
// {{nom}}, {{cognoms}}, {{nota}}, {{grup}}, {{observacions_grup}}, {{observacions_individual}},
// {{desglossament}}, {{sessio}}, {{modul}}, {{classe}}, {{curs}}.
// Marca la columna "Correu enviat" d'Alumnat amb la data d'enviament.
function enviarCorreus(p) {
  var ss = obrirFull();
  var dades = obtenirResultatsSessio(p.curs, p.modul, p.classe, p.desdoblament, p.sessioAvaluada);
  var destinataris = p.destinataris && p.destinataris.length ? p.destinataris : dades.alumnes;
  var alumnes = dades.alumnes.filter(function(a) {
    return destinataris.some(function(d) { return mateixAlumne(a.nom, a.cognoms, a.id, d); });
  });

  var correuDe = mapaCorreus(p.classe);
  var ambCorreu = alumnes.filter(function(a) { return correuDe(a); });
  var senseCorreu = alumnes.filter(function(a) { return !correuDe(a); }).map(function(a) { return a.nom + ' ' + a.cognoms; });

  var quota = MailApp.getRemainingDailyQuota();
  if (ambCorreu.length > quota) {
    throw new Error('Només et queden ' + quota + ' correus per avui (límit diari de Google) i en vols enviar ' +
        ambCorreu.length + '. Selecciona menys alumnes o prova-ho demà.');
  }

  var hoja = asegurarAlumnat(ss);
  var files = llegirFiles(hoja, CAPCALERA_ALUMNAT.length);
  var ara = new Date();
  var enviats = 0;
  var errors = [];
  var marcats = false;

  ambCorreu.forEach(function(a) {
    var desglossamentText = dades.criteris.map(function(c) {
      return '- ' + c.nom + (c.pes !== '' ? ' (' + c.pes + '%)' : '') + ': ' + (esBuit(a.notes[c.nom]) ? '-' : a.notes[c.nom]);
    }).join('\n');
    var desglossamentHtml = '<table style="border-collapse:collapse;font-size:14px">' + dades.criteris.map(function(c) {
      return '<tr><td style="border:1px solid #cbd5e1;padding:4px 8px">' + escaparHtml(c.nom) + (c.pes !== '' ? ' (' + c.pes + '%)' : '') +
          '</td><td style="border:1px solid #cbd5e1;padding:4px 8px;text-align:center"><b>' +
          escaparHtml(esBuit(a.notes[c.nom]) ? '-' : a.notes[c.nom]) + '</b></td></tr>';
    }).join('') + '</table>';

    var valors = {
      nom: a.nom, cognoms: a.cognoms, nota: a.notaFinal !== '' ? a.notaFinal : '-', grup: a.grup || '-',
      observacions_grup: a.observacioGrup || '', observacions_individual: a.observacioIndividual || '',
      sessio: p.sessioAvaluada, modul: p.modul, classe: p.classe, curs: p.curs
    };
    var valorsHtml = {};
    Object.keys(valors).forEach(function(k) { valorsHtml[k] = escaparHtml(valors[k]); });

    valors.desglossament = desglossamentText;
    valorsHtml.desglossament = desglossamentHtml;

    var cos = substituirPlantilla(p.cos, valors);
    var cosHtml = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' +
        substituirPlantilla(escaparHtml(p.cos), valorsHtml).replace(/\n/g, '<br>') + '</div>';

    try {
      MailApp.sendEmail({ to: correuDe(a), subject: substituirPlantilla(p.assumpte, valors), body: cos, htmlBody: cosHtml });
      enviats++;
      for (var i = 0; i < files.length; i++) {
        if (mateixaSessio(files[i], A, p.curs, p.modul, p.classe, p.desdoblament, p.sessioAvaluada) &&
            mateixAlumne(files[i][A.NOM], files[i][A.COGNOMS], files[i][A.ID], a)) {
          files[i][A.CORREU_ENVIAT] = ara;
          marcats = true;
        }
      }
    } catch (err) {
      errors.push(a.nom + ' ' + a.cognoms + ': ' + err.message);
    }
  });

  if (marcats && files.length) {
    hoja.getRange(2, A.CORREU_ENVIAT + 1, files.length, 1).setValues(files.map(function(f) { return [f[A.CORREU_ENVIAT]]; }));
  }
  return { enviats: enviats, senseCorreu: senseCorreu, errors: errors, quotaRestant: MailApp.getRemainingDailyQuota(),
           resultats: obtenirResultatsSessio(p.curs, p.modul, p.classe, p.desdoblament, p.sessioAvaluada) };
}

// ============ FORMAT I ESTRUCTURA DE PESTANYES ============

function aplicarEstilCapcalera(hoja, capcalera) {
  hoja.getRange(1, 1, 1, capcalera.length).setValues([capcalera])
      .setFontWeight("bold").setBackground(COLOR_CAPCALERA).setFontColor("#ffffff");
}

// Completa les capçaleres que falten (fulls creats amb una versió anterior de l'app)
function assegurarCapcaleres(hoja, capcalera) {
  var actuals = hoja.getRange(1, 1, 1, capcalera.length).getValues()[0];
  var falten = capcalera.some(function(c, i) { return txt(actuals[i]) !== c; });
  if (falten) aplicarEstilCapcalera(hoja, capcalera);
}

function aplicarFiltre(hoja, numCols) {
  var filtre = hoja.getFilter();
  if (filtre && filtre.getRange().getNumColumns() >= numCols) return;
  if (filtre) filtre.remove();
  hoja.getRange(1, 1, Math.max(hoja.getMaxRows(), 1000), numCols).createFilter();
}

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

function aplicarFormatData(hoja, columna) {
  hoja.getRange(2, columna, 999, 1).setNumberFormat("dd/mm/yyyy hh:mm");
}

// Les files d'exemple es creen en gris cursiva; quan s'hi escriuen dades reals, es treu aquest format
function netejarFormatExemple(hoja, amplada) {
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila >= 2) hoja.getRange(2, 1, ultimaFila - 1, amplada).setFontColor(null).setFontStyle(null);
}

function asegurarLlistat(ss) {
  var hoja = ss.getSheetByName(NOM_LLISTAT);
  if (hoja) {
    assegurarCapcaleres(hoja, CAPCALERA_LLISTAT);
    return hoja;
  }

  hoja = ss.insertSheet(NOM_LLISTAT, 0);
  aplicarEstilCapcalera(hoja, CAPCALERA_LLISTAT);

  var exemple = [
    ["María", "Álvarez Gómez", "", "26/27", "1º A", "General", ""],
    ["Javier", "Bernal Ruiz", "", "26/27", "1º A", "Desdoble 1", ""],
    ["Sofía", "Castro Peña", "", "26/27", "1º A", "Desdoble 2", ""]
  ];
  hoja.getRange(2, 1, exemple.length, CAPCALERA_LLISTAT.length).setValues(exemple)
      .setFontColor("#94a3b8").setFontStyle("italic");

  hoja.setColumnWidths(1, 2, 150);
  hoja.setColumnWidth(3, 200);
  hoja.setColumnWidth(4, 70);
  hoja.setColumnWidth(5, 80);
  hoja.setColumnWidth(6, 110);
  hoja.setColumnWidth(7, 200);
  hoja.setFrozenRows(1);
  aplicarFiltre(hoja, CAPCALERA_LLISTAT.length);
  return hoja;
}

// Criteris d'avaluació per mòdul (Supòsit buit) o per supòsit concret
function asegurarConfiguracio(ss) {
  var hoja = ss.getSheetByName(NOM_CONFIGURACIO);
  if (hoja) {
    // Versió anterior: hi havia una nota d'ajuda a E1, on ara va la columna "Tipus"
    if (txt(hoja.getRange("E1").getValue()).indexOf('Afegeix una fila') === 0) {
      hoja.getRange("E1").clearContent().setFontStyle(null).setFontColor(null);
    }
    assegurarCapcaleres(hoja, CAPCALERA_CONFIGURACIO);
    return hoja;
  }

  hoja = ss.insertSheet(NOM_CONFIGURACIO, 1);
  aplicarEstilCapcalera(hoja, CAPCALERA_CONFIGURACIO);

  var exemple = [
    ["Individuals Aigua", "Diu l'objectiu de la sessió", 10, "", "sino", "", ""],
    ["Individuals Aigua", "Bona presentació", 10, "", "numeric", "", ""],
    ["Individuals Aigua", "Coordinació grupal", 20, "", "rubrica", "Insuficient=2; Suficient=5; Bé=7.5; Excel·lent=10", ""],
    ["Individuals Aigua", "Activitats adients als participants", 20, "", "numeric", "", "Sí"],
    ["Individuals Aigua", "Els participants s'ho han passat molt bé", 40, "", "numeric", "", ""]
  ];
  hoja.getRange(2, 1, exemple.length, CAPCALERA_CONFIGURACIO.length).setValues(exemple)
      .setFontColor("#94a3b8").setFontStyle("italic");

  hoja.getRange("I1").setValue(
      "Es recomana editar-ho des de la pestanya Configurar de l'app. Supòsit buit = criteri per a tot el mòdul. " +
      "Tipus: numeric (0-10), sino (Sí=10/No=0) o rubrica (Nivells: Nom=valor; ...). Els pesos han de sumar 100.")
      .setFontStyle("italic").setFontColor("#64748b");

  hoja.setColumnWidths(1, 2, 200);
  hoja.setColumnWidth(3, 80);
  hoja.setColumnWidth(4, 170);
  hoja.setColumnWidth(5, 90);
  hoja.setColumnWidth(6, 280);
  hoja.setColumnWidth(7, 110);
  hoja.setFrozenRows(1);
  return hoja;
}

// Catàleg de supòsits pràctics per mòdul
function asegurarSuposits(ss) {
  var hoja = ss.getSheetByName(NOM_SUPOSITS);
  if (hoja) {
    assegurarCapcaleres(hoja, CAPCALERA_SUPOSITS);
    return hoja;
  }

  hoja = ss.insertSheet(NOM_SUPOSITS, 2);
  aplicarEstilCapcalera(hoja, CAPCALERA_SUPOSITS);
  hoja.setColumnWidth(1, 180);
  hoja.setColumnWidth(2, 220);
  hoja.setColumnWidth(3, 100);
  hoja.setColumnWidth(4, 360);
  hoja.setColumnWidth(5, 70);
  hoja.getRange(2, 3, 999, 1).setNumberFormat('yyyy-mm-dd');
  hoja.setFrozenRows(1);
  aplicarFiltre(hoja, CAPCALERA_SUPOSITS.length);
  return hoja;
}

function asegurarAlumnat(ss) {
  var hoja = ss.getSheetByName(NOM_ALUMNAT);
  if (hoja) {
    assegurarCapcaleres(hoja, CAPCALERA_ALUMNAT);
    return hoja;
  }

  hoja = ss.insertSheet(NOM_ALUMNAT);
  aplicarEstilCapcalera(hoja, CAPCALERA_ALUMNAT);

  [120, 70, 150, 80, 90, 120, 140, 170, 220, 220, 90, 60, 130, 200, 120, 260].forEach(function(amplada, i) {
    hoja.setColumnWidth(i + 1, amplada);
  });
  hoja.setFrozenRows(1);

  aplicarFiltre(hoja, CAPCALERA_ALUMNAT.length);
  aplicarEscalaColor(hoja, A.NOTA + 1);
  aplicarFormatData(hoja, A.DATA + 1);
  aplicarFormatData(hoja, A.CORREU_ENVIAT + 1);
  return hoja;
}

// Historial append-only: mai s'esborra, només s'afegeix
function asegurarHistorial(ss) {
  var hoja = ss.getSheetByName(NOM_HISTORIAL);
  if (hoja) {
    assegurarCapcaleres(hoja, CAPCALERA_HISTORIAL);
    return hoja;
  }

  hoja = ss.insertSheet(NOM_HISTORIAL);
  aplicarEstilCapcalera(hoja, CAPCALERA_HISTORIAL);
  hoja.setColumnWidths(1, CAPCALERA_HISTORIAL.length, 120);
  hoja.setFrozenRows(1);

  aplicarFiltre(hoja, CAPCALERA_HISTORIAL.length);
  aplicarEscalaColor(hoja, H.NOTA + 1);
  aplicarFormatData(hoja, H.DATA + 1);
  return hoja;
}

// Comentaris ràpids: es crea amb uns quants d'exemple
function asegurarComentaris(ss) {
  var hoja = ss.getSheetByName(NOM_COMENTARIS);
  if (hoja) {
    assegurarCapcaleres(hoja, CAPCALERA_COMENTARIS);
    return hoja;
  }
  hoja = ss.insertSheet(NOM_COMENTARIS);
  aplicarEstilCapcalera(hoja, CAPCALERA_COMENTARIS);
  hoja.getRange(2, 1, COMENTARIS_PER_DEFECTE.length, 2).setValues(COMENTARIS_PER_DEFECTE.map(function(c) { return [c, '']; }));
  hoja.setColumnWidth(1, 360);
  hoja.setColumnWidth(2, 200);
  hoja.setFrozenRows(1);
  return hoja;
}

function netejarFullDefecte(ss) {
  ["Hoja 1", "Sheet1", "Full1"].forEach(function(nom) {
    var full = ss.getSheetByName(nom);
    if (full && ss.getSheets().length > 1 && full.getLastRow() === 0) ss.deleteSheet(full);
  });
}
