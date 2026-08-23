import React, { useState, useEffect, useRef, useCallback } from 'react';
import { REGIMENES } from '../lib/isr.js';

export function ConfigDatosFiscales({ empresa, datosFiscales, onGuardar, onEliminar }) {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = React.useState(anioActual);
  const [form, setForm] = React.useState({
    regimen_fiscal: 'PM_GENERAL', coeficiente_utilidad: 0, perdidas_fiscales: 0,
    ptu_pagada: 0, saldo_favor_isr: 0, deduccion_ciega: 35
  });
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    const existente = (datosFiscales || []).find(d => Number(d.anio) === Number(anio));
    if (existente) {
      setForm({
        regimen_fiscal: existente.regimen_fiscal || 'PM_GENERAL',
        coeficiente_utilidad: existente.coeficiente_utilidad || 0,
        perdidas_fiscales: existente.perdidas_fiscales || 0,
        ptu_pagada: existente.ptu_pagada || 0,
        saldo_favor_isr: existente.saldo_favor_isr || 0,
        deduccion_ciega: existente.deduccion_ciega ?? 35
      });
    } else {
      setForm({ regimen_fiscal: 'PM_GENERAL', coeficiente_utilidad: 0, perdidas_fiscales: 0, ptu_pagada: 0, saldo_favor_isr: 0, deduccion_ciega: 35 });
    }
  }, [anio, datosFiscales]);

  const guardar = async () => {
    try {
      await onGuardar({ anio, ...form });
      setMsg(' Datos fiscales de ' + anio + ' guardados');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(' Error: ' + e.message);
    }
  };

  const eliminar = async (a) => {
    if (!confirm('¿Eliminar los datos fiscales del ejercicio ' + a + '?')) return;
    await onEliminar(a);
  };

  const anios = (datosFiscales || []).map(d => Number(d.anio)).sort((a, b) => b - a);

  return (
    <div>
      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        Aquí se configura el <b>régimen fiscal</b> de la empresa y sus datos para el cálculo de ISR: el
        <b> coeficiente de utilidad</b>, pérdidas fiscales pendientes, PTU pagada y saldo a favor de ISR.
        Se captura <b>una vez por cada ejercicio</b> (puedes tener varios años guardados) y el Papel de Trabajo
        de ISR los toma automáticamente al seleccionar el año.
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 300 }}>
          <label className="lbl">Ejercicio</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="inp" value={anio} onChange={e => setAnio(parseInt(e.target.value, 10))} style={{ maxWidth: 140 }}>
              {[...new Set([anioActual, anioActual - 1, anioActual - 2, anioActual + 1, ...anios])].sort((a, b) => b - a).map(a =>
                <option key={a} value={a}>{a}{anios.includes(a) ? '  guardado' : ''}</option>)}
            </select>
            <input className="inp" type="number" placeholder="Otro año..." style={{ maxWidth: 140 }}
              onKeyDown={e => { if (e.key === 'Enter' && e.target.value) setAnio(parseInt(e.target.value, 10)); }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="field">
          <label className="lbl">Régimen Fiscal</label>
          <select className="inp" value={form.regimen_fiscal} onChange={e => setForm(f => ({ ...f, regimen_fiscal: e.target.value }))}>
            {Object.entries(REGIMENES).map(([key, info]) => <option key={key} value={key}>{info.nombre}</option>)}
          </select>
        </div>
        {(REGIMENES[form.regimen_fiscal]?.usaCoeficiente) && (
          <div className="field">
            <label className="lbl">Coeficiente de Utilidad</label>
            <input className="inp" type="number" step="0.0001" value={form.coeficiente_utilidad}
              onChange={e => setForm(f => ({ ...f, coeficiente_utilidad: parseFloat(e.target.value) || 0 }))} />
          </div>
        )}
        {(REGIMENES[form.regimen_fiscal]?.usaPerdidas) && (
          <div className="field">
            <label className="lbl">Pérdidas Fiscales Pendientes de Amortizar</label>
            <input className="inp" type="number" value={form.perdidas_fiscales}
              onChange={e => setForm(f => ({ ...f, perdidas_fiscales: parseFloat(e.target.value) || 0 }))} />
          </div>
        )}
        {(REGIMENES[form.regimen_fiscal]?.usaPTU) && (
          <div className="field">
            <label className="lbl">PTU Pagada (anual)</label>
            <input className="inp" type="number" value={form.ptu_pagada}
              onChange={e => setForm(f => ({ ...f, ptu_pagada: parseFloat(e.target.value) || 0 }))} />
          </div>
        )}
        <div className="field">
          <label className="lbl">Saldo a Favor de ISR (inicio de ejercicio)</label>
          <input className="inp" type="number" value={form.saldo_favor_isr}
            onChange={e => setForm(f => ({ ...f, saldo_favor_isr: parseFloat(e.target.value) || 0 }))} />
        </div>
        {form.regimen_fiscal === 'PF_HONORARIOS' && (
          <div className="field">
            <label className="lbl">% Deducción Ciega</label>
            <input className="inp" type="number" value={form.deduccion_ciega}
              onChange={e => setForm(f => ({ ...f, deduccion_ciega: parseFloat(e.target.value) || 0 }))} style={{ maxWidth: 120 }} />
          </div>
        )}
        {msg && <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: msg.startsWith('') ? '#4caf50' : '#ef4444' }}>{msg}</div>}
        <button className="btn btn-primary" onClick={guardar}> Guardar Datos Fiscales de {anio}</button>
      </div>

      {anios.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ color: '#e5e7eb', fontSize: 15, marginBottom: 10 }}>Ejercicios guardados</h3>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1a237e', color: '#fff' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Año</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Régimen</th>
                <th style={{ padding: 8 }}>Coef. Utilidad</th>
                <th style={{ padding: 8 }}>Pérdidas</th>
                <th style={{ padding: 8 }}>PTU Pagada</th>
                <th style={{ padding: 8 }}>Saldo a favor</th>
                <th style={{ padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {(datosFiscales || []).sort((a, b) => b.anio - a.anio).map(d => (
                <tr key={d.anio} style={{ borderBottom: '1px solid #2a2f45' }}>
                  <td style={{ padding: 6, fontWeight: 700, color: '#e5e7eb' }}>{d.anio}</td>
                  <td style={{ padding: 6, color: '#e5e7eb' }}>{REGIMENES[d.regimen_fiscal]?.nombre || d.regimen_fiscal}</td>
                  <td style={{ padding: 6, textAlign: 'right', color: '#e5e7eb' }}>{d.coeficiente_utilidad}</td>
                  <td style={{ padding: 6, textAlign: 'right', color: '#e5e7eb' }}>{d.perdidas_fiscales}</td>
                  <td style={{ padding: 6, textAlign: 'right', color: '#e5e7eb' }}>{d.ptu_pagada}</td>
                  <td style={{ padding: 6, textAlign: 'right', color: '#e5e7eb' }}>{d.saldo_favor_isr}</td>
                  <td style={{ padding: 6, textAlign: 'center' }}>
                    <button className="btn btn-sm btn-danger" onClick={() => eliminar(d.anio)}></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
