import React, { useState, useEffect, useRef, useCallback } from 'react';
import { calcularResidualesPorFila, normCuenta, obtenerAncestroMayor } from '../lib/balanza.js';

export function EstadoResultados({ empresa, balanzaMes, catalogoCuentas, mes, ejercicio, modoCalculo }) {
  // modoCalculo: 'movimiento' (por defecto) usa cargos/abonos del periodo tal
  // como viene en la balanza — correcto para ver el flujo de UN mes aislado.
  // 'saldo' usa el saldo final (sf_d/sf_a) de las cuentas de resultados, que
  // es el acumulado real del ejercicio a la fecha de corte (las cuentas de
  // ingresos/costos/gastos no se reinician cada mes, solo se cierran una vez
  // al año) — es el mismo método ya usado para la Utilidad del Ejercicio que
  // se suma en el Balance, así que ambos siempre coinciden entre sí.
  const modo = modoCalculo || 'movimiento';
  const [nivelDetalle, setNivelDetalle] = React.useState(2); // 2 = con detalle por cuenta de mayor (default)

  const mapaCat = React.useMemo(() => {
    const m = {}; (catalogoCuentas || []).forEach(c => m[normCuenta(c.codigo)] = c); return m;
  }, [catalogoCuentas]);

  // Sin cuenta en el catálogo, se reporta como "sin clasificar" para que el
  // contador la note, en vez de excluirla silenciosamente del estado (que es lo
  // que hacía que los totales no cuadraran / salieran mal).
  const sinClasificarRef = React.useRef([]);

  // Se calcula UNA sola vez por balanza (no por categoría) cuánto aporta cada
  // fila sin duplicar lo que ya cuentan sus descendientes, a cualquier
  // profundidad (ver calcularResidualesPorFila).
  const residuales = React.useMemo(
    () => calcularResidualesPorFila(balanzaMes, mapaCat, modo),
    [balanzaMes, mapaCat, modo]
  );

  const calcularGrupo = (categoriaEF) => {
    // Acumula por CUENTA DE MAYOR (no por subcuenta): todas las subcuentas de la
    // balanza que cuelgan de la misma cuenta de Mayor se suman en una sola línea,
    // que es como deben presentarse los Estados Financieros.
    let total = 0;
    const porMayor = {};
    for (const fila of (balanzaMes || [])) {
      const codNorm = normCuenta(fila.cuenta);
      if (!mapaCat[codNorm]) { sinClasificarRef.current.push(fila); continue; }
      const mayor = obtenerAncestroMayor(codNorm, mapaCat);
      if (!mayor) { sinClasificarRef.current.push(fila); continue; }
      if (!mayor.categoriaEF && mayor.tipo !== 'K') { sinClasificarRef.current.push(fila); continue; }
      if ((mayor.categoriaEF || '') !== categoriaEF) continue;
      const valor = residuales[codNorm] || 0;
      total += valor;
      const key = normCuenta(mayor.codigo);
      if (!porMayor[key]) porMayor[key] = { codigo: mayor.codigo, nombre: mayor.nombre, saldo: 0 };
      porMayor[key].saldo += valor;
    }
    return { total, detalle: Object.values(porMayor) };
  };

  sinClasificarRef.current = [];
  const ingresos = calcularGrupo('ingresos');
  const costos = calcularGrupo('costos');
  const gastosOp = calcularGrupo('gastos_operativos');
  const gastosFin = calcularGrupo('gastos_financieros');
  const otrosIng = calcularGrupo('otros_ingresos');
  const otrosGast = calcularGrupo('otros_gastos');
  const cuentasSinClasificar = React.useMemo(() => {
    const vistos = new Set();
    return sinClasificarRef.current.filter(f => {
      const k = normCuenta(f.cuenta);
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }, [balanzaMes, catalogoCuentas]);

  const utilidadBruta = ingresos.total - Math.abs(costos.total);
  const utilidadOperativa = utilidadBruta - Math.abs(gastosOp.total);
  const utilidadAntesImpuestos = utilidadOperativa - Math.abs(gastosFin.total) + otrosIng.total - Math.abs(otrosGast.total);

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
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, color: '#fff', fontWeight: 800 }}> Estado de Resultados
            {modo === 'saldo' && (
              <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#4527a0', color: '#fff', verticalAlign: 'middle' }}>
                ACUMULADO (SALDO)
              </span>
            )}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
            {empresa.nombre} — {mes || 'Periodo seleccionado'} {ejercicio}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
            Formulado de conformidad con las Normas de Información Financiera (NIF)
            {modo === 'saldo' && ' — acumulado del ejercicio a la fecha de corte (saldo final)'}
          </p>
        </div>
        <select className="inp" style={{ width: 'auto', maxWidth: 160 }} value={nivelDetalle} onChange={e => setNivelDetalle(parseInt(e.target.value, 10))}>
          <option value={1}>Solo totales</option>
          <option value={2}>Con detalle de cuentas</option>
        </select>
      </div>

      <div>
        {renderLinea('Ingresos', ingresos.total, 0, true)}
        {nivelDetalle >= 2 && ingresos.detalle.map(d => renderLinea(d.nombre, d.saldo, 1))}

        {renderLinea('Costos', -Math.abs(costos.total), 0, true)}
        {nivelDetalle >= 2 && costos.detalle.map(d => renderLinea(d.nombre, d.saldo, 1))}

        {renderLinea('Utilidad Bruta', utilidadBruta, 0, false, true)}

        {renderLinea('Gastos de Operación', -Math.abs(gastosOp.total), 0, true)}
        {nivelDetalle >= 2 && gastosOp.detalle.map(d => renderLinea(d.nombre, d.saldo, 1))}

        {renderLinea('Utilidad de Operación', utilidadOperativa, 0, false, true)}

        {renderLinea('Otros Ingresos', otrosIng.total, 0, true)}
        {nivelDetalle >= 2 && otrosIng.detalle.map(d => renderLinea(d.nombre, d.saldo, 1))}

        {renderLinea('Gastos Financieros', -Math.abs(gastosFin.total), 0, true)}
        {nivelDetalle >= 2 && gastosFin.detalle.map(d => renderLinea(d.nombre, d.saldo, 1))}

        {renderLinea('Otros Gastos', -Math.abs(otrosGast.total), 0, true)}
        {nivelDetalle >= 2 && otrosGast.detalle.map(d => renderLinea(d.nombre, d.saldo, 1))}

        {renderLinea('Utilidad antes de Impuestos a la Utilidad', utilidadAntesImpuestos, 0, true)}
      </div>
      {cuentasSinClasificar.length > 0 && (
        <div className="alert alert-warn" style={{ margin: '0 20px 16px', fontSize: 12 }}>
           {cuentasSinClasificar.length} cuenta(s) de la balanza no se encontraron en el catálogo de cuentas
          (no se incluyeron en este estado): {cuentasSinClasificar.map(c => `${c.cuenta} (${c.nombre})`).join(', ')}.
          Revisa que el catálogo subido corresponda a esta empresa/ejercicio.
        </div>
      )}
      <div style={{ padding: '10px 20px', fontSize: 11, color: '#6b7280', fontStyle: 'italic', borderTop: '1px solid #374151' }}>
        El Impuesto Sobre la Renta se determina en el Papel de Trabajo de ISR, no en este estado financiero.
      </div>
    </div>
  );
}
