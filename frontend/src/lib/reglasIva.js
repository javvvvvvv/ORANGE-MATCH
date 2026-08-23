import { normCuenta } from './balanza.js';

export function getOp(row,op){
  const c=parseFloat(row?.cargos||0),a=parseFloat(row?.abonos||0);
  if(op==='C') return c; if(op==='A') return a;
  if(op==='C-A') return c-a; return a-c;
}

export function calcSeccion(reglas,balMap){
  let suma=0,missing=[];
  (reglas||[]).forEach(r=>{
    const row=balMap[String(r.cuenta).trim()];
    if(!row){missing.push(r.cuenta);return;}
    const v=getOp(row,r.operacion);
    suma+=r.tipo==='suma'?v:-v;
  });
  return{suma,missing};
}

export const SECCIONES=[
  {id:'base_trasladado',label:'Base IVA Trasladado'},
  {id:'iva_trasladado',label:'IVA Trasladado'},
  {id:'base_acreditable',label:'Base IVA Acreditable'},
  {id:'iva_acreditable',label:'IVA Acreditable'},
];

export const OPS=[{v:'C',l:'Cargos'},{v:'A',l:'Abonos'},{v:'C-A',l:'Cargos − Abonos'},{v:'A-C',l:'Abonos − Cargos'}];

export function aplicarReglas(reglas, balanzaMes) {
  let total = 0;
  for (const regla of (reglas || [])) {
    if (!regla || !regla.cuenta) continue;
    const fila = balanzaMes.find(r => normCuenta(r.cuenta) === normCuenta(regla.cuenta));
    if (!fila) continue;
    const cargos = parseFloat(fila.cargos) || 0;
    const abonos = parseFloat(fila.abonos) || 0;
    switch (regla.operacion) {
      case 'cargos': total += cargos; break;
      case 'abonos': total += abonos; break;
      case 'cargos_mas_abonos': total += (cargos + abonos); break;
      case 'cargos_menos_abonos': total += (cargos - abonos); break;
      case 'abonos_menos_cargos': total += (abonos - cargos); break;
      default: total += abonos; break;
    }
  }
  return total;
}

export function aplicarOperacion(cuentas, operacion, balanzaMes) {
  let total = 0;
  for (const cuenta of cuentas) {
    const fila = balanzaMes.find(r => normCuenta(r.cuenta) === normCuenta(cuenta));
    if (!fila) continue;
    const cargos = parseFloat(fila.cargos) || 0;
    const abonos = parseFloat(fila.abonos) || 0;
    switch (operacion) {
      case 'cargos': total += cargos; break;
      case 'abonos': total += abonos; break;
      case 'cargos_menos_abonos': total += (cargos - abonos); break;
      case 'abonos_menos_cargos': total += (abonos - cargos); break;
      default: total += abonos; break;
    }
  }
  return total;
}
