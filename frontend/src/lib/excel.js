import { detectarColumnasBalanza } from './balanza.js';

export const EXCEL_COLOR = {
  navy: 'FF1A237E', navyDark: 'FF0D1442', purple: 'FF4527A0', purpleLight: 'FF7E57C2',
  orange: 'FFFF9800', orangeDark: 'FFEF6C00', orangeLight: 'FFFFCC80',
  white: 'FFFFFFFF', lavender: 'FFE8EAF6', lightGray: 'FFF7F7FA', gray: 'FF6B7280', grayDark: 'FF374151',
  green: 'FF2E7D32', greenBg: 'FFE8F5E9', red: 'FFC62828', redBg: 'FFFFEBEE', border: 'FFD1D5DB'
};

export const EXCEL_MONEDA = '#,##0.00;[Red](#,##0.00)';

export let _logoBufferCache = null;

export async function cargarLogoBuffer() {
  if (_logoBufferCache !== null) return _logoBufferCache;
  try {
    const resp = await fetch('/assets/orange-match-logo-display.png');
    if (resp.ok) {
      _logoBufferCache = await resp.arrayBuffer();
      return _logoBufferCache;
    }
  } catch (e) { /* sin logo */ }
  // Logo embebido mínimo (1x1 naranja) para que el libro siempre se genere
  // Si no hay PNG real, el encabezado sigue con colores de marca.
  _logoBufferCache = null;
  return null;
}

export async function crearLibroExcel() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Orange Match';
  wb.created = new Date();
  wb.lastModifiedBy = 'Orange Match';
  wb.company = 'Orange Match';
  let logoId = null;
  const logoBuffer = await cargarLogoBuffer();
  if (logoBuffer) {
    try { logoId = wb.addImage({ buffer: logoBuffer, extension: 'png' }); } catch (e) { logoId = null; }
  }
  return { wb, logoId };
}

export function agregarEncabezadoHoja(ws, logoId, { empresa, titulo, subtitulo, numCols }) {
  numCols = Math.max(numCols, 6);
  ws.getRow(1).height = 34;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 6;
  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= numCols; c++) {
      ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.navy } };
    }
  }
  for (let c = 1; c <= numCols; c++) {
    ws.getCell(3, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.orange } };
  }
  // El logo tiene letras oscuras: sobre el navy del encabezado no se vería,
  // así que se le pone una placa blanca propia en las primeras columnas.
  // Logo real: 1600x468px (proporción ~3.42:1), se respeta esa proporción.
  if (logoId !== null && logoId !== undefined) {
    try {
      ws.mergeCells(1, 1, 2, 2);
      for (let r = 1; r <= 2; r++) for (let c = 1; c <= 2; c++) {
        ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.white } };
      }
      ws.addImage(logoId, { tl: { col: 0.15, row: 0.18 }, ext: { width: 140, height: 41 } });
    } catch (e) { /* sin logo */ }
  }

  const colTexto = Math.max(4, Math.round(numCols * 0.32));
  ws.mergeCells(1, colTexto, 1, numCols);
  const eCell = ws.getCell(1, colTexto);
  eCell.value = empresa || '';
  eCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: EXCEL_COLOR.white } };
  eCell.alignment = { horizontal: 'right', vertical: 'middle' };

  ws.mergeCells(2, colTexto, 2, numCols);
  const tCell = ws.getCell(2, colTexto);
  tCell.value = titulo || '';
  tCell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: EXCEL_COLOR.orangeLight } };
  tCell.alignment = { horizontal: 'right', vertical: 'middle' };

  ws.getRow(4).height = 4;
  ws.getRow(5).height = 15;
  ws.mergeCells(5, 1, 5, numCols);
  const sCell = ws.getCell(5, 1);
  sCell.value = subtitulo || '';
  sCell.font = { name: 'Calibri', italic: true, size: 9, color: { argb: EXCEL_COLOR.gray } };
  sCell.alignment = { horizontal: 'left' };

  return 7;
}

export function agregarPieHoja(ws, filaInicio, numCols) {
  numCols = Math.max(numCols, 6);
  ws.mergeCells(filaInicio, 1, filaInicio, numCols);
  const cell = ws.getCell(filaInicio, 1);
  const fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  cell.value = `Generado el ${fecha}  ·  Orange Match — Amarre de Balanzas`;
  cell.font = { name: 'Calibri', italic: true, size: 8, color: { argb: EXCEL_COLOR.gray } };
  return filaInicio;
}

export function estiloEncabezadoTabla(row, numCols) {
  row.height = 30;
  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c);
    cell.font = { name: 'Calibri', bold: true, color: { argb: EXCEL_COLOR.white }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.purple } };
    cell.alignment = { horizontal: c === 1 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: EXCEL_COLOR.navy } } };
  }
}

export function sombreadoAlterno(row, numCols) {
  for (let c = 1; c <= numCols; c++) {
    row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLOR.lightGray } };
  }
}

export function estiloFilaTotal(row, numCols, negativo) {
  const bg = negativo ? EXCEL_COLOR.redBg : EXCEL_COLOR.greenBg;
  const fg = negativo ? EXCEL_COLOR.red : EXCEL_COLOR.green;
  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.border = { top: { style: 'double', color: { argb: EXCEL_COLOR.gray } }, bottom: { style: 'double', color: { argb: EXCEL_COLOR.gray } } };
    if (c === 1 || c === numCols) cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: fg } };
  }
}

export async function descargarLibroExcel(wb, nombreArchivo) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombreArchivo;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function hojaBalanza(wb) {
  for (const nombreHoja of wb.SheetNames) {
    const ws = wb.Sheets[nombreHoja];
    let rows;
    try { rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }); } catch (e) { continue; }
    if (detectarColumnasBalanza(rows)) return { ws, rows, nombreHoja };
  }
  const wsDefault = wb.Sheets[wb.SheetNames[0]];
  return { ws: wsDefault, rows: XLSX.utils.sheet_to_json(wsDefault, { header: 1, defval: '' }), nombreHoja: wb.SheetNames[0] };
}
