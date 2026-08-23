import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CATEGORIAS_EF, clasificarCuentaAutomatico, normCuenta, normEncabezado, obtenerAncestroMayor } from '../lib/balanza.js';

export function ImportadorCatalogo({ onImportar, catalogoActual }) {
  const [archivo, setArchivo] = React.useState(null);
  const [procesando, setProcesando] = React.useState(false);
  const [cuentas, setCuentas] = React.useState(catalogoActual || []);
  const [busqueda, setBusqueda] = React.useState('');
  const [soloClasificables, setSoloClasificables] = React.useState(true);
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => { setCuentas(catalogoActual || []); }, [catalogoActual]);

function detectarColumnasCatalogo(rows, filaHeaderIdx) {
  if (filaHeaderIdx == null || filaHeaderIdx < 0) return null;
  const fila = rows[filaHeaderIdx] || [];
  const col = { codigo: -1, nombre: -1, ctaSup: -1, tipo: -1, ctaMayor: -1, idAgrupadorSAT: -1 };
  for (let c = 0; c < fila.length; c++) {
    const txt = normEncabezado(fila[c]).replace(/\s+/g, '');
    if (!txt) continue;
    if (col.codigo === -1 && txt === 'CODIGO') col.codigo = c;
    else if (col.nombre === -1 && txt === 'NOMBRE') col.nombre = c;
    else if (col.ctaSup === -1 && (txt === 'CTASUP' || txt === 'CUENTASUPERIOR')) col.ctaSup = c;
    else if (col.tipo === -1 && txt === 'TIPO') col.tipo = c;
    else if (col.ctaMayor === -1 && (txt === 'CTAMAYOR' || txt === 'CUENTAMAYOR')) col.ctaMayor = c;
    else if (col.idAgrupadorSAT === -1 && (txt === 'IDAGRUPADORSAT' || txt.includes('AGRUPADORSAT') || txt.includes('CODIGOAGRUPADOR'))) col.idAgrupadorSAT = c;
  }
  // Si no se encontraron al menos código, nombre y tipo, no es confiable.
  if (col.codigo === -1 || col.nombre === -1 || col.tipo === -1) return null;
  return col;
}

  const procesarArchivo = async (file) => {
    setProcesando(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Buscar la fila de encabezados ("Cuenta contable(C)" en el formato
      // estándar de CONTPAQi, u otras variantes). No es crítico acertarle
      // exacto: los datos se identifican por tener 'C' en la primera columna
      // sin importar desde qué fila se empiece a buscar, así que esto solo
      // evita recorrer de más.
      let startRow = 0;
      let filaHeaderIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const encabezado = normEncabezado((rows[i] || [])[0]).replace(/\s+/g, '');
        if (encabezado === 'CUENTACONTABLE(C)' || encabezado === 'CUENTACONTABLE' ||
            encabezado.includes('CUENTACONTABLE') || encabezado === 'CUENTA') {
          filaHeaderIdx = i;
          startRow = i + 1;
          break;
        }
      }
      // Detecta en qué columna está cada dato por el TEXTO del encabezado (más
      // robusto que asumir siempre las mismas posiciones 1,2,4,5,7,16 — por si
      // una empresa exporta el catálogo con columnas de más/menos o en otro
      // orden). Si no se detecta con confianza, se usa el orden clásico.
      const colCat = detectarColumnasCatalogo(rows, filaHeaderIdx) ||
        { codigo: 1, nombre: 2, ctaSup: 4, tipo: 5, ctaMayor: 7, idAgrupadorSAT: 16 };

      const nuevasCuentas = [];
      const duplicados = [];
      const mapaPorCodigo = {}; // indexado por normCuenta(codigo) — ignora guiones/puntos/espacios
      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row[0] !== 'C') continue;
        const codigo = String(row[colCat.codigo] || '').trim();
        const nombre = String(row[colCat.nombre] || '').trim();
        const ctaSup = String(row[colCat.ctaSup] || '').trim();
        const tipo = String(row[colCat.tipo] || '').trim();
        // CtaMayor: 1 = Cuenta de Mayor (la que va en los Estados Financieros),
        // 2 = subcuenta, 3 = rubro/grupo más alto, 4+ = subcuenta de subcuenta.
        const ctaMayor = parseInt(row[colCat.ctaMayor], 10) || 0;
        const idAgrupadorSAT = String(row[colCat.idAgrupadorSAT] || '').trim();
        if (codigo && nombre) {
          const c = { codigo, nombre, tipo, ctaSup, ctaMayor, idAgrupadorSAT };
          const key = normCuenta(codigo);
          if (mapaPorCodigo[key]) duplicados.push(codigo);
          nuevasCuentas.push(c);
          mapaPorCodigo[key] = c;
        }
      }

      // Respaldo: si ninguna cuenta quedó marcada como "Cuenta de Mayor"
      // (CtaMayor=1) — porque esa columna no vino en el archivo, vino vacía, o
      // usa otra codificación que no reconocemos — se infiere automáticamente:
      // las cuentas que NADIE más usa como CtaSup (las "hoja" del árbol, las
      // que reciben movimientos reales) se tratan como si fueran CtaMayor=1,
      // que es exactamente el criterio que usan los Estados Financieros para
      // decidir a qué nivel presentar cada línea.
      let usoRespaldoCtaMayor = false;
      if (nuevasCuentas.length > 0 && !nuevasCuentas.some(c => Number(c.ctaMayor) === 1)) {
        usoRespaldoCtaMayor = true;
        const sonPadre = new Set();
        nuevasCuentas.forEach(c => {
          const sup = normCuenta(c.ctaSup);
          if (sup && !/^0+$/.test(sup)) sonPadre.add(sup);
        });
        nuevasCuentas.forEach(c => {
          if (!sonPadre.has(normCuenta(c.codigo))) c.ctaMayor = 1;
        });
      }

      // Clasificación automática usando la jerarquía COMPLETA del catálogo (sube
      // por todos los ancestros, no solo el padre inmediato)
      nuevasCuentas.forEach(c => {
        c.categoriaEF = clasificarCuentaAutomatico(c, mapaPorCodigo);
      });

      setCuentas(nuevasCuentas);
      setProcesando(false);
      onImportar(nuevasCuentas);
      const avisoRespaldo = usoRespaldoCtaMayor
        ? '  No se detectó la columna "Cuenta de Mayor" en el archivo — se infirió automáticamente usando las cuentas que no tienen subcuentas; revisa la clasificación con cuidado.'
        : '';
      const avisoDuplicados = duplicados.length > 0
        ? `  ${duplicados.length} código(s) de cuenta repetido(s) en el archivo (se usó la última fila de cada uno): ${[...new Set(duplicados)].slice(0, 8).join(', ')}${duplicados.length > 8 ? '…' : ''}.`
        : '';
      setMsg(` Catálogo importado: ${nuevasCuentas.length} cuentas clasificadas automáticamente.${avisoRespaldo}${avisoDuplicados}`);
      setTimeout(() => setMsg(''), (avisoDuplicados || avisoRespaldo) ? 10000 : 4000);
    };
    reader.readAsArrayBuffer(file);
  };

  const cambiarCategoria = (codigo, categoriaEF) => {
    const nuevas = cuentas.map(c => c.codigo === codigo ? { ...c, categoriaEF } : c);
    setCuentas(nuevas);
  };

  const guardarCambios = async () => {
    await onImportar(cuentas);
    setMsg(' Cambios de clasificación guardados');
    setTimeout(() => setMsg(''), 3000);
  };

  // Se editan/muestran las cuentas de MAYOR (CtaMayor === 1): son las que se
  // presentan en los Estados Financieros. Las subcuentas heredan la
  // clasificación de su cuenta de Mayor automáticamente al generar los estados.
  const cuentasDetalle = React.useMemo(() => {
    let lista = cuentas.filter(c => Number(c.ctaMayor) === 1);
    if (soloClasificables) lista = lista.filter(c => c.tipo && c.tipo !== 'K');
    if (busqueda) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(c => c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q));
    }
    return lista;
  }, [cuentas, busqueda, soloClasificables]);

  const sinClasificar = cuentas.filter(c => Number(c.ctaMayor) === 1 && c.tipo && c.tipo !== 'K' && !c.categoriaEF).length;

  const [expandido, setExpandido] = React.useState({});

  // Para cada cuenta de Mayor, qué subcuentas de la balanza se van a ACUMULAR ahí
  // (todo lo que cuelga de ella en la jerarquía CtaSup, sin importar cuántos
  // niveles de profundidad tenga). Esto es lo que responde "¿de qué cuenta es
  // subcuenta y en cuál se acumula?".
  const mapaJerarquia = React.useMemo(() => {
    const m = {};
    cuentas.forEach(c => { m[normCuenta(c.codigo)] = c; });
    return m;
  }, [cuentas]);

  const subcuentasPorMayor = React.useMemo(() => {
    const map = {};
    cuentas.forEach(c => {
      if (Number(c.ctaMayor) === 1) return; // es el propio Mayor, no una subcuenta suya
      const anc = obtenerAncestroMayor(c.codigo, mapaJerarquia);
      if (anc && Number(anc.ctaMayor) === 1) {
        const key = normCuenta(anc.codigo);
        if (!map[key]) map[key] = [];
        map[key].push(c);
      }
    });
    return map;
  }, [cuentas, mapaJerarquia]);

  return (
    <div>
      <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 6 }}> Importar Catálogo de Cuentas (CONTPAQi)</h3>
      <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>
        Sube el archivo XLS/XLSX del catálogo de cuentas exportado de CONTPAQi. El sistema detecta cada cuenta
        y la clasifica <b>automáticamente</b> (Activo circulante/no circulante, Pasivo corto/largo plazo, Capital
        contribuido/ganado, Ingresos, Costos, Gastos operativos/financieros, Otros ingresos/gastos) usando —de más a
        menos confiable— el <b>Tipo contable</b> (A/D/F/H/G), el campo <b>CtaMayor</b> del catálogo para identificar
        la <b>cuenta de Mayor</b> de cada grupo de subcuentas, y la jerarquía (CtaSup) para acumular saldos. Los
        Estados Financieros se presentan y se cuadran <b>a nivel cuenta de Mayor</b>: cada subcuenta de la balanza
        se acumula en su cuenta de Mayor correspondiente, sin importar cómo esté ordenado el catálogo de cada
        empresa. Con esto, el Balance General y el Estado de Resultados de cada mes validado se arman solos — sin
        seleccionar cuentas a mano. Debajo se muestran y editan las cuentas de Mayor (las que salen en los estados).
      </p>
      <input
        type="file"
        accept=".xls,.xlsx"
        onChange={e => {
          const f = e.target.files[0];
          if (f) { setArchivo(f); procesarArchivo(f); }
        }}
        style={{ margin: '10px 0 16px' }}
      />
      {procesando && <p style={{ color: '#9ca3af' }}>Procesando catálogo…</p>}
      {msg && <div className="alert alert-info" style={{ marginBottom: 12 }}>{msg}</div>}

      {cuentas.length > 0 && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <input className="inp" placeholder="Buscar cuenta o nombre..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)} style={{ maxWidth: 260 }} />
            <label style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={soloClasificables} onChange={e => setSoloClasificables(e.target.checked)} />
              Solo cuentas afectables (ocultar cuentas de orden)
            </label>
            <span style={{ fontSize: 12, color: sinClasificar > 0 ? '#ff9800' : '#4caf50', fontWeight: 700 }}>
              {sinClasificar > 0 ? ` ${sinClasificar} cuentas sin clasificar` : ' Todas las cuentas clasificadas'}
            </span>
            <button className="btn btn-sm btn-primary" onClick={guardarCambios} style={{ marginLeft: 'auto' }}> Guardar clasificación</button>
          </div>
          <div style={{ maxHeight: 480, overflow: 'auto', border: '1px solid #2a2f45', borderRadius: 8 }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr style={{ background: '#1a237e', color: '#fff' }}>
                  <th style={{ padding: 8, textAlign: 'left' }}>Código</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Nombre</th>
                  <th style={{ padding: 8 }}>Tipo</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Clasificación (Estados Financieros)</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Acumula aquí (subcuentas)</th>
                </tr>
              </thead>
              <tbody>
                {cuentasDetalle.map((c, i) => {
                  const hijos = subcuentasPorMayor[normCuenta(c.codigo)] || [];
                  const abierto = !!expandido[c.codigo];
                  return (
                  <React.Fragment key={c.codigo + i}>
                  <tr style={{ borderBottom: abierto ? 'none' : '1px solid #2a2f45' }}>
                    <td style={{ padding: 6, fontFamily: 'monospace', color: '#e5e7eb' }}>{c.codigo}</td>
                    <td style={{ padding: 6, color: '#e5e7eb' }}>{c.nombre}</td>
                    <td style={{ padding: 6, textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 10,
                        background: c.tipo === 'A' ? '#e3f2fd' : c.tipo === 'D' ? '#fce4ec' : c.tipo === 'H' ? '#e8f5e9' : c.tipo === 'G' ? '#fff3e0' : '#f3e5f5',
                        color: c.tipo === 'A' ? '#1565c0' : c.tipo === 'D' ? '#c62828' : c.tipo === 'H' ? '#2e7d32' : c.tipo === 'G' ? '#ef6c00' : '#6a1b9a'
                      }}>
                        {c.tipo === 'A' ? 'ACTIVO' : c.tipo === 'D' ? 'PASIVO' : c.tipo === 'H' ? 'INGRESO' : c.tipo === 'G' ? 'EGRESO' : c.tipo === 'F' ? 'CAPITAL' : c.tipo === 'K' ? 'ORDEN' : (c.tipo || '—')}
                      </span>
                    </td>
                    <td style={{ padding: 6 }}>
                      <select className="inp" style={{ fontSize: 11, padding: '4px 8px' }} value={c.categoriaEF || ''}
                        onChange={e => cambiarCategoria(c.codigo, e.target.value)}>
                        {CATEGORIAS_EF.map(cat => <option key={cat.key} value={cat.key}>{cat.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: 6 }}>
                      {hijos.length > 0 ? (
                        <button className="btn btn-sm btn-secondary" style={{ fontSize: 10, padding: '2px 8px' }}
                          onClick={() => setExpandido(prev => ({ ...prev, [c.codigo]: !prev[c.codigo] }))}>
                          {abierto ? '▲' : '▼'} {hijos.length} subcuenta{hijos.length === 1 ? '' : 's'}
                        </button>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: 11 }}>— (recibe movimientos directo)</span>
                      )}
                    </td>
                  </tr>
                  {abierto && hijos.length > 0 && (
                    <tr style={{ borderBottom: '1px solid #2a2f45', background: '#11152a' }}>
                      <td colSpan={5} style={{ padding: '4px 6px 10px 24px' }}>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                          Todas estas subcuentas de la balanza se acumulan en <b style={{ color: '#e5e7eb' }}>{c.codigo} — {c.nombre}</b>:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                          {hijos.map(h => (
                            <span key={h.codigo} style={{ fontSize: 11, color: '#cbd5e1' }}>
                              <span style={{ fontFamily: 'monospace', color: '#9ca3af' }}>{h.codigo}</span> {h.nombre}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
