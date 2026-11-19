const assert = require('assert');
const { crearEntorn } = require('./mock');

let passats = 0;
function prova(nom, fn) {
  try { fn(); passats++; console.log('✓', nom); }
  catch (e) { console.log('✗', nom, '\n   ', e.message); process.exitCode = 1; }
}

// ---------- API (doPost) ----------
prova('doPost: retorna JSON i errors controlats', () => {
  const e = crearEntorn({ usuari: '' });
  const ok = JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'listarModuls', params: {} }) } }).text);
  assert.strictEqual(ok.error, false);
  const malament = JSON.parse(e.ctx.doPost({ postData: { contents: 'no és json' } }).text);
  assert.strictEqual(malament.error, true);
  assert.match(e.raw('constructor').message, /desconeguda/);
});
prova('acció desconeguda', () => {
  const e = crearEntorn();
  assert.match(e.raw('esborrarTot').message, /desconeguda/);
});

// ---------- Migració d'un full antic ----------
prova('migració de full antic (capçaleres i nota E1)', () => {
  const e = crearEntorn();
  const conf = e.ss.insertSheet('🔧 Configuració');
  conf.data = [['Mòdul', 'Criteri', 'Pes (%)', '', 'Afegeix una fila per cada criteri...'],
    ['Aigua', 'A', 60], ['Aigua', 'B', 40]];
  const alum = e.ss.insertSheet('👥 Alumnat');
  alum.data = [['Data', 'Curs', 'Mòdul', 'Classe', 'Desdobl.', 'Nom', 'Cognoms', 'Sessió avaluada', 'Observacions grup', 'Observacions individual', 'Nota final'],
    [new Date(2026, 9, 1), '26/27', 'Aigua', '1A', 'General', 'Pau', 'Puig', 'S1', '', '', 7]];
  const crit = e.call('obtenirCriteris', { modul: 'Aigua', suposit: 'S1' });
  assert.deepStrictEqual(crit.map(c => c.nom), ['A', 'B']);
  assert.strictEqual(conf.data[0][4], 'Tipus');
  const res = e.call('obtenirResultatsSessio', { curs: '26/27', modul: 'Aigua', classe: '1A', desdoblament: 'General', sessioAvaluada: 'S1' });
  assert.strictEqual(res.alumnes[0].notaFinal, 7);
  assert.strictEqual(alum.data[0][14], 'Correu enviat');
});

// ---------- Configuració ----------
function entornAmbConfig() {
  const e = crearEntorn();
  e.call('desarCriteris', { modul: 'Aigua', suposit: '', criteris: [
    { nom: 'Objectiu', pes: 20, tipus: 'sino' },
    { nom: 'Presentació', pes: 30, tipus: 'numeric', imprescindible: true },
    { nom: 'Coordinació', pes: 50, tipus: 'rubrica', nivells: [{ nom: 'Insuf', valor: 2 }, { nom: 'Bé', valor: 7.5 }, { nom: 'Exc', valor: 10 }] }
  ] });
  e.call('desarSuposit', { modul: 'Aigua', nomOriginal: '', suposit: { nom: 'S1', data: '2026-10-01', descripcio: 'Enunciat 1' } });
  e.call('desarSuposit', { modul: 'Aigua', nomOriginal: '', suposit: { nom: 'S2', data: '2026-10-08', criteris: [{ nom: 'Seguretat', pes: 100, tipus: 'numeric' }] } });
  e.call('listarClasses');
  const llistat = e.ss.getSheetByName('👤 Llistat');
  llistat.data = [llistat.data[0],
    ['Pau', 'Puig', 'pau@x.cat', '26/27', '1A', 'General', 'pau@x.cat'],
    ['Anna', 'Ros', 'anna@x.cat', '26/27', '1A', 'D1', ''],
    ['Pau', 'Puig', 'pau2@x.cat', '26/27', '1A', 'D1', 'pau2@x.cat'],
    ['Joan', 'Mas', '', '26/27', '1A', 'D1', '']];
  return e;
}

prova('desar i llegir criteris amb tipus', () => {
  const e = entornAmbConfig();
  const c = e.call('obtenirCriteris', { modul: 'Aigua', suposit: 'S1' });
  assert.strictEqual(c.length, 3);
  assert.strictEqual(c[2].tipus, 'rubrica');
  assert.strictEqual(c[2].nivells[1].valor, 7.5);
  assert.strictEqual(c[1].imprescindible, true);
});
prova('supòsit amb ítems propis', () => {
  const e = entornAmbConfig();
  assert.deepStrictEqual(e.call('obtenirCriteris', { modul: 'Aigua', suposit: 'S2' }).map(c => c.nom), ['Seguretat']);
});
prova('validació: pesos != 100', () => {
  const e = entornAmbConfig();
  assert.throws(() => e.call('desarCriteris', { modul: 'Aigua', suposit: '', criteris: [{ nom: 'X', pes: 90 }] }), /sumen 90/);
});
prova('validació: noms duplicats i rúbrica curta', () => {
  const e = entornAmbConfig();
  assert.throws(() => e.call('desarCriteris', { modul: 'M', suposit: '', criteris: [{ nom: 'X', pes: 50 }, { nom: 'x', pes: 50 }] }), /dos ítems/);
  assert.throws(() => e.call('desarCriteris', { modul: 'M', suposit: '', criteris: [{ nom: 'X', pes: 100, tipus: 'rubrica', nivells: 'A=1' }] }), /2 nivells/);
});
prova('llistar supòsits, arxivar, reanomenar, duplicar, eliminar', () => {
  const e = entornAmbConfig();
  assert.deepStrictEqual(e.call('listarSuposits', { modul: 'Aigua' }).map(s => s.nom), ['S1', 'S2']);
  e.call('desarSuposit', { modul: 'Aigua', nomOriginal: 'S1', suposit: { nom: 'S1', actiu: false } });
  assert.deepStrictEqual(e.call('listarSuposits', { modul: 'Aigua' }).map(s => s.nom), ['S2']);
  e.call('desarSuposit', { modul: 'Aigua', nomOriginal: 'S2', suposit: { nom: 'S2b', data: '2026-10-08' } });
  assert.deepStrictEqual(e.call('obtenirCriteris', { modul: 'Aigua', suposit: 'S2b' }).map(c => c.nom), ['Seguretat']);
  e.call('duplicarSuposit', { modul: 'Aigua', nom: 'S2b', nouNom: 'S3' });
  assert.deepStrictEqual(e.call('obtenirCriteris', { modul: 'Aigua', suposit: 'S3' }).map(c => c.nom), ['Seguretat']);
  assert.throws(() => e.call('desarSuposit', { modul: 'Aigua', nomOriginal: 'S3', suposit: { nom: 'S2b' } }), /Ja existeix/);
  e.call('eliminarSuposit', { modul: 'Aigua', nom: 'S3' });
  assert.strictEqual(e.call('obtenirCriteris', { modul: 'Aigua', suposit: 'S3' }).length, 3);
});
prova('configuració agrupada i plantilla', () => {
  const e = entornAmbConfig();
  const conf = e.call('obtenirConfiguracio');
  assert.strictEqual(conf[0].nom, 'Aigua');
  assert.strictEqual(conf[0].criteris.length, 3);
  assert.strictEqual(conf[0].suposits.find(s => s.nom === 'S2').criterisPropis, true);
  const plantilla = { nom: 'Aigua', criteris: conf[0].criteris, suposits: conf[0].suposits };
  e.call('importarPlantilla', { plantilla, nomModul: 'Aigua 2' });
  assert.deepStrictEqual(e.call('listarModuls').filter(m => m !== 'Individuals Aigua'), ['Aigua', 'Aigua 2']);
  assert.deepStrictEqual(e.call('obtenirCriteris', { modul: 'Aigua 2', suposit: 'S2' }).map(c => c.nom), ['Seguretat']);
  e.call('renomenarModul', { antic: 'Aigua 2', nou: 'Terra' });
  assert.deepStrictEqual(e.call('listarModuls').filter(m => m !== 'Individuals Aigua'), ['Aigua', 'Terra']);
  e.call('eliminarModul', { modul: 'Terra' });
  assert.deepStrictEqual(e.call('listarModuls').filter(m => m !== 'Individuals Aigua'), ['Aigua']);
});

// ---------- Alumnes i exportació ----------
prova('alumnes amb ID; mateix nom diferenciat', () => {
  const e = entornAmbConfig();
  const al = e.call('obtenirAlumnes', { classe: '1A', desdoblament: 'General' });
  assert.strictEqual(al.length, 4);
  assert.strictEqual(al.filter(a => a.nom === 'Pau').length, 2);
});

function dadesExport(evaluacions, sessio = 'S1') {
  return { dades: { curs: '26/27', modul: 'Aigua', classe: '1A', desdoblament: 'General', sessioAvaluada: sessio, evaluacions } };
}
const sessioS1 = { curs: '26/27', modul: 'Aigua', classe: '1A', desdoblament: 'General', sessioAvaluada: 'S1' };

prova('exportar: càlcul, 0 vàlid, límit 0-10, imprescindible, grups', () => {
  const e = entornAmbConfig();
  const r = e.call('exportarAGoogleSheets', dadesExport([
    { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', grup: 1, notes: { Objectiu: 10, Presentació: 8, Coordinació: 7.5 } },
    { nom: 'Pau', cognoms: 'Puig', id: 'pau2@x.cat', grup: 1, notes: { Objectiu: 0, Presentació: 15, Coordinació: 10 } },
    { nom: 'Anna', cognoms: 'Ros', id: 'anna@x.cat', notes: { Objectiu: 10, Presentació: 2, Coordinació: 10 } },
    { nom: 'Joan', cognoms: 'Mas', id: '', notes: {} }
  ]));
  assert.strictEqual(r.exportats, 3);
  assert.deepStrictEqual(r.limitades, ['Anna Ros']);
  const res = e.call('obtenirResultatsSessio', sessioS1);
  const pau1 = res.alumnes.find(a => a.id === 'pau@x.cat');
  const pau2 = res.alumnes.find(a => a.id === 'pau2@x.cat');
  const anna = res.alumnes.find(a => a.nom === 'Anna');
  assert.strictEqual(pau1.notaFinal, 8.15); // 2 + 2.4 + 3.75
  assert.strictEqual(pau2.notaFinal, 8);    // 0 + 3 (15->10) + 5
  assert.strictEqual(pau2.notes.Objectiu, 0);
  assert.strictEqual(pau2.notes['Presentació'], 10);
  assert.strictEqual(anna.notaFinal, 4);
  assert.match(anna.origen, /limitada/);
  assert.strictEqual(pau1.grup, '1');
  assert.deepStrictEqual(res.criteris.map(c => c.pes), [20, 30, 50]);
  const detall = e.call('obtenirDetallAlumne', Object.assign({}, sessioS1, { alumne: { nom: 'Pau', cognoms: 'Puig', id: 'pau2@x.cat' } }));
  assert.strictEqual(detall.Objectiu, 0);
});

prova('reexportar: confirmació i desglossament només de l\'última exportació', () => {
  const e = entornAmbConfig();
  const anna = { nom: 'Anna', cognoms: 'Ros', id: 'anna@x.cat' };
  e.call('exportarAGoogleSheets', dadesExport([Object.assign({ notes: { Objectiu: 10, Presentació: 6, Coordinació: 10 } }, anna)]));
  e.ss.getSheetByName('🗄 Historial').data.slice(1).forEach(f => { f[0] = new Date(f[0].getTime() - 60000); });
  const r = e.call('exportarAGoogleSheets', dadesExport([Object.assign({ notes: { Objectiu: 0 } }, anna)]));
  assert.strictEqual(r.necessitaConfirmacio, true);
  e.call('exportarAGoogleSheets', Object.assign(dadesExport([Object.assign({ notes: { Objectiu: 0 } }, anna)]), { confirmat: true }));
  const res = e.call('obtenirResultatsSessio', sessioS1);
  assert.strictEqual(res.alumnes.length, 1);
  assert.deepStrictEqual(res.alumnes[0].notes, { Objectiu: 0 });
  assert.strictEqual(res.alumnes[0].notaFinal, '');
});

prova('exportar afegeix alumnes nous al Llistat en bloc', () => {
  const e = entornAmbConfig();
  e.call('exportarAGoogleSheets', dadesExport([{ nom: 'Nou', cognoms: 'Alumne', id: '', notes: { Objectiu: 10 } }]));
  assert.ok(e.call('obtenirAlumnes', { classe: '1A', desdoblament: 'General' }).some(a => a.nom === 'Nou'));
});

prova('resultats: actualitzar (Manual), esborrar alumne i sessió, sessions, fitxa', () => {
  const e = entornAmbConfig();
  e.call('exportarAGoogleSheets', dadesExport([
    { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Objectiu: 10, Presentació: 10, Coordinació: 10 } },
    { nom: 'Pau', cognoms: 'Puig', id: 'pau2@x.cat', notes: { Objectiu: 10, Presentació: 5, Coordinació: 2 } }
  ]));
  e.call('exportarAGoogleSheets', dadesExport([{ nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Seguretat: 6 } }], 'S2'));
  const p1 = { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat' };
  assert.strictEqual(e.call('actualitzarResultat', Object.assign({}, sessioS1, { alumne: p1, notaFinal: '9', observacioGrup: '', observacioIndividual: 'ok' })).origen, 'Manual');
  assert.strictEqual(e.call('actualitzarResultat', Object.assign({}, sessioS1, { alumne: p1, notaFinal: '9', observacioGrup: '', observacioIndividual: 'ok2' })).origen, 'Manual');
  assert.throws(() => e.call('actualitzarResultat', Object.assign({}, sessioS1, { alumne: p1, notaFinal: '11' })), /entre 0 i 10/);
  const sessions = e.call('llistarSessions', { classe: '1A', modul: '' });
  assert.strictEqual(sessions.length, 2);
  const fitxa = e.call('obtenirFitxaAlumne', { classe: '1A', alumne: p1 });
  assert.deepStrictEqual(fitxa.map(s => s.notaFinal).sort(), [6, 9]);
  e.call('eliminarResultat', Object.assign({}, sessioS1, { alumne: p1 }));
  const res = e.call('obtenirResultatsSessio', sessioS1);
  assert.deepStrictEqual(res.alumnes.map(a => a.id), ['pau2@x.cat']);
  e.call('eliminarSessio', sessioS1);
  assert.strictEqual(e.call('llistarSessions', { classe: '1A', modul: '' }).length, 1);
});

prova('correus: HTML, escapament, seleccionats, sense correu, marca d\'enviat, quota', () => {
  const e = entornAmbConfig();
  e.call('exportarAGoogleSheets', dadesExport([
    { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Objectiu: 10, Presentació: 10, Coordinació: 10 }, observacioIndividual: '<script>x</script>' },
    { nom: 'Joan', cognoms: 'Mas', id: '', notes: { Objectiu: 0 } },
    { nom: 'Anna', cognoms: 'Ros', id: 'anna@x.cat', notes: { Objectiu: 0 } }
  ]));
  const r = e.call('enviarCorreus', Object.assign({}, sessioS1, {
    assumpte: 'Nota {{sessio}}', cos: 'Hola {{nom}}\n{{desglossament}}\n{{observacions_individual}}',
    destinataris: [{ nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat' }, { nom: 'Joan', cognoms: 'Mas', id: '' }]
  }));
  assert.strictEqual(r.enviats, 1);
  assert.deepStrictEqual(r.senseCorreu, ['Joan Mas']);
  const m = e.enviats[0];
  assert.strictEqual(m.to, 'pau@x.cat');
  assert.strictEqual(m.subject, 'Nota S1');
  assert.ok(m.htmlBody.includes('&lt;script&gt;'));
  assert.ok(m.htmlBody.includes('<table'));
  assert.ok(m.body.includes('- Objectiu (20%): 10'));
  const res = e.call('obtenirResultatsSessio', sessioS1);
  assert.ok(res.alumnes.find(a => a.nom === 'Pau').correuEnviat);
  assert.ok(!res.alumnes.find(a => a.nom === 'Anna').correuEnviat);

  const e2 = crearEntorn({ quota: 0 });
  Object.assign(e2.ss, e.ss); // mateix full
  assert.throws(() => e2.call('enviarCorreus', Object.assign({}, sessioS1, { assumpte: 'a', cos: 'b', destinataris: [] })), /Només et queden 0/);
});

prova('informe PDF', () => {
  const e = entornAmbConfig();
  e.call('exportarAGoogleSheets', dadesExport([{ nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Objectiu: 10 } }]));
  const r = e.call('crearInformePdf', sessioS1);
  assert.match(r.nom, /Informe - S1/);
  assert.ok(e.fitxers[0].html.includes('Objectiu'));
});

prova('importar Classroom amb ID i sense duplicar', () => {
  const e = crearEntorn({ alumnesClassroom: [
    { userId: 'u1', profile: { name: { givenName: 'Pau', familyName: 'Puig' }, emailAddress: 'pau@x.cat' } },
    { userId: 'u2', profile: { name: { givenName: 'Pau', familyName: 'Puig' }, emailAddress: 'pau2@x.cat' } }
  ] });
  let r = e.call('importarAlumnesClassroom', { courseId: 'c1', curs: '26/27', classe: '2B', desdoblament: 'General' });
  assert.deepStrictEqual([r.importats, r.actualitzats], [2, 0]);
  r = e.call('importarAlumnesClassroom', { courseId: 'c1', curs: '26/27', classe: '2B', desdoblament: 'General' });
  assert.deepStrictEqual([r.importats, r.actualitzats], [0, 2]);
  const al = e.call('obtenirAlumnes', { classe: '2B', desdoblament: 'General' });
  assert.deepStrictEqual(al.map(a => a.id).sort(), ['pau2@x.cat', 'pau@x.cat']);
});

prova('desdoblaments: assignar, filtrar i no trepitjar-los en reimportar', () => {
  const e = crearEntorn({ alumnesClassroom: [
    { userId: 'u1', profile: { name: { givenName: 'Pau', familyName: 'Puig' }, emailAddress: 'pau@x.cat' } },
    { userId: 'u2', profile: { name: { givenName: 'Anna', familyName: 'Ros' }, emailAddress: 'anna@x.cat' } },
    { userId: 'u3', profile: { name: { givenName: 'Joan', familyName: 'Mas' }, emailAddress: 'joan@x.cat' } }
  ] });
  e.call('importarAlumnesClassroom', { courseId: 'c1', curs: '26/27', classe: '1B', desdoblament: 'General' });
  let al = e.call('obtenirAlumnes', { classe: '1B', desdoblament: 'General' });
  assert.deepStrictEqual(al.map(a => a.desdoblament), ['General', 'General', 'General']);
  const r = e.call('desarDesdoblaments', { classe: '1B', assignacions: [
    { alumne: al.find(a => a.nom === 'Pau'), desdoblament: 'Desdoblament 1' },
    { alumne: al.find(a => a.nom === 'Anna'), desdoblament: 'Desdoblament 2' },
    { alumne: al.find(a => a.nom === 'Joan'), desdoblament: '' },
    { alumne: { nom: 'No', cognoms: 'Existeix', id: '' }, desdoblament: 'Desdoblament 1' }
  ] });
  assert.strictEqual(r.actualitzats, 2);
  assert.deepStrictEqual(r.noTrobats, ['No Existeix']);
  assert.deepStrictEqual(e.call('listarDesdoblaments', { classe: '1B' }), ['General', 'Desdoblament 1', 'Desdoblament 2']);
  assert.deepStrictEqual(e.call('obtenirAlumnes', { classe: '1B', desdoblament: 'Desdoblament 1' }).map(a => a.nom), ['Pau']);
  assert.strictEqual(e.call('obtenirAlumnes', { classe: '1B', desdoblament: 'General' }).length, 3);
  // Reimportar no trepitja el desdoblament ja assignat
  e.call('importarAlumnesClassroom', { courseId: 'c1', curs: '26/27', classe: '1B', desdoblament: 'General' });
  assert.deepStrictEqual(e.call('obtenirAlumnes', { classe: '1B', desdoblament: 'Desdoblament 2' }).map(a => a.nom), ['Anna']);
});

// ---------- Lot 1: velocitat ----------
prova('inicialitzar: tot en una sola petició', () => {
  const e = entornAmbConfig();
  const r = e.call('inicialitzar');
  assert.ok(r.moduls.includes('Aigua'));
  assert.deepStrictEqual(r.classes, ['1A']);
  assert.deepStrictEqual(r.desdoblaments['1A'], ['General', 'D1']);
  assert.deepStrictEqual(r.suposits.Aigua.map(x => x.nom), ['S1', 'S2']);
});

prova('memòria cau: la segona lectura no toca el full i una edició a mà es veu al moment', () => {
  const e = entornAmbConfig();
  e.call('inicialitzar'); // la primera vegada pot crear pestanyes que falten
  e.call('inicialitzar');
  const abans = e.estat.lecturesFull;
  e.call('inicialitzar');
  assert.strictEqual(e.estat.lecturesFull, abans, 'la segona vegada surt de la memòria cau');
  // Edició manual del full (com si el professor l'editès al navegador)
  const ll = e.ss.getSheetByName('👤 Llistat');
  ll.data = ll.data.concat([['Nou', 'Alumne', '', '26/27', '2C', 'General', '']]);
  assert.ok(e.call('inicialitzar').classes.includes('2C'), 'el canvi manual es veu');
  // Canvi des de l'app
  e.call('desarSuposit', { modul: 'Aigua', nomOriginal: '', suposit: { nom: 'S3' } });
  assert.deepStrictEqual(e.call('inicialitzar').suposits.Aigua.map(x => x.nom), ['S1', 'S2', 'S3']);
});

prova('resultats: es llegeixen de la columna "Detall ítems" sense tocar l\'Historial', () => {
  const e = entornAmbConfig();
  e.call('exportarAGoogleSheets', dadesExport([{ nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Objectiu: 0, Presentació: 8, Coordinació: 7.5 } }]));
  // Buidem l'Historial: els resultats han de sortir igualment
  const hist = e.ss.getSheetByName('🗄 Historial');
  hist.data = [hist.data[0]];
  const res = e.call('obtenirResultatsSessio', sessioS1);
  assert.deepStrictEqual(res.alumnes[0].notes, { Objectiu: 0, Presentació: 8, Coordinació: 7.5 });
  assert.deepStrictEqual(res.criteris.map(c => c.pes), [20, 30, 50]);
  const det = e.call('obtenirDetallAlumne', Object.assign({}, sessioS1, { alumne: { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat' } }));
  assert.strictEqual(det.Objectiu, 0);
});

prova('resultats antics (sense "Detall ítems") es llegeixen de l\'Historial', () => {
  const e = entornAmbConfig();
  e.call('exportarAGoogleSheets', dadesExport([{ nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Objectiu: 10, Presentació: 6, Coordinació: 5 } }]));
  const alum = e.ss.getSheetByName('👥 Alumnat');
  alum.data = alum.data.map((f, i) => i === 0 ? f : f.slice(0, 15)); // com un full d'abans
  const res = e.call('obtenirResultatsSessio', sessioS1);
  assert.deepStrictEqual(res.alumnes[0].notes, { Objectiu: 10, Presentació: 6, Coordinació: 5 });
});

prova('obtenirResultatsSessio amb ambCriteris inclou els ítems actuals', () => {
  const e = entornAmbConfig();
  e.call('exportarAGoogleSheets', dadesExport([{ nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Objectiu: 10 } }]));
  const r = e.call('obtenirResultatsSessio', Object.assign({ ambCriteris: true }, sessioS1));
  assert.deepStrictEqual(r.criterisActuals.map(c => c.nom), ['Objectiu', 'Presentació', 'Coordinació']);
});

prova('desarItemsResultat: una sola petició, nota manual opcional, la resta no canvia', () => {
  const e = entornAmbConfig();
  e.call('exportarAGoogleSheets', dadesExport([
    { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', grup: 1, notes: { Objectiu: 10, Presentació: 10, Coordinació: 10 }, observacioIndividual: 'ok' },
    { nom: 'Anna', cognoms: 'Ros', id: 'anna@x.cat', notes: { Objectiu: 10, Presentació: 5, Coordinació: 5 } }]));
  const p1 = { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat' };
  let r = e.call('desarItemsResultat', Object.assign({}, sessioS1, { alumne: p1, grup: '1',
    notes: { Objectiu: 0, Presentació: 10, Coordinació: 10 }, observacioGrup: '', observacioIndividual: 'ok2', notaManual: '' }));
  let pau = r.alumnes.find(a => a.nom === 'Pau');
  assert.strictEqual(pau.notaFinal, 8);
  assert.strictEqual(pau.origen, 'Calculada');
  assert.strictEqual(pau.observacioIndividual, 'ok2');
  assert.strictEqual(r.alumnes.find(a => a.nom === 'Anna').notaFinal, 6);
  r = e.call('desarItemsResultat', Object.assign({}, sessioS1, { alumne: p1, grup: '1',
    notes: { Objectiu: 0, Presentació: 10, Coordinació: 10 }, observacioGrup: '', observacioIndividual: 'ok2', notaManual: '9' }));
  pau = r.alumnes.find(a => a.nom === 'Pau');
  assert.strictEqual(pau.notaFinal, 9);
  assert.strictEqual(pau.origen, 'Manual');
});

prova('enviarCorreus retorna la sessió actualitzada amb la marca d\'enviat', () => {
  const e = entornAmbConfig();
  e.call('exportarAGoogleSheets', dadesExport([
    { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Objectiu: 10 } },
    { nom: 'Anna', cognoms: 'Ros', id: 'anna@x.cat', notes: { Objectiu: 10 } }]));
  const r = e.call('enviarCorreus', Object.assign({}, sessioS1, { assumpte: 'a', cos: 'b', destinataris: [{ nom: 'Anna', cognoms: 'Ros', id: 'anna@x.cat' }] }));
  assert.strictEqual(r.enviats, 1);
  assert.ok(r.resultats.alumnes.find(a => a.nom === 'Anna').correuEnviat);
  assert.ok(!r.resultats.alumnes.find(a => a.nom === 'Pau').correuEnviat);
});

// ---------- Lot 2: comentaris ràpids ----------
prova('comentaris ràpids: per defecte, desar, sense duplicats, per mòdul', () => {
  const e = entornAmbConfig();
  const r = e.call('inicialitzar');
  assert.ok(r.comentaris.length >= 3 && r.comentaris.every(c => c.text && c.modul === ''));
  e.call('desarComentaris', { comentaris: [{ text: 'Molt bé', modul: '' }, { text: 'molt bé', modul: '' }, { text: 'Bon salt', modul: 'Aigua' }, { text: '  ', modul: '' }] });
  assert.deepStrictEqual(e.call('inicialitzar').comentaris, [{ text: 'Molt bé', modul: '' }, { text: 'Bon salt', modul: 'Aigua' }]);
});

// ---------- Lot 4: quadern i informe per alumne ----------
prova('quadern: alumnes × sessions en ordre cronològic, buits i filtre per mòdul', () => {
  const e = entornAmbConfig();
  e.call('exportarAGoogleSheets', dadesExport([
    { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Objectiu: 10, Presentació: 10, Coordinació: 10 } },
    { nom: 'Anna', cognoms: 'Ros', id: 'anna@x.cat', notes: { Objectiu: 0, Presentació: 5, Coordinació: 5 } }], 'S1'));
  e.ss.getSheetByName('👥 Alumnat').data.slice(1).forEach(f => { f[0] = new Date(2026, 9, 1); });
  e.call('exportarAGoogleSheets', dadesExport([{ nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Seguretat: 6 } }], 'S2'));
  e.call('exportarAGoogleSheets', { dades: { curs: '26/27', modul: 'Terra', classe: '1A', desdoblament: 'General', sessioAvaluada: 'T1',
    evaluacions: [{ nom: 'Anna', cognoms: 'Ros', id: 'anna@x.cat', notes: { Nota: 7 } }] } });
  const q = e.call('obtenirQuadern', { classe: '1A', modul: 'Aigua' });
  assert.deepStrictEqual(q.sessions.map(s => s.sessioAvaluada), ['S1', 'S2']);
  assert.strictEqual(q.alumnes.length, 4, 'tots els alumnes de la classe, també els no avaluats');
  const pau = q.alumnes.find(a => a.id === 'pau@x.cat');
  assert.deepStrictEqual(pau.notes, [10, 6]);
  assert.deepStrictEqual(q.alumnes.find(a => a.nom === 'Anna').notes, [4, '']);
  assert.deepStrictEqual(q.alumnes.find(a => a.nom === 'Joan').notes, ['', '']);
  const tot = e.call('obtenirQuadern', { classe: '1A', modul: '' });
  assert.deepStrictEqual(tot.sessions.map(s => s.modul + '/' + s.sessioAvaluada), ['Aigua/S1', 'Aigua/S2', 'Terra/T1']);
});

prova('informe per alumne en PDF: sessions, ítems, observacions i mitjanes', () => {
  const e = entornAmbConfig();
  e.call('exportarAGoogleSheets', dadesExport([{ nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Objectiu: 10, Presentació: 8, Coordinació: 7.5 }, observacioIndividual: 'Molt <b>bé</b>' }], 'S1'));
  e.call('exportarAGoogleSheets', dadesExport([{ nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Seguretat: 6 } }], 'S2'));
  const r = e.call('crearInformeAlumne', { classe: '1A', alumne: { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat' }, modul: '' });
  assert.match(r.nom, /Informe - Puig, Pau - 1A/);
  const html = e.fitxers[0].html;
  assert.ok(html.includes('Presentació: <b>8</b>'));
  assert.ok(html.includes('Molt &lt;b&gt;bé&lt;/b&gt;'), 'observacions escapades');
  assert.ok(html.includes('Mitjana global: 7,08'), html.match(/Mitjana global[^<]*/));
  assert.throws(() => e.call('crearInformeAlumne', { classe: '1A', alumne: { nom: 'Joan', cognoms: 'Mas', id: '' }, modul: '' }), /cap sessió/);
});

// ---------- Lot 5: autoavaluació i coavaluació ----------
function entornAval() {
  const e = entornAmbConfig();
  e.call('exportarAGoogleSheets', dadesExport([
    { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', grup: 1, notes: { Objectiu: 10, Presentació: 6, Coordinació: 5 } },   // 6.3
    { nom: 'Anna', cognoms: 'Ros', id: 'anna@x.cat', grup: 1, notes: { Objectiu: 10, Presentació: 10, Coordinació: 10 } }, // 10
    { nom: 'Joan', cognoms: 'Mas', id: '', grup: 2, notes: { Objectiu: 0, Presentació: 5, Coordinació: 5 } }]));          // 4
  return e;
}
const obrirAval = (e, extra) => e.call('obrirAvaluacioAlumnes', Object.assign({}, sessioS1,
  { auto: true, co: true, pesAuto: 10, pesCo: 20, enviarCorreus: true, urlAlumne: 'https://x.github.io/app/alumne.html' }, extra || {}));
const codiDe = (e, nom) => e.ss.getSheetByName('👤 Llistat').data.find(f => f[0] === nom)[7];

prova('obrir: codis personals, correus amb enllaç i codi, validacions', () => {
  const e = entornAval();
  assert.throws(() => obrirAval(e, { pesAuto: 60, pesCo: 40 }), /menys del 100%/);
  assert.throws(() => obrirAval(e, { auto: false, co: false }), /Activa/);
  const r = obrirAval(e);
  assert.match(r.enllac, /^https:\/\/x\.github\.io\/app\/alumne\.html\?s=[0-9a-f]{20}$/);
  assert.strictEqual(r.enviats, 2);
  assert.deepStrictEqual(r.senseCorreu, ['Joan Mas']);
  const codiPau = codiDe(e, 'Pau');
  assert.match(codiPau, /^[A-HJ-NP-Z2-9]{6}$/);
  const correu = e.enviats.find(m => m.to === 'pau@x.cat');
  assert.ok(correu.body.includes(codiPau) && correu.body.includes(r.enllac));
  // Tornar a obrir manté el mateix token i el mateix codi
  const r2 = obrirAval(e, { enviarCorreus: false });
  assert.strictEqual(r2.token, r.token);
  assert.strictEqual(codiDe(e, 'Pau'), codiPau);
  // Coavaluació sense grups
  const e2 = entornAmbConfig();
  e2.call('exportarAGoogleSheets', dadesExport([{ nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', notes: { Objectiu: 10 } }]));
  assert.throws(() => obrirAval(e2, { auto: false }), /no té grups/);
});

prova('alumne: codi incorrecte, entrar, companys del grup i ítems', () => {
  const e = entornAval();
  const { token } = obrirAval(e);
  assert.throws(() => e.call('alumneEntrar', { token: 'xxxx', codi: 'AAAAAA' }), /enllaç no és vàlid/);
  assert.throws(() => e.call('alumneEntrar', { token, codi: 'ZZZZZZ' }), /codi no és correcte/);
  const r = e.call('alumneEntrar', { token, codi: codiDe(e, 'Pau').toLowerCase() });
  assert.strictEqual(r.alumne.nom, 'Pau');
  assert.deepStrictEqual(r.companys.map(c => c.nom), ['Anna'], 'només els del seu grup, sense ell mateix');
  assert.deepStrictEqual(r.criteris.map(c => c.nom), ['Objectiu', 'Presentació', 'Coordinació']);
  assert.strictEqual(r.meva, null);
});

prova('alumne: enviar, nota final combinada amb pesos i redistribució', () => {
  const e = entornAval();
  const { token } = obrirAval(e); // professor 70%, auto 10%, co 20%
  const codiPau = codiDe(e, 'Pau'), codiAnna = codiDe(e, 'Anna');
  // Pau s'autoavalua (10) i avalua Anna (8)
  e.call('alumneEnviar', { token, codi: codiPau,
    auto: { notes: { Objectiu: 10, Presentació: 10, Coordinació: 10 } },
    co: [{ alumne: { nom: 'Anna', cognoms: 'Ros', id: 'anna@x.cat' }, notes: { Objectiu: 10, Presentació: 10, Coordinació: 6 } }] });
  let res = e.call('obtenirResultatsSessio', sessioS1).alumnes;
  let pau = res.find(a => a.nom === 'Pau'), anna = res.find(a => a.nom === 'Anna');
  assert.strictEqual(pau.notaProfessor, 6.3);
  assert.strictEqual(pau.notaAuto, 10);
  assert.strictEqual(pau.notaCo, '');
  // Pau: sense co → pesos 70 i 10 → (6.3*70 + 10*10)/80 = 6.76
  assert.strictEqual(pau.notaFinal, 6.76);
  // Anna: sense auto → (10*70 + 8*20)/90 = 9.56
  assert.strictEqual(anna.notaCo, 8);
  assert.strictEqual(anna.notaFinal, 9.56);
  // Anna avalua Pau (4) i es torna a enviar (substitueix, no duplica)
  e.call('alumneEnviar', { token, codi: codiAnna, co: [{ alumne: { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat' }, notes: { Objectiu: 0, Presentació: 5, Coordinació: 5 } }] });
  e.call('alumneEnviar', { token, codi: codiAnna, co: [{ alumne: { nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat' }, notes: { Objectiu: 10, Presentació: 5, Coordinació: 5 } }] });
  pau = e.call('obtenirResultatsSessio', sessioS1).alumnes.find(a => a.nom === 'Pau');
  assert.strictEqual(pau.notaCo, 6);
  assert.strictEqual(pau.notaFinal, 6.61); // 6.3*0.7 + 10*0.1 + 6*0.2
  // Un alumne no pot avaluar algú d'un altre grup
  e.call('alumneEnviar', { token, codi: codiPau, co: [{ alumne: { nom: 'Joan', cognoms: 'Mas', id: '' }, notes: { Objectiu: 10 } }],
    auto: { notes: { Objectiu: 10, Presentació: 10, Coordinació: 10 } } });
  assert.strictEqual(e.call('obtenirResultatsSessio', sessioS1).alumnes.find(a => a.nom === 'Joan').notaCo, '');
  // Pesos a 0 → només informativa
  obrirAval(e, { pesAuto: 0, pesCo: 0, enviarCorreus: false });
  pau = e.call('obtenirResultatsSessio', sessioS1).alumnes.find(a => a.nom === 'Pau');
  assert.strictEqual(pau.notaFinal, 6.3);
  assert.strictEqual(pau.notaAuto, 10, 'la nota d\'autoavaluació es veu igualment');
  // Reexportar la sessió manté la combinació
  obrirAval(e, { enviarCorreus: false });
  e.call('exportarAGoogleSheets', Object.assign(dadesExport([{ nom: 'Pau', cognoms: 'Puig', id: 'pau@x.cat', grup: 1, notes: { Objectiu: 10, Presentació: 6, Coordinació: 5 } }]), { confirmat: true }));
  assert.strictEqual(e.call('obtenirResultatsSessio', sessioS1).alumnes.find(a => a.nom === 'Pau').notaFinal, 6.61);
  // Estat per al professor
  const estat = e.call('estatAvaluacioAlumnes', sessioS1);
  const ePau = estat.alumnes.find(a => a.nom === 'Pau');
  assert.deepStrictEqual([ePau.auto, ePau.coFetes, ePau.coRebudes], [true, 1, 1]);
  // Tancar: ja no es pot enviar
  e.call('tancarAvaluacioAlumnes', sessioS1);
  assert.throws(() => e.call('alumneEnviar', { token, codi: codiPau, auto: { notes: { Objectiu: 1 } } }), /tancada/);
  assert.strictEqual(e.call('alumneEntrar', { token, codi: codiPau }).obert, false);
});

prova('alumne: massa intents fallits bloquegen temporalment', () => {
  const e = entornAval();
  const { token } = obrirAval(e, { enviarCorreus: false });
  for (let i = 0; i < 30; i++) { try { e.call('alumneEntrar', { token, codi: 'ZZZZZ' + i }); } catch (err) { /* esperat */ } }
  assert.throws(() => e.call('alumneEntrar', { token, codi: codiDe(e, 'Pau') }), /Massa intents/);
});

console.log(`\n${passats} proves superades`);
