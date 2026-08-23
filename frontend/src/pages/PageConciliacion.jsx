import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fmt } from '../lib/format.js';

export function PageConciliacion({token}){
  const [moduloTraslado, setModuloTraslado] = useState(true);
  const [moduloAcreditable, setModuloAcreditable] = useState(true);
  const [files, setFiles] = useState({
    a1: null, a2: null, aa1: null,
    b1: null, b2: null, bb1: null
  });
  const [comparativas, setComparativas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const startRows = {
    a1: 8, a2: 8, aa1: 6,
    b1: 8, b2: 8, bb1: 6
  };

  const COL_B = 1, COL_C = 2, COL_F = 5, COL_G = 6, COL_H = 7, COL_J = 9, COL_L = 11, COL_T = 19, COL_U = 20;
  const TOLERANCIA = 0.50;

  function readFile(file, startRow) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          resolve(rows.slice(startRow));
        } catch (ex) { reject(ex); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function processAux(rows, sumColIndex) {
    const map = new Map();
    rows.forEach(row => {
      const b = String(row[COL_B] || '').trim();
      const c = String(row[COL_C] || '').trim();
      if (!b || !c) return;
      const id = b + '_' + c;
      const val = parseFloat(row[sumColIndex]) || 0;
      if (map.has(id)) map.set(id, { poliza: c, total: map.get(id).total + val });
      else map.set(id, { poliza: c, total: val });
    });
    const result = [];
    for (let [id, data] of map.entries()) {
      if (Math.abs(data.total) < 0.0001) continue;
      result.push({ id, poliza: data.poliza, total: data.total });
    }
    result.sort((a,b) => {
      const na = parseFloat(a.poliza), nb = parseFloat(b.poliza);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.poliza.localeCompare(b.poliza);
    });
    return result;
  }

  function processAnexoTrasladado(rows) {
    const map = new Map();
    rows.forEach(row => {
      const b = String(row[COL_B] || '').trim();
      const c = String(row[COL_C] || '').trim();
      if (!b || !c) return;
      const id = b + '_' + c;
      const h = parseFloat(row[COL_H]) || 0;
      const j = parseFloat(row[COL_J]) || 0;
      const l = parseFloat(row[COL_L]) || 0;
      const t = parseFloat(row[COL_T]) || 0;
      const u = parseFloat(row[COL_U]) || 0;
      const baseIva = h + j + l + t + u;
      const ivaTras = j;
      if (map.has(id)) {
        const existing = map.get(id);
        existing.total_base_iva += baseIva;
        existing.total_iva_trasladado += ivaTras;
      } else {
        map.set(id, { poliza: c, total_base_iva: baseIva, total_iva_trasladado: ivaTras });
      }
    });
    const result = [];
    for (let [id, data] of map.entries()) {
      if (Math.abs(data.total_base_iva) < 0.0001 && Math.abs(data.total_iva_trasladado) < 0.0001) continue;
      result.push({ id, poliza: data.poliza, total_base_iva: data.total_base_iva, total_iva_trasladado: data.total_iva_trasladado });
    }
    result.sort((a,b) => {
      const na = parseFloat(a.poliza), nb = parseFloat(b.poliza);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.poliza.localeCompare(b.poliza);
    });
    return result;
  }

  function processAnexoAcreditable(rows) {
    const map = new Map();
    rows.forEach(row => {
      const b = String(row[COL_B] || '').trim();
      const c = String(row[COL_C] || '').trim();
      if (!b || !c) return;
      const id = b + '_' + c;
      const h = parseFloat(row[COL_H]) || 0;
      const j = parseFloat(row[COL_J]) || 0;
      const l = parseFloat(row[COL_L]) || 0;
      const t = parseFloat(row[COL_T]) || 0;
      const baseIva = h + j + l + t;
      const ivaAcred = j;
      if (map.has(id)) {
        const existing = map.get(id);
        existing.total_base_iva += baseIva;
        existing.total_iva_acreditable += ivaAcred;
      } else {
        map.set(id, { poliza: c, total_base_iva: baseIva, total_iva_acreditable: ivaAcred });
      }
    });
    const result = [];
    for (let [id, data] of map.entries()) {
      if (Math.abs(data.total_base_iva) < 0.0001 && Math.abs(data.total_iva_acreditable) < 0.0001) continue;
      result.push({ id, poliza: data.poliza, total_base_iva: data.total_base_iva, total_iva_acreditable: data.total_iva_acreditable });
    }
    result.sort((a,b) => {
      const na = parseFloat(a.poliza), nb = parseFloat(b.poliza);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.poliza.localeCompare(b.poliza);
    });
    return result;
  }

  function reconcile(df1, df2, key1, key2) {
    const map = new Map();
    df1.forEach(item => map.set(item.id, { id: item.id, poliza: item.poliza, val1: item[key1], val2: 0 }));
    df2.forEach(item => {
      if (map.has(item.id)) {
        const existing = map.get(item.id);
        existing.val2 = item[key2];
      } else {
        map.set(item.id, { id: item.id, poliza: item.poliza, val1: 0, val2: item[key2] });
      }
    });
    const result = [];
    for (let [id, data] of map.entries()) {
      const v1 = Math.abs(data.val1);
      const v2 = Math.abs(data.val2);
      if (v1 <= TOLERANCIA && v2 <= TOLERANCIA) continue;
      data.diferencia = data.val1 - data.val2;
      const diffAbs = Math.abs(data.diferencia);
      if (diffAbs <= TOLERANCIA) data.estado = 'OK';
      else if (v1 <= TOLERANCIA) data.estado = 'Solo en Fiscal';
      else if (v2 <= TOLERANCIA) data.estado = 'Solo en Contable';
      else data.estado = 'Diferencia > 0.50';
      result.push(data);
    }
    result.sort((a,b) => {
      const na = parseFloat(a.poliza), nb = parseFloat(b.poliza);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.poliza.localeCompare(b.poliza);
    });
    return result;
  }

  const handleFileChange = (key, file) => {
    setFiles(prev => ({ ...prev, [key]: file }));
  };

  async function procesar() {
    setErr('');
    setComparativas(null);
    const required = [];
    if (moduloTraslado) required.push('a1','a2','aa1');
    if (moduloAcreditable) required.push('b1','b2','bb1');
    const missing = required.filter(k => !files[k]);
    if (missing.length) {
      setErr('Faltan archivos: ' + missing.join(', '));
      return;
    }
    setLoading(true);
    try {
      const keysToRead = Object.keys(files).filter(k => files[k] !== null);
      const readPromises = keysToRead.map(async key => {
        const data = await readFile(files[key], startRows[key]);
        return { key, data };
      });
      const results = await Promise.all(readPromises);
      const dataMap = {};
      results.forEach(r => { dataMap[r.key] = r.data; });

      const comparativasResult = {};

      if (moduloTraslado) {
        const resA1 = processAux(dataMap.a1, COL_G);
        const resA2 = processAux(dataMap.a2, COL_G);
        const resAA1 = processAnexoTrasladado(dataMap.aa1);
        comparativasResult.clientes = reconcile(resA1, resAA1, 'total', 'total_base_iva');
        comparativasResult.ivaTrasladado = reconcile(resA2, resAA1, 'total', 'total_iva_trasladado');
      }

      if (moduloAcreditable) {
        const resB1 = processAux(dataMap.b1, COL_F);
        const resB2 = processAux(dataMap.b2, COL_F);
        const resBB1 = processAnexoAcreditable(dataMap.bb1);
        comparativasResult.proveedores = reconcile(resB1, resBB1, 'total', 'total_base_iva');
        comparativasResult.ivaAcreditable = reconcile(resB2, resBB1, 'total', 'total_iva_acreditable');
      }

      setComparativas(comparativasResult);
    } catch (e) {
      setErr('Error al procesar: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function descargarExcel() {
    if (!comparativas) return;
    const wb = XLSX.utils.book_new();

    const NUMFMT = '#,##0.00';
    const borderThin = { top:{style:'thin',color:{rgb:'D1D5DB'}}, bottom:{style:'thin',color:{rgb:'D1D5DB'}}, left:{style:'thin',color:{rgb:'D1D5DB'}}, right:{style:'thin',color:{rgb:'D1D5DB'}} };
    const titleStyle = { font:{bold:true, sz:14, color:{rgb:'FF6B2B'}}, alignment:{horizontal:'left', vertical:'center'} };
    const subtitleStyle = { font:{italic:true, sz:10, color:{rgb:'6B7280'}} };
    const headerStyle = { font:{bold:true, color:{rgb:'FFFFFF'}, sz:11}, fill:{fgColor:{rgb:'FF6B2B'}}, alignment:{horizontal:'center', vertical:'center'}, border: borderThin };
    const ESTADO_STYLE = {
      'OK': { font:{bold:true,color:{rgb:'15803D'}}, fill:{fgColor:{rgb:'DCFCE7'}} },
      'Solo en Contable': { font:{bold:true,color:{rgb:'92400E'}}, fill:{fgColor:{rgb:'FEF3C7'}} },
      'Solo en Fiscal': { font:{bold:true,color:{rgb:'92400E'}}, fill:{fgColor:{rgb:'FEF3C7'}} },
      'Diferencia > 0.50': { font:{bold:true,color:{rgb:'B91C1C'}}, fill:{fgColor:{rgb:'FEE2E2'}} }
    };
    function estadoStyle(estado){
      const base = ESTADO_STYLE[estado] || { font:{color:{rgb:'1F2937'}}, fill:{fgColor:{rgb:'FFFFFF'}} };
      return { ...base, border: borderThin, alignment:{horizontal:'center', vertical:'center'} };
    }
    function rowFillStyle(estado, align){
      const base = ESTADO_STYLE[estado] || { fill:{fgColor:{rgb:'FFFFFF'}} };
      return { font:{color:{rgb:'1F2937'}}, fill: base.fill, border: borderThin, alignment:{horizontal:align, vertical:'center'} };
    }
    function rowFillNumStyle(estado){
      const base = ESTADO_STYLE[estado] || { fill:{fgColor:{rgb:'FFFFFF'}} };
      return { font:{color:{rgb:'1F2937'}}, fill: base.fill, border: borderThin, alignment:{horizontal:'right', vertical:'center'}, numFmt: NUMFMT };
    }

    function setCell(sheet, addr, obj, style) {
      sheet[addr] = obj;
      if (style) { sheet[addr].s = style; if (style.numFmt) sheet[addr].z = style.numFmt; }
    }

    function buildComparativaSheet(data, name, col1, col2) {
      const sheet = {};
      const startRow = 3;
      const headers = ['ID', 'Póliza', col1, col2, 'Diferencia', 'Estado'];
      const lastCol = headers.length - 1;

      setCell(sheet, XLSX.utils.encode_cell({ r: 0, c: 0 }), { t: 's', v: ` ORANGE MATCH — ${name}` }, titleStyle);
      const total = data ? data.length : 0;
      const okCount = data ? data.filter(d => d.estado === 'OK').length : 0;
      setCell(sheet, XLSX.utils.encode_cell({ r: 1, c: 0 }),
        { t: 's', v: `Generado: ${new Date().toLocaleDateString('es-MX')}   |   Registros: ${total}   |   Cuadrados: ${okCount}   |   Tolerancia: $${TOLERANCIA.toFixed(2)}` },
        subtitleStyle);

      headers.forEach((h, c) => {
        setCell(sheet, XLSX.utils.encode_cell({ r: startRow, c }), { t: 's', v: h }, headerStyle);
      });

      if (data && data.length) {
        data.forEach((row, i) => {
          const r = startRow + 1 + i;
          setCell(sheet, XLSX.utils.encode_cell({ r, c: 0 }), { t: 's', v: String(row.id) }, rowFillStyle(row.estado, 'left'));
          setCell(sheet, XLSX.utils.encode_cell({ r, c: 1 }), { t: 's', v: String(row.poliza) }, rowFillStyle(row.estado, 'left'));
          setCell(sheet, XLSX.utils.encode_cell({ r, c: 2 }), { t: 'n', v: Number(row.val1) || 0 }, rowFillNumStyle(row.estado));
          setCell(sheet, XLSX.utils.encode_cell({ r, c: 3 }), { t: 'n', v: Number(row.val2) || 0 }, rowFillNumStyle(row.estado));
          setCell(sheet, XLSX.utils.encode_cell({ r, c: 4 }), { t: 'n', v: Number(row.diferencia) || 0 }, rowFillNumStyle(row.estado));
          setCell(sheet, XLSX.utils.encode_cell({ r, c: 5 }), { t: 's', v: row.estado }, estadoStyle(row.estado));
        });
      }

      const lastRow = data && data.length ? startRow + data.length : startRow;
      sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } });
      sheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 20 }];
      sheet['!freeze'] = { xSplit: 0, ySplit: startRow + 1 };
      if (data && data.length) {
        sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: startRow, c: 0 }, e: { r: startRow, c: lastCol } }) };
      }
      return { sheet, total, okCount, diff: total - okCount };
    }

    const comparativasDef = [];
    if (comparativas.clientes) comparativasDef.push({ key: 'clientes', name: 'Comparativa Clientes', col1: 'Contable (A1)', col2: 'Fiscal (AA1)' });
    if (comparativas.ivaTrasladado) comparativasDef.push({ key: 'ivaTrasladado', name: 'Comparativa IVA Trasladado', col1: 'Contable (A2)', col2: 'Fiscal (AA1)' });
    if (comparativas.proveedores) comparativasDef.push({ key: 'proveedores', name: 'Comparativa Proveedores', col1: 'Contable (B1)', col2: 'Fiscal (BB1)' });
    if (comparativas.ivaAcreditable) comparativasDef.push({ key: 'ivaAcreditable', name: 'Comparativa IVA Acreditable', col1: 'Contable (B2)', col2: 'Fiscal (BB1)' });

    const summaries = comparativasDef.map(({ key, name, col1, col2 }) => {
      const data = comparativas[key];
      return { name, ...buildComparativaSheet(data, name, col1, col2) };
    });

    const resumenSheet = {};
    setCell(resumenSheet, 'A1', { t: 's', v: ' ORANGE MATCH — Resumen de Conciliación Contable vs Fiscal' }, titleStyle);
    setCell(resumenSheet, 'A2', { t: 's', v: `Generado: ${new Date().toLocaleDateString('es-MX')}   |   Tolerancia: $${TOLERANCIA.toFixed(2)}` }, subtitleStyle);
    const resHeaders = ['Comparativa', 'Registros', 'Cuadrados (OK)', 'Con Diferencia', '% Cuadrado'];
    resHeaders.forEach((h, c) => setCell(resumenSheet, XLSX.utils.encode_cell({ r: 3, c }), { t: 's', v: h }, headerStyle));

    summaries.forEach((s, i) => {
      const r = 4 + i;
      const pct = s.total ? (s.okCount / s.total) : 1;
      setCell(resumenSheet, XLSX.utils.encode_cell({ r, c: 0 }), { t: 's', v: s.name }, { font:{bold:true,color:{rgb:'1F2937'}}, fill:{fgColor:{rgb:'FFF3E9'}}, border: borderThin, alignment:{horizontal:'left',vertical:'center'} });
      setCell(resumenSheet, XLSX.utils.encode_cell({ r, c: 1 }), { t: 'n', v: s.total }, { font:{color:{rgb:'1F2937'}}, border: borderThin, alignment:{horizontal:'center',vertical:'center'} });
      setCell(resumenSheet, XLSX.utils.encode_cell({ r, c: 2 }), { t: 'n', v: s.okCount }, { font:{bold:true,color:{rgb:'15803D'}}, fill:{fgColor:{rgb:'DCFCE7'}}, border: borderThin, alignment:{horizontal:'center',vertical:'center'} });
      setCell(resumenSheet, XLSX.utils.encode_cell({ r, c: 3 }), { t: 'n', v: s.diff }, { font:{bold:true,color: s.diff>0?{rgb:'B91C1C'}:{rgb:'15803D'}}, fill:{fgColor: s.diff>0?{rgb:'FEE2E2'}:{rgb:'DCFCE7'}}, border: borderThin, alignment:{horizontal:'center',vertical:'center'} });
      setCell(resumenSheet, XLSX.utils.encode_cell({ r, c: 4 }), { t: 'n', v: pct }, { font:{color:{rgb:'1F2937'}}, border: borderThin, alignment:{horizontal:'center',vertical:'center'}, numFmt:'0.0%' });
    });
    resumenSheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 4 + summaries.length, c: 4 } });
    resumenSheet['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, resumenSheet, 'Resumen');

    summaries.forEach(s => XLSX.utils.book_append_sheet(wb, s.sheet, s.name));
    XLSX.writeFile(wb, 'conciliacion_contable_fiscal.xlsx');
  }

  function renderComparativa(data, titulo, col1, col2) {
    if (!data || data.length === 0) return <div className="alert alert-warn">No hay datos para mostrar</div>;
    return (
      <div style={{overflowX:'auto'}}>
        <table className="tbl">
          <thead><tr>
            <th>ID</th><th>Póliza</th><th>{col1}</th><th>{col2}</th><th>Diferencia</th><th>Estado</th>
          </tr></thead>
          <tbody>
            {data.map((row, i) => {
              let className = '';
              if (row.estado === 'OK') className = 'comparativa-ok';
              else if (row.estado === 'Diferencia > 0.50') className = 'comparativa-error';
              else className = 'comparativa-warn';
              return <tr key={i} className={row.estado === 'OK' ? 'comparativa-ok-bg' : row.estado === 'Diferencia > 0.50' ? 'comparativa-error-bg' : ''}>
                <td style={{fontWeight:600,color:'#fff'}}>{row.id}</td>
                <td>{row.poliza}</td>
                <td>{fmt(row.val1)}</td>
                <td>{fmt(row.val2)}</td>
                <td style={{color: Math.abs(row.diferencia) <= TOLERANCIA ? '#22c55e' : '#ef4444'}}>{fmt(row.diferencia)}</td>
                <td><span className={className}>{row.estado}</span></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{color:'#fff',fontSize:20,fontWeight:800,marginBottom:20}}> Conciliación Contable vs Fiscal</h2>
      <div className="card" style={{marginBottom:20}}>
        <div className="card-title"> Cargar archivos</div>
        {/* Checkboxes integrados con el mismo estilo que el resto */}
        <div style={{display:'flex', gap:20, marginBottom:12, flexWrap:'wrap', backgroundColor:'#111827', padding:'8px 12px', borderRadius:8, border:'1px solid #374151'}}>
          <label style={{display:'flex', alignItems:'center', gap:6, color:'#d1d5db', cursor:'pointer', fontSize:13}}>
            <input type="checkbox" checked={moduloTraslado} onChange={() => setModuloTraslado(v => !v)} />
            <span style={{fontWeight:600}}> Traslado (Clientes + IVA Trasladado)</span>
          </label>
          <label style={{display:'flex', alignItems:'center', gap:6, color:'#d1d5db', cursor:'pointer', fontSize:13}}>
            <input type="checkbox" checked={moduloAcreditable} onChange={() => setModuloAcreditable(v => !v)} />
            <span style={{fontWeight:600}}> Acreditable (Proveedores + IVA Acreditable)</span>
          </label>
        </div>

        <div className="grid2" style={{marginBottom:12}}>
          {moduloTraslado && (
            <>
              <div className="field"><label className="lbl">a1 (Auxiliar Clientes) — fila 9</label>
                <input className="inp" type="file" accept=".xlsx,.xls,.csv" onChange={e=>handleFileChange('a1', e.target.files[0])}/>
              </div>
              <div className="field"><label className="lbl">a2 (Auxiliar IVA Trasladado) — fila 9</label>
                <input className="inp" type="file" accept=".xlsx,.xls,.csv" onChange={e=>handleFileChange('a2', e.target.files[0])}/>
              </div>
              <div className="field"><label className="lbl">aa1 (Anexo Trasladado) — fila 7</label>
                <input className="inp" type="file" accept=".xlsx,.xls,.csv" onChange={e=>handleFileChange('aa1', e.target.files[0])}/>
              </div>
            </>
          )}
          {moduloAcreditable && (
            <>
              <div className="field"><label className="lbl">b1 (Auxiliar Proveedores) — fila 9</label>
                <input className="inp" type="file" accept=".xlsx,.xls,.csv" onChange={e=>handleFileChange('b1', e.target.files[0])}/>
              </div>
              <div className="field"><label className="lbl">b2 (Auxiliar IVA Acreditable) — fila 9</label>
                <input className="inp" type="file" accept=".xlsx,.xls,.csv" onChange={e=>handleFileChange('b2', e.target.files[0])}/>
              </div>
              <div className="field"><label className="lbl">bb1 (Anexo Acreditable) — fila 7</label>
                <input className="inp" type="file" accept=".xlsx,.xls,.csv" onChange={e=>handleFileChange('bb1', e.target.files[0])}/>
              </div>
            </>
          )}
        </div>
        {err && <div className="alert alert-error">{err}</div>}
        <button className="btn btn-primary" onClick={procesar} disabled={loading}>
          {loading ? <><span className="spinner"/>&nbsp;Procesando...</> : ' Procesar y conciliar'}
        </button>
      </div>

      {comparativas && (
        <div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
            <h3 style={{color:'#fff'}}>Resultados de la conciliación</h3>
            <button className="btn btn-primary" onClick={descargarExcel}> Descargar Excel con comparativas</button>
          </div>
          <div className="conciliacion-grid">
            {comparativas.clientes && (
              <div className="card">
                <div className="card-title"> Comparativa Clientes</div>
                {renderComparativa(comparativas.clientes, 'Clientes', 'Contable (A1)', 'Fiscal (AA1)')}
              </div>
            )}
            {comparativas.ivaTrasladado && (
              <div className="card">
                <div className="card-title"> Comparativa IVA Trasladado</div>
                {renderComparativa(comparativas.ivaTrasladado, 'IVA Trasladado', 'Contable (A2)', 'Fiscal (AA1)')}
              </div>
            )}
            {comparativas.proveedores && (
              <div className="card">
                <div className="card-title"> Comparativa Proveedores</div>
                {renderComparativa(comparativas.proveedores, 'Proveedores', 'Contable (B1)', 'Fiscal (BB1)')}
              </div>
            )}
            {comparativas.ivaAcreditable && (
              <div className="card">
                <div className="card-title"> Comparativa IVA Acreditable</div>
                {renderComparativa(comparativas.ivaAcreditable, 'IVA Acreditable', 'Contable (B2)', 'Fiscal (BB1)')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
