const assert = require('assert');
const { crearEntorn } = require('./mock');

let passats = 0;
function prova(nom, fn) {
  try { fn(); passats++; console.log('✓', nom); }
  catch (e) { console.log('✗', nom, '\n   ', e.message); process.exitCode = 1; }
}

// ---------- Seguretat ----------
prova('usuari no autoritzat rebutjat', () => {
  const e = crearEntorn({ usuari: 'intrus@gmail.com' });
  const r = e.raw('listarModuls');
  assert.strictEqual(r.error, true);
  assert.match(r.message, /No tens permís/);
});
prova('usuari autoritzat via PROFESSORS_AUTORITZATS', () => {
  const e = crearEntorn({ usuari: 'prof@x.cat' });
  e.ctx.PROFESSORS_AUTORITZATS.push('Prof@x.cat');
  assert.strictEqual(e.raw('listarModuls').error, false);
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
  assert.deepStrictEqual(fitxa.map(s => s.notaFinal), [9, 6]);
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

console.log(`\n${passats} proves superades`);
