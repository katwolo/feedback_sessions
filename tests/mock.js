// Simulació mínima dels serveis de Apps Script per executar code.gs a Node
const fs = require('fs');
const vm = require('vm');

function colToIdx(letters) { let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }

function crearEntorn(opts = {}) {
  const enviats = [];
  // Marca de modificació del full (simula DriveApp.getLastUpdated): puja amb qualsevol escriptura
  const estat = { versio: 1, lecturesFull: 0 };
  const cacheMap = new Map();
  const fitxers = [];
  let usuari = opts.usuari !== undefined ? opts.usuari : 'owner@x.cat';

  class Range {
    constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
    getValues() {
      estat.lecturesFull++;
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const fila = [];
        for (let j = 0; j < this.nc; j++) {
          const row = this.sheet.data[this.r - 1 + i];
          const v = row ? row[this.c - 1 + j] : undefined;
          fila.push(v === undefined || v === null ? '' : v);
        }
        out.push(fila);
      }
      return out;
    }
    getValue() { return this.getValues()[0][0]; }
    setValues(vals) {
      estat.versio++;
      if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error(`setValues mida incorrecta ${vals.length}x${vals[0].length} vs ${this.nr}x${this.nc}`);
      vals.forEach((fila, i) => fila.forEach((v, j) => {
        const ri = this.r - 1 + i;
        while (this.sheet.data.length <= ri) this.sheet.data.push([]);
        this.sheet.data[ri][this.c - 1 + j] = v;
      }));
      return this;
    }
    setValue(v) { return this.setValues([[v]]); }
    clearContent() {
      estat.versio++;
      for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) {
        const row = this.sheet.data[this.r - 1 + i];
        if (row) row[this.c - 1 + j] = '';
      }
      return this;
    }
    getNumColumns() { return this.nc; }
    createFilter() { this.sheet.filter = { getRange: () => this, remove: () => { this.sheet.filter = null; } }; return this.sheet.filter; }
  }
  ['setFontWeight', 'setBackground', 'setFontColor', 'setFontStyle', 'setNumberFormat'].forEach(m => { Range.prototype[m] = function() { return this; }; });

  class Sheet {
    constructor(name) { this.name = name; this._data = []; this.filter = null; this.rules = []; }
    get data() { return this._data; }
    set data(v) { estat.versio++; this._data = v; }
    getName() { return this.name; }
    getRange(a, b, c, d) {
      if (typeof a === 'string') {
        const m = a.match(/^([A-Z]+)(\d+)$/);
        return new Range(this, Number(m[2]), colToIdx(m[1]), 1, 1);
      }
      return new Range(this, a, b, c || 1, d || 1);
    }
    getLastRow() {
      for (let i = this.data.length - 1; i >= 0; i--) if ((this.data[i] || []).some(v => v !== '' && v !== undefined && v !== null)) return i + 1;
      return 0;
    }
    getLastColumn() { let m = 0; this.data.forEach(r => r.forEach((v, j) => { if (v !== '' && v !== undefined) m = Math.max(m, j + 1); })); return m; }
    getMaxRows() { return 1000; }
    getFilter() { return this.filter; }
    setColumnWidth() {} setColumnWidths() {} setFrozenRows() {}
    getConditionalFormatRules() { return this.rules; }
    setConditionalFormatRules(r) { this.rules = r; }
  }

  const sheets = [];
  const ss = {
    getSheetByName: n => sheets.find(s => s.name === n) || null,
    insertSheet: (n, idx) => { const s = new Sheet(n); sheets.splice(idx === undefined ? sheets.length : idx, 0, s); return s; },
    getSheets: () => sheets.slice(),
    deleteSheet: s => sheets.splice(sheets.indexOf(s), 1),
    getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST',
    getName: () => 'Test'
  };

  const builder = () => { const b = {}; ['setGradientMaxpoint', 'setGradientMidpointWithValue', 'setGradientMinpoint', 'setRanges'].forEach(m => { b[m] = () => b; }); b.build = () => ({}); return b; };

  const pad = n => String(n).padStart(2, '0');
  const context = {
    SpreadsheetApp: { openById: () => ss, newConditionalFormatRule: builder, InterpolationType: { NUMBER: 'NUMBER' } },
    Session: {
      getActiveUser: () => ({ getEmail: () => usuari }),
      getEffectiveUser: () => ({ getEmail: () => 'owner@x.cat' }),
      getScriptTimeZone: () => 'Europe/Madrid'
    },
    Utilities: {
      formatDate: (d, tz, p) => p.replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate()))
        .replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())),
      getUuid: () => require('crypto').randomUUID(),
      newBlob: (html) => ({ getAs: () => ({ setName(n) { this.name = n; this.html = html; return this; } }) })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    MailApp: { getRemainingDailyQuota: () => opts.quota === undefined ? 100 : opts.quota, sendEmail: m => enviats.push(m) },
    CacheService: { getScriptCache: () => ({
      get: k => cacheMap.has(k) ? cacheMap.get(k) : null,
      put: (k, v) => { cacheMap.set(k, v); },
      removeAll: ks => ks.forEach(k => cacheMap.delete(k))
    }) },
    DriveApp: { getFileById: () => ({ getLastUpdated: () => new Date(estat.versio) }), createFile: b => { fitxers.push(b); return { getUrl: () => 'https://drive/' + b.name }; }, getRootFolder: () => ({ getName: () => 'root' }) },
    ContentService: { createTextOutput: t => ({ text: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    HtmlService: { createHtmlOutput: h => ({ setTitle: () => ({ html: h }) }), createHtmlOutputFromFile: () => ({ setTitle() { return this; }, addMetaTag() { return this; } }) },
    Classroom: {
      Courses: {
        list: () => ({ courses: [{ id: 'c1', name: 'Aigua 1A' }] }),
        Students: { list: () => ({ students: opts.alumnesClassroom || [] }) }
      }
    },
    Logger: { log: () => {} },
    console
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require('path').join(__dirname, '..', 'code.gs'), 'utf8'), context);

  return {
    ctx: context, ss, sheets, enviats, fitxers, estat, cacheMap,
    // Cada crida HTTP real comença amb la memòria per petició buida
    novaPeticio: () => { vm.runInContext('_full = null; _memo = {}; _marcaFull = undefined;', context); },
    setUsuari: u => { usuari = u; },
    call: (action, params) => {
      vm.runInContext('_full = null; _memo = {}; _marcaFull = undefined;', context);
      const r = JSON.parse(context.api(action, JSON.parse(JSON.stringify(params || {}))));
      if (r.error) throw new Error(r.message);
      return r.resultat;
    },
    raw: (action, params) => (vm.runInContext('_full = null; _memo = {}; _marcaFull = undefined;', context), JSON.parse(context.api(action, JSON.parse(JSON.stringify(params || {})))))
  };
}

module.exports = { crearEntorn };
