import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';
import { calcularDetalleCategoriaBalance, calcularResidualesPorFila, filasBalanzaDesdeMatriz, normCuenta, obtenerAncestroMayor } from '../lib/balanza.js';
import { safeParseConfigPT } from '../lib/configEmpresa.js';
import { EXCEL_COLOR, EXCEL_MONEDA, agregarEncabezadoHoja, agregarPieHoja, crearLibroExcel, descargarLibroExcel, estiloEncabezadoTabla, estiloFilaTotal, hojaBalanza, sombreadoAlterno } from '../lib/excel.js';
import { MESES, fmt } from '../lib/format.js';
import { ConfigCuentasEmpresa } from '../components/ConfigCuentasEmpresa.jsx';
import { ConfigDatosFiscales } from '../components/ConfigDatosFiscales.jsx';
import { EstadoResultados } from '../components/EstadoResultados.jsx';
import { EstadoSituacionFinanciera } from '../components/EstadoSituacionFinanciera.jsx';
import { ImportadorCatalogo } from '../components/ImportadorCatalogo.jsx';
import { PapelTrabajoISR } from '../components/PapelTrabajoISR.jsx';
import { PapelTrabajoIVA } from '../components/PapelTrabajoIVA.jsx';
import { PapelesTrabajoErrorBoundary } from '../components/PapelesTrabajoErrorBoundary.jsx';

export function PagePapelesTrabajo({ token, user }) {
  const [empresas, setEmpresas] = React.useState([]);
  const [empresaSeleccionada, setEmpresaSeleccionada] = React.useState(null);
  const [catalogoCuentas, setCatalogoCuentas] = React.useState([]);
  const [balanzaAnual, setBalanzaAnual] = React.useState({});
  const [anexoIvaAnual, setAnexoIvaAnual] = React.useState({});
  const [isrManualAnual, setIsrManualAnual] = React.useState({});
  const isrExportRef = React.useRef(null);
  const ivaExportRef = React.useRef(null);
  const [descargandoAmbos, setDescargandoAmbos] = React.useState(false);

  // Descarga ISR + IVA en UN SOLO archivo Excel (una hoja por cada uno),
  // reutilizando exactamente las mismas funciones que generan cada Excel
  // por separado — así nunca se desincronizan entre sí.
  const descargarAmbosPapeles = async () => {
    if (!isrExportRef.current || !ivaExportRef.current) {
      alert('Entra a las pestañas de IVA e ISR al menos una vez antes de descargar ambos juntos.');
      return;
    }
    setDescargandoAmbos(true);
    try {
      const { wb, logoId } = await crearLibroExcel();
      ivaExportRef.current(wb, logoId);
      isrExportRef.current(wb, logoId);
      const nombreEmpresa = empresaSeleccionada?.nombre || '';
      await descargarLibroExcel(wb, `Papeles_ISR_IVA_${nombreEmpresa}_${ejercicio}.xlsx`);
    } catch (e) {
      alert(' Error al generar el Excel combinado: ' + e.message);
      console.error(e);
    } finally {
      setDescargandoAmbos(false);
    }
  };

  const [amarresValidados, setAmarresValidados] = React.useState({});
  const [datosFiscales, setDatosFiscales] = React.useState([]);
  const [tabActiva, setTabActiva] = React.useState('config');
  // Vista del Estado de Resultados: 'saldo' (acumulado por saldo final),
  // 'mensual' (mes + acumulado lado a lado), '12meses' (comparativo mensual).
  const [vistaER, setVistaER] = React.useState('saldo');
  const [config, setConfig] = React.useState({});
  const [mensaje, setMensaje] = React.useState('');
  const [cargando, setCargando] = React.useState(false);
  const [ejercicio, setEjercicio] = React.useState(new Date().getFullYear());

  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Cargar empresas
  React.useEffect(() => {
    cargarEmpresas();
  }, []);

  const cargarEmpresas = async () => {
    try {
      const list = await api('GET', '/empresas', null, token);
      setEmpresas(list || []);
    } catch (e) {
      console.error('Error cargando empresas:', e);
    }
  };

  // Cargar config, catálogo, balanza y amarres cuando se selecciona empresa o cambia el ejercicio
  React.useEffect(() => {
    if (!empresaSeleccionada) return;
    setTabActiva('config');
    cargarConfigEmpresa();
    cargarBalanzaAnual();
    cargarAnexoIvaAnual();
    cargarIsrManualAnual();
    cargarAmarresValidados();
    cargarDatosFiscales();
  }, [empresaSeleccionada, ejercicio]);

  const cargarConfigEmpresa = async () => {
    try {
      const list = await api('GET', '/empresas', null, token);
      const emp = (list || []).find(e => e.id === empresaSeleccionada.id) || empresaSeleccionada;
      setConfig(safeParseConfigPT(emp.config_pt));
      let cat = [];
      try {
        if (emp.catalogo_cuentas) {
          cat = typeof emp.catalogo_cuentas === 'string' ? JSON.parse(emp.catalogo_cuentas) : (emp.catalogo_cuentas || []);
        } else {
          // Catálogo ya no viene en el listado (evitaba el error 500 por tamaño).
          const resp = await api('GET', '/empresas/' + empresaSeleccionada.id + '/catalogo', null, token);
          cat = resp.catalogo || [];
        }
      } catch (e) { cat = []; }
      setCatalogoCuentas(Array.isArray(cat) ? cat : []);
    } catch (e) {
      console.error('Error cargando configuración de la empresa:', e);
    }
  };

  const cargarBalanzaAnual = async () => {
    setCargando(true);
    try {
      const meses = Array.from({ length: 12 }, (_, i) => i + 1);
      const resultados = await Promise.all(meses.map(async m => {
        const periodo = `${ejercicio}-${String(m).padStart(2, '0')}`;
        try {
          const data = await api('GET', `/empresas/${empresaSeleccionada.id}/balanza?periodo=${periodo}`, null, token);
          return [m, data.balanza || []];
        } catch (e) {
          return [m, []];
        }
      }));
      const balanza = {};
      resultados.forEach(([m, b]) => { balanza[m] = b; });
      setBalanzaAnual(balanza);
    } catch (e) {
      console.error('Error cargando balanzas:', e);
    }
    setCargando(false);
  };

  const cargarAnexoIvaAnual = async () => {
    try {
      const meses = Array.from({ length: 12 }, (_, i) => i + 1);
      const resultados = await Promise.all(meses.map(async m => {
        const periodo = `${ejercicio}-${String(m).padStart(2, '0')}`;
        try {
          const data = await api('GET', `/empresas/${empresaSeleccionada.id}/anexo-iva?periodo=${periodo}`, null, token);
          return [m, data.datos || {}];
        } catch (e) {
          return [m, {}];
        }
      }));
      const datos = {};
      resultados.forEach(([m, d]) => { datos[m] = d; });
      setAnexoIvaAnual(datos);
    } catch (e) {
      console.error('Error cargando valores del Anexo de IVA:', e);
    }
  };

  const cargarIsrManualAnual = async () => {
    try {
      const meses = Array.from({ length: 12 }, (_, i) => i + 1);
      const resultados = await Promise.all(meses.map(async m => {
        const periodo = `${ejercicio}-${String(m).padStart(2, '0')}`;
        try {
          const data = await api('GET', `/empresas/${empresaSeleccionada.id}/isr-manual?periodo=${periodo}`, null, token);
          return [m, data.datos || null];
        } catch (e) {
          return [m, null];
        }
      }));
      const datos = {};
      resultados.forEach(([m, d]) => { if (d) datos[m] = d; });
      setIsrManualAnual(datos);
    } catch (e) {
      console.error('Error cargando captura manual de ISR:', e);
    }
  };

  // Captura manual del Papel de Trabajo de ISR para meses anteriores a la
  // implementación del sistema: guarda directamente los conceptos capturados
  // a mano y marca ese mes como validado, igual que hace el Anexo de IVA manual.
  const guardarIsrManual = async (mes, datos) => {
    const periodo = `${ejercicio}-${String(mes).padStart(2, '0')}`;
    await api('PUT', `/empresas/${empresaSeleccionada.id}/isr-manual`, { periodo, datos }, token);
    await api('PUT', `/empresas/${empresaSeleccionada.id}/amarres`, { periodo, validado: true }, token);
    setIsrManualAnual(prev => ({ ...prev, [mes]: datos }));
    setAmarresValidados(prev => ({ ...prev, [periodo]: { validado: true, fecha: new Date().toISOString() } }));
  };

  // Quita la captura manual de un mes. Si ese mes tiene balanza subida, al
  // quitar la captura vuelve a calcularse automático (el amarre se queda
  // validado porque la balanza sigue ahí); si NO tiene balanza, se desmarca
  // el amarre por completo para no dejar un mes "validado" sin datos reales.
  const eliminarIsrManual = async (mes) => {
    const periodo = `${ejercicio}-${String(mes).padStart(2, '0')}`;
    await api('DELETE', `/empresas/${empresaSeleccionada.id}/isr-manual/${periodo}`, null, token);
    setIsrManualAnual(prev => { const n = { ...prev }; delete n[mes]; return n; });
    const tieneBalanza = (balanzaAnual[mes] || []).length > 0;
    if (!tieneBalanza) {
      await api('PUT', `/empresas/${empresaSeleccionada.id}/amarres`, { periodo, validado: false }, token);
      setAmarresValidados(prev => { const n = { ...prev }; delete n[periodo]; return n; });
    }
  };

  const cargarDatosFiscales = async () => {
    try {
      const data = await api('GET', `/empresas/${empresaSeleccionada.id}/datos-fiscales`, null, token);
      setDatosFiscales(data.datos || []);
    } catch (e) {
      console.error('Error cargando datos fiscales:', e);
    }
  };

  const guardarDatosFiscales = async (registro) => {
    await api('PUT', `/empresas/${empresaSeleccionada.id}/datos-fiscales`, registro, token);
    await cargarDatosFiscales();
  };

  const eliminarDatosFiscales = async (anio) => {
    await api('DELETE', `/empresas/${empresaSeleccionada.id}/datos-fiscales/${anio}`, null, token);
    await cargarDatosFiscales();
  };

  const cargarAmarresValidados = async () => {
    try {
      const data = await api('GET', `/empresas/${empresaSeleccionada.id}/amarres`, null, token);
      const amarres = {};
      (data.amarres || []).forEach(a => {
        amarres[a.periodo] = { validado: !!a.validado, fecha: a.fecha_validacion };
      });
      setAmarresValidados(amarres);
    } catch (e) {
      console.error('Error cargando amarres:', e);
    }
  };

  // Captura manual del Papel de Trabajo de IVA para meses anteriores a la
  // implementación del sistema (sin balanza ni Anexo que subir): guarda
  // directamente los 29 conceptos capturados a mano y marca el mes como
  // validado, para que aparezca igual que los meses procesados automáticamente.
  const guardarAnexoIvaManual = async (mes, datos) => {
    const periodo = `${ejercicio}-${String(mes).padStart(2, '0')}`;
    await api('PUT', `/empresas/${empresaSeleccionada.id}/anexo-iva`, { periodo, datos }, token);
    await api('PUT', `/empresas/${empresaSeleccionada.id}/amarres`, { periodo, validado: true }, token);
    setAnexoIvaAnual(prev => ({ ...prev, [mes]: datos }));
    setAmarresValidados(prev => ({ ...prev, [periodo]: { validado: true, fecha: new Date().toISOString() } }));
  };

  const guardarConfig = async (empresaId, configJSON) => {
    try {
      const emp = empresas.find(e => e.id === empresaId) || empresaSeleccionada;
      await api('PUT', '/empresas/' + empresaId, {
        config_pt: configJSON,
        actualizar_config_pt: true
      }, token);
      setConfig(JSON.parse(configJSON));
      setMensaje(' Configuración guardada correctamente');
      setTimeout(() => setMensaje(''), 3000);
    } catch (e) {
      setMensaje(' Error al guardar configuración: ' + e.message);
    }
  };

  const guardarCatalogo = async (cuentas) => {
    try {
      const emp = empresaSeleccionada;
      // IMPORTANTE: la importación del catálogo no debe reenviar config_iva ni
      // ninguna configuración de papeles de trabajo que pudiera estar desactualizada
      // en el estado del navegador. El servidor crea además un respaldo automático.
      const resp = await api('PUT', '/empresas/' + emp.id, { catalogo_cuentas: JSON.stringify(cuentas) }, token);
      if (resp && resp.backupId) console.info('Respaldo automático creado antes de importar catálogo:', resp.backupId);
      setCatalogoCuentas(cuentas);
      setMensaje(' Catálogo de cuentas guardado');
      setTimeout(() => setMensaje(''), 3000);
    } catch (e) {
      setMensaje(' Error al guardar catálogo: ' + e.message);
    }
  };

  // Lee un XLSX de balanza de comprobación (misma estructura que "Ejecutar")
  function parseBalanzaPT(wb) {
    const { rows } = hojaBalanza(wb);
    return filasBalanzaDesdeMatriz(rows);
  }

  const subirBalanzaMes = (mes, file) => {
    const periodo = `${ejercicio}-${String(mes).padStart(2, '0')}`;
    setMensaje(' Procesando balanza de ' + MESES[mes - 1] + '...');
    setCargando(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = window.XLSX;
        if (!XLSX) throw new Error('La librería XLSX no está disponible en el navegador.');
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const lista = parseBalanzaPT(wb);
        if (!lista.length) { setMensaje(' No se encontraron cuentas en el archivo'); setCargando(false); return; }
        const respBalanza = await api('PUT', `/empresas/${empresaSeleccionada.id}/balanza`, { periodo, balanza: lista }, token);
        if (respBalanza && respBalanza.backupId) console.info('Respaldo automático antes de importar balanza:', respBalanza.backupId);
        setBalanzaAnual(prev => ({ ...prev, [mes]: lista }));

        // Autocompleta el catálogo con las cuentas nuevas encontradas en la balanza.
        // Se compara ignorando guiones/espacios, porque CONTPAQi imprime la balanza
        // con guiones (ej. "101-01-001") pero el catálogo se descarga sin guiones.
        const mapaCat = {}; catalogoCuentas.forEach(c => mapaCat[normCuenta(c.codigo)] = c);
        let huboNuevas = false;
        const nuevasCuentas = [...catalogoCuentas];
        lista.forEach(l => {
          if (!mapaCat[normCuenta(l.cuenta)]) {
            const nueva = { codigo: l.cuenta, nombre: l.nombre, tipo: '', ctaSup: '', nivel: 0 };
            mapaCat[normCuenta(l.cuenta)] = nueva;
            nuevasCuentas.push(nueva);
            huboNuevas = true;
          }
        });
        if (huboNuevas) { await guardarCatalogo(nuevasCuentas); }

        setMensaje(` Balanza de ${MESES[mes - 1]} ${ejercicio} guardada (${lista.length} cuentas)`);
        setTimeout(() => setMensaje(''), 3000);
      } catch (err) {
        setMensaje(' Error al guardar la balanza: ' + err.message);
      } finally {
        setCargando(false);
      }
    };
    reader.onerror = () => { setMensaje(' Error al leer el archivo'); setCargando(false); };
    reader.readAsArrayBuffer(file);
  };

  const toggleAmarreMes = async (mes) => {
    const periodo = `${ejercicio}-${String(mes).padStart(2, '0')}`;
    const actual = !!amarresValidados[periodo]?.validado;
    const nuevo = !actual;
    try {
      await api('PUT', `/empresas/${empresaSeleccionada.id}/amarres`, { periodo, validado: nuevo }, token);
      setAmarresValidados(prev => ({ ...prev, [periodo]: { validado: nuevo, fecha: new Date().toISOString() } }));
    } catch (e) {
      setMensaje(' Error al actualizar el amarre: ' + e.message);
    }
  };

  const mapaCatGlobal = React.useMemo(() => {
    const m = {}; (catalogoCuentas || []).forEach(c => m[normCuenta(c.codigo)] = c); return m;
  }, [catalogoCuentas]);

  // Para el ESTADO DE RESULTADOS: suma los MOVIMIENTOS (cargos/abonos) del periodo —
  // correcto para flujos (ingresos, costos, gastos). Se acumula por CUENTA DE MAYOR
  // (obtenerAncestroMayor), igual que en la vista en pantalla, para que el Excel
  // exportado y lo que se ve en la app siempre coincidan.
  const totalPorCategoria = (balanzaMes, categoriaEF) => {
    let total = 0;
    const residuales = calcularResidualesPorFila(balanzaMes, mapaCatGlobal, 'movimiento');
    for (const fila of (balanzaMes || [])) {
      const codNorm = normCuenta(fila.cuenta);
      const cta = mapaCatGlobal[codNorm];
      if (!cta) continue;
      const mayor = obtenerAncestroMayor(codNorm, mapaCatGlobal);
      if (!mayor || (mayor.categoriaEF || '') !== categoriaEF) continue;
      total += residuales[codNorm] || 0;
    }
    return total;
  };

  // Para el ESTADO DE SITUACIÓN FINANCIERA: usa el SALDO FINAL (acumulado a la fecha
  // de corte) — correcto para cuentas de balance (activo, pasivo, capital), que no
  // se "reinician" cada mes como sí lo hacen los ingresos/gastos. También se
  // acumula por CUENTA DE MAYOR.
  const saldoPorCategoria = (balanzaMes, categoriaEF) => calcularDetalleCategoriaBalance(balanzaMes, mapaCatGlobal, categoriaEF).total;

  // Igual que saldoPorCategoria/totalPorCategoria, pero además regresa el
  // detalle a NIVEL CUENTA DE MAYOR (no solo el total de la categoría) — lo
  // que usan las hojas verticales de 12 periodos, para que se vea cada
  // cuenta de Mayor y no nada más el total de Activo Circulante, Ingresos, etc.
  const detallePorCategoriaMes = (balanzaMes, categoriaEF, modoDeseado) => {
    const porMayor = {};
    let total = 0;
    const conSF = (balanzaMes || []).some(f => f.sf_d !== undefined || f.sf_a !== undefined);
    const modo = modoDeseado === 'saldo' ? (conSF ? 'saldo' : 'movimiento') : 'movimiento';
    const residuales = calcularResidualesPorFila(balanzaMes, mapaCatGlobal, modo);
    for (const fila of (balanzaMes || [])) {
      const codNorm = normCuenta(fila.cuenta);
      const cta = mapaCatGlobal[codNorm];
      if (!cta) continue;
      const mayor = obtenerAncestroMayor(codNorm, mapaCatGlobal);
      if (!mayor || (mayor.categoriaEF || '') !== categoriaEF) continue;
      const valor = residuales[codNorm] || 0;
      total += valor;
      const key = normCuenta(mayor.codigo);
      if (!porMayor[key]) porMayor[key] = { codigo: mayor.codigo, nombre: mayor.nombre, saldo: 0 };
      porMayor[key].saldo += valor;
    }
    const detalle = Object.values(porMayor).filter(d => Math.abs(d.saldo) > 0.005).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
    return { total, detalle };
  };
  const detalleSaldoPorCategoria = (balanzaMes, categoriaEF) => calcularDetalleCategoriaBalance(balanzaMes, mapaCatGlobal, categoriaEF);
  const detalleFlujoPorCategoria = (balanzaMes, categoriaEF) => detallePorCategoriaMes(balanzaMes, categoriaEF, 'movimiento');

  // Utilidad (o Pérdida) del Ejercicio ACUMULADA a la fecha de corte, para
  // sumarla en el Capital Ganado del Balance.
  //
  // IMPORTANTE: aquí se usa el SALDO FINAL (sf_d/sf_a) de las cuentas de
  // ingresos/costos/gastos de la balanza AL CORTE — no los cargos/abonos.
  // Las cuentas de resultados (ingresos, costos, gastos) NO se reinician cada
  // mes, solo se cierran una vez al año; su saldo final ya es, por definición,
  // el acumulado del ejercicio a esa fecha (así lo entrega CONTPAQi: "Saldos
  // Iniciales" = inicio del rango del reporte, "Cargos/Abonos" = solo el
  // movimiento de ESE rango, "Saldos Actuales" = acumulado real a la fecha).
  // Usar cargos/abonos aquí subestima la utilidad cuando la balanza que se
  // sube ya trae saldos iniciales de meses previos distintos de cero (balanza
  // acumulada al corte, en vez de balanza de un único mes aislado) — esto era
  // lo que hacía que Activo no cuadrara con Pasivo + Capital.
  const calcularUtilidadEjercicio = (balanzaCorte) => {
    const ingresos = saldoPorCategoria(balanzaCorte, 'ingresos');
    const otrosIngresos = saldoPorCategoria(balanzaCorte, 'otros_ingresos');
    const costos = saldoPorCategoria(balanzaCorte, 'costos');
    const gastosOp = saldoPorCategoria(balanzaCorte, 'gastos_operativos');
    const gastosFin = saldoPorCategoria(balanzaCorte, 'gastos_financieros');
    const otrosGastos = saldoPorCategoria(balanzaCorte, 'otros_gastos');
    return ingresos + otrosIngresos - costos - gastosOp - gastosFin - otrosGastos;
  };

  const NOMBRES_CATEGORIA = {
    ingresos: 'Ingresos', otros_ingresos: 'Otros ingresos', costos: 'Costos',
    gastos_operativos: 'Gastos de Operación', gastos_financieros: 'Gastos Financieros', otros_gastos: 'Otros gastos',
    activo_circulante: 'Activo Circulante', activo_no_circulante: 'Activo No Circulante',
    pasivo_corto_plazo: 'Pasivo a Corto Plazo', pasivo_largo_plazo: 'Pasivo a Largo Plazo',
    capital_contribuido: 'Capital Contribuido', capital_ganado: 'Capital Ganado'
  };

  // ── VISTA "12 MESES": comparativo mensual del Estado de Resultados ──
  // Una columna por cada mes CONFIRMADO (amarre validado) usando cargos/abonos
  // de esa balanza, más una columna de Total que debe coincidir EXACTAMENTE
  // con el acumulado calculado por saldo final (mismo método del Balance) —
  // si no coincide, se avisa, porque normalmente indica que alguna balanza
  // mensual subida no trae únicamente el movimiento de ese mes (por ejemplo,
  // se subió una balanza ya acumulada en el lugar de un mes aislado).
  const renderComparativo12Meses = () => {
    const validados = mesesValidadosLista();
    if (validados.length === 0) return null;
    const ultimoMes = validados[validados.length - 1];
    const filas = [
      { key: 'ingresos', label: 'Ingresos', signo: 1 },
      { key: 'otros_ingresos', label: 'Otros Ingresos', signo: 1 },
      { key: 'costos', label: 'Costos', signo: -1 },
      { key: 'gastos_operativos', label: 'Gastos de Operación', signo: -1 },
      { key: 'gastos_financieros', label: 'Gastos Financieros', signo: -1 },
      { key: 'otros_gastos', label: 'Otros Gastos', signo: -1 },
    ];
    const porMesPorCategoria = {};
    filas.forEach(f => {
      porMesPorCategoria[f.key] = {};
      validados.forEach(m => { porMesPorCategoria[f.key][m] = totalPorCategoria(balanzaAnual[m] || [], f.key); });
    });
    const utilidadPorMes = {};
    validados.forEach(m => {
      utilidadPorMes[m] = filas.reduce((acc, f) => acc + f.signo * (porMesPorCategoria[f.key][m] || 0), 0);
    });
    const totalPorFila = (key) => validados.reduce((acc, m) => acc + (porMesPorCategoria[key][m] || 0), 0);
    const utilidadTotalMovimiento = validados.reduce((acc, m) => acc + (utilidadPorMes[m] || 0), 0);
    const utilidadTotalSaldo = calcularUtilidadEjercicio(balanzaAnual[ultimoMes] || []);
    const coincide = Math.abs(utilidadTotalMovimiento - utilidadTotalSaldo) < 1;

    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #374151' }}>
          <h3 style={{ margin: 0, fontSize: 17, color: '#fff', fontWeight: 800 }}> Estado de Resultados — Comparativo 12 Meses</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>{empresaSeleccionada.nombre} — {ejercicio}</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#374151', color: '#fff' }}>
                <th style={{ padding: 8, textAlign: 'left', position: 'sticky', left: 0, background: '#1a237e' }}>Concepto</th>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <th key={m} style={{ padding: 8, textAlign: 'right', minWidth: 100 }}>
                    {MESES[m - 1].slice(0, 3)}
                    {!validados.includes(m) && <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>no validado</div>}
                  </th>
                ))}
                <th style={{ padding: 8, textAlign: 'right', minWidth: 110, background: '#0d1442' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => (
                <tr key={f.key} style={{ borderBottom: '1px solid #2a2f45' }}>
                  <td style={{ padding: 6, color: '#e5e7eb', position: 'sticky', left: 0, background: '#111827' }}>{f.label}</td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <td key={m} style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace', color: validados.includes(m) ? '#cbd5e1' : '#4b5563' }}>
                      {validados.includes(m) ? fmt(porMesPorCategoria[f.key][m] || 0) : '—'}
                    </td>
                  ))}
                  <td style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace', color: '#e5e7eb', fontWeight: 700, background: '#161c36' }}>
                    {fmt(totalPorFila(f.key))}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #4527a0' }}>
                <td style={{ padding: 6, color: '#fff', fontWeight: 800, position: 'sticky', left: 0, background: '#1a1f3a' }}>Utilidad (Pérdida) del Mes</td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <td key={m} style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: validados.includes(m) ? (utilidadPorMes[m] >= 0 ? '#4caf50' : '#f44336') : '#4b5563' }}>
                    {validados.includes(m) ? fmt(utilidadPorMes[m]) : '—'}
                  </td>
                ))}
                <td style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: utilidadTotalMovimiento >= 0 ? '#4caf50' : '#f44336', background: '#161c36' }}>
                  {fmt(utilidadTotalMovimiento)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #374151' }}>
          {coincide ? (
            <div className="alert alert-info" style={{ margin: 0, fontSize: 12 }}>
               El Total (suma de los {validados.length} mes(es) validado(s)) coincide exactamente con el Acumulado
              por saldo: {fmt(utilidadTotalSaldo)}.
            </div>
          ) : (
            <div className="alert alert-warn" style={{ margin: 0, fontSize: 12 }}>
               El Total de los meses ({fmt(utilidadTotalMovimiento)}) NO coincide con el Acumulado por saldo
              ({fmt(utilidadTotalSaldo)}) — diferencia de {fmt(Math.abs(utilidadTotalMovimiento - utilidadTotalSaldo))}.
              Esto casi siempre significa que alguna balanza mensual subida no trae únicamente el movimiento de ESE
              mes (por ejemplo, se subió una balanza ya acumulada de varios meses en el lugar de un mes aislado).
              Revisa la vista " Ver detección" y los Saldos Iniciales de esa balanza.
            </div>
          )}
        </div>
      </div>
    );
  };


  // Meses con amarre validado (obligatorio para IVA / ISR papeles oficiales)
  const mesesValidadosLista = () => {
    const arr = [];
    for (let m = 1; m <= 12; m++) {
      const periodo = `${ejercicio}-${String(m).padStart(2, '0')}`;
      if (amarresValidados[periodo]?.validado && (balanzaAnual[m] || []).length) arr.push(m);
    }
    return arr;
  };

  // Meses con balanza cargada (permite EF y analíticas de meses anteriores
  // sin necesidad de re-validar el amarre de IVA)
  const mesesConBalanzaLista = () => {
    const arr = [];
    for (let m = 1; m <= 12; m++) {
      if ((balanzaAnual[m] || []).length > 0) arr.push(m);
    }
    return arr;
  };

  // Para Estados Financieros y Analíticas: usa todos los meses con balanza.
  // Si no hay ninguno, cae a validados.
  const mesesParaEF = () => {
    const conDatos = mesesConBalanzaLista();
    return conDatos.length ? conDatos : mesesValidadosLista();
  };

  // Aplica formato de moneda (#,##0.00) a un rango de celdas numéricas de la hoja
  const aplicarFormatoMoneda = (ws, celdas) => {
    celdas.forEach(ref => { if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = '#,##0.00'; });
  };

  const [exportando, setExportando] = React.useState(false);

  // ── Analítica a 12 periodos: Ingresos y Gastos por naturaleza / tipo SAT ──
  // Construye las hojas de Analítica de Ingresos, Analítica de Gastos y Resumen
  // dentro de UN LIBRO YA EXISTENTE (wb). Se usa tanto para el botón de
  // Analítica independiente como para incluirlas dentro del archivo único de
  // Estados Financieros ("Descargar Todo").
  const construirHojasAnaliticas = (wb, logoId, meses) => {
    const nombreEmpresa = empresaSeleccionada?.nombre || '';
    const mapa = mapaCatGlobal;

    // Clasifica cada SUBCUENTA (no la cuenta de mayor) en su grupo de
    // analítica. Prioridad: 1) patrones específicos de Nómina/Seguridad
    // Social/PTU (para que SIEMPRE queden separados, es obligación tenerlos
    // aparte); 2) patrones de negocio comunes (ventas, administración, etc);
    // 3) si nada coincide pero la cuenta trae código agrupador del SAT
    // (idAgrupadorSAT, tal como lo pide la Contabilidad Electrónica), se usa
    // ese código como el grupo — es la clasificación oficial del SAT, más
    // confiable que adivinar por el nombre.
    function nombreAgrupador(cuentaObj, ancestroMayor, codigo) {
      // El catálogo de CONTPAQi normalmente solo trae el ID del agrupador SAT.
      // Si la exportación trae también el nombre, lo aprovechamos; si no,
      // mostramos una descripción humana basada en la cuenta/jerarquía y nunca
      // dejamos "Agrupador SAT 401.01" como etiqueta de presentación.
      const nombreSat =
        cuentaObj?.nombreAgrupadorSAT ||
        cuentaObj?.agrupadorSATNombre ||
        cuentaObj?.nombreAgrupador ||
        cuentaObj?.agrupadorNombre ||
        (typeof cuentaObj?.agrupadorSAT === 'string' && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(cuentaObj.agrupadorSAT) ? cuentaObj.agrupadorSAT : '') ||
        (typeof cuentaObj?.agrupador === 'string' && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(cuentaObj.agrupador) ? cuentaObj.agrupador : '');
      if (nombreSat) return String(nombreSat).trim();

      const base = String(cuentaObj?.nombre || ancestroMayor?.nombre || '').trim();
      if (base) return base.replace(/^(INGRESOS?|GASTOS?|COSTOS?)[:\\-\\s]+/i, '').trim();

      const id = cuentaObj?.idAgrupadorSAT || ancestroMayor?.idAgrupadorSAT || '';
      return id ? `Grupo ${id}` : 'Sin grupo específico';
    }

    function grupoAnalitica(cuentaObj, ancestroMayor, codigo) {
      const tipo = (cuentaObj?.tipo || ancestroMayor?.tipo || '').toUpperCase();
      const nombre = ((cuentaObj?.nombre || '') + ' ' + (ancestroMayor?.nombre || '') + ' ' + codigo).toUpperCase();
      const digito = String(codigo || '').replace(/\D/g, '')[0] || '';
      const esIngreso = tipo === 'H' || digito === '4';
      const esGasto = tipo === 'G' || digito === '5' || digito === '6' || digito === '7';
      const grupoNatural = nombreAgrupador(cuentaObj, ancestroMayor, codigo);

      if (esIngreso) {
        if (/(FINANCIER|PRODUCTO FINAN|INTERES GANAD|OTROS INGRES|NO RECURRENTE)/.test(nombre)) return { hoja: 'ingresos', grupo: 'Otros ingresos / financieros' };
        if (/(VENTA|INGRESO|INGRESOS)/.test(nombre)) return { hoja: 'ingresos', grupo: 'Ingresos por ventas / servicios' };
        return { hoja: 'ingresos', grupo: grupoNatural === String(cuentaObj?.idAgrupadorSAT || '') ? 'Ingresos (otros)' : `Ingresos — ${grupoNatural}` };
      }
      if (esGasto) {
        if (/(NOMINA|SUELDO|SALARIO|COMISIONES AL PERSONAL|HONORARIOS AL PERSONAL|VACACION|AGUINALDO|PRIMA VACACIONAL|FINIQUITO|LIQUIDACION DE PERSONAL)/.test(nombre)) {
          return { hoja: 'gastos', grupo: 'Gastos de Nómina y Sueldos' };
        }
        if (/(IMSS|SEGURO SOCIAL|INFONAVIT|INFONACOT|\\bSAR\\b|CUOTA OBRERO|CUOTA PATRONAL|CUOTAS OBRERO|CUOTAS PATRONAL)/.test(nombre)) {
          return { hoja: 'gastos', grupo: 'Seguridad Social (IMSS / INFONAVIT / SAR)' };
        }
        if (/(\\bPTU\\b|REPARTO DE UTILIDADES)/.test(nombre)) {
          return { hoja: 'gastos', grupo: 'PTU (Reparto de Utilidades)' };
        }
        if (/(IMPUESTO SOBRE NOMINA|IMPUESTOS SOBRE NOMINA|IMPUESTO.*NOMINA|IMPUESTOS.*NOMINA)/.test(nombre)) {
          return { hoja: 'gastos', grupo: 'Impuestos sobre Nómina' };
        }
        if (/(MANTENIMIENTO|MANTTO)/.test(nombre)) {
          return { hoja: 'gastos', grupo: 'Mantenimiento' };
        }
        if (/(COSTO DE VENTA|COSTO DE VENTAS|COSTO DIRECTO|COSTO VARIABLE)/.test(nombre)) return { hoja: 'gastos', grupo: 'Costo de ventas' };
        if (/(ADMINISTRAT)/.test(nombre)) return { hoja: 'gastos', grupo: 'Gastos de administración' };
        if (/(VENTA|COMERCIAL|DISTRIBUC)/.test(nombre)) return { hoja: 'gastos', grupo: 'Gastos de venta' };
        if (/(FINANCIER|INTERES|COMISION BANC)/.test(nombre)) return { hoja: 'gastos', grupo: 'Gastos financieros' };
        if (/(DEPRECI|AMORTIZ)/.test(nombre)) return { hoja: 'gastos', grupo: 'Depreciaciones y amortizaciones' };
        if (/(NO DEDUCIBLE|\\bISR\\b)/.test(nombre)) return { hoja: 'gastos', grupo: 'Gastos no deducibles / fiscales' };
        return { hoja: 'gastos', grupo: grupoNatural === String(cuentaObj?.idAgrupadorSAT || '') ? 'Gastos de operación (otros)' : `Gastos — ${grupoNatural}` };
      }
      return null;
    }

    function movimientoMes(fila) {
      const c = parseFloat(fila.cargos || 0) || 0;
      const a = parseFloat(fila.abonos || 0) || 0;
      return { cargos: c, abonos: a, neto: c - a };
    }

    const ingresosMap = {};
    const gastosMap = {};

    meses.forEach(m => {
      const balanza = balanzaAnual[m] || [];
      // IMPORTANTE: CONTPAQi puede traer una cuenta padre con el total de sus
      // subcuentas y también las subcuentas con sus propios movimientos.
      // Tomar cargos/abonos crudos aquí duplicaba ingresos/gastos. Usamos el
      // residual por fila: el padre conserva únicamente movimiento propio y,
      // si es mero totalizador de sus hijas, su residual queda en cero.
      const residuales = calcularResidualesPorFila(balanza, mapa, 'movimiento');
      balanza.forEach(fila => {
        const cod = fila.cuenta || fila.codigo || '';
        const codN = normCuenta(cod);
        const cat = mapa[codN] || { codigo: cod, nombre: fila.nombre || '', tipo: '' };
        const residual = Number(residuales[codN] || 0);
        if (Math.abs(residual) < 0.000001) return; // no duplicar cuentas padre totalizadoras

        let ancestroMayor = null;
        try {
          if (typeof obtenerAncestroMayor === 'function') ancestroMayor = obtenerAncestroMayor(cod, mapa);
        } catch (e) {}
        const g = grupoAnalitica(cat, ancestroMayor, cod);
        if (!g) return;
        // El residual ya viene con la naturaleza contable normalizada:
        // ingreso acreedor positivo; gasto/costo deudor positivo.
        const valor = residual;
        const target = g.hoja === 'ingresos' ? ingresosMap : gastosMap;
        const key = codN;
        // Departamento = cuenta de Mayor a la que pertenece la subcuenta de
        // resultados deudora (p.ej. "GASTOS DE ADMINISTRACIÓN", "GASTOS DE
        // VENTAS", "GASTOS DE PRODUCCIÓN"...). Es el nivel de Mayor real del
        // catálogo, no un texto adivinado.
        const departamento = (ancestroMayor?.nombre || cat.nombre || fila.nombre || 'Sin departamento asignado').toString().trim();
        if (!target[key]) target[key] = { codigo: cod, nombre: cat.nombre || fila.nombre || cod, grupo: g.grupo, departamento, porMes: {} };
        target[key].porMes[m] = (target[key].porMes[m] || 0) + valor;
      });
    });

    function escribirHoja(nombreHoja, titulo, dataMap, colorHeader, porDepartamento) {
      const numCols = 2 + 12 + 1;
      const ws = wb.addWorksheet(nombreHoja, {
        views: [{ showGridLines: false, state: 'frozen', ySplit: 8, xSplit: 2 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });
      agregarEncabezadoHoja(ws, logoId, {
        empresa: nombreEmpresa,
        titulo: titulo,
        subtitulo: `Ejercicio ${ejercicio} · Meses con balanza: ${meses.map(m => MESES[m-1]).join(', ')} · Cifras en pesos · Generado con Orange Match`,
        numCols
      });
      ws.columns = [{ width: 11 }, { width: 30 }, ...Array(12).fill({ width: 9.5 }), { width: 12 }];

      const headerRow = ws.getRow(7);
      headerRow.values = ['Cuenta', 'Nombre / Grupo', ...MESES.map(m => m.slice(0, 3)), 'Total'];
      estiloEncabezadoTabla(headerRow, numCols);
      if (colorHeader) {
        for (let c = 1; c <= numCols; c++) {
          headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorHeader } };
        }
      }

      const colLetters = ['C','D','E','F','G','H','I','J','K','L','M','N'];
      let fila = 8;
      const filasTotalNivelSuperior = []; // filas que suman al GRAN TOTAL

      function escribirBloqueCuentas(items) {
        // Escribe las filas de cuentas de un grupo y regresa [inicio, fin]
        const inicio = fila;
        items.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))).forEach((item, idx) => {
          const row = ws.getRow(fila);
          row.getCell(1).value = item.codigo;
          row.getCell(2).value = item.nombre;
          for (let m = 1; m <= 12; m++) {
            const cell = row.getCell(2 + m);
            const v = item.porMes[m] || 0;
            cell.value = v;
            cell.numFmt = EXCEL_MONEDA;
            cell.alignment = { horizontal: 'right' };
            cell.font = { name: 'Calibri', size: 9 };
          }
          const totalCell = row.getCell(15);
          totalCell.value = { formula: `SUM(C${fila}:N${fila})` };
          totalCell.numFmt = EXCEL_MONEDA;
          totalCell.font = { name: 'Calibri', bold: true, size: 9 };
          totalCell.alignment = { horizontal: 'right' };
          if (idx % 2 === 1) sombreadoAlterno(row, numCols);
          fila++;
        });
        return [inicio, fila - 1];
      }

      function escribirSubtotal(etiqueta, inicioRango, finRango, size) {
        if (finRango < inicioRango) return null;
        const rowT = ws.getRow(fila);
        rowT.getCell(1).value = '';
        rowT.getCell(2).value = etiqueta;
        colLetters.forEach((letter, i) => {
          const cell = rowT.getCell(3 + i);
          cell.value = { formula: `SUM(${letter}${inicioRango}:${letter}${finRango})` };
          cell.numFmt = EXCEL_MONEDA;
          cell.font = { name: 'Calibri', bold: true, size: size || 10 };
          cell.alignment = { horizontal: 'right' };
        });
        rowT.getCell(15).value = { formula: `SUM(O${inicioRango}:O${finRango})` };
        rowT.getCell(15).numFmt = EXCEL_MONEDA;
        rowT.getCell(15).font = { name: 'Calibri', bold: true, size: size || 10 };
        estiloFilaTotal(rowT, numCols, false);
        const filaResultado = fila;
        fila++;
        return filaResultado;
      }

      function escribirSubtotalDeFilas(etiqueta, filas, size) {
        if (!filas.length) return null;
        const rowT = ws.getRow(fila);
        rowT.getCell(2).value = etiqueta;
        colLetters.forEach((letter, i) => {
          const refs = filas.map(r => letter + r).join('+');
          const cell = rowT.getCell(3 + i);
          cell.value = { formula: refs };
          cell.numFmt = EXCEL_MONEDA;
          cell.font = { name: 'Calibri', bold: true, size: size || 10 };
          cell.alignment = { horizontal: 'right' };
        });
        const refsO = filas.map(r => 'O' + r).join('+');
        rowT.getCell(15).value = { formula: refsO };
        rowT.getCell(15).numFmt = EXCEL_MONEDA;
        rowT.getCell(15).font = { name: 'Calibri', bold: true, size: size || 10 };
        estiloFilaTotal(rowT, numCols, false);
        const filaResultado = fila;
        fila++;
        return filaResultado;
      }

      if (porDepartamento) {
        // ── Nivel 1: Departamento (cuenta de Mayor). Nivel 2: tipo de gasto
        // (Nómina, Mantenimiento, Depreciaciones, etc., ya clasificado por
        // grupoAnalitica). Dentro de cada tipo, las cuentas de detalle.
        const porDepto = {};
        Object.values(dataMap).forEach(item => {
          const d = item.departamento || 'Sin departamento asignado';
          if (!porDepto[d]) porDepto[d] = {};
          const g = item.grupo || 'Otros';
          if (!porDepto[d][g]) porDepto[d][g] = [];
          porDepto[d][g].push(item);
        });

        Object.keys(porDepto).sort().forEach(depto => {
          const rowD = ws.getRow(fila);
          ws.mergeCells(fila, 1, fila, numCols);
          rowD.getCell(1).value = '■ ' + depto;
          rowD.getCell(1).font = { name: 'Calibri', bold: true, size: 12, color: { argb: EXCEL_COLOR.white } };
          for (let c = 1; c <= numCols; c++) {
            rowD.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A148C' } };
          }
          fila++;

          const filasTotalGrupoDepto = [];
          Object.keys(porDepto[depto]).sort().forEach(grupo => {
            const rowG = ws.getRow(fila);
            ws.mergeCells(fila, 1, fila, numCols);
            rowG.getCell(1).value = '   ▸ ' + grupo;
            rowG.getCell(1).font = { name: 'Calibri', bold: true, size: 11, color: { argb: EXCEL_COLOR.white } };
            for (let c = 1; c <= numCols; c++) {
              rowG.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.navy } };
            }
            fila++;

            const [inicioGrupo, finGrupo] = escribirBloqueCuentas(porDepto[depto][grupo]);
            const filaSub = escribirSubtotal('Subtotal ' + grupo, inicioGrupo, finGrupo, 9);
            if (filaSub) filasTotalGrupoDepto.push(filaSub);
          });

          const filaDepto = escribirSubtotalDeFilas('TOTAL ' + depto, filasTotalGrupoDepto, 11);
          if (filaDepto) filasTotalNivelSuperior.push(filaDepto);
          fila++;
        });
      } else {
        const porGrupo = {};
        Object.values(dataMap).forEach(item => {
          if (!porGrupo[item.grupo]) porGrupo[item.grupo] = [];
          porGrupo[item.grupo].push(item);
        });

        Object.keys(porGrupo).sort().forEach(grupo => {
          const rowG = ws.getRow(fila);
          ws.mergeCells(fila, 1, fila, numCols);
          rowG.getCell(1).value = '▸ ' + grupo;
          rowG.getCell(1).font = { name: 'Calibri', bold: true, size: 11, color: { argb: EXCEL_COLOR.white } };
          for (let c = 1; c <= numCols; c++) {
            rowG.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.navy } };
          }
          fila++;

          const [inicioGrupo, finGrupo] = escribirBloqueCuentas(porGrupo[grupo]);
          const filaSub = escribirSubtotal('TOTAL ' + grupo, inicioGrupo, finGrupo, 10);
          if (filaSub) filasTotalNivelSuperior.push(filaSub);
          fila++;
        });
      }

      if (filasTotalNivelSuperior.length) {
        const rowGT = ws.getRow(fila);
        rowGT.getCell(2).value = 'GRAN TOTAL';
        colLetters.forEach((letter, i) => {
          const refs = filasTotalNivelSuperior.map(r => letter + r).join('+');
          const cell = rowGT.getCell(3 + i);
          cell.value = { formula: refs };
          cell.numFmt = EXCEL_MONEDA;
          cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: EXCEL_COLOR.white } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.purple } };
          cell.alignment = { horizontal: 'right' };
        });
        const refsO = filasTotalNivelSuperior.map(r => 'O' + r).join('+');
        rowGT.getCell(15).value = { formula: refsO };
        rowGT.getCell(15).numFmt = EXCEL_MONEDA;
        rowGT.getCell(15).font = { name: 'Calibri', bold: true, size: 11, color: { argb: EXCEL_COLOR.white } };
        rowGT.getCell(15).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.purple } };
        fila += 2;
      }

      agregarPieHoja(ws, fila + 1, numCols);
    }

    escribirHoja('Analítica Ingresos', 'ANALÍTICA DE INGRESOS — 12 PERIODOS', ingresosMap, 'FF2E7D32', false);

    // Una hoja por departamento (no todo amontonado en una sola), para que se
    // vea ordenado: cada departamento es la cuenta de Mayor de resultados
    // deudora a la que pertenece el gasto (ver 'departamento' más arriba).
    // Dentro de cada hoja, el agrupado por tipo de gasto (Nómina, Mantenimiento,
    // Depreciaciones, etc.) se mantiene igual que antes.
    const porDepto = {};
    Object.values(gastosMap).forEach(item => {
      const d = item.departamento || 'Sin departamento asignado';
      if (!porDepto[d]) porDepto[d] = {};
      porDepto[d][item.codigo + '|' + item.nombre] = item;
    });
    const nombresUsados = new Set();
    const nombreHojaValido = (texto) => {
      // Excel: máx 31 caracteres, sin : \ / ? * [ ]
      let base = String(texto).replace(/[:\\/?*\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
      let corto = base.length > 28 ? base.slice(0, 28).trim() : base;
      let candidato = corto;
      let n = 2;
      while (nombresUsados.has(candidato.toUpperCase())) { candidato = `${corto.slice(0, 25).trim()} (${n})`; n++; }
      nombresUsados.add(candidato.toUpperCase());
      return candidato;
    };
    Object.keys(porDepto).sort().forEach(depto => {
      escribirHoja(
        nombreHojaValido(depto),
        `ANALÍTICA DE GASTOS — ${depto.toUpperCase()} — 12 PERIODOS`,
        porDepto[depto],
        'FFC62828',
        false
      );
    });

    // Hoja resumen
    {
      const ws = wb.addWorksheet('Resumen Analítico', { views: [{ showGridLines: false }] });
      agregarEncabezadoHoja(ws, logoId, {
        empresa: nombreEmpresa,
        titulo: 'RESUMEN ANALÍTICO DEL EJERCICIO',
        subtitulo: `${ejercicio} · Orange Match`,
        numCols: 4
      });
      ws.columns = [{ width: 36 }, { width: 16 }, { width: 16 }, { width: 16 }];
      const hr = ws.getRow(7);
      hr.values = ['Concepto', 'Total ejercicio', 'Promedio mensual', 'Meses con dato'];
      estiloEncabezadoTabla(hr, 4);

      function totalMap(map) {
        let t = 0, mesesSet = new Set();
        Object.values(map).forEach(item => {
          Object.entries(item.porMes).forEach(([m, v]) => { t += v; if (v) mesesSet.add(m); });
        });
        return { t, n: mesesSet.size || 1 };
      }
      const ti = totalMap(ingresosMap);
      const tg = totalMap(gastosMap);
      const r8 = ws.getRow(8); r8.values = ['Total Ingresos', ti.t, ti.t / ti.n, ti.n];
      const r9 = ws.getRow(9); r9.values = ['Total Gastos / Costos', tg.t, tg.t / tg.n, tg.n];
      const r10 = ws.getRow(10); r10.values = ['Utilidad (Ingresos − Gastos)', ti.t - tg.t, (ti.t - tg.t) / Math.max(ti.n, tg.n), ''];
      [8,9,10].forEach(rn => {
        for (let c = 2; c <= 3; c++) { ws.getRow(rn).getCell(c).numFmt = EXCEL_MONEDA; }
      });
      estiloFilaTotal(ws.getRow(10), 4, (ti.t - tg.t) < 0);
      agregarPieHoja(ws, 12, 4);
    }
  };

  const exportarAnaliticas12 = async () => {
    setExportando(true);
    try {
      const meses = mesesParaEF();
      if (!meses.length) {
        alert('Sube al menos una balanza del ejercicio para generar la analítica.');
        setExportando(false);
        return;
      }
      const { wb, logoId } = await crearLibroExcel();
      const nombreEmpresa = empresaSeleccionada?.nombre || '';
      construirHojasAnaliticas(wb, logoId, meses);
      await descargarLibroExcel(wb, `Analitica_12_periodos_${nombreEmpresa}_${ejercicio}.xlsx`);
    } catch (e) {
      alert(' Error al generar analítica: ' + e.message);
      console.error(e);
    } finally {
      setExportando(false);
    }
  };

  const exportarEstadosFinancieros = async () => {
    setExportando(true);
    try {
      const { wb, logoId } = await crearLibroExcel();
      const mesesVal = mesesParaEF();
      if (!mesesVal.length) {
        alert('No hay balanzas cargadas para este ejercicio. Sube al menos un mes en la pestaña Balanzas y Amarres.');
        setExportando(false);
        return;
      }
      const nombreEmpresa = empresaSeleccionada?.nombre || '';
      const ultimoMes = mesesVal[mesesVal.length - 1];
      const balanzaCorte = balanzaAnual[ultimoMes] || [];
      const suma = arr => arr.reduce((a, b) => a + b, 0);

      // ══════════════ HOJA 1: BALANZA (del mes de corte) ══════════════
      {
        const numCols = 8;
        const ws = wb.addWorksheet('Balanza', { views: [{ showGridLines: false, state: 'frozen', ySplit: 7 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 } } });
        agregarEncabezadoHoja(ws, logoId, {
          empresa: nombreEmpresa, titulo: 'BALANZA DE COMPROBACIÓN',
          subtitulo: `Corte: ${ultimoMes ? MESES[ultimoMes - 1] + ' de ' : ''}${ejercicio}`,
          numCols
        });
        ws.columns = [{ width: 18 }, { width: 38 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }];
        const headerRow = ws.getRow(7);
        headerRow.values = ['Cuenta', 'Nombre', 'Saldo Inicial Deudor', 'Saldo Inicial Acreedor', 'Cargos', 'Abonos', 'Saldo Final Deudor', 'Saldo Final Acreedor'];
        estiloEncabezadoTabla(headerRow, numCols);
        let fila = 8;
        const cuentasPadreBalanza = new Set();
        Object.values(mapaCatGlobal).forEach(c => {
          const sup = normCuenta(c.ctaSup);
          if (sup && !/^0+$/.test(sup)) cuentasPadreBalanza.add(sup);
        });
        balanzaCorte.forEach((f, i) => {
          const row = ws.getRow(fila);
          row.values = [f.cuenta, f.nombre, f.si_d, f.si_a, f.cargos, f.abonos, f.sf_d, f.sf_a];
          const ctaCat = mapaCatGlobal[normCuenta(f.cuenta)];
          const esMayor = Number(ctaCat?.ctaMayor) === 1;
          const esAgrupadora = cuentasPadreBalanza.has(normCuenta(f.cuenta));
          const negrita = esMayor || esAgrupadora;
          for (let c = 3; c <= 8; c++) {
            row.getCell(c).numFmt = EXCEL_MONEDA;
            row.getCell(c).font = { name: 'Calibri', size: 9, bold: negrita };
            row.getCell(c).alignment = { horizontal: 'right' };
          }
          row.getCell(1).font = { name: 'Calibri', size: 9, bold: negrita };
          row.getCell(2).font = { name: 'Calibri', size: 9, bold: negrita };
          if (esAgrupadora && !esMayor) {
            row.getCell(1).font = { name: 'Calibri', size: 9, bold: true, italic: true };
            row.getCell(2).font = { name: 'Calibri', size: 9, bold: true, italic: true };
          }
          if (i % 2 === 1) sombreadoAlterno(row, numCols);
          fila++;
        });
        agregarPieHoja(ws, fila + 1, numCols);
      }

      // ══════════════ HOJA 2: ESTADO DE RESULTADOS (con fórmulas reales) ══════════════
      {
        const numCols = 2 + mesesVal.length;
        const ws = wb.addWorksheet('Estado de Resultados', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 } } });
        agregarEncabezadoHoja(ws, logoId, {
          empresa: nombreEmpresa, titulo: 'ESTADO DE RESULTADOS',
          subtitulo: `Del 1 de enero al ${ultimoMes ? MESES[ultimoMes - 1] + ' de ' : ''}${ejercicio} (meses con amarre validado) · Cifras en pesos mexicanos · Formulado de conformidad con las NIF`,
          numCols
        });
        ws.columns = [{ width: 42 }, ...mesesVal.map(() => ({ width: 14 })), { width: 16 }];
        const headerRowIdx = 7;
        const headerRow = ws.getRow(headerRowIdx);
        headerRow.values = ['Concepto', ...mesesVal.map(m => MESES[m - 1]), 'Acumulado'];
        estiloEncabezadoTabla(headerRow, numCols);

        let fila = headerRowIdx + 1;
        function filaDatos(nombre, valoresPorMes) {
          const row = ws.getRow(fila);
          row.getCell(1).value = nombre;
          row.getCell(1).font = { name: 'Calibri', size: 11 };
          valoresPorMes.forEach((v, i) => {
            const cell = row.getCell(2 + i);
            cell.value = v; cell.numFmt = EXCEL_MONEDA; cell.font = { name: 'Calibri', size: 11 };
            cell.alignment = { horizontal: 'right' };
          });
          if (mesesVal.length) {
            const c1 = ws.getCell(fila, 2).address, c2 = ws.getCell(fila, 1 + mesesVal.length).address;
            const acumCell = row.getCell(2 + mesesVal.length);
            acumCell.value = { formula: `SUM(${c1}:${c2})` };
            acumCell.numFmt = EXCEL_MONEDA; acumCell.font = { name: 'Calibri', size: 11 }; acumCell.alignment = { horizontal: 'right' };
          }
          if ((fila - headerRowIdx) % 2 === 0) sombreadoAlterno(row, numCols);
          const nFila = fila; fila++;
          return nFila;
        }
        function filaFormulaSuma(nombre, filasASumar) {
          const row = ws.getRow(fila);
          row.getCell(1).value = nombre;
          row.getCell(1).font = { name: 'Calibri', bold: true, size: 11 };
          for (let i = 0; i < mesesVal.length; i++) {
            const col = 2 + i;
            const refs = filasASumar.map(f => ws.getCell(f, col).address).join('+');
            const cell = row.getCell(col);
            cell.value = { formula: refs }; cell.numFmt = EXCEL_MONEDA; cell.font = { name: 'Calibri', bold: true, size: 11 }; cell.alignment = { horizontal: 'right' };
          }
          const colAcum = 2 + mesesVal.length;
          const refsAcum = filasASumar.map(f => ws.getCell(f, colAcum).address).join('+');
          const cellAcum = row.getCell(colAcum);
          cellAcum.value = { formula: mesesVal.length ? refsAcum : '0' };
          cellAcum.numFmt = EXCEL_MONEDA; cellAcum.font = { name: 'Calibri', bold: true, size: 11 }; cellAcum.alignment = { horizontal: 'right' };
          for (let c = 1; c <= numCols; c++) row.getCell(c).border = { top: { style: 'thin', color: { argb: EXCEL_COLOR.border } } };
          const nFila = fila; fila++;
          return nFila;
        }

        const ingresosPorMes = mesesVal.map(m => totalPorCategoria(balanzaAnual[m] || [], 'ingresos'));
        const costosPorMes = mesesVal.map(m => -Math.abs(totalPorCategoria(balanzaAnual[m] || [], 'costos')));
        const gastosOpPorMes = mesesVal.map(m => -Math.abs(totalPorCategoria(balanzaAnual[m] || [], 'gastos_operativos')));
        const otrosIngPorMes = mesesVal.map(m => totalPorCategoria(balanzaAnual[m] || [], 'otros_ingresos'));
        const gastosFinPorMes = mesesVal.map(m => -Math.abs(totalPorCategoria(balanzaAnual[m] || [], 'gastos_financieros')));
        const otrosGastPorMes = mesesVal.map(m => -Math.abs(totalPorCategoria(balanzaAnual[m] || [], 'otros_gastos')));

        const fIngresos = filaDatos('Ingresos', ingresosPorMes);
        const fCostos = filaDatos('Costos', costosPorMes);
        const fUtilBruta = filaFormulaSuma('Utilidad Bruta', [fIngresos, fCostos]);
        const fGastosOp = filaDatos('Gastos de Operación', gastosOpPorMes);
        const fUtilOp = filaFormulaSuma('Utilidad de Operación', [fUtilBruta, fGastosOp]);
        const fOtrosIng = filaDatos('Otros Ingresos', otrosIngPorMes);
        const fGastosFin = filaDatos('Gastos Financieros', gastosFinPorMes);
        const fOtrosGast = filaDatos('Otros Gastos', otrosGastPorMes);
        const fUtilFinal = filaFormulaSuma('Utilidad antes de Impuestos a la Utilidad', [fUtilOp, fOtrosIng, fGastosFin, fOtrosGast]);

        const totalUtilFinal = suma(ingresosPorMes) + suma(costosPorMes) + suma(gastosOpPorMes) + suma(otrosIngPorMes) + suma(gastosFinPorMes) + suma(otrosGastPorMes);
        estiloFilaTotal(ws.getRow(fUtilFinal), numCols, totalUtilFinal < 0);

        agregarPieHoja(ws, fila + 1, numCols);
      }

      // ══════════════ HOJA 3: ESTADO DE SITUACIÓN FINANCIERA (con fórmulas reales) ══════════════
      {
        const numCols = 6;
        const ws = wb.addWorksheet('Situación Financiera', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 } } });
        agregarEncabezadoHoja(ws, logoId, {
          empresa: nombreEmpresa, titulo: 'ESTADO DE SITUACIÓN FINANCIERA',
          subtitulo: `Al ${ultimoMes ? 'último día de ' + MESES[ultimoMes - 1] : 'corte'} de ${ejercicio} · Cifras en pesos mexicanos · Formulado de conformidad con las NIF`,
          numCols
        });
        ws.columns = [{ width: 32 }, { width: 18 }, { width: 3 }, { width: 40 }, { width: 18 }, { width: 3 }];

        // Detalle a NIVEL CUENTA DE MAYOR. Las subcuentas no se muestran
        // individualmente en el Balance: se acumulan dentro de su Mayor.
        // El residual evita volver a sumar una cuenta padre que ya contiene el
        // total de sus hijas.
        const detalleBalancePorCategoria = (categoriaEF) => calcularDetalleCategoriaBalance(balanzaCorte, mapaCatGlobal, categoriaEF);

        const activoCirc = detalleBalancePorCategoria('activo_circulante');
        const activoNoCirc = detalleBalancePorCategoria('activo_no_circulante');
        const pasivoCorto = detalleBalancePorCategoria('pasivo_corto_plazo');
        const pasivoLargo = detalleBalancePorCategoria('pasivo_largo_plazo');
        const capitalCont = detalleBalancePorCategoria('capital_contribuido');
        const utilidadEjercicioTotal = calcularUtilidadEjercicio(balanzaCorte);
        const capitalGanTotal = detalleBalancePorCategoria('capital_ganado').total + utilidadEjercicioTotal;

        const rEnc = ws.getRow(7);
        rEnc.getCell(1).value = 'ACTIVO'; rEnc.getCell(4).value = 'PASIVO';
        [1, 4].forEach(c => { rEnc.getCell(c).font = { name: 'Calibri', bold: true, size: 12, color: { argb: EXCEL_COLOR.navy } }; });
        for (let c = 1; c <= numCols; c++) rEnc.getCell(c).border = { bottom: { style: 'medium', color: { argb: EXCEL_COLOR.navy } } };

        // AGRUPADORA -> CUENTAS DE MAYOR -> TOTAL DE LA SECCIÓN, en dos
        // columnas independientes (Activo a la izquierda, Pasivo + Capital a
        // la derecha). Para que "TOTAL ACTIVO" y "TOTAL PASIVO + CAPITAL"
        // queden exactamente en el mismo renglón (como en un balance impreso
        // tradicional), primero se calcula cuántas filas ocupa cada lado y el
        // lado más corto se rellena con filas en blanco antes de escribir su
        // total, en vez de calcular la posición del total sobre la marcha.
        const cgDetalle = detalleBalancePorCategoria('capital_ganado').detalle;
        const filasBloque = (datos) => 1 + datos.detalle.length + 1; // título + detalle + total
        const filasIzquierda = filasBloque(activoCirc) + filasBloque(activoNoCirc) + 1; // +1 = TOTAL ACTIVO
        const filasDerecha = filasBloque(pasivoCorto) + filasBloque(pasivoLargo) + 1 // +1 = TOTAL PASIVO
          + 1 // blanco antes de Capital
          + 1 // título CAPITAL CONTABLE
          + 1 + capitalCont.detalle.length // Capital Contribuido + su detalle
          + 1 + cgDetalle.length + (utilidadEjercicioTotal !== 0 ? 1 : 0) // Capital Ganado + su detalle + utilidad
          + 1 // TOTAL CAPITAL CONTABLE
          + 1 // blanco antes de TOTAL PASIVO + CAPITAL
          + 1; // TOTAL PASIVO + CAPITAL
        const filasFinales = Math.max(filasIzquierda, filasDerecha);

        let rL = 8, rR = 8;
        const bloqueL = (categoria, titulo) => {
          const datos = detalleBalancePorCategoria(categoria);
          const h = ws.getRow(rL++);
          h.getCell(1).value = titulo; h.getCell(1).font = { name: 'Calibri', bold: true, size: 11, color: { argb: EXCEL_COLOR.navy } };
          datos.detalle.forEach(d => {
            const rr = ws.getRow(rL++);
            rr.getCell(1).value = `${d.codigo} — ${d.nombre}`;
            rr.getCell(1).font = { name: 'Calibri', bold: true, size: 11 };
            rr.getCell(2).value = d.saldo; rr.getCell(2).numFmt = EXCEL_MONEDA; rr.getCell(2).alignment = { horizontal: 'right' };
            rr.getCell(1).alignment = { indent: 1 };
          });
          const rt = ws.getRow(rL++);
          rt.getCell(1).value = 'TOTAL ' + titulo.toUpperCase();
          rt.getCell(2).value = datos.total; rt.getCell(2).numFmt = EXCEL_MONEDA;
          rt.getCell(1).font = { name: 'Calibri', bold: true, size: 11 }; rt.getCell(2).font = { name: 'Calibri', bold: true, size: 11 };
          for (let c=1;c<=2;c++) rt.getCell(c).border={top:{style:'thin',color:{argb:EXCEL_COLOR.border}}};
          return rt;
        };
        const bloqueR = (categoria, titulo) => {
          const datos = detalleBalancePorCategoria(categoria);
          const h = ws.getRow(rR++);
          h.getCell(4).value = titulo; h.getCell(4).font = { name: 'Calibri', bold: true, size: 11, color: { argb: EXCEL_COLOR.navy } };
          datos.detalle.forEach(d => {
            const rr = ws.getRow(rR++);
            rr.getCell(4).value = `${d.codigo} — ${d.nombre}`;
            rr.getCell(4).font = { name: 'Calibri', bold: true, size: 11 };
            rr.getCell(5).value = d.saldo; rr.getCell(5).numFmt = EXCEL_MONEDA; rr.getCell(5).alignment = { horizontal: 'right' };
            rr.getCell(4).alignment = { indent: 1 };
          });
          const rt = ws.getRow(rR++);
          rt.getCell(4).value = 'TOTAL ' + titulo.toUpperCase();
          rt.getCell(5).value = datos.total; rt.getCell(5).numFmt = EXCEL_MONEDA;
          rt.getCell(4).font = { name: 'Calibri', bold: true, size: 11 }; rt.getCell(5).font = { name: 'Calibri', bold: true, size: 11 };
          for (let c=4;c<=5;c++) rt.getCell(c).border={top:{style:'thin',color:{argb:EXCEL_COLOR.border}}};
          return rt;
        };

        const fAC = bloqueL('activo_circulante', 'ACTIVO CIRCULANTE');
        const fANC = bloqueL('activo_no_circulante', 'ACTIVO NO CIRCULANTE');
        // Relleno para que TOTAL ACTIVO caiga en el mismo renglón que
        // TOTAL PASIVO + CAPITAL, sea cual sea el lado más largo.
        rL = 8 + (filasFinales - 1);
        const fTotalActivo = ws.getRow(rL);
        fTotalActivo.getCell(1).value = 'TOTAL ACTIVO';
        fTotalActivo.getCell(2).value = { formula: `${fAC.getCell(2).address}+${fANC.getCell(2).address}` };
        fTotalActivo.getCell(1).font = { name: 'Calibri', bold: true, size: 11 }; fTotalActivo.getCell(2).font = { name: 'Calibri', bold: true, size: 11 }; fTotalActivo.getCell(2).numFmt = EXCEL_MONEDA;
        for (let c=1;c<=2;c++) fTotalActivo.getCell(c).border={top:{style:'double',color:{argb:EXCEL_COLOR.navy}}};

        const fPC = bloqueR('pasivo_corto_plazo', 'PASIVO A CORTO PLAZO');
        const fPL = bloqueR('pasivo_largo_plazo', 'PASIVO A LARGO PLAZO');
        const fTotalPasivo = ws.getRow(rR++);
        fTotalPasivo.getCell(4).value = 'TOTAL PASIVO';
        fTotalPasivo.getCell(5).value = { formula: `${fPC.getCell(5).address}+${fPL.getCell(5).address}` };
        fTotalPasivo.getCell(4).font = { name: 'Calibri', bold: true, size: 11 }; fTotalPasivo.getCell(5).font = { name: 'Calibri', bold: true, size: 11 }; fTotalPasivo.getCell(5).numFmt = EXCEL_MONEDA;

        const capStart = rR + 1;
        const capH = ws.getRow(capStart); capH.getCell(4).value = 'CAPITAL CONTABLE'; capH.getCell(4).font = { name: 'Calibri', bold: true, size: 11, color: { argb: EXCEL_COLOR.navy } };
        const capC = ws.getRow(capStart + 1); capC.getCell(4).value = 'Capital Contribuido';
        capC.getCell(5).value = capitalCont.total; capC.getCell(5).numFmt = EXCEL_MONEDA; capC.getCell(4).font = { name: 'Calibri', bold: true, size: 11 };
        capitalCont.detalle.forEach((d, idx) => {
          const rr = ws.getRow(capStart + 2 + idx); rr.getCell(4).value = `${d.codigo} — ${d.nombre}`; rr.getCell(4).font = { name: 'Calibri', bold: true, size: 11 }; rr.getCell(4).alignment = { indent: 1 };
          rr.getCell(5).value = d.saldo; rr.getCell(5).numFmt = EXCEL_MONEDA;
        });
        const capGRow = capStart + 2 + capitalCont.detalle.length;
        const capG = ws.getRow(capGRow); capG.getCell(4).value = 'Capital Ganado (incluye Utilidad del Ejercicio)'; capG.getCell(4).font = { name: 'Calibri', bold: true, size: 11 };
        capG.getCell(5).value = capitalGanTotal; capG.getCell(5).numFmt = EXCEL_MONEDA;
        cgDetalle.forEach((d, idx) => {
          const rr = ws.getRow(capGRow + 1 + idx); rr.getCell(4).value = `${d.codigo} — ${d.nombre}`; rr.getCell(4).font = { name: 'Calibri', bold: true, size: 11 }; rr.getCell(4).alignment = { indent: 1 };
          rr.getCell(5).value = d.saldo; rr.getCell(5).numFmt = EXCEL_MONEDA;
        });
        const utilidadRow = capGRow + 1 + cgDetalle.length;
        if (utilidadEjercicioTotal !== 0) {
          const rr = ws.getRow(utilidadRow); rr.getCell(4).value = 'Utilidad (Pérdida) del Ejercicio'; rr.getCell(5).value = utilidadEjercicioTotal; rr.getCell(5).numFmt = EXCEL_MONEDA;
        }
        const fTotalCapital = ws.getRow(utilidadRow + 1);
        fTotalCapital.getCell(4).value = 'TOTAL CAPITAL CONTABLE';
        fTotalCapital.getCell(5).value = { formula: `${capC.getCell(5).address}+${capG.getCell(5).address}` };
        fTotalCapital.getCell(4).font = { name: 'Calibri', bold: true, size: 11 }; fTotalCapital.getCell(5).font = { name: 'Calibri', bold: true, size: 11 }; fTotalCapital.getCell(5).numFmt = EXCEL_MONEDA;

        // TOTAL PASIVO + CAPITAL siempre en el mismo renglón que TOTAL ACTIVO.
        const fTotalPasivoCapital = ws.getRow(rL);
        fTotalPasivoCapital.getCell(4).value = 'TOTAL PASIVO + CAPITAL';
        fTotalPasivoCapital.getCell(5).value = { formula: `${fTotalPasivo.getCell(5).address}+${fTotalCapital.getCell(5).address}` };
        fTotalPasivoCapital.getCell(4).font = { name: 'Calibri', bold: true, size: 11 }; fTotalPasivoCapital.getCell(5).font = { name: 'Calibri', bold: true, size: 11 }; fTotalPasivoCapital.getCell(5).numFmt = EXCEL_MONEDA;
        for (let c=4;c<=5;c++) fTotalPasivoCapital.getCell(c).border={top:{style:'double',color:{argb:EXCEL_COLOR.navy}}};

        const totalActivoVal = activoCirc.total + activoNoCirc.total;
        const totalPasivoCapitalVal = pasivoCorto.total + pasivoLargo.total + capitalCont.total + capitalGanTotal;
        const cuadra = Math.abs(totalActivoVal - totalPasivoCapitalVal) < 1;
        const filaCuadra = rL + 2;
        ws.mergeCells(filaCuadra, 1, filaCuadra, numCols);
        const cuadraCell = ws.getCell(filaCuadra, 1);
        cuadraCell.value = cuadra
          ? ` El balance cuadra: Activo = Pasivo + Capital (${fmt(totalActivoVal)})`
          : ` Diferencia de ${fmt(Math.abs(totalActivoVal - totalPasivoCapitalVal))} — revisa la clasificación de cuentas en el catálogo`;
        cuadraCell.font = { name: 'Calibri', bold: true, italic: true, size: 11, color: { argb: cuadra ? EXCEL_COLOR.green : EXCEL_COLOR.red } };
        cuadraCell.alignment = { horizontal: 'center' };

        agregarPieHoja(ws, filaCuadra + 1, numCols);
      }

      // ══════════════ HOJA 4 (si hay 2+ meses validados): BALANCE A 12 PERIODOS EN VERTICAL ══════════════
      // A diferencia de la Hoja 3 (un solo balance, con fórmulas reales, del
      // mes de corte), aquí se muestra un renglón por CUENTA DE MAYOR y una
      // COLUMNA POR CADA MES VALIDADO (formato comparativo horizontal, como
      // las hojas de IVA/ISR/Analíticas). El universo de cuentas por
      // categoría es la unión de las cuentas que aparecieron en cualquier mes
      // validado; si una cuenta no tuvo saldo en un mes puntual, esa celda
      // queda en 0.
      if (mesesVal.length >= 2) {
        const numColsBal = 1 + mesesVal.length;
        const ws = wb.addWorksheet('Balance Comparativo 12P', {
          views: [{ showGridLines: false, state: 'frozen', ySplit: 7, xSplit: 1 }],
          pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 } }
        });
        agregarEncabezadoHoja(ws, logoId, {
          empresa: nombreEmpresa, titulo: 'BALANCE GENERAL COMPARATIVO POR PERIODO (DETALLE POR CUENTA DE MAYOR)',
          subtitulo: `Meses validados de ${ejercicio}: ${mesesVal.map(m => MESES[m - 1]).join(', ')} · Cifras en pesos mexicanos`,
          numCols: numColsBal
        });
        ws.columns = [{ width: 44 }, ...mesesVal.map(() => ({ width: 15 }))];

        const headerRowIdx = 7;
        const headerRow = ws.getRow(headerRowIdx);
        headerRow.values = ['Concepto', ...mesesVal.map(m => MESES[m - 1].slice(0, 3))];
        estiloEncabezadoTabla(headerRow, numColsBal);

        let fila = headerRowIdx + 1;

        // Junta, para una categoría de Estado Financiero, la unión de cuentas
        // de Mayor de todos los meses validados y el saldo de cada una por mes.
        const matrizCategoria = (categoriaEF) => {
          const nombrePorCodigo = {};
          const orden = [];
          const saldoPorMesYCodigo = {};
          mesesVal.forEach(m => {
            const d = detalleSaldoPorCategoria(balanzaAnual[m] || [], categoriaEF);
            saldoPorMesYCodigo[m] = {};
            d.detalle.forEach(item => {
              saldoPorMesYCodigo[m][item.codigo] = item.saldo;
              if (!(item.codigo in nombrePorCodigo)) { nombrePorCodigo[item.codigo] = item.nombre; orden.push(item.codigo); }
            });
          });
          orden.sort((a, b) => String(a).localeCompare(String(b)));
          return { orden, nombrePorCodigo, saldoPorMesYCodigo };
        };

        const filaTitulo = (texto) => {
          ws.mergeCells(fila, 1, fila, numColsBal);
          const c = ws.getCell(fila, 1);
          c.value = texto;
          c.font = { name: 'Calibri', bold: true, size: 12, color: { argb: EXCEL_COLOR.white } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.navy } };
          c.alignment = { vertical: 'middle', indent: 1 };
          ws.getRow(fila).height = 18;
          const nFila = fila; fila++; return nFila;
        };

        const filaCuenta = (etiqueta, valorPorMes, opts = {}) => {
          const row = ws.getRow(fila);
          row.getCell(1).value = etiqueta;
          row.getCell(1).font = { name: 'Calibri', size: opts.size || 9 };
          row.getCell(1).alignment = { indent: opts.indent ?? 2 };
          mesesVal.forEach((m, i) => {
            const cell = row.getCell(2 + i);
            cell.value = valorPorMes[m] || 0;
            cell.numFmt = EXCEL_MONEDA;
            cell.font = { name: 'Calibri', size: opts.size || 9 };
            cell.alignment = { horizontal: 'right' };
          });
          const nFila = fila; fila++; return nFila;
        };

        // Subtotal con fórmula SUM del rango de cuentas de arriba.
        const filaSubtotal = (etiqueta, inicio, fin) => {
          const row = ws.getRow(fila);
          row.getCell(1).value = etiqueta;
          row.getCell(1).font = { name: 'Calibri', bold: true, size: 11 };
          row.getCell(1).alignment = { indent: 1 };
          mesesVal.forEach((m, i) => {
            const col = 2 + i;
            const cell = row.getCell(col);
            cell.value = fin >= inicio ? { formula: `SUM(${ws.getCell(inicio, col).address}:${ws.getCell(fin, col).address})` } : 0;
            cell.numFmt = EXCEL_MONEDA; cell.font = { name: 'Calibri', bold: true, size: 11 }; cell.alignment = { horizontal: 'right' };
          });
          const nFila = fila; fila++; return nFila;
        };

        // Total general: suma de filas de subtotal referenciadas, con borde.
        const filaTotal = (etiqueta, filasASumar, opts = {}) => {
          const row = ws.getRow(fila);
          row.getCell(1).value = etiqueta;
          row.getCell(1).font = { name: 'Calibri', bold: true, size: 11 };
          mesesVal.forEach((m, i) => {
            const col = 2 + i;
            const cell = row.getCell(col);
            cell.value = { formula: filasASumar.map(f => ws.getCell(f, col).address).join('+') };
            cell.numFmt = EXCEL_MONEDA; cell.font = { name: 'Calibri', bold: true, size: 11 }; cell.alignment = { horizontal: 'right' };
            cell.border = { top: { style: opts.borde || 'thin', color: { argb: EXCEL_COLOR.navy } } };
          });
          const nFila = fila; fila++; return nFila;
        };

        const bloqueCategoria = (etiquetaSub, categoriaEF) => {
          const m = matrizCategoria(categoriaEF);
          const inicio = fila;
          m.orden.forEach(codigo => {
            const porMes = {};
            mesesVal.forEach(mes => { porMes[mes] = m.saldoPorMesYCodigo[mes][codigo] || 0; });
            filaCuenta(`${codigo} — ${m.nombrePorCodigo[codigo]}`, porMes);
          });
          const fin = fila - 1;
          return filaSubtotal(etiquetaSub, inicio, fin);
        };

        filaTitulo('ACTIVO');
        const subAC = bloqueCategoria('Activo Circulante', 'activo_circulante');
        const subANC = bloqueCategoria('Activo No Circulante', 'activo_no_circulante');
        const filaTotalActivo = filaTotal('TOTAL ACTIVO', [subAC, subANC]);
        fila++;

        filaTitulo('PASIVO');
        const subPC = bloqueCategoria('Pasivo a Corto Plazo', 'pasivo_corto_plazo');
        const subPL = bloqueCategoria('Pasivo a Largo Plazo', 'pasivo_largo_plazo');
        const filaTotalPasivo = filaTotal('Total Pasivo', [subPC, subPL]);
        fila++;

        filaTitulo('CAPITAL CONTABLE');
        const subCC = bloqueCategoria('Capital Contribuido', 'capital_contribuido');
        // Capital Ganado incluye, como una cuenta más, la Utilidad (Pérdida)
        // del Ejercicio calculada de cada mes (no viene en el catálogo).
        const mCG = matrizCategoria('capital_ganado');
        const inicioCG = fila;
        mCG.orden.forEach(codigo => {
          const porMes = {};
          mesesVal.forEach(mes => { porMes[mes] = mCG.saldoPorMesYCodigo[mes][codigo] || 0; });
          filaCuenta(`${codigo} — ${mCG.nombrePorCodigo[codigo]}`, porMes);
        });
        const utilidadPorMes = {};
        mesesVal.forEach(m => { utilidadPorMes[m] = calcularUtilidadEjercicio(balanzaAnual[m] || []); });
        filaCuenta('Utilidad (Pérdida) del Ejercicio', utilidadPorMes, { size: 9, indent: 2 });
        const finCG = fila - 1;
        const subCG = filaSubtotal('Capital Ganado (incl. Utilidad del Ejercicio)', inicioCG, finCG);
        const filaTotalCapital = filaTotal('Total Capital Contable', [subCC, subCG]);
        fila++;

        const filaTotalPasivoCapital = filaTotal('TOTAL PASIVO + CAPITAL', [filaTotalPasivo, filaTotalCapital], { borde: 'double' });

        // Fila de verificación: Activo = Pasivo + Capital, evaluada por mes.
        const filaVerifRow = ws.getRow(fila);
        filaVerifRow.getCell(1).value = 'Cuadre (Activo = Pasivo + Capital)';
        filaVerifRow.getCell(1).font = { name: 'Calibri', italic: true, size: 9, color: { argb: EXCEL_COLOR.gray } };
        mesesVal.forEach((m, i) => {
          const balMes = balanzaAnual[m] || [];
          const ac = detalleSaldoPorCategoria(balMes, 'activo_circulante').total + detalleSaldoPorCategoria(balMes, 'activo_no_circulante').total;
          const pc = detalleSaldoPorCategoria(balMes, 'pasivo_corto_plazo').total + detalleSaldoPorCategoria(balMes, 'pasivo_largo_plazo').total;
          const cc = detalleSaldoPorCategoria(balMes, 'capital_contribuido').total + detalleSaldoPorCategoria(balMes, 'capital_ganado').total + calcularUtilidadEjercicio(balMes);
          const cuadraMes = Math.abs(ac - (pc + cc)) < 1;
          const cell = filaVerifRow.getCell(2 + i);
          cell.value = cuadraMes ? '' : ` ${fmt(Math.abs(ac - (pc + cc)))}`;
          cell.font = { name: 'Calibri', bold: true, italic: true, size: 9, color: { argb: cuadraMes ? EXCEL_COLOR.green : EXCEL_COLOR.red } };
          cell.alignment = { horizontal: 'right' };
        });
        fila++;

        agregarPieHoja(ws, fila + 1, numColsBal);
      }

      // ══════════════ HOJA 5 (si hay 2+ meses validados): ESTADO DE RESULTADOS COMPARATIVO POR PERIODO (MESES EN HORIZONTAL) ══════════════
      // Mismo formato comparativo que la Hoja 4: un renglón por cuenta/
      // concepto, una columna por mes validado.
      if (mesesVal.length >= 2) {
        const numColsRes = 1 + mesesVal.length;
        const ws = wb.addWorksheet('Resultados Comparativo 12P', {
          views: [{ showGridLines: false, state: 'frozen', ySplit: 7, xSplit: 1 }],
          pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 } }
        });
        agregarEncabezadoHoja(ws, logoId, {
          empresa: nombreEmpresa, titulo: 'ESTADO DE RESULTADOS COMPARATIVO POR PERIODO (DETALLE POR CUENTA DE MAYOR)',
          subtitulo: `Meses validados de ${ejercicio}: ${mesesVal.map(m => MESES[m - 1]).join(', ')} · Cifras en pesos mexicanos`,
          numCols: numColsRes
        });
        ws.columns = [{ width: 44 }, ...mesesVal.map(() => ({ width: 15 }))];

        const headerRowIdx = 7;
        const headerRow = ws.getRow(headerRowIdx);
        headerRow.values = ['Concepto', ...mesesVal.map(m => MESES[m - 1].slice(0, 3))];
        estiloEncabezadoTabla(headerRow, numColsRes);

        let fila = headerRowIdx + 1;

        const matrizCategoria = (categoriaEF) => {
          const nombrePorCodigo = {};
          const orden = [];
          const saldoPorMesYCodigo = {};
          mesesVal.forEach(m => {
            const d = detalleFlujoPorCategoria(balanzaAnual[m] || [], categoriaEF);
            saldoPorMesYCodigo[m] = {};
            d.detalle.forEach(item => {
              saldoPorMesYCodigo[m][item.codigo] = item.saldo;
              if (!(item.codigo in nombrePorCodigo)) { nombrePorCodigo[item.codigo] = item.nombre; orden.push(item.codigo); }
            });
          });
          orden.sort((a, b) => String(a).localeCompare(String(b)));
          return { orden, nombrePorCodigo, saldoPorMesYCodigo };
        };

        const filaCuenta = (etiqueta, valorPorMes, opts = {}) => {
          const row = ws.getRow(fila);
          row.getCell(1).value = etiqueta;
          row.getCell(1).font = { name: 'Calibri', size: opts.size || 9 };
          row.getCell(1).alignment = { indent: opts.indent ?? 2 };
          mesesVal.forEach((m, i) => {
            const cell = row.getCell(2 + i);
            cell.value = valorPorMes[m] || 0;
            cell.numFmt = EXCEL_MONEDA;
            cell.font = { name: 'Calibri', size: opts.size || 9 };
            cell.alignment = { horizontal: 'right' };
          });
          const nFila = fila; fila++; return nFila;
        };

        const filaSubtotal = (etiqueta, inicio, fin) => {
          const row = ws.getRow(fila);
          row.getCell(1).value = etiqueta;
          row.getCell(1).font = { name: 'Calibri', bold: true, size: 11 };
          row.getCell(1).alignment = { indent: 1 };
          mesesVal.forEach((m, i) => {
            const col = 2 + i;
            const cell = row.getCell(col);
            cell.value = fin >= inicio ? { formula: `SUM(${ws.getCell(inicio, col).address}:${ws.getCell(fin, col).address})` } : 0;
            cell.numFmt = EXCEL_MONEDA; cell.font = { name: 'Calibri', bold: true, size: 11 }; cell.alignment = { horizontal: 'right' };
          });
          const nFila = fila; fila++; return nFila;
        };

        const filaTotal = (etiqueta, formula, opts = {}) => {
          const row = ws.getRow(fila);
          row.getCell(1).value = etiqueta;
          row.getCell(1).font = { name: 'Calibri', bold: true, size: 11 };
          mesesVal.forEach((m, i) => {
            const col = 2 + i;
            const cell = row.getCell(col);
            cell.value = { formula: formula(col) };
            cell.numFmt = EXCEL_MONEDA; cell.font = { name: 'Calibri', bold: true, size: 11 }; cell.alignment = { horizontal: 'right' };
            cell.border = { top: { style: opts.borde || 'thin', color: { argb: EXCEL_COLOR.navy } } };
          });
          const nFila = fila; fila++; return nFila;
        };

        // Bloque de cuentas de una categoría, con signo invertido para
        // costos/gastos (se muestran en negativo, como resta del renglón).
        const bloqueCategoria = (etiquetaSub, categoriaEF, invertir) => {
          const m = matrizCategoria(categoriaEF);
          const inicio = fila;
          m.orden.forEach(codigo => {
            const porMes = {};
            mesesVal.forEach(mes => {
              const v = m.saldoPorMesYCodigo[mes][codigo] || 0;
              porMes[mes] = invertir ? -Math.abs(v) : v;
            });
            filaCuenta(`${codigo} — ${m.nombrePorCodigo[codigo]}`, porMes);
          });
          const fin = fila - 1;
          return filaSubtotal(etiquetaSub, inicio, fin);
        };

        const subIngresos = bloqueCategoria('Ingresos', 'ingresos', false);
        const subCostos = bloqueCategoria('Costos', 'costos', true);
        const filaUtilBruta = filaTotal('Utilidad Bruta', col => `${ws.getCell(subIngresos, col).address}+${ws.getCell(subCostos, col).address}`);
        fila++;
        const subGastosOp = bloqueCategoria('Gastos de Operación', 'gastos_operativos', true);
        const filaUtilOp = filaTotal('Utilidad de Operación', col => `${ws.getCell(filaUtilBruta, col).address}+${ws.getCell(subGastosOp, col).address}`);
        fila++;
        const subOtrosIng = bloqueCategoria('Otros Ingresos', 'otros_ingresos', false);
        const subGastosFin = bloqueCategoria('Gastos Financieros', 'gastos_financieros', true);
        const subOtrosGast = bloqueCategoria('Otros Gastos', 'otros_gastos', true);
        filaTotal(
          'Utilidad (Pérdida) antes de Impuestos a la Utilidad',
          col => [filaUtilOp, subOtrosIng, subGastosFin, subOtrosGast].map(f => ws.getCell(f, col).address).join('+'),
          { borde: 'double' }
        );

        agregarPieHoja(ws, fila + 1, numColsRes);
      }

      // ══════════════ HOJAS DE ANALÍTICA (Ingresos / Gastos / Resumen) ══════
      // Incluidas en el MISMO libro, tal como se pidió: un solo archivo con
      // Balanza + Estados Financieros + Analíticas, cada quien en su pestaña.
      construirHojasAnaliticas(wb, logoId, mesesVal);

      await descargarLibroExcel(wb, `Estados_Financieros_${nombreEmpresa}_${ejercicio}.xlsx`);
    } catch (e) {
      alert(' Error al generar el Excel: ' + e.message);
      console.error(e);
    } finally {
      setExportando(false);
    }
  };

  return (
    <PapelesTrabajoErrorBoundary moduleName="Papeles de Trabajo">
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', minWidth: 0 }}>
      <h1 style={{ color: '#f9fafb', marginBottom: 8 }}>Módulo de Papeles de Trabajo</h1>
      <p style={{ color: '#9ca3af', marginBottom: 20 }}>
        IVA, ISR y Estados Financieros — Validación de amarre de balanza requerida
      </p>

      {mensaje && (
        <div style={{
          padding: '12px 20px',
          background: mensaje.toLowerCase().includes('error') ? 'rgba(239,68,68,.1)' : 'rgba(34,197,94,.1)',
          color: mensaje.toLowerCase().includes('error') ? '#ef4444' : '#22c55e',
          borderRadius: 6,
          marginBottom: 16,
          fontWeight: 'bold'
        }}>
          {mensaje}
        </div>
      )}

      {/* Selector de empresa y ejercicio */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 14, fontWeight: 'bold', color: '#d1d5db', marginRight: 12 }}>Empresa:</label>
          <select
            value={empresaSeleccionada?.id || ''}
            onChange={e => {
              const emp = empresas.find(emp => emp.id === parseInt(e.target.value));
              setEmpresaSeleccionada(emp || null);
            }}
            style={{ padding: '9px 12px', fontSize: 14, minWidth: 300, background: '#374151', color: '#f9fafb', border: '1px solid #4b5563', borderRadius: 8 }}
          >
            <option value="">Selecciona una empresa...</option>
            {empresas.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.nombre} ({emp.rfc})</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 14, fontWeight: 'bold', color: '#d1d5db', marginRight: 12 }}>Ejercicio:</label>
          <input
            type="number"
            value={ejercicio}
            onChange={e => setEjercicio(parseInt(e.target.value, 10) || new Date().getFullYear())}
            style={{ padding: '9px 12px', fontSize: 14, width: 110, background: '#374151', color: '#f9fafb', border: '1px solid #4b5563', borderRadius: 8 }}
          />
        </div>
      </div>

      {empresaSeleccionada && (
        <>
          {/* Tabs */}
          <div className="tabs" style={{ flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', display: 'flex' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {[
              { key: 'config', label: 'Configurar Cuentas' },
              { key: 'catalogo', label: 'Catálogo de Cuentas' },
              { key: 'fiscal', label: 'Datos Fiscales' },
              { key: 'balanzas', label: 'Balanzas y Amarres' },
              { key: 'iva', label: 'IVA Anual' },
              { key: 'isr', label: 'ISR Anual' },
              { key: 'estados', label: 'Estados Financieros' }
            ].map(t => (
              <button
                key={t.key}
                className={'tab' + (tabActiva === t.key ? ' active' : '')}
                onClick={() => setTabActiva(t.key)}
              >
                {t.label}
              </button>
            ))}
            </div>
            {(tabActiva === 'iva' || tabActiva === 'isr') && (
              <button onClick={descargarAmbosPapeles} disabled={descargandoAmbos}
                style={{
                  padding: '9px 18px', background: '#4527a0', color: '#fff', border: 'none',
                  borderRadius: 6, fontWeight: 'bold', cursor: descargandoAmbos ? 'default' : 'pointer',
                  opacity: descargandoAmbos ? 0.7 : 1, whiteSpace: 'nowrap', margin: '6px 0'
                }}>
                {descargandoAmbos ? ' Generando…' : ' Descargar ISR + IVA (1 archivo)'}
              </button>
            )}
          </div>

          {/* Contenido por tab */}
          {tabActiva === 'config' && (
            <ConfigCuentasEmpresa
              empresa={empresaSeleccionada}
              onGuardar={guardarConfig}
              catalogoCuentas={catalogoCuentas}
              user={user}
            />
          )}

          {tabActiva === 'catalogo' && (
            <ImportadorCatalogo
              onImportar={guardarCatalogo}
              catalogoActual={catalogoCuentas}
            />
          )}

          {tabActiva === 'fiscal' && (
            <ConfigDatosFiscales
              empresa={empresaSeleccionada}
              datosFiscales={datosFiscales}
              onGuardar={guardarDatosFiscales}
              onEliminar={eliminarDatosFiscales}
            />
          )}

          {tabActiva === 'balanzas' && (
            <div>
              <div style={{ background: 'rgba(255,107,43,.08)', color: '#d1d5db', border: '1px solid rgba(255,107,43,.2)', padding: 14, borderRadius: 6, marginBottom: 20, fontSize: 13 }}>
                Sube la balanza de comprobación (XLSX) de cada mes del ejercicio {ejercicio}.
                Marca "Amarre validado" solo cuando hayas verificado el amarre contra el Anexo de IVA ( Ejecutar):
                eso es obligatorio para los papeles oficiales de IVA e ISR.
                Para Estados Financieros y Analíticas a 12 periodos basta con tener la balanza cargada
                (puedes subir meses anteriores sin re-validar el amarre).
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#374151', color: '#fff' }}>
                    <th style={{ padding: 10, textAlign: 'left' }}>Mes</th>
                    <th style={{ padding: 10 }}>Balanza (XLSX)</th>
                    <th style={{ padding: 10 }}>Cuentas cargadas</th>
                    <th style={{ padding: 10 }}>Amarre validado</th>
                  </tr>
                </thead>
                <tbody>
                  {MESES.map((m, i) => {
                    const mes = i + 1;
                    const cargadas = (balanzaAnual[mes] || []).length;
                    const periodo = `${ejercicio}-${String(mes).padStart(2, '0')}`;
                    const validado = amarresValidados[periodo]?.validado;
                    return (
                      <tr key={mes} style={{ borderBottom: '1px solid #374151' }}>
                        <td style={{ padding: 8, fontWeight: 'bold' }}>{m} {ejercicio}</td>
                        <td style={{ padding: 8 }}>
                          <input type="file" accept=".xls,.xlsx" onChange={e => { const f = e.target.files[0]; if (f) subirBalanzaMes(mes, f); }} style={{ fontSize: 12 }} />
                        </td>
                        <td style={{ padding: 8, textAlign: 'center' }}>{cargadas > 0 ? `${cargadas} cuentas` : '—'}</td>
                        <td style={{ padding: 8, textAlign: 'center' }}>
                          <input type="checkbox" checked={!!validado} disabled={cargadas === 0} onChange={() => toggleAmarreMes(mes)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tabActiva === 'iva' && (
            <PapelesTrabajoErrorBoundary key={`iva-${empresaSeleccionada.id}`} moduleName="Papel de Trabajo IVA">
              <PapelTrabajoIVA
                empresa={empresaSeleccionada}
                balanzaAnual={balanzaAnual}
                anexoIvaAnual={anexoIvaAnual}
                amarresValidados={amarresValidados}
                config={config}
                ejercicio={ejercicio}
                onGuardarManual={guardarAnexoIvaManual}
                exportRef={ivaExportRef}
              />
            </PapelesTrabajoErrorBoundary>
          )}

          {tabActiva === 'isr' && (
            <PapelesTrabajoErrorBoundary key={`isr-${empresaSeleccionada.id}`} moduleName="Papel de Trabajo ISR">
              <PapelTrabajoISR
                empresa={empresaSeleccionada}
                balanzaAnual={balanzaAnual}
                amarresValidados={amarresValidados}
                config={config}
                ejercicio={ejercicio}
                token={token}
                datosFiscales={datosFiscales}
                onGuardarDatosFiscales={guardarDatosFiscales}
                isrManualAnual={isrManualAnual}
                onGuardarManual={guardarIsrManual}
                onEliminarManual={eliminarIsrManual}
                exportRef={isrExportRef}
              />
            </PapelesTrabajoErrorBoundary>
          )}

          {tabActiva === 'estados' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <h2 style={{ color: '#fff', margin: 0, fontSize: 20 }}> Estados Financieros</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={exportarEstadosFinancieros} disabled={exportando}>
                    {exportando ? ' Generando Excel…' : ' Descargar Todo (Balanza + Balance + Resultados + Analíticas)'}
                  </button>
                  <button className="btn btn-secondary" onClick={exportarAnaliticas12} disabled={exportando}>
                     Analítica 12 periodos (Ingresos / Gastos)
                  </button>
                </div>
              </div>
              <div className="alert alert-info" style={{ marginBottom: 20 }}>
                Se generan con la clasificación del catálogo. Usa <b>todos los meses con balanza cargada</b>
                (pestaña " Balanzas y Amarres"). No es obligatorio validar el amarre de IVA para ver o exportar
                Estados Financieros de meses anteriores.
              </div>

              {mesesParaEF().length > 0 ? (
                <div style={{ display: 'grid', gap: 24 }}>
                  {(() => {
                    const validados = mesesParaEF();
                    const ultimoMes = validados[validados.length - 1];
                    return (
                      <div>
                        <h3 style={{ color: '#e5e7eb', marginBottom: 12, fontSize: 16 }}>
                           Estado de Situación Financiera — al corte de {MESES[ultimoMes - 1]} {ejercicio}
                        </h3>
                        <EstadoSituacionFinanciera
                          empresa={empresaSeleccionada}
                          balanzaMes={balanzaAnual[ultimoMes] || []}
                          catalogoCuentas={catalogoCuentas}
                          mes={'Al corte de ' + MESES[ultimoMes - 1]}
                          ejercicio={ejercicio}
                          utilidadEjercicio={calcularUtilidadEjercicio(balanzaAnual[ultimoMes] || [])}
                        />
                      </div>
                    );
                  })()}

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                      <h3 style={{ color: '#e5e7eb', margin: 0, fontSize: 16 }}> Estado de Resultados</h3>
                      <div style={{ display: 'flex', gap: 6, background: '#161c36', padding: 4, borderRadius: 8 }}>
                        {[
                          { id: 'saldo', label: ' Acumulado (Saldo)' },
                          { id: 'mensual', label: ' Mes + Acumulado' },
                          { id: '12meses', label: ' 12 Meses' }
                        ].map(v => (
                          <button key={v.id}
                            onClick={() => setVistaER(v.id)}
                            style={{
                              padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                              background: vistaER === v.id ? '#4527a0' : 'transparent',
                              color: vistaER === v.id ? '#fff' : '#9ca3af'
                            }}>
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {vistaER === 'saldo' && (() => {
                      const validados = mesesParaEF();
                      const ultimoMes = validados[validados.length - 1];
                      return (
                        <EstadoResultados
                          empresa={empresaSeleccionada}
                          balanzaMes={balanzaAnual[ultimoMes] || []}
                          catalogoCuentas={catalogoCuentas}
                          mes={'Acumulado al corte de ' + MESES[ultimoMes - 1]}
                          ejercicio={ejercicio}
                          modoCalculo="saldo"
                        />
                      );
                    })()}

                    {vistaER === 'mensual' && (
                      <div style={{ display: 'grid', gap: 24 }}>
                        {mesesParaEF().map(mes => (
                          <div key={mes}>
                            <h4 style={{ color: '#9ca3af', marginBottom: 10, fontSize: 13, fontWeight: 700 }}>
                              {MESES[mes - 1]} {ejercicio}
                              {amarresValidados[`${ejercicio}-${String(mes).padStart(2,'0')}`]?.validado
                                ? <span style={{ color: '#4caf50' }}>  amarre validado</span>
                                : <span style={{ color: '#eab308' }}> · solo balanza</span>}
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
                              <EstadoResultados
                                empresa={empresaSeleccionada}
                                balanzaMes={balanzaAnual[mes] || []}
                                catalogoCuentas={catalogoCuentas}
                                mes={MESES[mes - 1]}
                                ejercicio={ejercicio}
                                modoCalculo="movimiento"
                              />
                              <EstadoResultados
                                empresa={empresaSeleccionada}
                                balanzaMes={balanzaAnual[mes] || []}
                                catalogoCuentas={catalogoCuentas}
                                mes={'Acumulado a ' + MESES[mes - 1]}
                                ejercicio={ejercicio}
                                modoCalculo="saldo"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {vistaER === '12meses' && renderComparativo12Meses()}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', background: '#161a2e', borderRadius: 8, color: '#9ca3af' }}>
                  No hay balanzas cargadas en {ejercicio}. Sube los archivos XLSX de cada mes en la pestaña
                  " Balanzas y Amarres" (no es necesario validar el amarre de IVA para meses anteriores).
                </div>
              )}
            </div>
          )}
        </>
      )}

      {cargando && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#1f2937',
            border: '1px solid #374151',
            color: '#d1d5db',
            padding: '30px 50px',
            borderRadius: 12,
            textAlign: 'center'
          }}>
            <div style={{
              width: 40, height: 40,
              border: '4px solid #374151',
              borderTop: '4px solid #ff6b2b',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: '#f9fafb', fontWeight: 'bold' }}>Cargando balanzas...</p>
          </div>
        </div>
      )}
      </div>
    </PapelesTrabajoErrorBoundary>
  );
}
