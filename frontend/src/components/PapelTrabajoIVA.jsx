import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CONFIG_DEFAULT } from '../lib/configEmpresa.js';
import { EXCEL_COLOR, EXCEL_MONEDA, agregarEncabezadoHoja, agregarPieHoja, crearLibroExcel, descargarLibroExcel, estiloEncabezadoTabla, estiloFilaTotal, sombreadoAlterno } from '../lib/excel.js';
import { MESES } from '../lib/format.js';
import { aplicarOperacion } from '../lib/reglasIva.js';

export function PapelTrabajoIVA({ empresa, balanzaAnual, anexoIvaAnual, amarresValidados, config, onExportar, ejercicio: ejercicioProp, onGuardarManual, exportRef }) {
  const [ejercicio, setEjercicio] = React.useState(ejercicioProp || new Date().getFullYear());
  React.useEffect(() => { if (ejercicioProp) setEjercicio(ejercicioProp); }, [ejercicioProp]);
  const [saldoFavorAnterior, setSaldoFavorAnterior] = React.useState(0);
  const [saldoFavorAplicado, setSaldoFavorAplicado] = React.useState({});
  const [nuevoSaldoFavor, setNuevoSaldoFavor] = React.useState({});
  const [detalleVisible, setDetalleVisible] = React.useState({});
  const [mesManual, setMesManual] = React.useState(null);
  const [formManual, setFormManual] = React.useState({});
  const [guardandoManual, setGuardandoManual] = React.useState(false);

  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Validar que solo se procesen meses con amarre validado
  const mesesValidados = React.useMemo(() => {
    const validados = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${ejercicio}-${String(m).padStart(2, '0')}`;
      validados[m] = amarresValidados[key]?.validado === true;
    }
    return validados;
  }, [amarresValidados, ejercicio]);

  const mesesHabilitados = Object.entries(mesesValidados).filter(([_, v]) => v).map(([m]) => parseInt(m));

  // Valores tomados directamente del Anexo de IVA guardado al validar el amarre del mes
  // (ver " Ejecutar"). No se calculan desde cuentas de la balanza.
  const calcularConceptoMensual = (conceptoKey, mes) => {
    if (!mesesValidados[mes]) return 0;
    const datosMes = (anexoIvaAnual && anexoIvaAnual[mes]) || {};
    // Fuente principal: valores del Anexo guardados al validar el amarre.
    if (Object.prototype.hasOwnProperty.call(datosMes, conceptoKey)) {
      return Number(datosMes[conceptoKey]) || 0;
    }

    // Respaldo para empresas/meses antiguos: si el Anexo no quedó almacenado
    // (por ejemplo, una validación hecha con una versión anterior), usamos la
    // configuración de cuentas de IVA de esa empresa. Así el papel no se queda
    // vacío solo porque falte la cédula persistida.
    const regla = config?.iva?.[conceptoKey];
    if (regla?.cuentas?.length) {
      try {
        return Number(aplicarOperacion(regla.cuentas, regla.operacion || 'abonos', balanzaAnual[mes] || [])) || 0;
      } catch (e) {
        console.warn('No se pudo calcular respaldo de IVA', conceptoKey, mes, e);
      }
    }
    return 0;
  };

  // Estructura del papel de trabajo IVA
  const estructuraIVA = {
    // SECCIÓN 1: INGRESOS
    ingresos: {
      titulo: 'INGRESOS',
      color: '#1565c0',
      colorClaro: '#e3f2fd',
      filas: [
        { key: 'ingresos_gravados_16', label: 'Ingresos Gravados al 16%' },
        { key: 'ingresos_gravados_11', label: 'Ingresos Gravados al 11%' },
        { key: 'ingresos_gravados_0', label: 'Ingresos Gravados al 0%' },
        { key: 'ingresos_exentos', label: 'Ingresos Exentos' },
        { key: 'ingresos_gravados_15', label: 'Ingresos Gravados al 15%' },
        { key: 'ingresos_gravados_10', label: 'Ingresos Gravados al 10%' },
        { key: 'otras_bases_ingresos', label: 'Otras Bases' }
      ],
      totalLabel: 'Total Ingresos'
    },
    // SECCIÓN 2: IVA TRASLADADO
    iva_trasladado: {
      titulo: 'IVA CAUSADO (TRASLADADO)',
      color: '#c62828',
      colorClaro: '#ffebee',
      filas: [
        { key: 'iva_trasladado_16', label: 'IVA Trasladado al 16%' },
        { key: 'iva_trasladado_11', label: 'IVA Trasladado al 11%' },
        { key: 'iva_trasladado_0', label: 'IVA Trasladado al 0%' },
        { key: 'iva_exento', label: 'IVA Exento' },
        { key: 'iva_trasladado_15', label: 'IVA Trasladado al 15%' },
        { key: 'iva_trasladado_10', label: 'IVA Trasladado al 10%' },
        { key: 'iva_otras_bases', label: 'IVA Otras Bases' },
        { key: 'iva_retenido', label: 'IVA Retenido' }
      ],
      totalLabel: 'Total IVA Trasladado'
    },
    // SECCIÓN 3: BASES ACREDITABLES
    bases_acreditable: {
      titulo: 'BASES GRAVABLES ACREDITABLES',
      color: '#6a1b9a',
      colorClaro: '#f3e5f5',
      filas: [
        { key: 'base_acreditable_16', label: 'Base gravable al 16%' },
        { key: 'base_acreditable_11', label: 'Base gravable al 11%' },
        { key: 'base_acreditable_0', label: 'Base gravable al 0%' },
        { key: 'base_acreditable_exenta', label: 'Base gravable exenta' },
        { key: 'base_acreditable_15', label: 'Base gravable al 15%' },
        { key: 'base_acreditable_10', label: 'Base gravable al 10%' },
        { key: 'base_otras', label: 'Otras bases' }
      ],
      totalLabel: 'Total Base IVA Acreditable'
    },
    // SECCIÓN 4: IVA ACREDITABLE
    iva_acreditable: {
      titulo: 'IVA ACREDITABLE',
      color: '#2e7d32',
      colorClaro: '#e8f5e9',
      filas: [
        { key: 'iva_acreditable_16', label: 'IVA Acreditable al 16%' },
        { key: 'iva_acreditable_11', label: 'IVA Acreditable al 11%' },
        { key: 'iva_acreditable_15', label: 'IVA Acreditable al 15%' },
        { key: 'iva_acreditable_10', label: 'IVA Acreditable al 10%' },
        { key: 'iva_acreditable_otras', label: 'IVA Otras Bases' },
        { key: 'iva_retenido_acreditable', label: 'IVA Retenido' },
        { key: 'iva_retenido_anteriores', label: 'IVA Retenido Meses Anteriores' }
      ],
      totalLabel: 'Total IVA Acreditable'
    }
  };

  // Calcular todos los valores
  const valores = React.useMemo(() => {
    const v = {};
    for (let mes = 1; mes <= 12; mes++) {
      v[mes] = {};
      // Ingresos
      v[mes].ingresos_gravados_16 = calcularConceptoMensual('ingresos_gravados_16', mes);
      v[mes].ingresos_gravados_11 = calcularConceptoMensual('ingresos_gravados_11', mes);
      v[mes].ingresos_gravados_0 = calcularConceptoMensual('ingresos_gravados_0', mes);
      v[mes].ingresos_exentos = calcularConceptoMensual('ingresos_exentos', mes);
      v[mes].ingresos_gravados_15 = calcularConceptoMensual('ingresos_gravados_15', mes);
      v[mes].ingresos_gravados_10 = calcularConceptoMensual('ingresos_gravados_10', mes);
      v[mes].otras_bases_ingresos = calcularConceptoMensual('otras_bases_ingresos', mes);
      v[mes].total_ingresos =
        v[mes].ingresos_gravados_16 + v[mes].ingresos_gravados_11 + v[mes].ingresos_gravados_0 +
        v[mes].ingresos_exentos + v[mes].ingresos_gravados_15 + v[mes].ingresos_gravados_10 +
        v[mes].otras_bases_ingresos;

      // IVA Trasladado
      v[mes].iva_trasladado_16 = calcularConceptoMensual('iva_trasladado_16', mes);
      v[mes].iva_trasladado_11 = calcularConceptoMensual('iva_trasladado_11', mes);
      v[mes].iva_trasladado_0 = calcularConceptoMensual('iva_trasladado_0', mes);
      v[mes].iva_exento = calcularConceptoMensual('iva_exento', mes);
      v[mes].iva_trasladado_15 = calcularConceptoMensual('iva_trasladado_15', mes);
      v[mes].iva_trasladado_10 = calcularConceptoMensual('iva_trasladado_10', mes);
      v[mes].iva_otras_bases = calcularConceptoMensual('iva_otras_bases', mes);
      v[mes].iva_retenido = calcularConceptoMensual('iva_retenido', mes);
      v[mes].total_iva_trasladado =
        v[mes].iva_trasladado_16 + v[mes].iva_trasladado_11 + v[mes].iva_trasladado_0 +
        v[mes].iva_exento + v[mes].iva_trasladado_15 + v[mes].iva_trasladado_10 +
        v[mes].iva_otras_bases + v[mes].iva_retenido;

      // Bases Acreditable
      v[mes].base_acreditable_16 = calcularConceptoMensual('base_acreditable_16', mes);
      v[mes].base_acreditable_11 = calcularConceptoMensual('base_acreditable_11', mes);
      v[mes].base_acreditable_0 = calcularConceptoMensual('base_acreditable_0', mes);
      v[mes].base_acreditable_exenta = calcularConceptoMensual('base_acreditable_exenta', mes);
      v[mes].base_acreditable_15 = calcularConceptoMensual('base_acreditable_15', mes);
      v[mes].base_acreditable_10 = calcularConceptoMensual('base_acreditable_10', mes);
      v[mes].base_otras = calcularConceptoMensual('base_otras', mes);
      v[mes].total_bases =
        v[mes].base_acreditable_16 + v[mes].base_acreditable_11 + v[mes].base_acreditable_0 +
        v[mes].base_acreditable_exenta + v[mes].base_acreditable_15 + v[mes].base_acreditable_10 +
        v[mes].base_otras;

      // IVA Acreditable
      v[mes].iva_acreditable_16 = calcularConceptoMensual('iva_acreditable_16', mes);
      v[mes].iva_acreditable_11 = calcularConceptoMensual('iva_acreditable_11', mes);
      v[mes].iva_acreditable_15 = calcularConceptoMensual('iva_acreditable_15', mes);
      v[mes].iva_acreditable_10 = calcularConceptoMensual('iva_acreditable_10', mes);
      v[mes].iva_acreditable_otras = calcularConceptoMensual('iva_acreditable_otras', mes);
      v[mes].iva_retenido_acreditable = calcularConceptoMensual('iva_retenido_acreditable', mes);
      v[mes].iva_retenido_anteriores = calcularConceptoMensual('iva_retenido_anteriores', mes);
      v[mes].total_iva_acreditable =
        v[mes].iva_acreditable_16 + v[mes].iva_acreditable_11 + v[mes].iva_acreditable_15 +
        v[mes].iva_acreditable_10 + v[mes].iva_acreditable_otras +
        v[mes].iva_retenido_acreditable + v[mes].iva_retenido_anteriores;

      // DETERMINACIÓN
      v[mes].iva_cargo_periodo = v[mes].total_iva_trasladado - v[mes].total_iva_acreditable;
      v[mes].iva_favor_periodo = v[mes].iva_cargo_periodo < 0 ? Math.abs(v[mes].iva_cargo_periodo) : 0;
      v[mes].iva_cargo_periodo = Math.max(0, v[mes].iva_cargo_periodo);

      // Aplicar saldo a favor
      let saldoDisp = mes === 1 ? saldoFavorAnterior : (nuevoSaldoFavor[mes - 1] || 0);
      saldoDisp += (saldoFavorAplicado[mes] || 0);

      if (v[mes].iva_cargo_periodo > 0 && saldoDisp > 0) {
        const aplica = Math.min(v[mes].iva_cargo_periodo, saldoDisp);
        v[mes].iva_cargo_periodo -= aplica;
        saldoDisp -= aplica;
      }

      v[mes].iva_pendiente_acreditar = saldoDisp;
      v[mes].nuevo_saldo_favor = v[mes].iva_favor_periodo;
    }
    return v;
    // anexoIvaAnual y mesesValidados llegan vía fetch async (cargarAnexoIvaAnual /
    // cargarAmarresValidados) DESPUÉS del primer render, cuando balanzaAnual/config
    // ya no vuelven a cambiar. Si no están en las dependencias, este useMemo se queda
    // con el snapshot inicial (anexoIvaAnual={} y mesesValidados=todo false) y el
    // Papel de Trabajo de IVA se queda en ceros aunque los datos ya se hayan cargado:
    // esa era la causa de que no se llenara automáticamente.
  }, [balanzaAnual, config, saldoFavorAnterior, saldoFavorAplicado, anexoIvaAnual, mesesValidados]);

  const formatNum = (n) => {
    if (n === 0 || n === undefined || n === null) return '';
    return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ── CAPTURA MANUAL (meses anteriores a la implementación del sistema) ──
  // Para meses en los que no se subirá balanza/Anexo (porque el sistema entró en
  // uso hasta junio/julio 2026, por ejemplo), se puede capturar aquí directamente
  // el resultado final de cada uno de los 29 conceptos. Al guardar, se marca ese
  // mes como "validado" para que aparezca igual que los meses automáticos.
  const abrirCapturaManual = (mes) => {
    const existente = (anexoIvaAnual && anexoIvaAnual[mes]) || {};
    const inicial = {};
    Object.keys(CONFIG_DEFAULT.iva).forEach(k => { inicial[k] = existente[k] || ''; });
    setFormManual(inicial);
    setMesManual(mes);
  };

  const guardarCapturaManual = async () => {
    if (!mesManual) return;
    setGuardandoManual(true);
    try {
      const datos = {};
      Object.keys(CONFIG_DEFAULT.iva).forEach(k => { datos[k] = parseFloat(formManual[k]) || 0; });
      await onGuardarManual(mesManual, datos);
      setMesManual(null);
    } catch (e) {
      alert(' Error al guardar la captura manual: ' + e.message);
    } finally {
      setGuardandoManual(false);
    }
  };

  const renderCapturaManual = () => {
    const mesesSinValidar = Array.from({ length: 12 }, (_, i) => i + 1).filter(m => !mesesValidados[m]);
    return (
      <div style={{ marginBottom: 20, border: '1px dashed #9575cd', borderRadius: 8, padding: 14, background: '#f5f3ff' }}>
        <div style={{ fontWeight: 'bold', color: '#4527a0', marginBottom: 6 }}>
           Captura manual de meses anteriores
        </div>
        <p style={{ fontSize: 12, color: '#5e548e', marginBottom: 10 }}>
          Para meses previos a que empezaras a usar el sistema (sin balanza ni Anexo que subir), captura aquí
          directamente el resultado final de cada concepto. Al guardar, el mes queda marcado como válido y se
          muestra igual que los demás.
        </p>
        {mesesSinValidar.length === 0 ? (
          <p style={{ fontSize: 12, color: '#2e7d32' }}> Los 12 meses del ejercicio ya están capturados/validados.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {mesesSinValidar.map(m => (
              <button key={m} onClick={() => abrirCapturaManual(m)}
                style={{
                  padding: '6px 14px', background: '#fff', border: '1px solid #9575cd', borderRadius: 6,
                  color: '#4527a0', fontSize: 12, cursor: 'pointer', fontWeight: 600
                }}>
                {MESES[m - 1]} {ejercicio}
              </button>
            ))}
          </div>
        )}

        {mesManual && (
          <div style={{ marginTop: 16, background: '#fff', border: '1px solid #d1c4e9', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, color: '#1a237e' }}>Captura manual — {MESES[mesManual - 1]} {ejercicio}</h4>
              <button onClick={() => setMesManual(null)} style={{ border: 'none', background: 'none', fontSize: 16, cursor: 'pointer', color: '#999' }}></button>
            </div>
            {Object.entries(estructuraIVA).map(([secKey, sec]) => (
              <div key={secKey} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 'bold', fontSize: 12, color: '#1a237e', marginBottom: 4 }}>{sec.titulo}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 6 }}>
                  {sec.filas.map(fila => (
                    <React.Fragment key={fila.key}>
                      <label style={{ fontSize: 12, color: '#333', alignSelf: 'center' }}>{fila.label}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formManual[fila.key] ?? ''}
                        onChange={e => setFormManual(prev => ({ ...prev, [fila.key]: e.target.value }))}
                        style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, textAlign: 'right' }}
                        placeholder="0.00"
                      />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button onClick={() => setMesManual(null)} style={{ padding: '8px 18px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarCapturaManual} disabled={guardandoManual}
                style={{ padding: '8px 18px', border: 'none', borderRadius: 6, background: '#4527a0', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                {guardandoManual ? 'Guardando…' : ' Guardar y marcar como validado'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSeccion = (seccionKey, seccionData) => {
    const colorSec = seccionData.color || '#1a237e';
    const colorClaro = seccionData.colorClaro || '#e8eaf6';
    return (
      <div style={{ marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.12)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{
          background: colorSec,
          color: '#fff',
          padding: '12px 16px',
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: 0.3
        }}>
          {seccionData.titulo}
        </div>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: colorClaro }}>
              <th style={{
                padding: '9px 12px', textAlign: 'left', width: 260, minWidth: 260,
                border: '1px solid #d0d0d0', position: 'sticky', left: 0, background: colorClaro, zIndex: 2,
                color: colorSec, fontWeight: 800
              }}>Concepto</th>
              {MESES.map((m, i) => (
                <th key={i} style={{
                  padding: '8px 4px',
                  textAlign: 'right',
                  border: '1px solid #d0d0d0',
                  width: 92,
                  minWidth: 92,
                  fontWeight: 700,
                  background: mesesValidados[i + 1] ? colorClaro : '#fce4e4',
                  color: mesesValidados[i + 1] ? '#222' : '#b71c1c'
                }}>
                  {m}
                  {!mesesValidados[i + 1] && <span style={{ fontSize: 9, display: 'block', fontWeight: 700 }}> Sin validar</span>}
                </th>
              ))}
              <th style={{
                padding: '9px 12px', textAlign: 'right', border: '1px solid #d0d0d0',
                background: colorSec, color: '#fff', width: 120, minWidth: 120,
                position: 'sticky', right: 0
              }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {seccionData.filas.map((fila, idx) => {
              const total = MESES.reduce((sum, _, i) => sum + (valores[i + 1]?.[fila.key] || 0), 0);
              const bgFila = idx % 2 === 0 ? '#fff' : '#f7f7fa';
              return (
                <tr key={fila.key} style={{ background: bgFila }}>
                  <td style={{
                    padding: '7px 12px', border: '1px solid #e6e6e6', fontSize: 12.5,
                    position: 'sticky', left: 0, background: bgFila, zIndex: 1, fontWeight: 600, color: '#333'
                  }}>
                    {fila.label}
                    <button
                      onClick={() => setDetalleVisible(prev => ({ ...prev, [fila.key]: !prev[fila.key] }))}
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        padding: '2px 6px',
                        background: '#e3f2fd',
                        border: '1px solid #90caf9',
                        borderRadius: 3,
                        cursor: 'pointer'
                      }}
                    >
                      {detalleVisible[fila.key] ? '▲' : '▼'} Cuentas
                    </button>
                  </td>
                  {MESES.map((_, i) => (
                    <td key={i} style={{
                      padding: '7px 8px',
                      textAlign: 'right',
                      border: '1px solid #ececec',
                      fontFamily: 'monospace',
                      fontSize: 12.5,
                      fontWeight: 600,
                      background: mesesValidados[i + 1] ? 'transparent' : '#fff7f7',
                      color: mesesValidados[i + 1] ? '#1a1a1a' : '#c9a0a0'
                    }}>
                      {formatNum(valores[i + 1]?.[fila.key])}
                    </td>
                  ))}
                  <td style={{
                    padding: '7px 12px',
                    textAlign: 'right',
                    border: '1px solid #d0d0d0',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    background: colorClaro,
                    color: colorSec,
                    position: 'sticky', right: 0
                  }}>
                    {formatNum(total)}
                  </td>
                </tr>
              );
            })}
            {/* Fila de total */}
            <tr style={{ background: colorSec, fontWeight: 800 }}>
              <td style={{
                padding: '9px 12px', border: '1px solid ' + colorSec, color: '#fff',
                position: 'sticky', left: 0, background: colorSec, zIndex: 1
              }}>{seccionData.totalLabel}</td>
              {MESES.map((_, i) => {
                const totalMes = seccionData.filas.reduce((sum, f) => sum + (valores[i + 1]?.[f.key] || 0), 0);
                return (
                  <td key={i} style={{
                    padding: '7px 8px',
                    textAlign: 'right',
                    border: '1px solid ' + colorSec,
                    fontFamily: 'monospace',
                    color: '#fff'
                  }}>
                    {formatNum(totalMes)}
                  </td>
                );
              })}
              <td style={{
                padding: '9px 12px',
                textAlign: 'right',
                border: '1px solid ' + colorSec,
                fontFamily: 'monospace',
                background: '#000',
                color: '#fff',
                position: 'sticky', right: 0,
                opacity: 0.85
              }}>
                {formatNum(seccionData.filas.reduce((sum, f) => {
                  return sum + MESES.reduce((s, _, i) => s + (valores[i + 1]?.[f.key] || 0), 0);
                }, 0))}
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    );
  };

  const renderDeterminacion = () => {
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{
          background: '#2e7d32',
          color: '#fff',
          padding: '10px 16px',
          fontWeight: 'bold',
          fontSize: 14,
          borderRadius: '4px 4px 0 0'
        }}>
          DETERMINACIÓN DEL IVA
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#e8f5e9' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', width: 280, border: '1px solid #a5d6a7' }}>Concepto</th>
              {MESES.map((m, i) => (
                <th key={i} style={{
                  padding: '6px 4px',
                  textAlign: 'right',
                  border: '1px solid #a5d6a7',
                  width: 90,
                  background: mesesValidados[i + 1] ? '#e8f5e9' : '#ffebee'
                }}>{m}</th>
              ))}
              <th style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #a5d6a7', background: '#a5d6a7', width: 110 }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {[
              { key: 'iva_cargo_periodo', label: 'IVA a cargo del periodo', style: { color: '#c62828', fontWeight: 'bold' } },
              { key: 'iva_favor_periodo', label: 'IVA a favor del periodo', style: { color: '#2e7d32' } },
              { key: 'iva_pendiente_acreditar', label: 'IVA pendiente por acreditar', style: { color: '#ff9800' } },
              { key: 'nuevo_saldo_favor', label: 'Nuevo saldo a favor', style: { color: '#1565c0', fontWeight: 'bold' } }
            ].map((fila, idx) => {
              const total = MESES.reduce((sum, _, i) => sum + (valores[i + 1]?.[fila.key] || 0), 0);
              return (
                <tr key={fila.key} style={{ background: idx % 2 === 0 ? '#fff' : '#f1f8e9' }}>
                  <td style={{ padding: '6px 12px', border: '1px solid #e0e0e0', ...fila.style }}>{fila.label}</td>
                  {MESES.map((_, i) => (
                    <td key={i} style={{
                      padding: '6px 8px',
                      textAlign: 'right',
                      border: '1px solid #e0e0e0',
                      fontFamily: 'monospace',
                      ...fila.style,
                      color: mesesValidados[i + 1] ? (fila.style.color || '#333') : '#bbb'
                    }}>
                      {formatNum(valores[i + 1]?.[fila.key])}
                    </td>
                  ))}
                  <td style={{
                    padding: '6px 12px',
                    textAlign: 'right',
                    border: '1px solid #a5d6a7',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    background: '#e8f5e9',
                    ...fila.style
                  }}>
                    {formatNum(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const [exportandoIVA, setExportandoIVA] = React.useState(false);

  const construirHojaIVA = (wb, logoId) => {
      const numCols = 2 + MESES.length; // Concepto + 12 meses + Total
      const ws = wb.addWorksheet('Cédula IVA', {
        views: [{ showGridLines: false }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 } }
      });
      agregarEncabezadoHoja(ws, logoId, {
        empresa: empresa.nombre, titulo: 'PAPEL DE TRABAJO DE IVA',
        subtitulo: `Ejercicio ${ejercicio} · Meses validados: ${mesesHabilitados.length}/12 · Cifras en pesos mexicanos`,
        numCols
      });
      ws.columns = [{ width: 38 }, ...MESES.map(() => ({ width: 13 })), { width: 15 }];

      const headerRowIdx = 7;
      const headerRow = ws.getRow(headerRowIdx);
      headerRow.values = ['Concepto', ...MESES.map(m => m.slice(0, 3)), 'Total'];
      estiloEncabezadoTabla(headerRow, numCols);

      let fila = headerRowIdx + 1;
      const filasConceptoPorKey = {};

      Object.entries(estructuraIVA).forEach(([key, seccion]) => {
        // Título de sección
        ws.mergeCells(fila, 1, fila, numCols);
        const tCell = ws.getCell(fila, 1);
        tCell.value = seccion.titulo;
        tCell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: EXCEL_COLOR.white } };
        tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.navy } };
        tCell.alignment = { vertical: 'middle', indent: 1 };
        ws.getRow(fila).height = 18;
        fila++;

        const filasDeEstaSeccion = [];
        seccion.filas.forEach((f, idxFila) => {
          const row = ws.getRow(fila);
          row.getCell(1).value = f.label;
          row.getCell(1).font = { name: 'Calibri', size: 11 };
          MESES.forEach((_, i) => {
            const cell = row.getCell(2 + i);
            cell.value = valores[i + 1]?.[f.key] || 0;
            cell.numFmt = EXCEL_MONEDA; cell.font = { name: 'Calibri', size: 11 }; cell.alignment = { horizontal: 'right' };
          });
          const c1 = ws.getCell(fila, 2).address, c2 = ws.getCell(fila, 1 + MESES.length).address;
          const totalCell = row.getCell(2 + MESES.length);
          totalCell.value = { formula: `SUM(${c1}:${c2})` };
          totalCell.numFmt = EXCEL_MONEDA; totalCell.font = { name: 'Calibri', size: 11 }; totalCell.alignment = { horizontal: 'right' };
          if (idxFila % 2 === 1) sombreadoAlterno(row, numCols);
          filasDeEstaSeccion.push(fila);
          filasConceptoPorKey[f.key] = fila;
          fila++;
        });

        // Total de la sección: FÓRMULA que suma las filas de concepto de arriba, por mes y en Total
        const rowTotal = ws.getRow(fila);
        rowTotal.getCell(1).value = seccion.totalLabel;
        rowTotal.getCell(1).font = { name: 'Calibri', bold: true, size: 11 };
        for (let i = 0; i < MESES.length; i++) {
          const col = 2 + i;
          const refs = filasDeEstaSeccion.map(f => ws.getCell(f, col).address).join('+');
          const cell = rowTotal.getCell(col);
          cell.value = { formula: refs || '0' }; cell.numFmt = EXCEL_MONEDA; cell.font = { name: 'Calibri', bold: true, size: 11 }; cell.alignment = { horizontal: 'right' };
        }
        const colTotalGlobal = 2 + MESES.length;
        const refsTotal = filasDeEstaSeccion.map(f => ws.getCell(f, colTotalGlobal).address).join('+');
        const cellTotalGlobal = rowTotal.getCell(colTotalGlobal);
        cellTotalGlobal.value = { formula: refsTotal || '0' }; cellTotalGlobal.numFmt = EXCEL_MONEDA; cellTotalGlobal.font = { name: 'Calibri', bold: true, size: 11 }; cellTotalGlobal.alignment = { horizontal: 'right' };
        for (let c = 1; c <= numCols; c++) {
          rowTotal.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.lavender } };
          rowTotal.getCell(c).border = { top: { style: 'thin', color: { argb: EXCEL_COLOR.purple } } };
        }
        fila += 2; // renglón de la sección + un espacio
      });

      // ══ DETERMINACIÓN DEL IVA ══
      ws.mergeCells(fila, 1, fila, numCols);
      const dCell = ws.getCell(fila, 1);
      dCell.value = 'DETERMINACIÓN DEL IVA';
      dCell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: EXCEL_COLOR.white } };
      dCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.orangeDark } };
      dCell.alignment = { vertical: 'middle', indent: 1 };
      ws.getRow(fila).height = 18;
      fila++;

      const labelsDet = {
        iva_cargo_periodo: 'IVA a cargo del periodo',
        iva_favor_periodo: 'IVA a favor del periodo',
        iva_pendiente_acreditar: 'IVA pendiente por acreditar',
        nuevo_saldo_favor: 'Nuevo saldo a favor'
      };
      ['iva_cargo_periodo', 'iva_favor_periodo', 'iva_pendiente_acreditar', 'nuevo_saldo_favor'].forEach((key, idx) => {
        const row = ws.getRow(fila);
        row.getCell(1).value = labelsDet[key];
        const esFinal = idx === 3;
        row.getCell(1).font = { name: 'Calibri', size: 11, bold: esFinal };
        let total = 0;
        MESES.forEach((_, i) => {
          const cell = row.getCell(2 + i);
          const v = valores[i + 1]?.[key] || 0;
          cell.value = v; total += v;
          cell.numFmt = EXCEL_MONEDA; cell.font = { name: 'Calibri', size: 11, bold: esFinal }; cell.alignment = { horizontal: 'right' };
        });
        const c1 = ws.getCell(fila, 2).address, c2 = ws.getCell(fila, 1 + MESES.length).address;
        const totalCell = row.getCell(2 + MESES.length);
        totalCell.value = { formula: `SUM(${c1}:${c2})` };
        totalCell.numFmt = EXCEL_MONEDA; totalCell.font = { name: 'Calibri', size: 11, bold: esFinal }; totalCell.alignment = { horizontal: 'right' };
        if (esFinal) { estiloFilaTotal(row, numCols, total < 0); }
        fila++;
      });

      agregarPieHoja(ws, fila + 1, numCols);
      return ws;
  };

  // Expone la función al componente padre para la descarga combinada
  // ISR + IVA en un solo archivo (ver botón "Descargar ambos papeles").
  if (exportRef) exportRef.current = construirHojaIVA;

  const exportarExcel = async () => {
    setExportandoIVA(true);
    try {
      const { wb, logoId } = await crearLibroExcel();
      construirHojaIVA(wb, logoId);
      await descargarLibroExcel(wb, `Cedula_IVA_${empresa.nombre}_${ejercicio}.xlsx`);
    } catch (e) {
      alert(' Error al generar el Excel: ' + e.message);
      console.error(e);
    } finally {
      setExportandoIVA(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: '#1a237e', margin: 0 }}> Papel de Trabajo IVA — {empresa.nombre}</h2>
          <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0 0' }}>
            Ejercicio: {ejercicio} | Meses validados: {mesesHabilitados.length}/12
            {mesesHabilitados.length < 12 && (
              <span style={{ color: '#c62828', marginLeft: 8 }}>
                 Solo se muestran datos de meses con amarre de balanza validado
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: '#555' }}>
            Saldo a favor anterior:
            <input
              type="number"
              value={saldoFavorAnterior}
              onChange={e => setSaldoFavorAnterior(parseFloat(e.target.value) || 0)}
              style={{ marginLeft: 8, padding: '4px 8px', width: 120, border: '1px solid #ccc', borderRadius: 4 }}
            />
          </label>
          <button
            onClick={exportarExcel}
            disabled={exportandoIVA}
            style={{
              padding: '10px 24px',
              background: '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {exportandoIVA ? ' Generando…' : ' Exportar a Excel'}
          </button>
        </div>
      </div>

      {renderCapturaManual()}

      {mesesHabilitados.length === 0 ? (
        <div style={{
          padding: 40,
          textAlign: 'center',
          background: '#fff3e0',
          borderRadius: 8,
          border: '2px dashed #ff9800'
        }}>
          <h3 style={{ color: '#e65100' }}> No hay meses validados</h3>
          <p>Valida el amarre de balanza para los periodos que quieras incluir en " Ejecutar", o usa la
            captura manual de arriba para meses anteriores a la implementación del sistema.</p>
        </div>
      ) : (
        <>
          {renderSeccion('ingresos', estructuraIVA.ingresos)}
          {renderSeccion('iva_trasladado', estructuraIVA.iva_trasladado)}
          {renderSeccion('bases_acreditable', estructuraIVA.bases_acreditable)}
          {renderSeccion('iva_acreditable', estructuraIVA.iva_acreditable)}
          {renderDeterminacion()}
        </>
      )}
    </div>
  );
}
