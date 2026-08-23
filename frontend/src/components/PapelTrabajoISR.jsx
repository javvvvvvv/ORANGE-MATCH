import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CONFIG_DEFAULT } from '../lib/configEmpresa.js';
import { EXCEL_COLOR, EXCEL_MONEDA, agregarEncabezadoHoja, agregarPieHoja, crearLibroExcel, descargarLibroExcel, estiloEncabezadoTabla, estiloFilaTotal, sombreadoAlterno } from '../lib/excel.js';
import { MESES } from '../lib/format.js';
import { REGIMENES, calcularResicoPF, calcularTarifa152 } from '../lib/isr.js';
import { aplicarReglas } from '../lib/reglasIva.js';

export function PapelTrabajoISR({ empresa, balanzaAnual, amarresValidados, config, onExportar, ejercicio: ejercicioProp, token, datosFiscales, onGuardarDatosFiscales, isrManualAnual, onGuardarManual, onEliminarManual, exportRef }) {
  const [ejercicio, setEjercicio] = React.useState(ejercicioProp || new Date().getFullYear());
  React.useEffect(() => { if (ejercicioProp) setEjercicio(ejercicioProp); }, [ejercicioProp]);

  // Datos fiscales del ejercicio en turno, ya guardados en " Datos Fiscales" (Configurar Empresa).
  const datosDelAnio = React.useMemo(() =>
    (datosFiscales || []).find(d => Number(d.anio) === Number(ejercicio)), [datosFiscales, ejercicio]);

  const [coeficienteUtilidad, setCoeficienteUtilidad] = React.useState(0);
  const [perdidasPendientes, setPerdidasPendientes] = React.useState(0);
  const [ptuPagada, setPtuPagada] = React.useState(0);
  const [saldoFavorISR, setSaldoFavorISR] = React.useState(0);
  const [regimen, setRegimen] = React.useState('PM_GENERAL');
  const [deduccionCiega, setDeduccionCiega] = React.useState(35); // Para PF honorarios
  const [usarDeduccionCiegaArr, setUsarDeduccionCiegaArr] = React.useState(true); // Arrendamiento: 35% ciego (true) vs deducciones reales (false)
  const [detalleVisible, setDetalleVisible] = React.useState({});
  const [msgFiscal, setMsgFiscal] = React.useState('');
  const [mesManual, setMesManual] = React.useState(null);
  const [formManual, setFormManual] = React.useState({});
  const [guardandoManual, setGuardandoManual] = React.useState(false);

  // Cuando cambia el ejercicio (o llegan los datos fiscales guardados), precargar los valores
  React.useEffect(() => {
    if (datosDelAnio) {
      setRegimen(datosDelAnio.regimen_fiscal || 'PM_GENERAL');
      setCoeficienteUtilidad(datosDelAnio.coeficiente_utilidad || 0);
      setPerdidasPendientes(datosDelAnio.perdidas_fiscales || 0);
      setPtuPagada(datosDelAnio.ptu_pagada || 0);
      setSaldoFavorISR(datosDelAnio.saldo_favor_isr || 0);
      setDeduccionCiega(datosDelAnio.deduccion_ciega ?? 35);
    } else {
      // Sin datos fiscales capturados para este ejercicio: usar valores neutros
      setRegimen('PM_GENERAL');
      setCoeficienteUtilidad(0);
      setPerdidasPendientes(0);
      setPtuPagada(0);
      setSaldoFavorISR(0);
      setDeduccionCiega(35);
    }
  }, [ejercicio, datosDelAnio]);

  const guardarDatosFiscales = async () => {
    try {
      await onGuardarDatosFiscales({
        anio: ejercicio, regimen_fiscal: regimen, coeficiente_utilidad: coeficienteUtilidad,
        perdidas_fiscales: perdidasPendientes, ptu_pagada: ptuPagada, saldo_favor_isr: saldoFavorISR,
        deduccion_ciega: deduccionCiega
      });
      setMsgFiscal(' Datos fiscales del ejercicio ' + ejercicio + ' guardados');
      setTimeout(() => setMsgFiscal(''), 3000);
    } catch (e) {
      setMsgFiscal(' Error al guardar: ' + e.message);
    }
  };

  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const regimenInfo = REGIMENES[regimen] || REGIMENES.PM_GENERAL;

  const mesesValidados = React.useMemo(() => {
    const validados = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${ejercicio}-${String(m).padStart(2, '0')}`;
      validados[m] = amarresValidados[key]?.validado === true;
    }
    return validados;
  }, [amarresValidados, ejercicio]);

  const mesesHabilitados = Object.entries(mesesValidados).filter(([_, v]) => v).map(([m]) => parseInt(m));

  // Calcular valores mensuales: cada cuenta configurada trae su propia operación
  // (cargos / abonos / cargos-abonos / abonos-cargos), igual que en "Configurar IVA".
  // Si el mes tiene captura MANUAL (meses anteriores a usar el sistema), se usa
  // ese valor directamente en vez de calcularlo desde la balanza.
  const calcularConceptoMensual = (conceptoKey, mes) => {
    if (!mesesValidados[mes]) return 0;
    const manual = isrManualAnual && isrManualAnual[mes];
    if (manual) return Number(manual[conceptoKey]) || 0;
    const conf = config?.isr?.[conceptoKey];
    const def = CONFIG_DEFAULT.isr[conceptoKey];
    if (!conf || !conf.reglas || conf.reglas.length === 0) return 0;
    const balanzaMes = balanzaAnual[mes] || [];
    const valor = aplicarReglas(conf.reglas, balanzaMes);
    return valor * (def?.signo || 1);
  };

  // Calcular ISR según régimen
  const valores = React.useMemo(() => {
    const v = {};
    let saldoFavorAcum = saldoFavorISR;
    let perdidasRestantes = perdidasPendientes;

    for (let mes = 1; mes <= 12; mes++) {
      v[mes] = {};

      if (!mesesValidados[mes]) {
        v[mes].validado = false;
        continue;
      }
      v[mes].validado = true;

      // Ingresos
      // Los anticipos de clientes se consideran ingreso COBRADO en el mes en
      // que se reciben (base de efectivo) y NO se difieren — entran aquí, al
      // ingreso del mes, para que se acumulen automáticamente sin importar
      // el régimen fiscal seleccionado (Art. 106 y equivalentes en RESICO,
      // Arrendamiento y Honorarios/Plataformas).
      v[mes].anticipos_clientes = calcularConceptoMensual('anticipos_clientes', mes);
      const esManual = !!(isrManualAnual && isrManualAnual[mes]);
      // En meses calculados desde balanza, el anticipo se suma aparte porque
      // vive en una cuenta distinta a "Ingresos". En meses de captura MANUAL,
      // el contador ya captura el ingreso final (anticipos incluidos), así
      // que aquí NO se vuelve a sumar para no duplicarlo.
      v[mes].ingresos_nominales = calcularConceptoMensual('ingresos_nominales', mes) + (esManual ? 0 : v[mes].anticipos_clientes);
      v[mes].ingresos_acumulables = calcularConceptoMensual('ingresos_acumulables', mes) + (esManual ? 0 : v[mes].anticipos_clientes);

      // Acumulados hasta el mes
      let ingresosNominalesAcum = 0;
      let ingresosAcumulablesAcum = 0;
      for (let i = 1; i <= mes; i++) {
        if (mesesValidados[i]) {
          ingresosNominalesAcum += v[i].ingresos_nominales || 0;
          ingresosAcumulablesAcum += v[i].ingresos_acumulables || 0;
        }
      }
      v[mes].ingresos_nominales_acum = ingresosNominalesAcum;
      v[mes].ingresos_acumulables_acum = ingresosAcumulablesAcum;

      // Deducciones
      v[mes].deducciones = calcularConceptoMensual('deducciones_autorizadas', mes);
      let deduccionesAcum = 0;
      for (let i = 1; i <= mes; i++) {
        if (mesesValidados[i]) deduccionesAcum += v[i].deducciones || 0;
      }
      v[mes].deducciones_acum = deduccionesAcum;

      // AAI
      v[mes].aai_acumulable = calcularConceptoMensual('aai_acumulable', mes);
      v[mes].aai_deducible = calcularConceptoMensual('aai_deducible', mes);

      // Retenciones
      v[mes].isr_retenido = calcularConceptoMensual('isr_retenido', mes);
      let retencionesAcum = 0;
      for (let i = 1; i <= mes; i++) {
        if (mesesValidados[i]) retencionesAcum += v[i].isr_retenido || 0;
      }
      v[mes].isr_retenido_acum = retencionesAcum;

      // ─── CÁLCULO SEGÚN RÉGIMEN ───

      if (regimen === 'PM_GENERAL') {
        // Art. 14 LISR - Coeficiente de utilidad
        v[mes].utilidad_fiscal_provisional = ingresosNominalesAcum * coeficienteUtilidad;

        // Disminuir PTU (mayo a diciembre, en partes iguales)
        let ptuMes = 0;
        if (mes >= 5 && ptuPagada > 0) {
          ptuMes = ptuPagada / 8; // 8 meses (may-dic)
        }
        v[mes].ptu_disminucion = ptuMes;
        let ptuAcum = 0;
        for (let i = 1; i <= mes; i++) {
          if (mesesValidados[i]) ptuAcum += v[i].ptu_disminucion || 0;
        }

        // Disminuir pérdidas
        let perdidasAplicadas = 0;
        if (perdidasRestantes > 0 && v[mes].utilidad_fiscal_provisional > 0) {
          perdidasAplicadas = Math.min(perdidasRestantes, v[mes].utilidad_fiscal_provisional);
          perdidasRestantes -= perdidasAplicadas;
        }
        v[mes].perdidas_aplicadas = perdidasAplicadas;

        v[mes].base_isr_provisional = Math.max(0,
          v[mes].utilidad_fiscal_provisional - ptuAcum - v[mes].perdidas_aplicadas
        );

        v[mes].isr_periodo = v[mes].base_isr_provisional * 0.30;

        // Acreditar pagos provisionales anteriores
        let pagosAnteriores = 0;
        for (let i = 1; i < mes; i++) {
          if (mesesValidados[i]) pagosAnteriores += v[i].pago_provisional || 0;
        }
        v[mes].pagos_anteriores = pagosAnteriores;

        v[mes].isr_a_cargo = Math.max(0, v[mes].isr_periodo - v[mes].isr_retenido_acum - pagosAnteriores);
        v[mes].pago_provisional = v[mes].isr_a_cargo;

      } else if (regimen === 'PM_RESICO') {
        // Art. 211 LISR - Flujo de efectivo
        v[mes].ingresos_efectivos = v[mes].ingresos_acumulables; // En RESICO es flujo
        v[mes].deducciones_efectivas = v[mes].deducciones;

        let ingresosAcumRESICO = 0;
        let deduccionesAcumRESICO = 0;
        for (let i = 1; i <= mes; i++) {
          if (mesesValidados[i]) {
            ingresosAcumRESICO += v[i].ingresos_efectivos || 0;
            deduccionesAcumRESICO += v[i].deducciones_efectivas || 0;
          }
        }

        v[mes].base_isr = Math.max(0, ingresosAcumRESICO - deduccionesAcumRESICO);
        v[mes].isr_periodo = v[mes].base_isr * 0.30;

        let pagosAnteriores = 0;
        for (let i = 1; i < mes; i++) {
          if (mesesValidados[i]) pagosAnteriores += v[i].pago_provisional || 0;
        }
        v[mes].pagos_anteriores = pagosAnteriores;
        v[mes].isr_a_cargo = Math.max(0, v[mes].isr_periodo - v[mes].isr_retenido_acum - pagosAnteriores);
        v[mes].pago_provisional = v[mes].isr_a_cargo;

      } else if (regimen === 'PF_GENERAL') {
        // Art. 106-108 LISR - Tarifa Art. 152
        // Base_gravable = Ingresos_acumulados − Deducciones_acumuladas − PTU − Pérdidas
        // (igual fórmula que Persona Moral, aplicable también a Persona Física
        // con Actividad Empresarial: Art. 109 LISR permite disminuir PTU
        // pagada a trabajadores y pérdidas fiscales de ejercicios anteriores).
        let ingresosAcumPF = 0;
        let deduccionesAcumPF = 0;
        let nMesesPF = 0;
        for (let i = 1; i <= mes; i++) {
          if (mesesValidados[i]) {
            ingresosAcumPF += v[i].ingresos_acumulables || 0;
            deduccionesAcumPF += v[i].deducciones || 0;
            nMesesPF++;
          }
        }

        const utilidadPrevia = Math.max(0, ingresosAcumPF - deduccionesAcumPF);

        // PTU pagada se disminuye en partes iguales de mayo a diciembre (8 meses)
        let ptuMesPF = 0;
        if (mes >= 5 && ptuPagada > 0) ptuMesPF = ptuPagada / 8;
        v[mes].ptu_disminucion = ptuMesPF;
        let ptuAcumPF = 0;
        for (let i = 1; i <= mes; i++) {
          if (mesesValidados[i]) ptuAcumPF += v[i].ptu_disminucion || 0;
        }

        // Pérdidas fiscales pendientes de ejercicios anteriores
        let perdidasAplicadasPF = 0;
        const utilidadTrasPTU = Math.max(0, utilidadPrevia - ptuAcumPF);
        if (perdidasRestantes > 0 && utilidadTrasPTU > 0) {
          perdidasAplicadasPF = Math.min(perdidasRestantes, utilidadTrasPTU);
          perdidasRestantes -= perdidasAplicadasPF;
        }
        v[mes].perdidas_aplicadas = perdidasAplicadasPF;

        v[mes].base_gravable = Math.max(0, utilidadTrasPTU - perdidasAplicadasPF);
        // La tarifa se acumula según el número de meses efectivamente
        // incluidos en la base (los amarres validados), y usa la tabla
        // configurada para el ejercicio en curso (ver  Tarifas ISR SAT).
        v[mes].isr_periodo = calcularTarifa152(v[mes].base_gravable, ejercicio, nMesesPF || mes);

        let pagosAnteriores = 0;
        for (let i = 1; i < mes; i++) {
          if (mesesValidados[i]) pagosAnteriores += v[i].pago_provisional || 0;
        }
        v[mes].pagos_anteriores = pagosAnteriores;
        v[mes].isr_a_cargo = Math.max(0, v[mes].isr_periodo - v[mes].isr_retenido_acum - pagosAnteriores);
        v[mes].pago_provisional = v[mes].isr_a_cargo;

      } else if (regimen === 'PF_RESICO') {
        // Art. 113-E LISR - Tabla RESICO
        v[mes].ingresos_mes = v[mes].ingresos_acumulables;
        v[mes].isr_periodo = calcularResicoPF(v[mes].ingresos_mes, ejercicio);
        v[mes].isr_a_cargo = Math.max(0, v[mes].isr_periodo - v[mes].isr_retenido);
        v[mes].pago_provisional = v[mes].isr_a_cargo;

      } else if (regimen === 'PF_HONORARIOS') {
        // Art. 106 y 103 LISR — Honorarios/Servicios Profesionales deduce
        // GASTOS REALES Y COMPROBADOS (con CFDI), no hay deducción ciega
        // opcional para este régimen (esa figura es propia de Arrendamiento,
        // Art. 115). Misma fórmula que Actividad Empresarial: se pueden
        // disminuir también PTU pagada y pérdidas fiscales pendientes.
        let ingresosAcumHon = 0;
        let deduccionesAcumHon = 0;
        let nMesesHon = 0;
        for (let i = 1; i <= mes; i++) {
          if (mesesValidados[i]) {
            ingresosAcumHon += v[i].ingresos_acumulables || 0;
            deduccionesAcumHon += v[i].deducciones || 0;
            nMesesHon++;
          }
        }

        v[mes].ingresos_acum = ingresosAcumHon;
        v[mes].deducciones_acum = deduccionesAcumHon;
        const utilidadPreviaHon = Math.max(0, ingresosAcumHon - deduccionesAcumHon);

        let ptuMesHon = 0;
        if (mes >= 5 && ptuPagada > 0) ptuMesHon = ptuPagada / 8;
        v[mes].ptu_disminucion = ptuMesHon;
        let ptuAcumHon = 0;
        for (let i = 1; i <= mes; i++) {
          if (mesesValidados[i]) ptuAcumHon += v[i].ptu_disminucion || 0;
        }

        let perdidasAplicadasHon = 0;
        const utilidadTrasPTUHon = Math.max(0, utilidadPreviaHon - ptuAcumHon);
        if (perdidasRestantes > 0 && utilidadTrasPTUHon > 0) {
          perdidasAplicadasHon = Math.min(perdidasRestantes, utilidadTrasPTUHon);
          perdidasRestantes -= perdidasAplicadasHon;
        }
        v[mes].perdidas_aplicadas = perdidasAplicadasHon;

        v[mes].base_gravable = Math.max(0, utilidadTrasPTUHon - perdidasAplicadasHon);
        v[mes].isr_periodo = calcularTarifa152(v[mes].base_gravable, ejercicio, nMesesHon || mes);

        let pagosAnteriores = 0;
        for (let i = 1; i < mes; i++) {
          if (mesesValidados[i]) pagosAnteriores += v[i].pago_provisional || 0;
        }
        v[mes].pagos_anteriores = pagosAnteriores;
        v[mes].isr_a_cargo = Math.max(0, v[mes].isr_periodo - v[mes].isr_retenido_acum - pagosAnteriores);
        v[mes].pago_provisional = v[mes].isr_a_cargo;

      } else if (regimen === 'PF_ARRENDAMIENTO') {
        // Art. 115-116 LISR — A DIFERENCIA de Actividad Empresarial, el
        // arrendamiento NO es acumulativo: cada mes se calcula solo, con
        // ingresos y deducción de ESE mes, y la tarifa MENSUAL (no la
        // escalada por número de meses). Además la ley da a elegir UNA sola
        // opción de deducción, nunca las dos juntas: o el 35% ciego
        // (sustituye cualquier deducción real), o las deducciones reales
        // comprobadas — no ambas restadas a la vez.
        const ingresosMesArr = v[mes].ingresos_acumulables; // ingreso de ESTE mes (ya incluye anticipos si aplica)
        const deduccionesMesArr = v[mes].deducciones;        // deducciones reales de ESTE mes

        v[mes].deduccion_ciega = ingresosMesArr * 0.35;
        const deduccionAplicada = usarDeduccionCiegaArr ? v[mes].deduccion_ciega : deduccionesMesArr;
        v[mes].base_gravable = Math.max(0, ingresosMesArr - deduccionAplicada);

        // Tarifa MENSUAL (nMeses=1), NO acumulada por número de meses.
        v[mes].isr_periodo = calcularTarifa152(v[mes].base_gravable, ejercicio, 1);

        // Sin acumulación de pagos anteriores: cada mes se compara solo
        // contra la retención DE ESE MES (Art. 116, retención 10% cuando el
        // arrendatario es persona moral).
        v[mes].pagos_anteriores = 0;
        v[mes].isr_a_cargo = Math.max(0, v[mes].isr_periodo - v[mes].isr_retenido);
        v[mes].pago_provisional = v[mes].isr_a_cargo;
      }

      // Saldo a favor
      if (v[mes].isr_a_cargo < 0) {
        v[mes].saldo_favor = Math.abs(v[mes].isr_a_cargo);
        v[mes].isr_a_cargo = 0;
      } else {
        v[mes].saldo_favor = 0;
      }
    }

    return v;
  }, [balanzaAnual, config, regimen, coeficienteUtilidad, perdidasPendientes, ptuPagada, saldoFavorISR, deduccionCiega, usarDeduccionCiegaArr, mesesValidados, isrManualAnual]);

  const formatNum = (n) => {
    if (n === 0 || n === undefined || n === null) return '';
    return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ── CAPTURA MANUAL DE ISR (meses anteriores a usar el sistema) ──────────
  // Para meses sin balanza que subir (antes de implementar el sistema), se
  // captura aquí directamente el resultado final de cada concepto de ISR
  // (Ingresos, Deducciones, Anticipos, Retenciones, etc.). Al guardar, el mes
  // queda marcado como validado, igual que si se hubiera calculado desde la
  // balanza. IMPORTANTE: aquí "Ingresos Nominales/Acumulables" debe capturarse
  // ya CON los anticipos del mes incluidos (el sistema no los vuelve a sumar
  // en meses manuales, para no duplicarlos).
  const abrirCapturaManual = (mes) => {
    const existente = (isrManualAnual && isrManualAnual[mes]) || {};
    const inicial = {};
    Object.keys(CONFIG_DEFAULT.isr).forEach(k => { inicial[k] = existente[k] ?? ''; });
    setFormManual(inicial);
    setMesManual(mes);
  };

  const guardarCapturaManual = async () => {
    if (!mesManual) return;
    setGuardandoManual(true);
    try {
      const datos = {};
      Object.keys(CONFIG_DEFAULT.isr).forEach(k => { datos[k] = parseFloat(formManual[k]) || 0; });
      await onGuardarManual(mesManual, datos);
      setMesManual(null);
    } catch (e) {
      alert(' Error al guardar la captura manual: ' + e.message);
    } finally {
      setGuardandoManual(false);
    }
  };

  const renderCapturaManual = () => {
    const todosLosMeses = Array.from({ length: 12 }, (_, i) => i + 1);
    return (
      <div style={{ marginBottom: 20, border: '1px dashed #9575cd', borderRadius: 8, padding: 14, background: '#f5f3ff' }}>
        <div style={{ fontWeight: 'bold', color: '#4527a0', marginBottom: 6 }}>
           Captura / edición manual de cualquier mes (ISR)
        </div>
        <p style={{ fontSize: 12, color: '#5e548e', marginBottom: 10 }}>
          Para meses previos a usar el sistema (sin balanza que subir), o para AJUSTAR a mano un mes que ya se
          calculó automático, captura aquí el resultado final de cada concepto de ISR. Captura Ingresos
          Nominales/Acumulables ya CON los anticipos del mes incluidos. Al guardar, ese mes queda fijo con lo que
          captures — deja de recalcularse desde la balanza hasta que borres la captura manual.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {todosLosMeses.map(m => {
            const esManualMes = !!(isrManualAnual && isrManualAnual[m]);
            const esAutoMes = mesesValidados[m] && !esManualMes;
            const vacioMes = !mesesValidados[m] && !esManualMes;
            const estilo = esManualMes
              ? { background: '#ede7f6', border: '1px solid #7e57c2', color: '#4527a0' }
              : esAutoMes
              ? { background: '#e8f5e9', border: '1px solid #66bb6a', color: '#2e7d32' }
              : { background: '#fff', border: '1px dashed #bbb', color: '#777' };
            return (
              <button key={m} onClick={() => abrirCapturaManual(m)}
                title={esManualMes ? 'Capturado a mano — clic para editar' : esAutoMes ? 'Calculado desde balanza — clic para sobreescribir a mano' : 'Sin datos — clic para capturar'}
                style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600, ...estilo }}>
                {MESES[m - 1]} {ejercicio} {esManualMes ? '' : esAutoMes ? '' : ''}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#666' }}>
          <span> Manual</span><span> Automático (desde balanza)</span><span> Sin datos</span>
        </div>

        {mesManual && mesesValidados[mesManual] && !(isrManualAnual && isrManualAnual[mesManual]) && (
          <div style={{ marginTop: 10, padding: 10, background: '#fff3e0', color: '#e65100', borderRadius: 6, fontSize: 12 }}>
             {MESES[mesManual - 1]} ya tiene un cálculo AUTOMÁTICO desde la balanza. Si guardas aquí, lo vas a
            reemplazar con lo que captures a mano.
          </div>
        )}
        {mesManual && (
          <div style={{ marginTop: 16, background: '#fff', border: '1px solid #d1c4e9', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, color: '#1a237e' }}>Captura manual ISR — {MESES[mesManual - 1]} {ejercicio}</h4>
              <button onClick={() => setMesManual(null)} style={{ border: 'none', background: 'none', fontSize: 16, cursor: 'pointer', color: '#999' }}></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 6 }}>
              {Object.entries(CONFIG_DEFAULT.isr).map(([key, def]) => (
                <React.Fragment key={key}>
                  <label style={{ fontSize: 12, color: '#333', alignSelf: 'center' }}>{def.concepto}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formManual[key] ?? ''}
                    onChange={e => setFormManual(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, textAlign: 'right' }}
                    placeholder="0.00"
                  />
                </React.Fragment>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              {isrManualAnual && isrManualAnual[mesManual] && (
                <button onClick={async () => {
                  if (!confirm('¿Quitar la captura manual de ' + MESES[mesManual - 1] + ' y volver a calcularlo automático desde la balanza?')) return;
                  setGuardandoManual(true);
                  try { await onEliminarManual(mesManual); setMesManual(null); }
                  catch (e) { alert(' ' + e.message); }
                  finally { setGuardandoManual(false); }
                }} disabled={guardandoManual}
                  style={{ padding: '8px 18px', border: '1px solid #c62828', borderRadius: 6, background: '#fff', color: '#c62828', cursor: 'pointer', marginRight: 'auto' }}>
                   Quitar captura manual (volver a automático)
                </button>
              )}
              <button onClick={() => setMesManual(null)} style={{ padding: '8px 18px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarCapturaManual} disabled={guardandoManual}
                style={{ padding: '8px 18px', border: 'none', borderRadius: 6, background: '#4527a0', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                {guardandoManual ? 'Guardando…' : ' Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizar tabla según régimen
  const [exportandoISR, setExportandoISR] = React.useState(false);
  const construirFilasISR = () => {
    const filas = [];

    // Filas comunes
    filas.push({ key: 'anticipos_clientes', label: 'Anticipos de Clientes Cobrados (incluidos en Ingresos)', tipo: 'normal', color: '#7c4dff', italic: true });
    filas.push({ key: 'ingresos_nominales', label: 'Ingresos Nominales del Mes', tipo: 'normal' });
    filas.push({ key: 'ingresos_nominales_acum', label: 'Ingresos Nominales Acumulados', tipo: 'acumulado', bold: true });

    if (regimen === 'PM_GENERAL') {
      filas.push({ key: 'coeficiente', label: `Coeficiente de Utilidad (${(coeficienteUtilidad * 100).toFixed(4)}%)`, tipo: 'formula', valor: coeficienteUtilidad });
      filas.push({ key: 'utilidad_fiscal_provisional', label: 'Utilidad Fiscal Provisional', tipo: 'calculado', bold: true, color: '#1565c0' });
      filas.push({ key: 'ptu_disminucion', label: 'PTU Pagada (disminución)', tipo: 'normal' });
      filas.push({ key: 'perdidas_aplicadas', label: 'Pérdidas Fiscales Aplicadas', tipo: 'normal', color: '#c62828' });
      filas.push({ key: 'base_isr_provisional', label: 'Base para ISR Provisional', tipo: 'calculado', bold: true, color: '#2e7d32' });
      filas.push({ key: 'isr_periodo', label: 'ISR del Periodo (30%)', tipo: 'calculado', bold: true, color: '#c62828' });
    } else if (regimen === 'PM_RESICO') {
      filas.push({ key: 'ingresos_efectivos', label: 'Ingresos Efectivos (flujo)', tipo: 'normal' });
      filas.push({ key: 'deducciones_efectivas', label: 'Deducciones Efectivas (flujo)', tipo: 'normal' });
      filas.push({ key: 'base_isr', label: 'Base ISR', tipo: 'calculado', bold: true, color: '#2e7d32' });
      filas.push({ key: 'isr_periodo', label: 'ISR del Periodo (30%)', tipo: 'calculado', bold: true, color: '#c62828' });
    } else if (regimen === 'PF_GENERAL') {
      filas.push({ key: 'ingresos_acumulables_acum', label: 'Ingresos Acumulables Acum.', tipo: 'acumulado' });
      filas.push({ key: 'deducciones_acum', label: 'Deducciones Autorizadas Acum.', tipo: 'acumulado' });
      filas.push({ key: 'ptu_disminucion', label: 'PTU Pagada (disminución, may-dic)', tipo: 'normal' });
      filas.push({ key: 'perdidas_aplicadas', label: 'Pérdidas Fiscales Aplicadas', tipo: 'normal' });
      filas.push({ key: 'base_gravable', label: 'Base Gravable', tipo: 'calculado', bold: true, color: '#2e7d32' });
      filas.push({ key: 'isr_periodo', label: 'ISR (Tarifa Art. 152)', tipo: 'calculado', bold: true, color: '#c62828' });
    } else if (regimen === 'PF_RESICO') {
      filas.push({ key: 'ingresos_mes', label: 'Ingresos del Mes', tipo: 'normal' });
      filas.push({ key: 'isr_periodo', label: 'ISR (Tabla RESICO)', tipo: 'calculado', bold: true, color: '#c62828' });
    } else if (regimen === 'PF_HONORARIOS') {
      filas.push({ key: 'ingresos_acum', label: 'Ingresos Acumulados', tipo: 'acumulado' });
      filas.push({ key: 'deducciones_acum', label: 'Deducciones Reales Acumuladas (CFDI)', tipo: 'acumulado' });
      filas.push({ key: 'ptu_disminucion', label: 'PTU Pagada (disminución, may-dic)', tipo: 'normal' });
      filas.push({ key: 'perdidas_aplicadas', label: 'Pérdidas Fiscales Aplicadas', tipo: 'normal' });
      filas.push({ key: 'base_gravable', label: 'Base Gravable', tipo: 'calculado', bold: true, color: '#2e7d32' });
      filas.push({ key: 'isr_periodo', label: 'ISR (Tarifa Art. 152)', tipo: 'calculado', bold: true, color: '#c62828' });
    } else if (regimen === 'PF_ARRENDAMIENTO') {
      filas.push({ key: 'ingresos_acumulables', label: 'Ingresos del Mes (no se acumula)', tipo: 'normal' });
      filas.push({
        key: 'deduccion_ciega',
        label: usarDeduccionCiegaArr ? 'Deducción Ciega (35%, sustituye reales)' : 'Deducción Ciega (35%) — no aplicada, se usan reales',
        tipo: usarDeduccionCiegaArr ? 'calculado' : 'normal'
      });
      filas.push({
        key: 'deducciones',
        label: usarDeduccionCiegaArr ? 'Deducciones Reales del Mes — no aplicadas, se usa ciega' : 'Deducciones Reales del Mes (aplicadas)',
        tipo: usarDeduccionCiegaArr ? 'normal' : 'calculado'
      });
      filas.push({ key: 'base_gravable', label: 'Base Gravable del Mes', tipo: 'calculado', bold: true, color: '#2e7d32' });
      filas.push({ key: 'isr_periodo', label: 'ISR (Tarifa MENSUAL Art. 96, no acumulada)', tipo: 'calculado', bold: true, color: '#c62828' });
    }

    // Filas comunes finales
    if (regimen === 'PF_ARRENDAMIENTO') {
      // Arrendamiento no es acumulativo: aquí se muestra la retención de ESE
      // mes, no un acumulado, y no hay "pagos anteriores" que acreditar.
      filas.push({ key: 'isr_retenido', label: 'ISR Retenido del Mes (10% si arrendatario es Persona Moral)', tipo: 'normal' });
      filas.push({ key: 'isr_a_cargo', label: 'ISR A Cargo / Pago Provisional del Mes', tipo: 'final', bold: true, color: '#c62828', bg: '#ffebee' });
      filas.push({ key: 'saldo_favor', label: 'Saldo a Favor del Mes', tipo: 'final', color: '#2e7d32', bg: '#e8f5e9' });
    } else {
      filas.push({ key: 'isr_retenido_acum', label: 'ISR Retenido Acumulado', tipo: 'normal' });
      filas.push({ key: 'pagos_anteriores', label: 'Pagos Provisionales Anteriores', tipo: 'calculado' });
      filas.push({ key: 'isr_a_cargo', label: 'ISR A Cargo / Pago Provisional', tipo: 'final', bold: true, color: '#c62828', bg: '#ffebee' });
      filas.push({ key: 'saldo_favor', label: 'Saldo a Favor', tipo: 'final', color: '#2e7d32', bg: '#e8f5e9' });
    }

    return filas;
  };

  const renderTablaISR = () => {
    const filas = construirFilasISR();

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#1a237e', color: '#fff' }}>
            <th style={{ padding: '10px 12px', textAlign: 'left', width: 320, border: '1px solid #3949ab' }}>Concepto</th>
            {MESES.map((m, i) => (
              <th key={i} style={{
                padding: '8px 6px',
                textAlign: 'right',
                border: '1px solid #3949ab',
                width: 95,
                background: mesesValidados[i + 1] ? '#303f9f' : '#5c6bc0'
              }}>
                {m}
                {!mesesValidados[i + 1] && <span style={{ fontSize: 9, display: 'block', opacity: 0.7 }}> Sin validar</span>}
              </th>
            ))}
            <th style={{ padding: '10px 12px', textAlign: 'right', border: '1px solid #3949ab', background: '#283593', width: 120 }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, idx) => {
            const total = MESES.reduce((sum, _, i) => {
              if (fila.tipo === 'formula') return sum;
              return sum + (valores[i + 1]?.[fila.key] || 0);
            }, 0);

            return (
              <tr key={fila.key} style={{
                background: fila.bg || (idx % 2 === 0 ? '#fff' : '#fafafa'),
                fontWeight: fila.bold ? 'bold' : 'normal'
              }}>
                <td style={{
                  padding: '8px 12px',
                  border: '1px solid #e0e0e0',
                  color: fila.color || '#333',
                  fontSize: fila.bold ? 13 : 12
                }}>
                  {fila.label}
                </td>
                {MESES.map((_, i) => {
                  let val = 0;
                  if (fila.tipo === 'formula') {
                    val = fila.valor || 0;
                  } else {
                    val = valores[i + 1]?.[fila.key] || 0;
                  }
                  return (
                    <td key={i} style={{
                      padding: '6px 8px',
                      textAlign: 'right',
                      border: '1px solid #e0e0e0',
                      fontFamily: 'monospace',
                      color: mesesValidados[i + 1] ? (fila.color || '#333') : '#bbb',
                      fontWeight: fila.bold ? 'bold' : 'normal',
                      background: fila.bg || 'transparent'
                    }}>
                      {fila.tipo === 'formula'
                        ? (fila.valor || 0).toFixed(4)
                        : formatNum(val)}
                    </td>
                  );
                })}
                <td style={{
                  padding: '8px 12px',
                  textAlign: 'right',
                  border: '1px solid #c5cae9',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  background: '#e8eaf6',
                  color: fila.color || '#1a237e'
                }}>
                  {fila.tipo === 'formula' ? '' : formatNum(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  // Construye la hoja de Excel del Papel de Trabajo de ISR dentro de un LIBRO
  // YA EXISTENTE (wb) — permite reutilizarla tanto para el botón individual
  // como para la descarga combinada ISR + IVA en un solo archivo.
  const construirHojaISR = (wb, logoId) => {
    const filas = construirFilasISR();
    const numCols = 2 + MESES.length;
    const ws = wb.addWorksheet('Cédula ISR', {
      views: [{ showGridLines: false }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 } }
    });
    agregarEncabezadoHoja(ws, logoId, {
      empresa: empresa.nombre,
      titulo: 'PAPEL DE TRABAJO DE ISR',
      subtitulo: `Ejercicio ${ejercicio} · Régimen: ${regimenInfo.nombre} · Meses validados: ${mesesHabilitados.length}/12 · Cifras en pesos mexicanos`,
      numCols
    });
    ws.columns = [{ width: 46 }, ...MESES.map(() => ({ width: 13 })), { width: 15 }];

    // Datos fiscales del ejercicio, como referencia arriba de la tabla
    let filaRef = 7;
    const datosRef = [
      ['Coeficiente de Utilidad', coeficienteUtilidad],
      ['Pérdidas Fiscales Pendientes', perdidasPendientes],
      ['PTU Pagada', ptuPagada],
      ['Saldo a Favor ISR (ejercicio anterior)', saldoFavorISR]
    ];
    datosRef.forEach(([label, val]) => {
      const row = ws.getRow(filaRef);
      row.getCell(1).value = label;
      row.getCell(1).font = { name: 'Calibri', italic: true, size: 9, color: { argb: EXCEL_COLOR.gray } };
      row.getCell(2).value = val;
      row.getCell(2).numFmt = EXCEL_MONEDA;
      row.getCell(2).font = { name: 'Calibri', italic: true, size: 9, color: { argb: EXCEL_COLOR.gray } };
      filaRef++;
    });
    filaRef++;

    const headerRowIdx = filaRef;
    const headerRow = ws.getRow(headerRowIdx);
    headerRow.values = ['Concepto', ...MESES.map(m => m.slice(0, 3)), 'Total'];
    estiloEncabezadoTabla(headerRow, numCols);

    let fila = headerRowIdx + 1;
    filas.forEach((f, idxFila) => {
      const row = ws.getRow(fila);
      row.getCell(1).value = f.label;
      row.getCell(1).font = { name: 'Calibri', size: 11, bold: !!f.bold, color: f.color ? { argb: 'FF' + f.color.replace('#', '').toUpperCase() } : undefined };
      let total = 0;
      MESES.forEach((_, i) => {
        const cell = row.getCell(2 + i);
        if (f.tipo === 'formula') {
          cell.value = f.valor || 0;
          cell.numFmt = '0.0000%';
        } else {
          const v = valores[i + 1]?.[f.key] || 0;
          cell.value = v; total += v;
          cell.numFmt = EXCEL_MONEDA;
        }
        cell.font = { name: 'Calibri', size: 11, bold: !!f.bold };
        cell.alignment = { horizontal: 'right' };
      });
      if (f.tipo !== 'formula') {
        const c1 = ws.getCell(fila, 2).address, c2 = ws.getCell(fila, 1 + MESES.length).address;
        const totalCell = row.getCell(2 + MESES.length);
        totalCell.value = { formula: `SUM(${c1}:${c2})` };
        totalCell.numFmt = EXCEL_MONEDA; totalCell.font = { name: 'Calibri', size: 11, bold: true }; totalCell.alignment = { horizontal: 'right' };
      }
      if (f.tipo === 'final') {
        estiloFilaTotal(row, numCols, total < 0);
      } else if (idxFila % 2 === 1) {
        sombreadoAlterno(row, numCols);
      }
      fila++;
    });

    agregarPieHoja(ws, fila + 1, numCols);
    return ws;
  };

  const exportarExcel = async () => {
    setExportandoISR(true);
    try {
      const { wb, logoId } = await crearLibroExcel();
      construirHojaISR(wb, logoId);
      await descargarLibroExcel(wb, `Papel_ISR_${empresa.nombre}_${ejercicio}.xlsx`);
    } catch (e) {
      alert(' Error al generar el Excel: ' + e.message);
      console.error(e);
    } finally {
      setExportandoISR(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: '#1a237e', margin: 0 }}> Papel de Trabajo ISR — {empresa.nombre}</h2>
          <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0 0' }}>
            Ejercicio: {ejercicio} | Régimen: {regimenInfo.nombre}
          </p>
        </div>
        <button
          onClick={exportarExcel}
          disabled={exportandoISR}
          style={{
            padding: '10px 24px',
            background: '#ff9800',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
            cursor: exportandoISR ? 'default' : 'pointer',
            opacity: exportandoISR ? 0.7 : 1
          }}
        >
          {exportandoISR ? ' Generando…' : ' Exportar a Excel'}
        </button>
      </div>

      {/* Parámetros del régimen */}
      <div style={{
        background: '#fff8e1',
        border: '1px solid #ffe082',
        borderRadius: 8,
        padding: 16,
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Régimen Fiscal</label>
          <select
            value={regimen}
            onChange={e => setRegimen(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, minWidth: 300 }}
          >
            {Object.entries(REGIMENES).map(([key, info]) => (
              <option key={key} value={key}>{info.nombre}</option>
            ))}
          </select>
        </div>

        {regimenInfo.usaCoeficiente && (
          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Coeficiente de Utilidad</label>
            <input
              type="number"
              step="0.0001"
              value={coeficienteUtilidad}
              onChange={e => setCoeficienteUtilidad(parseFloat(e.target.value) || 0)}
              style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, width: 120 }}
            />
          </div>
        )}

        {regimenInfo.usaPerdidas && (
          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Pérdidas Fiscales Pendientes</label>
            <input
              type="number"
              value={perdidasPendientes}
              onChange={e => setPerdidasPendientes(parseFloat(e.target.value) || 0)}
              style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, width: 150 }}
            />
          </div>
        )}

        {regimenInfo.usaPTU && (
          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>PTU Pagada (anual)</label>
            <input
              type="number"
              value={ptuPagada}
              onChange={e => setPtuPagada(parseFloat(e.target.value) || 0)}
              style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, width: 150 }}
            />
          </div>
        )}

        <div>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Saldo a Favor ISR (inicio)</label>
          <input
            type="number"
            value={saldoFavorISR}
            onChange={e => setSaldoFavorISR(parseFloat(e.target.value) || 0)}
            style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, width: 150 }}
          />
        </div>

        {regimen === 'PF_ARRENDAMIENTO' && (
          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Deducción a aplicar</label>
            <select className="inp" value={usarDeduccionCiegaArr ? 'ciega' : 'reales'}
              onChange={e => setUsarDeduccionCiegaArr(e.target.value === 'ciega')}
              style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, width: 220 }}>
              <option value="ciega">35% Ciega (Art. 115, sustituye deducciones)</option>
              <option value="reales">Deducciones Reales Comprobadas</option>
            </select>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button className="btn btn-sm btn-primary" onClick={guardarDatosFiscales}
            style={{ padding: '8px 16px', background: '#1a237e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>
             Guardar como Datos Fiscales {ejercicio}
          </button>
        </div>
      </div>
      {!datosDelAnio && (
        <div style={{ background: '#fff3e0', color: '#e65100', padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 12 }}>
           No hay Datos Fiscales guardados para {ejercicio}. Configúralos aquí y guárdalos, o captúralos en la pestaña " Datos Fiscales".
        </div>
      )}
      {msgFiscal && <div style={{ padding: 10, borderRadius: 6, marginBottom: 16, background: msgFiscal.startsWith('') ? '#e8f5e9' : '#ffebee', color: msgFiscal.startsWith('') ? '#2e7d32' : '#c62828', fontWeight: 'bold', fontSize: 12 }}>{msgFiscal}</div>}

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
          <p>Valida el amarre de balanza de cada mes (pestaña " Balanzas y Amarres"), o usa la captura manual de arriba para meses anteriores a usar el sistema.</p>
        </div>
      ) : (
        renderTablaISR()
      )}
    </div>
  );
}
