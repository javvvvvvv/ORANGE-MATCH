export const REGIMENES = {
  PM_GENERAL: {
    id: 'PM_GENERAL',
    nombre: 'Persona Moral - Régimen General (Art. 14 LISR)',
    tipo: 'MORAL',
    tasaISR: 30,
    usaCoeficiente: true,
    usaPTU: true,
    usaPerdidas: true,
    pagoMensual: true,
    formula: 'coeficiente'
  },
  PM_RESICO: {
    id: 'PM_RESICO',
    nombre: 'Persona Moral - RESICO (Art. 206-211 LISR)',
    tipo: 'MORAL',
    tasaISR: 30,
    usaCoeficiente: false,
    usaPTU: false,
    usaPerdidas: false,
    pagoMensual: true,
    formula: 'flujo_efectivo'
  },
  PF_GENERAL: {
    id: 'PF_GENERAL',
    nombre: 'Persona Física - Actividades Empresariales (Art. 106-108 LISR)',
    tipo: 'FISICA',
    tasaISR: null, // Tarifa Art. 152
    usaCoeficiente: false,
    usaPTU: false,
    usaPerdidas: true,
    pagoMensual: true,
    formula: 'tarifa_152'
  },
  PF_RESICO: {
    id: 'PF_RESICO',
    nombre: 'Persona Física - RESICO (Art. 113-E LISR)',
    tipo: 'FISICA',
    tasaISR: null, // Tabla RESICO
    usaCoeficiente: false,
    usaPTU: false,
    usaPerdidas: false,
    pagoMensual: true,
    formula: 'tabla_resico'
  },
  PF_HONORARIOS: {
    id: 'PF_HONORARIOS',
    nombre: 'Persona Física - Honorarios (Art. 106 LISR)',
    tipo: 'FISICA',
    tasaISR: null,
    usaCoeficiente: false,
    usaPTU: false,
    usaPerdidas: true,
    pagoMensual: true,
    formula: 'honorarios'
  },
  PF_ARRENDAMIENTO: {
    id: 'PF_ARRENDAMIENTO',
    nombre: 'Persona Física - Arrendamiento (Art. 116 LISR)',
    tipo: 'FISICA',
    tasaISR: null,
    usaCoeficiente: false,
    usaPTU: false,
    usaPerdidas: true,
    pagoMensual: true,
    formula: 'arrendamiento'
  }
};

export const TARIFAS_ISR_MENSUAL_DEFAULT = {
  2026: [
    { limiteInferior: 0.01, limiteSuperior: 844.59, cuotaFija: 0.00, porcentaje: 1.92 },
    { limiteInferior: 844.60, limiteSuperior: 7168.51, cuotaFija: 16.22, porcentaje: 6.40 },
    { limiteInferior: 7168.52, limiteSuperior: 12598.02, cuotaFija: 420.95, porcentaje: 10.88 },
    { limiteInferior: 12598.03, limiteSuperior: 14644.64, cuotaFija: 1011.68, porcentaje: 16.00 },
    { limiteInferior: 14644.65, limiteSuperior: 17533.64, cuotaFija: 1339.14, porcentaje: 17.92 },
    { limiteInferior: 17533.65, limiteSuperior: 35362.83, cuotaFija: 1856.84, porcentaje: 21.36 },
    { limiteInferior: 35362.84, limiteSuperior: 55736.68, cuotaFija: 5665.16, porcentaje: 23.52 },
    { limiteInferior: 55736.69, limiteSuperior: 106410.50, cuotaFija: 10457.09, porcentaje: 30.00 },
    { limiteInferior: 106410.51, limiteSuperior: 141880.66, cuotaFija: 25659.23, porcentaje: 32.00 },
    { limiteInferior: 141880.67, limiteSuperior: 425641.99, cuotaFija: 37009.69, porcentaje: 34.00 },
    { limiteInferior: 425642.00, limiteSuperior: Infinity, cuotaFija: 133488.54, porcentaje: 35.00 }
  ]
};

export const TABLA_RESICO_PF_DEFAULT = {
  2026: [
    { limite: 25000, tasa: 1.00 },
    { limite: 50000, tasa: 1.10 },
    { limite: 100000, tasa: 1.50 },
    { limite: 200000, tasa: 2.00 },
    { limite: 300000, tasa: 2.50 },
    { limite: 400000, tasa: 2.80 },
    { limite: 500000, tasa: 3.00 },
    { limite: 600000, tasa: 3.20 },
    { limite: 700000, tasa: 3.40 },
    { limite: 800000, tasa: 3.60 },
    { limite: 900000, tasa: 3.80 },
    { limite: 1000000, tasa: 4.00 },
    { limite: 1500000, tasa: 4.50 },
    { limite: 2000000, tasa: 5.00 },
    { limite: 2500000, tasa: 5.50 },
    { limite: 3000000, tasa: 6.00 },
    { limite: 3500000, tasa: 6.40 }
  ]
};

export const TARIFAS_ISR_STORAGE_KEY = 'om_tarifas_isr_sat';

export function _tarifasISRPorDefecto() {
  return {
    mensual: JSON.parse(JSON.stringify(TARIFAS_ISR_MENSUAL_DEFAULT)),
    resico: JSON.parse(JSON.stringify(TABLA_RESICO_PF_DEFAULT))
  };
}

export function cargarTarifasISRLocal() {
  try {
    const raw = localStorage.getItem(TARIFAS_ISR_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.mensual) return parsed;
    }
  } catch (e) {}
  return _tarifasISRPorDefecto();
}

export function guardarTarifasISRLocal(data) {
  try { localStorage.setItem(TARIFAS_ISR_STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

export function _anioMasCercano(anios, anio) {
  if (!anios.length) return null;
  const menoresOIguales = anios.filter(a => a <= anio);
  return menoresOIguales.length ? Math.max(...menoresOIguales) : Math.max(...anios);
}

export function obtenerTablaMensualISR(anio, tarifasCfg) {
  const cfg = tarifasCfg || cargarTarifasISRLocal();
  const mapa = cfg.mensual || {};
  if (mapa[anio]) return mapa[anio];
  const anios = Object.keys(mapa).map(Number);
  const cercano = _anioMasCercano(anios, anio);
  return cercano != null ? mapa[cercano] : TARIFAS_ISR_MENSUAL_DEFAULT[2026];
}

export function obtenerTablaResicoISR(anio, tarifasCfg) {
  const cfg = tarifasCfg || cargarTarifasISRLocal();
  const mapa = cfg.resico || {};
  if (mapa[anio]) return mapa[anio];
  const anios = Object.keys(mapa).map(Number);
  const cercano = _anioMasCercano(anios, anio);
  return cercano != null ? mapa[cercano] : TABLA_RESICO_PF_DEFAULT[2026];
}

export function escalarTarifaPorMes(tablaMensual, mes) {
  const m = mes || 1;
  return (tablaMensual || []).map(t => ({
    limiteInferior: t.limiteInferior * m,
    limiteSuperior: t.limiteSuperior === Infinity ? Infinity : t.limiteSuperior * m,
    cuotaFija: t.cuotaFija * m,
    porcentaje: t.porcentaje
  }));
}

export function calcularTarifa152(baseGravable, anio, mes) {
  const tablaMensual = obtenerTablaMensualISR(anio || new Date().getFullYear());
  const tabla = escalarTarifaPorMes(tablaMensual, mes || 1);
  let impuesto = 0;
  for (const tramo of tabla) {
    if (baseGravable > tramo.limiteInferior) {
      const baseTramo = Math.min(baseGravable, tramo.limiteSuperior) - tramo.limiteInferior;
      if (baseTramo > 0) {
        impuesto += tramo.cuotaFija + (baseTramo * tramo.porcentaje / 100);
      }
    }
  }
  return impuesto;
}

export function calcularResicoPF(ingresosMensuales, anio) {
  const tabla = obtenerTablaResicoISR(anio || new Date().getFullYear());
  for (const tramo of tabla) {
    if (ingresosMensuales <= tramo.limite) {
      return ingresosMensuales * tramo.tasa / 100;
    }
  }
  return ingresosMensuales * (tabla[tabla.length - 1]?.tasa || 2.5) / 100;
}
