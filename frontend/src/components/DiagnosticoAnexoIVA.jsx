import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CONFIG_DEFAULT } from '../lib/configEmpresa.js';
import { fmt } from '../lib/format.js';

export function DiagnosticoAnexoIVA({ detalle29, anexoWB }) {
  const [abierto, setAbierto] = React.useState(false);
  const [verFilas, setVerFilas] = React.useState(false);
  if (!detalle29) return null;
  const claves = Object.keys(CONFIG_DEFAULT.iva);
  const noEncontrados = claves.filter(k => detalle29[k] && !detalle29[k].encontrado && !detalle29[k].manual);

  // Lista TODAS las filas del Anexo con texto y valores numéricos, con su
  // referencia de celda (ej. C16), para que el usuario mismo pueda identificar a
  // mano en cuál celda está cada concepto y ponerla en "ajustar celdas" — sin
  // tener que abrir el Excel ni mandarnos el archivo.
  const filasAnexo = React.useMemo(() => {
    if (!anexoWB) return [];
    const out = [];
    anexoWB.SheetNames.forEach((nombreHoja, sIdx) => {
      const ws = anexoWB.Sheets[nombreHoja];
      let filas;
      try { filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }); } catch (e) { return; }
      filas.forEach((fila, r) => {
        const texto = (fila || []).filter(v => typeof v === 'string').join(' ').trim();
        const valores = [];
        (fila || []).forEach((v, c) => { if (typeof v === 'number' && v !== 0) valores.push({ col: XLSX.utils.encode_col(c), valor: v }); });
        if (texto || valores.length) {
          out.push({ hoja: nombreHoja, fila: r + 1, texto, valores });
        }
      });
    });
    return out;
  }, [anexoWB]);

  return (
    <div style={{ marginTop: 16 }}>
      <button className="btn btn-sm btn-secondary" onClick={() => setAbierto(v => !v)}>
        {abierto ? '▲ Ocultar' : '▼'}  Ver detección del Anexo de IVA por concepto
        {noEncontrados.length > 0 ? ` ( ${noEncontrados.length} sin detectar)` : ' ( todos detectados)'}
      </button>
      {abierto && (
        <div style={{ marginTop: 10, border: '1px solid #374151', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1a237e', color: '#fff' }}>
                <th style={{ padding: 6, textAlign: 'left' }}>Concepto</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Importe</th>
                <th style={{ padding: 6, textAlign: 'left' }}>Detectado en</th>
              </tr>
            </thead>
            <tbody>
              {claves.map(k => {
                const d = detalle29[k] || {};
                return (
                  <tr key={k} style={{ borderBottom: '1px solid #2a2f45' }}>
                    <td style={{ padding: 6, color: '#e5e7eb' }}>{CONFIG_DEFAULT.iva[k].concepto}</td>
                    <td style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace', color: '#e5e7eb' }}>{fmt(d.valor || 0)}</td>
                    <td style={{ padding: 6, color: d.encontrado ? '#9ca3af' : '#ff9800', fontStyle: d.encontrado ? 'normal' : 'italic' }}>{d.fuente || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '8px 12px', fontSize: 11, color: '#6b7280' }}>
            Si algún concepto no se detectó (), puedes fijar una celda manual para ese concepto en
            "Papeles de Trabajo → Configurar Cuentas →  Anexo IVA → ver/ajustar celdas". Usa la lista de abajo
            para encontrar la celda exacta sin necesidad de abrir el Excel.
          </div>
          {anexoWB && (
            <div style={{ borderTop: '1px solid #374151' }}>
              <button className="btn btn-sm btn-secondary" style={{ margin: 10 }} onClick={() => setVerFilas(v => !v)}>
                {verFilas ? '▲ Ocultar' : '▼'} Ver TODAS las filas de tu Anexo (para encontrar la celda manual)
              </button>
              {verFilas && (
                <div style={{ maxHeight: 320, overflow: 'auto', margin: '0 10px 10px' }}>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0 }}>
                      <tr style={{ background: '#111827', color: '#9ca3af' }}>
                        <th style={{ padding: 4, textAlign: 'left' }}>Hoja</th>
                        <th style={{ padding: 4, textAlign: 'left' }}>Fila</th>
                        <th style={{ padding: 4, textAlign: 'left' }}>Texto</th>
                        <th style={{ padding: 4, textAlign: 'left' }}>Valores (celda: importe)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasAnexo.map((f, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                          <td style={{ padding: 4, color: '#9ca3af' }}>{f.hoja}</td>
                          <td style={{ padding: 4, color: '#9ca3af', fontFamily: 'monospace' }}>{f.fila}</td>
                          <td style={{ padding: 4, color: '#e5e7eb' }}>{f.texto}</td>
                          <td style={{ padding: 4, color: '#cbd5e1', fontFamily: 'monospace' }}>
                            {f.valores.map(v => `${v.col}${f.fila}: ${fmt(v.valor)}`).join('  |  ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
