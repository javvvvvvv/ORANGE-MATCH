export function normCuenta(s) {
  return String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function normEncabezado(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function detectarColumnasBalanza(rows) {
  // CONTPAQi suele escribir los encabezados con las letras separadas por
  // espacios ("C u e n t a"), y otros sistemas usan puntuación variable
  // ("No. Cuenta", "N° Cuenta", "Cve. Cuenta:", "Cuenta Contable"). Por eso
  // "compacto" quita TODO lo que no sea letra o número (no solo espacios),
  // así estas variantes se reconocen igual.
  const compacto = (s) => normEncabezado(s).replace(/[^A-Z0-9]/g, '');

  // Reconoce el encabezado de la columna de cuenta sin importar prefijos
  // comunes ("No.", "Núm.", "Cve.", "Clave", "Código", "de"). Se hace
  // quitando esos prefijos/sufijos conocidos y comparando lo que queda
  // contra "CUENTA"/"CTA", en vez de un `includes` genérico — un `includes`
  // genérico confundiría el NOMBRE de una cuenta como "Cuenta por Cobrar"
  // (que aparece en los datos, no en el encabezado) con el encabezado real.
  const esEncabezadoCuenta = (raw) => {
    const t = compacto(raw);
    if (!t) return false;
    if (t === 'CUENTA' || t === 'CTA' || t === 'CODIGO' || t === 'CLAVE') return true;
    let r = t.replace(/^(NUMERO|NUM|NO|CVE|CLAVE|COD|CODIGO)/, '').replace(/^DE/, '');
    r = r.replace(/CONTABLE$/, '');
    return r === 'CUENTA' || r === 'CTA';
  };

  let filaHeader = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const fila = rows[i] || [];
    // Se revisa TODA la fila (antes solo las primeras 4 columnas): algunos
    // formatos traen columnas de folio/numeración antes de "Cuenta", lo que
    // antes hacía que nunca se encontrara el encabezado y el sistema caía en
    // un mapeo de columnas fijo (0,1,2,3…) incorrecto para ese archivo.
    for (let c = 0; c < fila.length; c++) {
      if (esEncabezadoCuenta(fila[c])) { filaHeader = i; break; }
    }
    if (filaHeader >= 0) break;
  }
  if (filaHeader === -1) return null;

  // El layout de encabezados varía mucho entre sistemas (a veces "Cuenta" y
  // los grupos "Saldos Iniciales/Actuales" van en la misma fila y
  // Deudor/Acreedor/Cargos/Abonos en la de abajo; a veces al revés). Se junta
  // el texto de una ventana de filas cercanas por columna para no depender
  // de un orden exacto.
  const filaPrincipal = rows[filaHeader] || [];
  const filaSiguiente = rows[filaHeader + 1] || [];
  const ventana = [rows[filaHeader - 1] || [], filaPrincipal, filaSiguiente, rows[filaHeader + 2] || []];
  const anchoTotal = Math.max(...ventana.map(f => f.length), 8);
  const textoColumna = [];
  for (let c = 0; c < anchoTotal; c++) {
    textoColumna[c] = ventana.map(f => normEncabezado(f[c])).filter(Boolean).join(' ');
  }

  const col = { cuenta: -1, nombre: -1, si_d: -1, si_a: -1, cargos: -1, abonos: -1, sf_d: -1, sf_a: -1 };

  // Cuenta y Nombre: buscar primero en la fila principal detectada.
  for (let c = 0; c < filaPrincipal.length; c++) {
    const txt = compacto(filaPrincipal[c]);
    if (!txt) continue;
    if (col.cuenta === -1 && esEncabezadoCuenta(filaPrincipal[c])) col.cuenta = c;
    if (col.nombre === -1 && (txt.includes('NOMBRE') || txt.includes('CONCEPTO') || txt.includes('DESCRIPCION'))) col.nombre = c;
  }
  if (col.nombre === -1) {
    for (let c = 0; c < textoColumna.length; c++) {
      if (c === col.cuenta) continue;
      const txt = compacto(textoColumna[c]);
      if (txt.includes('NOMBRE') || txt.includes('CONCEPTO') || txt.includes('DESCRIPCION')) { col.nombre = c; break; }
    }
  }

  // El resto de columnas: usar el texto combinado de la ventana por columna,
  // para tener tanto la etiqueta (Deudor/Acreedor/Cargos/Abonos) como el
  // grupo (Inicial/Actual/Final) sin importar en qué fila haya quedado cada uno.
  // NOTA: se probó propagar la etiqueta de grupo de izquierda a derecha para
  // cubrir casos donde el grupo solo se escribe en la primera columna del
  // rango que abarca, pero en la práctica esto rompía archivos reales donde
  // "Saldos"/"Actuales" quedan repartidos en columnas separadas de forma que
  // la propagación adivinaba mal el corte — así que se usa solo el texto
  // exacto de cada columna (columna por columna), y si no hay un grupo claro
  // ahí mismo, se usa "primera aparición = inicial, segunda = final" como
  // respaldo (que es el orden real en los formatos de balanza vistos).
  for (let c = 0; c < textoColumna.length; c++) {
    if (c === col.cuenta || c === col.nombre) continue;
    const txt = textoColumna[c];
    const comp = compacto(txt);
    if (!comp) continue;
    if (comp.includes('CARGO')) { col.cargos = c; continue; }
    if (comp.includes('ABONO')) { col.abonos = c; continue; }
    if (comp.includes('DEUDOR') || / DEBE( |$)/.test(' ' + txt + ' ')) {
      if (txt.includes('INICIAL') || txt.includes('ANTERIOR')) col.si_d = c;
      else if (txt.includes('ACTUAL') || txt.includes('FINAL') || txt.includes('CORTE')) col.sf_d = c;
      else if (col.si_d === -1) col.si_d = c; // sin grupo claro: primera aparición = inicial
      else col.sf_d = c; // segunda aparición = final
      continue;
    }
    if (comp.includes('ACREEDOR') || / HABER( |$)/.test(' ' + txt + ' ')) {
      if (txt.includes('INICIAL') || txt.includes('ANTERIOR')) col.si_a = c;
      else if (txt.includes('ACTUAL') || txt.includes('FINAL') || txt.includes('CORTE')) col.sf_a = c;
      else if (col.si_a === -1) col.si_a = c;
      else col.sf_a = c;
      continue;
    }
  }
  if (col.cuenta === -1) return null; // sin columna de cuenta identificada, no es confiable

  // Los datos empiezan después de la última fila de encabezados que sí aportó algo.
  const siguienteAporta = compacto((filaSiguiente || []).join(''));
  col.filaHeader = siguienteAporta && /CARGO|ABONO|DEUDOR|ACREEDOR|NOMBRE|CONCEPTO/.test(siguienteAporta)
    ? filaHeader + 1
    : filaHeader;
  return col;
}

export function parseMonto(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return 0;
  let s = String(v).trim();
  if (!s) return 0;
  let negativo = false;
  // Paréntesis contable: puede venir pegado a un símbolo de moneda antes,
  // ej. "$ (2,500.00)" — se detecta buscando el primer "(" y el último ")"
  // en vez de exigir que estén exactamente al inicio/fin del texto.
  if (s.includes('(') && s.includes(')')) {
    negativo = true;
    s = s.replace(/[()]/g, '');
  }
  s = s.replace(/[^0-9.,\-]/g, ''); // quita símbolo de moneda, espacios, letras
  if (!s) return 0;
  if (s.trim() === '-') return 0;
  if (s.startsWith('-')) { negativo = true; s = s.slice(1); }
  s = s.replace(/,/g, ''); // separador de miles
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return negativo ? -n : n;
}

export function filasBalanzaDesdeMatriz(rows) {
  const col = detectarColumnasBalanza(rows) || { cuenta: 0, nombre: 1, si_d: 2, si_a: 3, cargos: 4, abonos: 5, sf_d: 6, sf_a: 7, filaHeader: -1 };
  const num = (r, idx) => (idx == null || idx < 0) ? 0 : parseMonto(r[idx]);
  const inicio = col.filaHeader >= 0 ? col.filaHeader + 1 : 0;
  const lista = [];
  for (let i = inicio; i < rows.length; i++) {
    const r = rows[i];
    const cuenta = String((r && r[col.cuenta]) || '').trim();
    if (!cuenta || isNaN(cuenta[0])) continue;
    lista.push({
      cuenta,
      nombre: String((r && r[col.nombre]) || '').trim(),
      si_d: num(r, col.si_d), si_a: num(r, col.si_a),
      cargos: num(r, col.cargos), abonos: num(r, col.abonos),
      sf_d: num(r, col.sf_d), sf_a: num(r, col.sf_a)
    });
  }
  return lista;
}

export function calcularValorCuenta(cuenta, balanzaMes) {
  const fila = balanzaMes.find(r => normCuenta(r.cuenta) === normCuenta(cuenta));
  if (!fila) return 0;
  return (parseFloat(fila.cargos) || 0) - (parseFloat(fila.abonos) || 0);
}

export function combinarBalanzas(listaDeBalanzas) {
  const mapa = {};
  for (const balanza of (listaDeBalanzas || [])) {
    for (const fila of (balanza || [])) {
      if (!mapa[fila.cuenta]) mapa[fila.cuenta] = { cuenta: fila.cuenta, nombre: fila.nombre, cargos: 0, abonos: 0 };
      mapa[fila.cuenta].cargos += parseFloat(fila.cargos) || 0;
      mapa[fila.cuenta].abonos += parseFloat(fila.abonos) || 0;
    }
  }
  return Object.values(mapa);
}

export function valorConSigno(fila, tipo, modo) {
  const acreedora = tipo === 'D' || tipo === 'F' || tipo === 'H';
  if (modo === 'saldo') {
    const sf_d = parseFloat(fila.sf_d) || 0;
    const sf_a = parseFloat(fila.sf_a) || 0;
    return acreedora ? sf_a - sf_d : sf_d - sf_a;
  }
  const cargos = parseFloat(fila.cargos) || 0;
  const abonos = parseFloat(fila.abonos) || 0;
  return acreedora ? abonos - cargos : cargos - abonos;
}

export function montoNeto(fila, modo) {
  if (modo === 'saldo') {
    return (parseFloat(fila.sf_a) || 0) - (parseFloat(fila.sf_d) || 0);
  }
  return (parseFloat(fila.abonos) || 0) - (parseFloat(fila.cargos) || 0);
}

export function calcularResidualesPorFila(balanzaRows, mapaPorCodigoNorm, modo) {
  const balanzaPorCodigo = {};
  // Si el mismo código de cuenta aparece más de una vez en la balanza SUBIDA
  // con valores distintos entre sí (no un simple renglón repetido idéntico),
  // es una señal de que el archivo trae algo mezclado — por ejemplo, dos
  // monedas o dos periodos concatenados en el mismo reporte — y quedarse solo
  // con el último renglón (como se hacía antes, en silencio) puede tirar a la
  // basura saldos reales sin que nadie se entere. Aquí se detecta y se avisa.
  const avisosDuplicados = [];
  (balanzaRows || []).forEach(f => {
    const cn = normCuenta(f.cuenta);
    const anterior = balanzaPorCodigo[cn];
    if (anterior) {
      const distinto = ['cargos', 'abonos', 'sf_d', 'sf_a'].some(k => Math.abs((parseFloat(anterior[k]) || 0) - (parseFloat(f[k]) || 0)) > 0.01);
      if (distinto) avisosDuplicados.push({ codigo: f.cuenta, nombre: f.nombre });
    }
    balanzaPorCodigo[cn] = f;
  });

  const hijosPorCodigo = {};
  Object.keys(mapaPorCodigoNorm).forEach(codigoNorm => {
    const c = mapaPorCodigoNorm[codigoNorm];
    const sup = normCuenta(c.ctaSup);
    if (!sup || /^0+$/.test(sup)) return;
    if (!hijosPorCodigo[sup]) hijosPorCodigo[sup] = [];
    hijosPorCodigo[sup].push(codigoNorm);
  });

  const memoTotal = {};
  const residualNetoPorFila = {};

  function total(codigoNorm, guard) {
    if (memoTotal[codigoNorm] !== undefined) return memoTotal[codigoNorm];
    if (guard > 40) return 0; // protección ante ciclos raros en el catálogo
    memoTotal[codigoNorm] = 0; // evita bucles infinitos si hubiera un ciclo
    const hijos = hijosPorCodigo[codigoNorm] || [];
    let sumaHijos = 0;
    hijos.forEach(hijoCod => { sumaHijos += total(hijoCod, guard + 1); });
    const filaPropia = balanzaPorCodigo[codigoNorm];
    let resultado;
    if (filaPropia) {
      const propio = montoNeto(filaPropia, modo);
      residualNetoPorFila[codigoNorm] = propio - sumaHijos;
      resultado = propio;
    } else {
      resultado = sumaHijos;
    }
    memoTotal[codigoNorm] = resultado;
    return resultado;
  }

  Object.keys(mapaPorCodigoNorm).forEach(codigoNorm => { total(codigoNorm, 0); });

  // ── Cuentas de "agrupación" (OBLIGACIONES, A CORTO PLAZO, ACTIVO, etc.):
  // en un catálogo de CONTPAQi bien formado, estas cuentas son un espejo
  // matemático de sus propias cuentas de Mayor — nunca deberían llevar
  // movimiento propio. Si de todos modos lo traen (su residual neto no es
  // cero), esa diferencia NO se puede atribuir con certeza a ninguna
  // categoría del Balance: haerlo (como se hacía antes) es lo que provocaba
  // que el Balance no cuadrara de forma distinta en cada empresa, según qué
  // tan completo viniera el catálogo de esa cabecera en particular. La regla
  // general, la misma para cualquier empresa, es: si la cabecera YA tiene al
  // menos una cuenta de Mayor real (CtaMayor=1) debajo, su propio residual se
  // excluye del cálculo (no se inventa a qué categoría pertenece) y se
  // reporta aparte como diagnóstico; si NO tiene ninguna cuenta de Mayor real
  // en todo su árbol (catálogo que no marca CtaMayor de forma consistente),
  // se sigue usando esa cabecera como "mejor esfuerzo" para no perder el
  // monto — comportamiento previo, sin cambios, para no dejar huecos.
  const conMayorDescendiente = new Set();
  Object.values(mapaPorCodigoNorm).forEach(c => {
    if (Number(c.ctaMayor) !== 1) return;
    let sup = normCuenta(c.ctaSup);
    let guard = 0;
    while (sup && !/^0+$/.test(sup) && guard < 30) {
      if (conMayorDescendiente.has(sup)) break;
      conMayorDescendiente.add(sup);
      const padre = mapaPorCodigoNorm[sup];
      if (!padre) break;
      sup = normCuenta(padre.ctaSup);
      guard++;
    }
  });

  // Convierte cada residual NETO al signo de despliegue correcto según el
  // Tipo de SU PROPIA cuenta (no el de su cuenta de Mayor, por si difieren,
  // como en el caso de las cuentas contra-ingreso/contra-gasto).
  const residualPorFila = {};
  const avisosGrupo = [];
  Object.keys(residualNetoPorFila).forEach(codigoNorm => {
    const cta = mapaPorCodigoNorm[codigoNorm];
    const esMayorReal = cta && Number(cta.ctaMayor) === 1;
    if (!esMayorReal && conMayorDescendiente.has(codigoNorm)) {
      if (Math.abs(residualNetoPorFila[codigoNorm]) > 1) {
        avisosGrupo.push({ codigo: cta.codigo, nombre: cta.nombre, monto: residualNetoPorFila[codigoNorm], categoriaEF: cta.categoriaEF || '' });
      }
      residualPorFila[codigoNorm] = 0;
      return;
    }
    const acreedora = cta && (cta.tipo === 'D' || cta.tipo === 'F' || cta.tipo === 'H');
    residualPorFila[codigoNorm] = acreedora ? residualNetoPorFila[codigoNorm] : -residualNetoPorFila[codigoNorm];
  });
  // Se cuelga en una llave que jamás puede chocar con un código de cuenta
  // normalizado (normCuenta jamás produce guiones bajos), para no romper a
  // quien ya consume el resultado como un simple diccionario código -> monto.
  residualPorFila.__avisosGrupo = avisosGrupo;
  residualPorFila.__avisosDuplicados = avisosDuplicados;
  return residualPorFila;
}

export function detectarCuentasGrupoDesajustadas(balanzaRows, mapaPorCodigoNorm, residualPorFila) {
  const sonPadre = new Set();
  Object.values(mapaPorCodigoNorm).forEach(c => {
    const sup = normCuenta(c.ctaSup);
    if (sup && !/^0+$/.test(sup)) sonPadre.add(sup);
  });
  const avisos = [];
  (balanzaRows || []).forEach(f => {
    const codNorm = normCuenta(f.cuenta);
    const cta = mapaPorCodigoNorm[codNorm];
    if (!cta || Number(cta.ctaMayor) === 1 || !sonPadre.has(codNorm)) return;
    const monto = residualPorFila[codNorm] || 0;
    if (Math.abs(monto) > 1) avisos.push({ codigo: f.cuenta, nombre: cta.nombre || f.nombre, monto, categoriaEF: cta.categoriaEF || '' });
  });
  return avisos;
}

export function obtenerAncestroMayor(codigo, mapaPorCodigoNorm) {
  let node = mapaPorCodigoNorm[normCuenta(codigo)];
  if (!node) return null;
  let guard = 0;
  while (node && guard < 30) {
    if (Number(node.ctaMayor) === 1) return node;
    const supNorm = normCuenta(node.ctaSup);
    if (!supNorm || /^0+$/.test(supNorm)) return node; // llegó a la raíz sin encontrar CtaMayor=1: mejor esfuerzo
    const parent = mapaPorCodigoNorm[supNorm];
    if (!parent || parent === node) return node;
    node = parent;
    guard++;
  }
  return node;
}

export function calcularDetalleCategoriaBalance(balanzaMes, mapaCat, categoriaEF) {
  const conSF = (balanzaMes || []).some(f => f.sf_d !== undefined || f.sf_a !== undefined);
  const residuales = calcularResidualesPorFila(balanzaMes, mapaCat, conSF ? 'saldo' : 'movimiento');
  const porMayor = {};
  let total = 0;
  (balanzaMes || []).forEach(fila => {
    const codNorm = normCuenta(fila.cuenta);
    const cta = mapaCat[codNorm];
    if (!cta) return;
    const mayor = obtenerAncestroMayor(codNorm, mapaCat);
    if (!mayor || (mayor.categoriaEF || '') !== categoriaEF) return;
    const valor = Number(residuales[codNorm] || 0);
    total += valor;
    const key = normCuenta(mayor.codigo);
    if (!porMayor[key]) porMayor[key] = { codigo: mayor.codigo, nombre: mayor.nombre, saldo: 0 };
    porMayor[key].saldo += valor;
  });
  const detalle = Object.values(porMayor).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  return { total, detalle };
}

export function textoJerarquiaCuenta(codigo, mapaPorCodigoNorm) {
  let node = mapaPorCodigoNorm[normCuenta(codigo)];
  const partes = [];
  let guard = 0;
  while (node && guard < 30) {
    partes.push(String(node.nombre || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    const supNorm = normCuenta(node.ctaSup);
    if (!supNorm || /^0+$/.test(supNorm)) break;
    const parent = mapaPorCodigoNorm[supNorm];
    if (!parent || parent === node) break;
    node = parent;
    guard++;
  }
  return ' | ' + partes.join(' | ') + ' | ';
}

export function clasificarCuentaAutomatico(cuenta, mapaPorCodigoNorm) {
  const tipo = (cuenta.tipo || '').toUpperCase();
  const jerarquia = textoJerarquiaCuenta(cuenta.codigo, mapaPorCodigoNorm);

  // Respaldo para cuentas agregadas desde una balanza cuyo catálogo no traía
  // Tipo/CtaMayor: usamos el prefijo contable de tres dígitos. Es coherente
  // con la estructura habitual de CONTPAQi y evita que una empresa quede sin
  // Estados Financieros solo porque faltó una fila del catálogo.
  if (!tipo) {
    const prefijo = parseInt(String(cuenta.codigo || '').replace(/\\D/g, '').slice(0, 3), 10);
    if (Number.isFinite(prefijo)) {
      if (prefijo >= 100 && prefijo < 200) {
        return /(NO CIRCULANTE|ACTIVO FIJO|\\bFIJO\\b|INMUEBLE|MAQUINARIA|MOBILIARIO|EQUIPO|DEPRECIACION|AMORTIZACION|INTANGIBLE|DIFERIDO|TERRENO|EDIFICIO)/.test(jerarquia)
          ? 'activo_no_circulante' : 'activo_circulante';
      }
      if (prefijo >= 200 && prefijo < 300) return /(LARGO PLAZO|A LARGO|NO CORRIENTE)/.test(jerarquia) ? 'pasivo_largo_plazo' : 'pasivo_corto_plazo';
      if (prefijo >= 300 && prefijo < 400) return /(GANADO|RESULTADO|UTILIDAD|PERDIDA|EJERCICIOS ANTERIORES)/.test(jerarquia) ? 'capital_ganado' : 'capital_contribuido';
      if (prefijo >= 400 && prefijo < 500) return 'ingresos';
      if (prefijo >= 500 && prefijo < 600) return 'costos';
      if (prefijo >= 600 && prefijo < 800) return prefijo >= 700 ? 'gastos_financieros' : 'gastos_operativos';
    }
    return '';
  }
  if (tipo === 'K') return ''; // cuentas de orden / memorándum: se excluyen
  switch (tipo) {
    case 'A':
    case 'B': // Activo complementario (ej. Depreciación Acumulada): mismo criterio que Activo
      if (jerarquia.includes('NO CIRCULANTE')) return 'activo_no_circulante';
      // OJO: la jerarquía une el nombre de CADA nivel por separado (ej. "FIJO | ACTIVO"),
      // así que "ACTIVO FIJO" puede no aparecer como frase única — por eso "FIJO" también
      // cuenta solo, con límite de palabra para no confundir con otros términos.
      if (/(ACTIVO FIJO|\bFIJO\b|INMUEBLE|MAQUINARIA|\bMAQ\b|MOBILIARIO|\bEQUIPO\b|\bEQPO\b|\bEQ\b|DEPRECIACION|AMORTIZACION|INTANGIBLE|DIFERIDO|INVERSION PERMANENTE|TERRENO|EDIFICIO|TROQUEL|MOLDE|HERRAMIENTA|MARCAS Y PATENTES|\bPATENTE|MEJORAS? A(L)? LOCAL|GASTOS DE INSTALACION|DEPOSITOS? EN GARANTIA|CONSTRUCCION EN PROCESO)/.test(jerarquia)) return 'activo_no_circulante';
      return 'activo_circulante';
    case 'D':
      if (/(LARGO PLAZO|A LARGO|NO CORRIENTE)/.test(jerarquia)) return 'pasivo_largo_plazo';
      return 'pasivo_corto_plazo';
    case 'F':
      if (/(GANADO|RESULTADO|UTILIDAD|PERDIDA|EJERCICIOS ANTERIORES)/.test(jerarquia)) return 'capital_ganado';
      return 'capital_contribuido';
    case 'H':
      if (/(NO RECURRENTE|OTROS INGRESOS|PRODUCTOS FINANCIEROS)/.test(jerarquia)) return 'otros_ingresos';
      return 'ingresos';
    case 'G':
      if (/(VARIABLE|COSTO DE VENTA|COSTO DE LO VENDIDO|COSTOS|\bCOSTO\b)/.test(jerarquia)) return 'costos';
      if (/FINANCIER/.test(jerarquia)) return 'gastos_financieros';
      if (/(NO RECURRENTE|OTROS GASTOS)/.test(jerarquia)) return 'otros_gastos';
      return 'gastos_operativos';
    default: {
      // Respaldo cuando el Tipo contable NO se reconoce (por si alguna
      // empresa usa una letra de Tipo que no hemos visto todavía): se usa el
      // Código Agrupador del SAT (Anexo 24 de la Contabilidad Electrónica),
      // que es un estándar NACIONAL Y OBLIGATORIO desde 2014 — no depende de
      // cómo cada empresa configuró su catálogo en CONTPAQi, así que es un
      // respaldo mucho más confiable que adivinar por el nombre de la cuenta.
      //   100-199 Activo · 200-299 Pasivo · 300-399 Capital
      //   400-499 Ingresos · 500-599 Costos · 600-699 Gastos
      //   700-799 Resultado Integral de Financiamiento · 800+ Orden/Fiscal (se excluye)
      const agrup = String(cuenta.idAgrupadorSAT || '').trim();
      const prefijo = agrup ? parseInt(agrup, 10) : NaN;
      if (!isNaN(prefijo) && prefijo > 0) {
        if (prefijo < 200) return jerarquia.includes('NO CIRCULANTE') ? 'activo_no_circulante' : 'activo_circulante';
        if (prefijo < 300) return (/(LARGO PLAZO|A LARGO|NO CORRIENTE)/.test(jerarquia)) ? 'pasivo_largo_plazo' : 'pasivo_corto_plazo';
        if (prefijo < 400) return (/(GANADO|RESULTADO|UTILIDAD|PERDIDA)/.test(jerarquia)) ? 'capital_ganado' : 'capital_contribuido';
        if (prefijo < 500) return 'ingresos';
        if (prefijo < 600) return 'costos';
        if (prefijo < 700) return 'gastos_operativos';
        if (prefijo < 800) return 'gastos_financieros';
        return ''; // 800+: cuentas de orden o fiscales, se excluyen de los Estados Financieros
      }
      return '';
    }
  }
}

export const CATEGORIAS_EF = [
  { key: '', label: '— Sin clasificar / Cuenta de orden —' },
  { key: 'activo_circulante', label: 'Activo circulante' },
  { key: 'activo_no_circulante', label: 'Activo no circulante' },
  { key: 'pasivo_corto_plazo', label: 'Pasivo a corto plazo' },
  { key: 'pasivo_largo_plazo', label: 'Pasivo a largo plazo' },
  { key: 'capital_contribuido', label: 'Capital contribuido' },
  { key: 'capital_ganado', label: 'Capital ganado' },
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'otros_ingresos', label: 'Otros ingresos' },
  { key: 'costos', label: 'Costos' },
  { key: 'gastos_operativos', label: 'Gastos operativos' },
  { key: 'gastos_financieros', label: 'Gastos financieros' },
  { key: 'otros_gastos', label: 'Otros gastos' },
];
