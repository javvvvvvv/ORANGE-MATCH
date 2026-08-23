import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ANEXO_IVA_CELDAS_DEFAULT, CONFIG_DEFAULT, safeParseConfigPT } from '../lib/configEmpresa.js';

export function ConfigCuentasEmpresa({ empresa, onGuardar, catalogoCuentas, user }) {
  const [config, setConfig] = React.useState(() => safeParseConfigPT(empresa.config_pt));
  const [tabActiva, setTabActiva] = React.useState('anexo_iva');
  const [busqueda, setBusqueda] = React.useState('');
  const esAdmin = user?.role === 'admin';

  React.useEffect(() => {
    setConfig(safeParseConfigPT(empresa.config_pt));
  }, [empresa.id]);

  const guardar = async () => {
    await onGuardar(empresa.id, JSON.stringify(config));
  };

  // ═══ ANEXO IVA: una celda del archivo Anexo de IVA por cada concepto ═══
  // No se seleccionan cuentas de la balanza: estos valores se toman del Anexo
  // de IVA que se sube en "Ejecutar" al momento de validar el amarre del mes.
  const setCeldaAnexo = (key, celda) => {
    setConfig(prev => ({ ...prev, anexo_iva: { ...(prev.anexo_iva || {}), [key]: celda } }));
  };

  const [mostrarAvanzadoAnexo, setMostrarAvanzadoAnexo] = React.useState(false);
  const anexoPersonalizado = Object.keys(config.anexo_iva || {}).some(k => (config.anexo_iva[k] || '') !== (ANEXO_IVA_CELDAS_DEFAULT[k] || ''));

  const renderAnexoIVA = () => (
    <div>
      <div className="alert alert-info" style={{ marginBottom: 16 }}>
         El Papel de Trabajo de IVA se llena <b>automáticamente</b>: el sistema busca cada concepto
        <b> por su texto/etiqueta</b> dentro del Anexo de IVA que subes en " Ejecutar" (por ejemplo, la fila que
        diga "IVA Trasladado a la tasa del 16%"), sin importar en qué fila venga en tu archivo. No necesitas
        configurar nada ni seleccionar cuentas — esto ya está
        listo{anexoPersonalizado ? ', con ajustes que guardaste para esta empresa' : ''}. Puedes verificar qué fila
        detectó para cada concepto en la pantalla " Ejecutar", en " Ver detección del Anexo de IVA por concepto".
      </div>
      {!esAdmin && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
           Las celdas manuales del Anexo de IVA solo puede modificarlas un <b>administrador</b>. Puedes ver la
          configuración actual, pero los campos están bloqueados para tu rol.
        </div>
      )}
      <button className="btn btn-sm btn-secondary" onClick={() => setMostrarAvanzadoAnexo(v => !v)}>
        {mostrarAvanzadoAnexo ? '▲ Ocultar' : '▼ Solo si algún concepto no se detecta: fijar celda manual'}
      </button>

      {mostrarAvanzadoAnexo && (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>
            Normalmente no necesitas tocar esto — el sistema encuentra cada concepto buscando su texto en el
            Anexo. Solo si un concepto en particular NO se detecta (revisa el panel de diagnóstico en "Ejecutar"),
            puedes fijar aquí la celda exacta donde está en tu archivo (ej. <code>C16</code>) para ese concepto;
            una celda manual siempre tiene prioridad sobre la búsqueda automática.
          </p>
          <div style={{ marginBottom: 12 }}>
            <button className="btn btn-sm btn-secondary" disabled={!esAdmin}
              onClick={() => setConfig(prev => ({ ...prev, anexo_iva: {} }))}>
              ↺ Quitar todas las celdas manuales (volver a búsqueda automática por texto)
            </button>
          </div>
          {Object.entries(CONFIG_DEFAULT.iva).map(([key, def]) => (
            <div key={key} className="field" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <label className="lbl" style={{ flex: 1, margin: 0 }}>
                {def.concepto}{def.tasa ? <span style={{ color: '#9ca3af' }}> ({def.tasa}%)</span> : ''}
              </label>
              <input
                className="inp"
                placeholder="Automático — solo llenar si falla"
                value={(config.anexo_iva || {})[key] || ''}
                onChange={e => setCeldaAnexo(key, e.target.value)}
                disabled={!esAdmin}
                title={esAdmin ? '' : 'Solo un administrador puede editar esto'}
                style={{ maxWidth: 220 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ═══ ISR: por cada concepto, cuentas + operación (igual patrón que "Configurar IVA") ═══
  const getReglasISR = (key) => (config.isr && config.isr[key] && config.isr[key].reglas) || [];
  const setReglasISR = (key, reglas) => {
    setConfig(prev => {
      const isr = { ...(prev.isr || {}) };
      const base = isr[key] || { concepto: CONFIG_DEFAULT.isr[key].concepto, signo: CONFIG_DEFAULT.isr[key].signo };
      isr[key] = { ...base, reglas };
      return { ...prev, isr };
    });
  };
  const addReglaISR = (key) => setReglasISR(key, [...getReglasISR(key), { cuenta: '', operacion: 'abonos' }]);
  const updReglaISR = (key, i, campo, valor) => {
    const r = [...getReglasISR(key)]; r[i] = { ...r[i], [campo]: valor }; setReglasISR(key, r);
  };
  const delReglaISR = (key, i) => {
    const r = [...getReglasISR(key)]; r.splice(i, 1); setReglasISR(key, r);
  };

  const cuentasFiltradas = React.useMemo(() => {
    if (!busqueda) return catalogoCuentas.slice(0, 60);
    const q = busqueda.toLowerCase();
    return catalogoCuentas.filter(c => c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)).slice(0, 60);
  }, [catalogoCuentas, busqueda]);

  const [buscando, setBuscando] = React.useState(null); // {key,idx}

  const renderISR = () => (
    <div>
      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        Para cada concepto agrega las cuentas de la balanza que lo integran. Por cada cuenta indica si se debe
        considerar <b>Cargos</b>, <b>Abonos</b>, <b>Cargos + Abonos</b>, <b>Cargos − Abonos</b> o <b>Abonos − Cargos</b> — igual que en "Configurar IVA".
        Usa el concepto <b>Anticipos de Clientes</b> para que se sumen automáticamente al ingreso del mes en que se cobran, en cualquier régimen.
      </div>
      {Object.entries(CONFIG_DEFAULT.isr).map(([key, def]) => {
        const reglas = getReglasISR(key);
        return (
          <div key={key} className="card" style={{ marginBottom: 14 }}>
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{def.concepto}</span>
              <button className="btn btn-sm btn-secondary" onClick={() => addReglaISR(key)}>+ Cuenta</button>
            </div>
            {reglas.length === 0 && <p style={{ color: '#6b7280', fontSize: 12, fontStyle: 'italic' }}>Sin cuentas configuradas</p>}
            {reglas.map((r, i) => (
              <div key={i} className="regla-row" style={{ position: 'relative' }}>
                <input className="inp" placeholder="No. cuenta" value={r.cuenta}
                  onChange={e => updReglaISR(key, i, 'cuenta', e.target.value)}
                  onFocus={() => setBuscando({ key, idx: i })}
                  style={{ flex: 2, minWidth: 100 }} />
                <select className="inp" style={{ flex: 1, minWidth: 140 }} value={r.operacion}
                  onChange={e => updReglaISR(key, i, 'operacion', e.target.value)}>
                  {[{ v: 'cargos', l: 'Cargos' }, { v: 'abonos', l: 'Abonos' }, { v: 'cargos_mas_abonos', l: 'Cargos + Abonos' },
                    { v: 'cargos_menos_abonos', l: 'Cargos − Abonos' }, { v: 'abonos_menos_cargos', l: 'Abonos − Cargos' }]
                    .map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <button className="btn btn-sm btn-danger" onClick={() => delReglaISR(key, i)}></button>
                {buscando && buscando.key === key && buscando.idx === i && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 90, zIndex: 200 }}>
                    <input className="inp" placeholder="Buscar número o nombre..." value={busqueda} autoFocus
                      onChange={e => setBusqueda(e.target.value)} style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }} />
                    <div className="search-results">
                      {catalogoCuentas.length === 0 && <div style={{ padding: 12, color: '#6b7280', fontSize: 12 }}>Sube el catálogo de cuentas primero</div>}
                      {cuentasFiltradas.map(c => (
                        <div key={c.codigo} className="search-item"
                          onClick={() => { updReglaISR(key, i, 'cuenta', c.codigo); setBuscando(null); setBusqueda(''); }}>
                          <b style={{ color: '#ff6b2b' }}>{c.codigo}</b> — {c.nombre}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
      {buscando && <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setBuscando(null)} />}
    </div>
  );

  const renderEstadosInfo = () => (
    <div className="alert alert-info">
       Los Estados Financieros (Balance General y Estado de Resultados) se generan <b>automáticamente</b> a
      partir del <b>catálogo de cuentas</b> (pestaña " Catálogo de Cuentas") y de la balanza validada de cada mes.
      Aquí no se configura nada manualmente: el sistema clasifica cada cuenta (Activo circulante/no circulante,
      Pasivo corto/largo plazo, Capital contribuido/ganado, Ingresos, Costos, Gastos operativos/financieros, Otros
      ingresos/gastos) usando el tipo contable y la jerarquía del catálogo importado. Si alguna cuenta quedó mal
      clasificada, corrígela en la pestaña del Catálogo.
    </div>
  );

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 20 }}>
         Configuración de Papeles de Trabajo — {empresa.nombre}
      </h2>

      <div className="tabs">
        <button className={'tab' + (tabActiva === 'anexo_iva' ? ' active' : '')} onClick={() => setTabActiva('anexo_iva')}> Anexo IVA</button>
        <button className={'tab' + (tabActiva === 'isr' ? ' active' : '')} onClick={() => setTabActiva('isr')}> ISR</button>
        <button className={'tab' + (tabActiva === 'estados' ? ' active' : '')} onClick={() => setTabActiva('estados')}> Estados Financieros</button>
      </div>

      <div className="card">
        {tabActiva === 'anexo_iva' && renderAnexoIVA()}
        {tabActiva === 'isr' && renderISR()}
        {tabActiva === 'estados' && renderEstadosInfo()}
      </div>

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button className="btn btn-primary" onClick={guardar}> Guardar Configuración</button>
      </div>
    </div>
  );
}
