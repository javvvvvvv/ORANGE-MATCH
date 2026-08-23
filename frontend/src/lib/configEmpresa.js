export function safeParseConfigPT(raw){
  if(raw===undefined||raw===null||raw==='') return {};
  try{
    let parsed = raw;
    // Desanida si quedó multi-codificado como string JSON (bug histórico)
    for (let i = 0; i < 5 && typeof parsed === 'string'; i++) {
      parsed = JSON.parse(parsed);
    }
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  }catch(ex){ return {}; }
}

export function safeParseConfigIVA(raw){
  if(raw===undefined||raw===null||raw==='') return {};
  try{
    let parsed = raw;
    for (let i = 0; i < 5 && typeof parsed === 'string'; i++) {
      parsed = JSON.parse(parsed);
    }
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  }catch(ex){ return {}; }
}

export function tieneConfigIVA(raw){
  const c = safeParseConfigIVA(raw);
  let n = 0;
  for (const v of Object.values(c)) {
    if (Array.isArray(v)) n += v.length;
  }
  return n > 0;
}

export const ANEXO_IVA_CELDAS_DEFAULT = {
  ingresos_gravados_16: 'C8',
  ingresos_gravados_11: 'C10',
  ingresos_gravados_0: 'C11',
  ingresos_exentos: 'C12',
  ingresos_gravados_15: 'C13',
  ingresos_gravados_10: 'C14',
  otras_bases_ingresos: 'C15',
  iva_trasladado_16: 'C19',
  iva_trasladado_11: 'C21',
  iva_trasladado_0: '',
  iva_exento: '',
  iva_trasladado_15: 'C22',
  iva_trasladado_10: 'C23',
  iva_otras_bases: '',
  iva_retenido: 'C24',
  base_acreditable_16: 'C54',
  base_acreditable_11: 'C56',
  base_acreditable_0: 'C57',
  base_acreditable_exenta: 'C58',
  base_acreditable_15: 'C59',
  base_acreditable_10: 'C60',
  base_otras: '',
  iva_acreditable_16: 'C64',
  iva_acreditable_11: 'C66',
  iva_acreditable_15: 'C67',
  iva_acreditable_10: 'C68',
  iva_acreditable_otras: '',
  iva_retenido_acreditable: 'C69',
  iva_retenido_anteriores: 'C70'
};

export const CONFIG_DEFAULT = {
  // ═══ IVA ═══
  iva: {
    // Ingresos gravados (por tasa)
    ingresos_gravados_16: {
      concepto: 'Ingresos Gravados al 16%',
      cuentas: [],
      operacion: 'abonos', // cargos, abonos, cargos_menos_abonos, abonos_menos_cargos
      signo: 1,
      tasa: 16
    },
    ingresos_gravados_11: {
      concepto: 'Ingresos Gravados al 11%',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: 11
    },
    ingresos_gravados_0: {
      concepto: 'Ingresos Gravados al 0%',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: 0
    },
    ingresos_exentos: {
      concepto: 'Ingresos Exentos',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: 0
    },
    ingresos_gravados_15: {
      concepto: 'Ingresos Gravados al 15%',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: 15
    },
    ingresos_gravados_10: {
      concepto: 'Ingresos Gravados al 10%',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: 10
    },
    otras_bases_ingresos: {
      concepto: 'Otras Bases',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: null
    },
    // IVA Trasladado
    iva_trasladado_16: {
      concepto: 'IVA Trasladado al 16%',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: 16
    },
    iva_trasladado_11: {
      concepto: 'IVA Trasladado al 11%',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: 11
    },
    iva_trasladado_0: {
      concepto: 'IVA Trasladado al 0%',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: 0
    },
    iva_exento: {
      concepto: 'IVA Exento',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: 0
    },
    iva_trasladado_15: {
      concepto: 'IVA Trasladado al 15%',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: 15
    },
    iva_trasladado_10: {
      concepto: 'IVA Trasladado al 10%',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: 10
    },
    iva_otras_bases: {
      concepto: 'IVA Otras Bases',
      cuentas: [],
      operacion: 'abonos',
      signo: 1,
      tasa: null
    },
    iva_retenido: {
      concepto: 'IVA Retenido',
      cuentas: [],
      operacion: 'cargos',
      signo: -1,
      tasa: null
    },
    // IVA Acreditable
    base_acreditable_16: {
      concepto: 'Base gravable al 16%',
      cuentas: [],
      operacion: 'cargos',
      signo: 1,
      tasa: 16
    },
    base_acreditable_11: {
      concepto: 'Base gravable al 11%',
      cuentas: [],
      operacion: 'cargos',
      signo: 1,
      tasa: 11
    },
    base_acreditable_0: {
      concepto: 'Base gravable al 0%',
      cuentas: [],
      operacion: 'cargos',
      signo: 1,
      tasa: 0
    },
    base_acreditable_exenta: {
      concepto: 'Base gravable exenta',
      cuentas: [],
      operacion: 'cargos',
      signo: 1,
      tasa: 0
    },
    base_acreditable_15: {
      concepto: 'Base gravable al 15%',
      cuentas: [],
      operacion: 'cargos',
      signo: 1,
      tasa: 15
    },
    base_acreditable_10: {
      concepto: 'Base gravable al 10%',
      cuentas: [],
      operacion: 'cargos',
      signo: 1,
      tasa: 10
    },
    base_otras: {
      concepto: 'Otras bases',
      cuentas: [],
      operacion: 'cargos',
      signo: 1,
      tasa: null
    },
    iva_acreditable_16: {
      concepto: 'IVA Acreditable al 16%',
      cuentas: [],
      operacion: 'cargos',
      signo: 1,
      tasa: 16
    },
    iva_acreditable_11: {
      concepto: 'IVA Acreditable al 11%',
      cuentas: [],
      operacion: 'cargos',
      signo: 1,
      tasa: 11
    },
    iva_acreditable_15: {
      concepto: 'IVA Acreditable al 15%',
      cuentas: [],
      operacion: 'cargos',
      signo: 1,
      tasa: 15
    },
    iva_acreditable_10: {
      concepto: 'IVA Acreditable al 10%',
      cuentas: [],
      operacion: 'cargos',
      signo: 1,
      tasa: 10
    },
    iva_acreditable_otras: {
      concepto: 'IVA Otras Bases',
      cuentas: [],
      operacion: 'cargos',
      signo: 1,
      tasa: null
    },
    iva_retenido_acreditable: {
      concepto: 'IVA Retenido',
      cuentas: [],
      operacion: 'cargos',
      signo: -1,
      tasa: null
    },
    iva_retenido_anteriores: {
      concepto: 'IVA Retenido Meses Anteriores',
      cuentas: [],
      operacion: 'cargos',
      signo: -1,
      tasa: null
    }
  },

  // ═══ ISR ═══
  isr: {
    // Ingresos
    ingresos_nominales: {
      concepto: 'Ingresos Nominales (Acumulables sin AAI)',
      cuentas: [],
      operacion: 'abonos',
      signo: 1
    },
    ingresos_acumulables: {
      concepto: 'Ingresos Acumulables Totales',
      cuentas: [],
      operacion: 'abonos',
      signo: 1
    },
    // Anticipos de clientes: se acumulan como ingreso COBRADO en el mes en que
    // se reciben (base de efectivo), en TODOS los regímenes — Actividad
    // Empresarial, RESICO, Arrendamiento y Plataformas Tecnológicas — igual
    // que lo indican las instrucciones del papel de trabajo. No se difieren:
    // entran al cálculo del pago provisional del mes en que se cobran. Aquí
    // se suman directamente a Ingresos Nominales e Ingresos Acumulables
    // (ver PapelTrabajoISR), así que aplican automáticamente sin importar
    // el régimen fiscal seleccionado.
    anticipos_clientes: {
      concepto: 'Anticipos de Clientes (cobrados en el mes — todos los regímenes)',
      cuentas: [],
      operacion: 'abonos',
      signo: 1
    },
    // Deducciones
    deducciones_autorizadas: {
      concepto: 'Deducciones Autorizadas',
      cuentas: [],
      operacion: 'cargos',
      signo: 1
    },
    // Ajuste anual por inflación
    aai_acumulable: {
      concepto: 'AAI Acumulable',
      cuentas: [],
      operacion: 'abonos_menos_cargos',
      signo: 1
    },
    aai_deducible: {
      concepto: 'AAI Deducible',
      cuentas: [],
      operacion: 'cargos_menos_abonos',
      signo: 1
    },
    // Retenciones
    isr_retenido: {
      concepto: 'ISR Retenido',
      cuentas: [],
      operacion: 'cargos',
      signo: -1
    },
    // PTU
    ptu_pagada: {
      concepto: 'PTU Pagada',
      cuentas: [],
      operacion: 'cargos',
      signo: 1
    }
  },

  // ═══ ESTADOS FINANCIEROS ═══
  estados: {
    // ACTIVO CIRCULANTE
    activo_circulante: {
      concepto: 'ACTIVO CIRCULANTE',
      cuentas: [],
      tipo: 'A',
      nivel: 2,
      naturaleza: 'deudor'
    },
    // ACTIVO NO CIRCULANTE
    activo_no_circulante: {
      concepto: 'ACTIVO NO CIRCULANTE',
      cuentas: [],
      tipo: 'A',
      nivel: 2,
      naturaleza: 'deudor'
    },
    // PASIVO CORTO PLAZO
    pasivo_corto_plazo: {
      concepto: 'PASIVO A CORTO PLAZO',
      cuentas: [],
      tipo: 'D',
      nivel: 2,
      naturaleza: 'acreedor'
    },
    // PASIVO LARGO PLAZO
    pasivo_largo_plazo: {
      concepto: 'PASIVO A LARGO PLAZO',
      cuentas: [],
      tipo: 'D',
      nivel: 2,
      naturaleza: 'acreedor'
    },
    // CAPITAL
    capital_contribuido: {
      concepto: 'CAPITAL CONTRIBUIDO',
      cuentas: [],
      tipo: 'F',
      nivel: 2,
      naturaleza: 'acreedor'
    },
    capital_ganado: {
      concepto: 'CAPITAL GANADO',
      cuentas: [],
      tipo: 'F',
      nivel: 2,
      naturaleza: 'acreedor'
    },
    // INGRESOS
    ingresos: {
      concepto: 'INGRESOS',
      cuentas: [],
      tipo: 'H',
      nivel: 1,
      naturaleza: 'acreedor'
    },
    // COSTOS
    costos: {
      concepto: 'COSTOS',
      cuentas: [],
      tipo: 'G',
      nivel: 1,
      naturaleza: 'deudor'
    },
    // GASTOS
    gastos_operativos: {
      concepto: 'GASTOS OPERATIVOS',
      cuentas: [],
      tipo: 'G',
      nivel: 1,
      naturaleza: 'deudor'
    },
    gastos_financieros: {
      concepto: 'GASTOS FINANCIEROS',
      cuentas: [],
      tipo: 'G',
      nivel: 1,
      naturaleza: 'deudor'
    },
    // OTROS
    otros_ingresos: {
      concepto: 'OTROS INGRESOS',
      cuentas: [],
      tipo: 'H',
      nivel: 1,
      naturaleza: 'acreedor'
    },
    otros_gastos: {
      concepto: 'OTROS GASTOS',
      cuentas: [],
      tipo: 'G',
      nivel: 1,
      naturaleza: 'deudor'
    }
  }
};
