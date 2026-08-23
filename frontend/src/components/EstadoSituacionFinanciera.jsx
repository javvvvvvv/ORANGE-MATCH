import React, { useState, useEffect, useRef, useCallback } from 'react';
import { calcularDetalleCategoriaBalance, calcularResidualesPorFila, normCuenta, obtenerAncestroMayor } from '../lib/balanza.js';

export function EstadoSituacionFinanciera({ empresa, balanzaMes, catalogoCuentas, mes, ejercicio, utilidadEjercicio }) {
  const mapaCat = React.useMemo(() => {
    const m = {}; (catalogoCuentas || []).forEach(c => m[normCuenta(c.codigo)] = c); return m;
  }, [catalogoCuentas]);

  const sinClasificarRef = React.useRef([]);

  // El Estado de Situación Financiera es una FOTOGRAFÍA al corte del mes: usa el
  // saldo final (acumulado), no solo los movimientos (cargos/abonos) de ese mes.
  // Si la balanza no trae saldo final (archivos antiguos), se usa cargos-abonos
  // como respaldo, aunque solo es exacto para el primer mes del ejercicio.
  const modoSF = React.useMemo(() => {
    const conSF = (balanzaMes || []).some(f => f.sf_d !== undefined || f.sf_a !== undefined);
    return conSF ? 'saldo' : 'movimiento';
  }, [balanzaMes]);
  const residuales = React.useMemo(
    () => calcularResidualesPorFila(balanzaMes, mapaCat, modoSF),
    [balanzaMes, mapaCat, modoSF]
  );

  const calcularGrupo = (categoriaEF) => {
    // Detecta cuentas sin clasificar (para el aviso en pantalla). El monto en
    // sí se calcula con calcularDetalleCategoriaBalance, la MISMA función que
    // usan todas las hojas exportadas a Excel, para que Activo Circulante/No
    // Circulante, Pasivo y Capital siempre coincidan entre pantalla y Excel.
    for (const fila of (balanzaMes || [])) {
      const codNorm = normCuenta(fila.cuenta);
      if (!mapaCat[codNorm]) { sinClasificarRef.current.push(fila); continue; }
      const mayor = obtenerAncestroMayor(codNorm, mapaCat);
      if (!mayor) { sinClasificarRef.current.push(fila); continue; }
      if (!mayor.categoriaEF && mayor.tipo !== 'K') { sinClasificarRef.current.push(fila); continue; }
    }
    return calcularDetalleCategoriaBalance(balanzaMes, mapaCat, categoriaEF);
  };

  sinClasificarRef.current = [];
  const activoCirc = calcularGrupo('activo_circulante');
  const activoNoCirc = calcularGrupo('activo_no_circulante');
  const pasivoCorto = calcularGrupo('pasivo_corto_plazo');
  const pasivoLargo = calcularGrupo('pasivo_largo_plazo');
  const capitalCont = calcularGrupo('capital_contribuido');
  const capitalGanBase = calcularGrupo('capital_ganado');
  // ── FUNDAMENTAL: la Utilidad (o Pérdida) del Ejercicio que arroja el Estado de
  // Resultados se acumula dentro del Capital Ganado del Balance. Sin esto el
  // Balance NUNCA cuadra en un ejercicio que sigue abierto (no se ha hecho el
  // cierre contable formal), porque el resultado del periodo todavía no está
  // registrado como tal en ninguna cuenta de capital de la balanza.
  const utilidadNum = Number(utilidadEjercicio) || 0;
  const capitalGan = {
    total: capitalGanBase.total + utilidadNum,
    detalle: [
      ...capitalGanBase.detalle,
      ...(utilidadNum !== 0 ? [{ codigo: '', nombre: 'Utilidad (Pérdida) del Ejercicio', saldo: utilidadNum }] : [])
    ]
  };
  const cuentasSinClasificar = React.useMemo(() => {
    const vistos = new Set();
    return sinClasificarRef.current.filter(f => {
      const k = normCuenta(f.cuenta);
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }, [balanzaMes, catalogoCuentas]);

  const totalActivo = activoCirc.total + activoNoCirc.total;
  const totalPasivo = pasivoCorto.total + pasivoLargo.total;
  const totalCapital = capitalCont.total + capitalGan.total;
  const pasivoCapital = totalPasivo + totalCapital;
  const cuadra = Math.abs(totalActivo - pasivoCapital) < 1;
  const gruposDesajustados = residuales.__avisosGrupo || [];
  const codigosDuplicados = residuales.__avisosDuplicados || [];

  // Formato NIF: los negativos se muestran entre paréntesis, no con signo menos
  const formatNum = (n) => {
    const abs = Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `(${abs})` : abs;
  };

  const renderLinea = (label, valor, nivel = 0, esTotal = false, esSubtotal = false) => (
    <div key={label} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: esTotal ? '10px 16px' : '7px 16px',
      paddingLeft: 16 + nivel * 22,
      background: esTotal ? 'rgba(255,107,43,.12)' : esSubtotal ? 'rgba(255,255,255,.03)' : 'transparent',
      borderTop: esTotal ? '2px solid var(--orange)' : esSubtotal ? '1px solid #374151' : 'none',
      borderBottom: esTotal ? '2px solid var(--orange)' : 'none'
    }}>
      <span style={{
        fontSize: esTotal ? 14 : 13, fontWeight: esTotal ? 800 : esSubtotal ? 700 : 400,
        color: esTotal ? '#fff' : esSubtotal ? '#e5e7eb' : '#9ca3af'
      }}>{label}</span>
      <span style={{
        fontSize: esTotal ? 14 : 13, fontWeight: esTotal ? 800 : esSubtotal ? 700 : 400,
        fontFamily: 'monospace', color: esTotal ? 'var(--orange)' : valor < 0 ? 'var(--red)' : '#e5e7eb'
      }}>{formatNum(valor)}</span>
    </div>
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #374151' }}>
        <h3 style={{ margin: 0, fontSize: 17, color: '#fff', fontWeight: 800 }}> Estado de Situación Financiera</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
          {empresa.nombre} — {mes || 'Periodo seleccionado'} {ejercicio}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
          Formulado de conformidad con las Normas de Información Financiera (NIF)
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {/* ACTIVO — lado izquierdo */}
        <div style={{ borderRight: '1px solid #374151' }}>
          <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,.05)', fontSize: 12, fontWeight: 800, color: '#9ca3af', letterSpacing: .5 }}>ACTIVO</div>
          {renderLinea('Activo Circulante', activoCirc.total, 0, false, true)}
          {activoCirc.detalle.map(d => renderLinea(d.nombre, d.saldo, 1))}
          {renderLinea('Activo No Circulante', activoNoCirc.total, 0, false, true)}
          {activoNoCirc.detalle.map(d => renderLinea(d.nombre, d.saldo, 1))}
          {renderLinea('Total Activo', totalActivo, 0, true)}
        </div>

        {/* PASIVO + CAPITAL — lado derecho, comparten la columna */}
        <div>
          <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,.05)', fontSize: 12, fontWeight: 800, color: '#9ca3af', letterSpacing: .5 }}>PASIVO</div>
          {renderLinea('Pasivo a Corto Plazo', pasivoCorto.total, 0, false, true)}
          {pasivoCorto.detalle.map(d => renderLinea(d.nombre, d.saldo, 1))}
          {renderLinea('Pasivo a Largo Plazo', pasivoLargo.total, 0, false, true)}
          {pasivoLargo.detalle.map(d => renderLinea(d.nombre, d.saldo, 1))}
          {renderLinea('Total Pasivo', totalPasivo, 0, true)}

          <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,.05)', fontSize: 12, fontWeight: 800, color: '#9ca3af', letterSpacing: .5, marginTop: 4 }}>CAPITAL CONTABLE</div>
          {renderLinea('Capital Contribuido', capitalCont.total, 0, false, true)}
          {capitalCont.detalle.map(d => renderLinea(d.nombre, d.saldo, 1))}
          {renderLinea('Capital Ganado', capitalGan.total, 0, false, true)}
          {capitalGan.detalle.map(d => renderLinea(d.nombre, d.saldo, 1))}
          {renderLinea('Total Capital Contable', totalCapital, 0, true)}

          {renderLinea('Total Pasivo + Capital', pasivoCapital, 0, true)}
        </div>
      </div>

      {/* Validación del balance: Activo debe ser igual a Pasivo + Capital */}
      <div style={{
        padding: '12px 20px',
        background: cuadra ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
        borderTop: '1px solid #374151',
        textAlign: 'center',
        fontWeight: 700,
        fontSize: 13,
        color: cuadra ? 'var(--green)' : 'var(--red)'
      }}>
        {cuadra
          ? ` El Balance cuadra: Activo = Pasivo + Capital (${formatNum(totalActivo)})`
          : ` El Balance NO cuadra — diferencia de ${formatNum(Math.abs(totalActivo - pasivoCapital))}.`
        }
      </div>
      {!cuadra && gruposDesajustados.length > 0 && (
        <div className="alert alert-warn" style={{ margin: '12px 20px', fontSize: 12 }}>
           <b>Causa probable encontrada:</b> {gruposDesajustados.length === 1 ? 'la siguiente cuenta' : 'las siguientes cuentas'} de agrupación
          (no son cuenta de Mayor, son un total de grupo) no coincide{gruposDesajustados.length === 1 ? '' : 'n'} con la suma de sus propias
          cuentas de Mayor — normalmente significa que la balanza de este mes no trae TODAS las subcuentas de ese grupo, o se exportó con un corte distinto:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {gruposDesajustados.map(g => (
              <li key={g.codigo}>
                <b>{g.codigo}</b> — {g.nombre}: diferencia de <b>{formatNum(Math.abs(g.monto))}</b>
                {g.categoriaEF ? ` (dentro de ${(g.categoriaEF || '').replace(/_/g, ' ')})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {codigosDuplicados.length > 0 && (
        <div className="alert alert-warn" style={{ margin: '12px 20px', fontSize: 12 }}>
           <b>{codigosDuplicados.length} cuenta(s) aparecen repetidas en la balanza subida con montos distintos entre sí</b> (no es un renglón
          duplicado idéntico): {codigosDuplicados.map(d => `${d.codigo} (${d.nombre})`).join(', ')}.
          Solo se está tomando el último renglón de cada una — revisa si el archivo trae dos monedas, dos periodos o dos reportes mezclados.
        </div>
      )}
      {cuentasSinClasificar.length > 0 && (
        <div className="alert alert-warn" style={{ margin: '12px 20px', fontSize: 12 }}>
           {cuentasSinClasificar.length} cuenta(s) de la balanza no se encontraron en el catálogo de cuentas
          (no se incluyeron en este balance): {cuentasSinClasificar.map(c => `${c.cuenta} (${c.nombre})`).join(', ')}.
          Esta es la causa más común de que el balance no cuadre.
        </div>
      )}
    </div>
  );
}
