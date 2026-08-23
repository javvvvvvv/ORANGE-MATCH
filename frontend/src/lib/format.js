export const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function fmt(n){return typeof n==='number'?n.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}):'0.00'}
