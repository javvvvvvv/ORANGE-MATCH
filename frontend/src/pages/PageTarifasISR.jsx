import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';
import { TABLA_RESICO_PF_DEFAULT, TARIFAS_ISR_MENSUAL_DEFAULT, cargarTarifasISRLocal, guardarTarifasISRLocal } from '../lib/isr.js';

export function PageTarifasISR({ token }) {
  const [cfg, setCfg] = React.useState(() => cargarTarifasISRLocal());
  const [anio, setAnio] = React.useState(new Date().getFullYear());
  const [nuevoAnio, setNuevoAnio] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [cargando, setCargando] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const remoto = await api('GET', '/tarifas-isr', null, token);
        if (remoto && remoto.mensual) {
          setCfg(remoto);
          guardarTarifasISRLocal(remoto);
        }
      } catch (e) { /* el backend puede no tener esta ruta todavía: se usa la copia local */ }
    })();
  }, []);

  const anios = Object.keys(cfg.mensual || {}).map(Number).sort((a, b) => b - a);
  const tablaMensual = cfg.mensual?.[anio] || [];
  const tablaResico = cfg.resico?.[anio] || [];

  function actualizar(fn) {
    setCfg(prev => {
      const copia = JSON.parse(JSON.stringify(prev));
      fn(copia);
      return copia;
    });
  }

  function agregarAnio() {
    const a = parseInt(nuevoAnio, 10);
    if (!a || a < 2000 || a > 2100) { setMsg(' Año inválido'); return; }
    actualizar(c => {
      if (!c.mensual[a]) c.mensual[a] = JSON.parse(JSON.stringify(TARIFAS_ISR_MENSUAL_DEFAULT[2026]));
      if (!c.resico[a]) c.resico[a] = JSON.parse(JSON.stringify(TABLA_RESICO_PF_DEFAULT[2026]));
    });
    setAnio(a);
    setNuevoAnio('');
  }

  function eliminarAnio(a) {
    if (!confirm(`¿Eliminar la tarifa del ejercicio ${a}?`)) return;
    actualizar(c => { delete c.mensual[a]; delete c.resico[a]; });
    if (anio === a) {
      const restantes = Object.keys(cfg.mensual || {}).map(Number).filter(x => x !== a);
      setAnio(restantes.length ? Math.max(...restantes) : new Date().getFullYear());
    }
  }

  function updTramoMensual(i, campo, valor) {
    actualizar(c => {
      const t = c.mensual[anio][i];
      t[campo] = campo === 'porcentaje' || campo === 'cuotaFija' || campo === 'limiteInferior'
        ? parseFloat(valor) || 0
        : (valor === 'Infinity' ? Infinity : (parseFloat(valor) || 0));
    });
  }
  function addTramoMensual() {
    actualizar(c => {
      c.mensual[anio].push({ limiteInferior: 0, limiteSuperior: 0, cuotaFija: 0, porcentaje: 0 });
    });
  }
  function delTramoMensual(i) {
    actualizar(c => { c.mensual[anio].splice(i, 1); });
  }

  function updTramoResico(i, campo, valor) {
    actualizar(c => { c.resico[anio][i][campo] = parseFloat(valor) || 0; });
  }
  function addTramoResico() {
    actualizar(c => { c.resico[anio].push({ limite: 0, tasa: 0 }); });
  }
  function delTramoResico(i) {
    actualizar(c => { c.resico[anio].splice(i, 1); });
  }

  async function guardar() {
    setCargando(true);
    guardarTarifasISRLocal(cfg);
    try {
      await api('PUT', '/tarifas-isr', cfg, token);
      setMsg(' Tarifas ISR guardadas y sincronizadas — aplican a todas las empresas');
    } catch (e) {
      setMsg(' Tarifas ISR guardadas en este navegador (aplican a todas las empresas). El backend aún no expone /tarifas-isr, así que no se sincronizaron a otros equipos.');
    }
    setCargando(false);
    setTimeout(() => setMsg(''), 5000);
  }

  const thStyle = { padding: '8px 10px', background: '#1a237e', color: '#fff', fontSize: 12, textAlign: 'left' };
  const tdStyle = { padding: '4px 6px', border: '1px solid #e0e0e0' };
  const inpStyle = { width: '100%', padding: '5px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' };

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ color: '#1a237e', marginBottom: 4 }}> Tarifas ISR (SAT)</h1>
      <p style={{ color: '#666', marginBottom: 20, fontSize: 13 }}>
        Configura aquí, <b>una sola vez por ejercicio</b>, la tarifa <b>mensual</b> de ISR (Art. 96/152 LISR)
        y la tabla RESICO Personas Físicas publicadas por el SAT. El sistema acumula automáticamente la
        tarifa mensual según el número de mes de cada pago provisional, y esta configuración aplica de
        forma automática a <b>todas las empresas</b> del sistema — no se captura por empresa.
      </p>

      {msg && <div style={{ padding: 12, borderRadius: 6, marginBottom: 16, background: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold', fontSize: 13 }}>{msg}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 'bold', color: '#333' }}>Ejercicio:</label>
        <select value={anio} onChange={e => setAnio(parseInt(e.target.value))} style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4 }}>
          {anios.length === 0 && <option value={anio}>{anio} (sin capturar)</option>}
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {anios.includes(anio) && anios.length > 1 && (
          <button onClick={() => eliminarAnio(anio)} style={{ padding: '6px 12px', background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}> Eliminar {anio}</button>
        )}
        <span style={{ marginLeft: 16, color: '#666', fontSize: 12 }}>Agregar nuevo ejercicio:</span>
        <input type="number" placeholder="Ej. 2027" value={nuevoAnio} onChange={e => setNuevoAnio(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, width: 100 }} />
        <button onClick={agregarAnio} style={{ padding: '6px 14px', background: '#1a237e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>+ Agregar</button>
      </div>

      {!anios.includes(anio) ? (
        <div style={{ padding: 30, textAlign: 'center', background: '#fff3e0', borderRadius: 8, border: '2px dashed #ff9800', marginBottom: 20 }}>
          No hay tarifa capturada para {anio}. Agrega el ejercicio arriba para empezar a partir de la tarifa vigente más reciente.
        </div>
      ) : (
        <>
          <h3 style={{ color: '#1a237e', marginBottom: 8 }}>Tarifa MENSUAL ISR — Personas Físicas (Art. 96/152 LISR)</h3>
          <p style={{ color: '#666', fontSize: 12, marginBottom: 10 }}>Captura los montos <b>mensuales</b> tal como los publica el SAT. Para el límite superior del último tramo usa la palabra <code>Infinity</code>.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
            <thead><tr>
              <th style={thStyle}>Límite inferior</th>
              <th style={thStyle}>Límite superior</th>
              <th style={thStyle}>Cuota fija</th>
              <th style={thStyle}>% sobre excedente</th>
              <th style={thStyle}></th>
            </tr></thead>
            <tbody>
              {tablaMensual.map((t, i) => (
                <tr key={i}>
                  <td style={tdStyle}><input style={inpStyle} value={t.limiteInferior} onChange={e => updTramoMensual(i, 'limiteInferior', e.target.value)} /></td>
                  <td style={tdStyle}><input style={inpStyle} value={t.limiteSuperior === Infinity ? 'Infinity' : t.limiteSuperior} onChange={e => updTramoMensual(i, 'limiteSuperior', e.target.value)} /></td>
                  <td style={tdStyle}><input style={inpStyle} value={t.cuotaFija} onChange={e => updTramoMensual(i, 'cuotaFija', e.target.value)} /></td>
                  <td style={tdStyle}><input style={inpStyle} value={t.porcentaje} onChange={e => updTramoMensual(i, 'porcentaje', e.target.value)} /></td>
                  <td style={tdStyle}><button onClick={() => delTramoMensual(i)} style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontWeight: 'bold' }}></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addTramoMensual} style={{ marginBottom: 24, padding: '6px 14px', background: '#eee', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>+ Agregar tramo</button>

          <h3 style={{ color: '#1a237e', marginBottom: 8 }}>Tabla RESICO — Personas Físicas (Art. 113-E LISR)</h3>
          <p style={{ color: '#666', fontSize: 12, marginBottom: 10 }}>Tasa aplicable sobre los ingresos del mes, según el límite de ingresos mensuales acumulados.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, maxWidth: 500 }}>
            <thead><tr>
              <th style={thStyle}>Límite de ingresos mensuales</th>
              <th style={thStyle}>Tasa %</th>
              <th style={thStyle}></th>
            </tr></thead>
            <tbody>
              {tablaResico.map((t, i) => (
                <tr key={i}>
                  <td style={tdStyle}><input style={inpStyle} value={t.limite} onChange={e => updTramoResico(i, 'limite', e.target.value)} /></td>
                  <td style={tdStyle}><input style={inpStyle} value={t.tasa} onChange={e => updTramoResico(i, 'tasa', e.target.value)} /></td>
                  <td style={tdStyle}><button onClick={() => delTramoResico(i)} style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontWeight: 'bold' }}></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addTramoResico} style={{ padding: '6px 14px', background: '#eee', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>+ Agregar tramo</button>
        </>
      )}

      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <button onClick={guardar} disabled={cargando} style={{ padding: '14px 48px', background: '#1a237e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26,35,126,0.3)' }}>
          {cargando ? 'Guardando...' : ' Guardar tarifas (todas las empresas)'}
        </button>
      </div>
    </div>
  );
}
