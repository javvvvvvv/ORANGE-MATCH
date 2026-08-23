import { ANEXO_IVA_CELDAS_DEFAULT } from './configEmpresa.js';

export function normTxtAnexo(s) {
  return (' ' + String(s || '')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[°ºª]/g, '')
    .replace(/%/g, ' % ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() + ' ');
}

export function tieneTasaAnexo(txt, n) {
  // Evita falsos positivos (p.ej. "116") y reconoce tanto "16%" como
  // "16 %" y "tasa 16". Para 0% exige que el cero sea un token independiente.
  const t = String(txt || '');
  const esc = String(n).replace('.', '\\.');
  return new RegExp('(?:^|\\s)' + esc + '(?:\\s*%|(?=\\s|$))').test(t);
}

export function filaTextoAnexo(fila) {
  return normTxtAnexo((fila || []).filter(v => typeof v === 'string').join(' '));
}

export function cumpleGrupoAnexo(txt, grupo) {
  if (grupo.tasa !== undefined && grupo.tasa !== null) {
    if (!tieneTasaAnexo(txt, grupo.tasa)) return false;
  }
  for (const req of (grupo.incluye || [])) { if (!txt.includes(req)) return false; }
  for (const ev of (grupo.evita || [])) { if (txt.includes(ev)) return false; }
  return true;
}

export function valorNumericoDeFilaAnexo(fila, colPreferida) {
  // Algunos Excel/CONTPAQi llegan con importes como texto por formato,
  // apóstrofe o fórmulas. Normalizamos ambos casos.
  const numericos = [];
  (fila || []).forEach((v, idx) => {
    let n = null;
    if (typeof v === 'number' && Number.isFinite(v)) n = v;
    else if (typeof v === 'string') {
      const limpio = v.replace(/[$,\\s]/g, '').replace(/\\(([^)]+)\\)/, '-$1');
      if (/^-?\\d+(?:\\.\\d+)?$/.test(limpio)) n = Number(limpio);
    }
    if (n !== null && Number.isFinite(n)) numericos.push({ idx, v: n });
  });
  if (numericos.length === 0) return 0;
  if (colPreferida != null) {
    const enPreferida = numericos.find(n => n.idx === colPreferida && n.v !== 0);
    if (enPreferida) return enPreferida.v;
  }
  const noCero = numericos.filter(n => n.v !== 0);
  if (noCero.length) return noCero[noCero.length - 1].v;
  return numericos[numericos.length - 1].v;
}

export const ANEXO_IVA_ETIQUETAS = {
  ingresos_gravados_16: [{ incluye: ['INGRES', 'GRAVAD'], tasa: 16 }, { incluye: ['BASE', 'GRAVAD'], tasa: 16 }, { incluye: ['ACTOS', 'GRAVAD'], tasa: 16 }, { incluye: ['VENTA', 'GRAVAD'], tasa: 16 }],
  ingresos_gravados_11: [{ incluye: ['INGRES', 'GRAVAD'], tasa: 11 }, { incluye: ['BASE', 'GRAVAD'], tasa: 11 }],
  ingresos_gravados_0: [{ incluye: ['INGRES', 'GRAVAD'], tasa: 0 }, { incluye: ['INGRES', 'TASA', '0'] }],
  ingresos_exentos: [{ incluye: ['INGRES', 'EXENT'] }, { incluye: ['ACTOS', 'EXENT'] }],
  ingresos_gravados_15: [{ incluye: ['INGRES', 'GRAVAD'], tasa: 15 }],
  ingresos_gravados_10: [{ incluye: ['INGRES', 'GRAVAD'], tasa: 10 }],
  otras_bases_ingresos: [{ incluye: ['OTRA', 'BASE'], evita: ['ACREDITA'] }, { incluye: ['OTROS', 'INGRES'] }],

  iva_trasladado_16: [{ incluye: ['IVA', 'TRASLAD'], tasa: 16, evita: ['ACREDITA'] }],
  iva_trasladado_11: [{ incluye: ['IVA', 'TRASLAD'], tasa: 11, evita: ['ACREDITA'] }],
  iva_trasladado_0: [{ incluye: ['IVA', 'TRASLAD'], tasa: 0, evita: ['ACREDITA'] }],
  iva_exento: [{ incluye: ['IVA', 'EXENT'], evita: ['ACREDITA'] }],
  iva_trasladado_15: [{ incluye: ['IVA', 'TRASLAD'], tasa: 15, evita: ['ACREDITA'] }],
  iva_trasladado_10: [{ incluye: ['IVA', 'TRASLAD'], tasa: 10, evita: ['ACREDITA'] }],
  iva_otras_bases: [{ incluye: ['IVA', 'OTRA', 'BASE'], evita: ['ACREDITA'] }],
  iva_retenido: [{ incluye: ['IVA', 'RETEN'], evita: ['ACREDITA', 'ANTERIOR'] }],

  base_acreditable_16: [{ incluye: ['BASE', 'ACREDITA'], tasa: 16 }, { incluye: ['COMPRA', 'ACREDITA'], tasa: 16 }, { incluye: ['GASTO', 'ACREDITA'], tasa: 16 }, { incluye: ['COMPRAS', 'GASTOS'], tasa: 16 }],
  base_acreditable_11: [{ incluye: ['BASE', 'ACREDITA'], tasa: 11 }, { incluye: ['COMPRA', 'ACREDITA'], tasa: 11 }],
  base_acreditable_0: [{ incluye: ['BASE', 'ACREDITA'], tasa: 0 }, { incluye: ['COMPRA', 'ACREDITA'], tasa: 0 }],
  base_acreditable_exenta: [{ incluye: ['BASE', 'ACREDITA', 'EXENT'] }, { incluye: ['COMPRA', 'EXENT'] }],
  base_acreditable_15: [{ incluye: ['BASE', 'ACREDITA'], tasa: 15 }, { incluye: ['COMPRA', 'ACREDITA'], tasa: 15 }],
  base_acreditable_10: [{ incluye: ['BASE', 'ACREDITA'], tasa: 10 }, { incluye: ['COMPRA', 'ACREDITA'], tasa: 10 }],
  base_otras: [{ incluye: ['BASE', 'OTRA'], evita: ['TRASLAD'] }, { incluye: ['COMPRA', 'OTRA'] }],

  iva_acreditable_16: [{ incluye: ['IVA', 'ACREDITA'], tasa: 16, evita: ['BASE', 'RETEN'] }],
  iva_acreditable_11: [{ incluye: ['IVA', 'ACREDITA'], tasa: 11, evita: ['BASE', 'RETEN'] }],
  iva_acreditable_15: [{ incluye: ['IVA', 'ACREDITA'], tasa: 15, evita: ['BASE', 'RETEN'] }],
  iva_acreditable_10: [{ incluye: ['IVA', 'ACREDITA'], tasa: 10, evita: ['BASE', 'RETEN'] }],
  iva_acreditable_otras: [{ incluye: ['IVA', 'ACREDITA', 'OTRA'], evita: ['BASE', 'RETEN'] }],
  iva_retenido_acreditable: [{ incluye: ['IVA', 'RETEN', 'ACREDITA'] }, { incluye: ['RETEN', 'NOSOTROS'] }, { incluye: ['RETEN', 'TERCEROS'] }],
  iva_retenido_anteriores: [{ incluye: ['RETEN', 'ANTERIOR'] }, { incluye: ['RETEN', 'MESES', 'ANTERIOR'] }]
};

export function normSinEspaciosAnexo(s) {
  return normTxtAnexo(s).replace(/\s+/g, '');
}

export function parseAnexoCompacEstandar(anexoWB) {
  let filas = null;
  for (const nombreHoja of anexoWB.SheetNames) {
    const ws = anexoWB.Sheets[nombreHoja];
    let f;
    try { f = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }); } catch (e) { continue; }
    const esFormatoEstandar = f.some(r => {
      const t = normSinEspaciosAnexo((r || []).filter(v => typeof v === 'string').join(' '));
      return t.includes('IVACAUSADO') || t.includes('IVATRASLADADO');
    });
    if (esFormatoEstandar) { filas = f; break; }
  }
  if (!filas) return null; // no es el formato estándar reconocido; se usará el respaldo por palabras clave

  const valores = {};
  const fuente = {};
  const marcar = (key, r, texto, valor) => {
    if (!key) return;
    valores[key] = (valores[key] || 0) + valor;
    fuente[key] = `Fila ${r + 1}: "${texto.trim()}"`;
  };

  let seccion = null; // 'causado' | 'compras_gastos' | 'pagado' | 'determinacion'
  for (let r = 0; r < filas.length; r++) {
    const fila = filas[r];
    const soloTexto = (fila || []).filter(v => typeof v === 'string').join(' ');
    const compacto = normSinEspaciosAnexo(soloTexto);
    const tieneNumero = (fila || []).some(v => {
      if (typeof v === 'number') return Number.isFinite(v) && v !== 0;
      if (typeof v === 'string') return /^[-$\\d\\s,().]+$/.test(v.trim()) && /\\d/.test(v);
      return false;
    });
    if (!compacto) continue;
    // Los encabezados pueden traer el ejercicio, porcentajes u otros números;
    // por eso la sección se reconoce ANTES de revisar si la fila tiene números.
    if (compacto.includes('IVACAUSADO')) { seccion = 'causado'; continue; }
    if (compacto.includes('COMPRASYGASTOS')) { seccion = 'compras_gastos'; continue; }
    if (compacto.includes('IVAPAGADOACREDITABLE') || compacto.includes('IVAPAGADO') && compacto.includes('ACREDITABLE')) { seccion = 'pagado'; continue; }
    if (compacto.includes('DETERMINACIONDELIVA')) { seccion = 'determinacion'; continue; }
    const texto = normTxtAnexo(soloTexto);
    const valor = valorNumericoDeFilaAnexo(fila, 2); // columna C

    if (seccion === 'causado') {
      if (texto.includes('GRAVADOS') && tieneTasaAnexo(texto, 16)) marcar('ingresos_gravados_16', r, texto, valor);
      else if (texto.includes('GRAVADOS') && tieneTasaAnexo(texto, 8)) marcar('otras_bases_ingresos', r, texto, valor); // el 8% no tiene columna propia en la Cédula
      else if (texto.includes('GRAVADOS') && tieneTasaAnexo(texto, 11)) marcar('ingresos_gravados_11', r, texto, valor);
      else if (texto.includes('GRAVADOS') && tieneTasaAnexo(texto, 0)) marcar('ingresos_gravados_0', r, texto, valor);
      else if (texto.includes('EXENT')) marcar('ingresos_exentos', r, texto, valor);
      else if (texto.includes('GRAVADOS') && tieneTasaAnexo(texto, 15)) marcar('ingresos_gravados_15', r, texto, valor);
      else if (texto.includes('GRAVADOS') && tieneTasaAnexo(texto, 10)) marcar('ingresos_gravados_10', r, texto, valor);
      else if (texto.includes('OTRAS') && texto.includes('TASAS')) marcar('otras_bases_ingresos', r, texto, valor);
      else if ((texto.includes('CAUSADO') || texto.includes('TRASLAD')) && tieneTasaAnexo(texto, 16)) marcar('iva_trasladado_16', r, texto, valor);
      else if ((texto.includes('CAUSADO') || texto.includes('TRASLAD')) && tieneTasaAnexo(texto, 8)) marcar('iva_otras_bases', r, texto, valor);
      else if ((texto.includes('CAUSADO') || texto.includes('TRASLAD')) && tieneTasaAnexo(texto, 11)) marcar('iva_trasladado_11', r, texto, valor);
      else if ((texto.includes('CAUSADO') || texto.includes('TRASLAD')) && tieneTasaAnexo(texto, 15)) marcar('iva_trasladado_15', r, texto, valor);
      else if ((texto.includes('CAUSADO') || texto.includes('TRASLAD')) && tieneTasaAnexo(texto, 10)) marcar('iva_trasladado_10', r, texto, valor);
      else if (texto.includes('RETENIDO')) marcar('iva_retenido', r, texto, valor);
    } else if (seccion === 'pagado') {
      // Las filas de IVA (empiezan con "IVA de Actos y Actividades Pagados…") se
      // revisan ANTES que las de base, porque ambas contienen la palabra "PAGADOS".
      if (texto.includes('PAGADOS') && texto.includes('IVA') && tieneTasaAnexo(texto, 16)) marcar('iva_acreditable_16', r, texto, valor);
      else if (texto.includes('PAGADOS') && texto.includes('IVA') && tieneTasaAnexo(texto, 8)) marcar('iva_acreditable_otras', r, texto, valor);
      else if (texto.includes('PAGADOS') && texto.includes('IVA') && tieneTasaAnexo(texto, 11)) marcar('iva_acreditable_11', r, texto, valor);
      else if (texto.includes('PAGADOS') && texto.includes('IVA') && tieneTasaAnexo(texto, 15)) marcar('iva_acreditable_15', r, texto, valor);
      else if (texto.includes('PAGADOS') && texto.includes('IVA') && tieneTasaAnexo(texto, 10)) marcar('iva_acreditable_10', r, texto, valor);
      else if (texto.includes('MESES') && texto.includes('ANTERIOR')) marcar('iva_retenido_anteriores', r, texto, valor);
      else if (texto.includes('RETENIDO')) marcar('iva_retenido_acreditable', r, texto, valor);
      else if (texto.includes('PAGADOS') && tieneTasaAnexo(texto, 16)) marcar('base_acreditable_16', r, texto, valor);
      else if (texto.includes('PAGADOS') && tieneTasaAnexo(texto, 8)) marcar('base_otras', r, texto, valor);
      else if (texto.includes('PAGADOS') && tieneTasaAnexo(texto, 11)) marcar('base_acreditable_11', r, texto, valor);
      else if (texto.includes('PAGADOS') && tieneTasaAnexo(texto, 0)) marcar('base_acreditable_0', r, texto, valor);
      else if (texto.includes('EXENT')) marcar('base_acreditable_exenta', r, texto, valor);
      else if (texto.includes('PAGADOS') && tieneTasaAnexo(texto, 15)) marcar('base_acreditable_15', r, texto, valor);
      else if (texto.includes('PAGADOS') && tieneTasaAnexo(texto, 10)) marcar('base_acreditable_10', r, texto, valor);
    }
    // Las secciones 'compras_gastos' (devengado, informativa) y 'determinacion'
    // (resultado, no insumo) no alimentan los 29 conceptos del Papel de Trabajo.
  }
  return { valores, fuente };
}

export const _cacheAnexoCompac = new WeakMap();

export function obtenerParseCompacEstandar(anexoWB) {
  if (_cacheAnexoCompac.has(anexoWB)) return _cacheAnexoCompac.get(anexoWB);
  const parsed = parseAnexoCompacEstandar(anexoWB);
  _cacheAnexoCompac.set(anexoWB, parsed);
  return parsed;
}

export function buscarValorAnexoPorEtiqueta(anexoWB, key, celdaManual) {
  if (celdaManual) {
    return { valor: getAnexoValue(anexoWB, celdaManual), fuente: 'Celda manual ' + celdaManual, encontrado: true, manual: true };
  }
  // 1) Método principal: parser exacto del formato estándar CONTPAQi/Compac.
  const parseado = obtenerParseCompacEstandar(anexoWB);
  if (parseado && parseado.valores && parseado.valores[key] !== undefined) {
    return { valor: parseado.valores[key], fuente: parseado.fuente[key] || 'Formato estándar CONTPAQi', encontrado: true, manual: false };
  }
  // Si el archivo SÍ es del formato estándar pero este concepto en particular no
  // tuvo fila ese mes (p.ej. no hubo compras a la tasa del 10%), su valor real es
  // 0 — no hay que caer al respaldo por palabras clave ni a la celda por defecto.
  if (parseado) {
    return { valor: 0, fuente: 'No aplica este mes (no hay movimientos en este concepto)', encontrado: true, manual: false };
  }
  // 2) Respaldo: búsqueda flexible por palabras clave (para Anexos con formato distinto al estándar)
  const grupos = ANEXO_IVA_ETIQUETAS[key] || [];
  const colPreferida = 2; // columna C
  for (let s = 0; s < anexoWB.SheetNames.length; s++) {
    const ws = anexoWB.Sheets[anexoWB.SheetNames[s]];
    let filas;
    try { filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }); } catch (e) { continue; }
    for (let r = 0; r < filas.length; r++) {
      const txt = filaTextoAnexo(filas[r]);
      if (txt.trim().length < 2) continue;
      for (const grupo of grupos) {
        if (cumpleGrupoAnexo(txt, grupo)) {
          const valor = valorNumericoDeFilaAnexo(filas[r], colPreferida);
          const etiquetaTexto = (filas[r] || []).filter(v => typeof v === 'string').join(' ').trim();
          return { valor, fuente: `Fila ${r + 1}: "${etiquetaTexto}"`, encontrado: true, manual: false };
        }
      }
    }
  }
  const refDefault = ANEXO_IVA_CELDAS_DEFAULT[key];
  if (refDefault) {
    return { valor: getAnexoValue(anexoWB, refDefault), fuente: 'No se encontró la etiqueta de texto — se usó la celda por defecto ' + refDefault, encontrado: false, manual: false };
  }
  return { valor: 0, fuente: 'No se encontró este concepto en el Anexo', encontrado: false, manual: false };
}

export const SUMA_LEGACY_ANEXO = {
  base_trasladado: ['ingresos_gravados_16', 'ingresos_gravados_11', 'ingresos_gravados_0', 'ingresos_exentos', 'ingresos_gravados_15', 'ingresos_gravados_10', 'otras_bases_ingresos'],
  iva_trasladado: ['iva_trasladado_16', 'iva_trasladado_11', 'iva_trasladado_0', 'iva_exento', 'iva_trasladado_15', 'iva_trasladado_10', 'iva_otras_bases', 'iva_retenido'],
  base_acreditable: ['base_acreditable_16', 'base_acreditable_11', 'base_acreditable_0', 'base_acreditable_exenta', 'base_acreditable_15', 'base_acreditable_10', 'base_otras'],
  iva_acreditable: ['iva_acreditable_16', 'iva_acreditable_11', 'iva_acreditable_15', 'iva_acreditable_10', 'iva_acreditable_otras', 'iva_retenido_acreditable', 'iva_retenido_anteriores']
};
