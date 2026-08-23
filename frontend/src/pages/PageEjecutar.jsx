import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SUMA_LEGACY_ANEXO, buscarValorAnexoPorEtiqueta } from '../lib/anexoIva.js';
import { api } from '../lib/api.js';
import { filasBalanzaDesdeMatriz, normCuenta } from '../lib/balanza.js';
import { CONFIG_DEFAULT, safeParseConfigIVA, safeParseConfigPT } from '../lib/configEmpresa.js';
import { hojaBalanza } from '../lib/excel.js';
import { MESES, fmt } from '../lib/format.js';
import { OPS, SECCIONES, calcSeccion, getOp } from '../lib/reglasIva.js';
import { DiagnosticoAnexoIVA } from '../components/DiagnosticoAnexoIVA.jsx';

export function PageEjecutar({token,onCuentasLoad}){
  const [empresas,setEmpresas]=useState([]);
  const [empId,setEmpId]=useState('');
  const [mes,setMes]=useState(new Date().getMonth()+1);
  const [anio,setAnio]=useState(new Date().getFullYear());
  const [balFile,setBalFile]=useState(null);
  const [anexoFile,setAnexoFile]=useState(null);
  const [resultado,setResultado]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const [validando,setValidando]=useState(false);
  const [validado,setValidado]=useState(false);
  const [msgValidacion,setMsgValidacion]=useState('');
  // Celdas de las 4 secciones para el amarre (método directo restaurado —
  // ver comentario en ejecutar()), configuradas en "Config IVA → Anexo Config".
  const [anexoCfg,setAnexoCfg]=useState({});
  useEffect(()=>{api('GET','/anexo-config',null,token).then(d=>{if(d) setAnexoCfg(d);}).catch(()=>{});},[]);

  useEffect(()=>{api('GET','/empresas',null,token).then(setEmpresas).catch(()=>{});},[]);

  // Revisa si el amarre de la empresa/mes/año en turno ya está validado.
  // Se usa un pequeño debounce (para no disparar una petición por cada dígito
  // que se teclea en "Año") y un contador de secuencia para ignorar respuestas
  // que lleguen fuera de orden (evita parpadeos si el usuario cambia rápido).
  const secuenciaCheck = useRef(0);
  useEffect(()=>{
    setValidado(false);
    setMsgValidacion('');
    if(!empId) return;
    const anioNum = parseInt(anio,10);
    if(!anioNum || String(anioNum).length!==4) return; // espera a que el año esté completo
    const miTurno = ++secuenciaCheck.current;
    const t = setTimeout(()=>{
      const periodo=`${anioNum}-${String(mes).padStart(2,'0')}`;
      api('GET',`/empresas/${empId}/amarres`,null,token).then(data=>{
        if(secuenciaCheck.current!==miTurno) return; // llegó una respuesta vieja, se ignora
        const a=(data.amarres||[]).find(x=>x.periodo===periodo);
        setValidado(!!a?.validado);
      }).catch(()=>{});
    }, 350);
    return ()=>clearTimeout(t);
  },[empId,mes,anio]);

  function parseBalanza(wb){
    const {ws,rows}=hojaBalanza(wb);
    const map={};const lista=[];
    filasBalanzaDesdeMatriz(rows).forEach(obj=>{
      // Se guarda con AMBAS llaves: la cruda (como la configuró el usuario en
      // Configurar IVA, con guiones tal cual la imprime CONTPAQi) y la
      // normalizada, para no romper configuraciones ya guardadas.
      map[String(obj.cuenta).trim()]=obj;
      map[normCuenta(obj.cuenta)]=obj;
      lista.push({numero:obj.cuenta,nombre:obj.nombre});
    });
    return{map,lista,ws,rows};
  }

  function getCellValueFromWS(ws, cellRef){
    if(!cellRef) return 0;
    let cleanRef = cellRef.trim().toUpperCase();
    const match = cleanRef.match(/^([A-Z]+)(\d+)$/);
    if(!match){ console.warn("Referencia inválida:", cellRef); return 0; }
    const col = match[1];
    const row = parseInt(match[2],10)-1;
    const cell = ws[col+row];
    if(!cell){ console.warn(`Celda ${cellRef} no encontrada`); return 0; }
    let val = cell.v;
    if(typeof val === 'string'){ val = val.replace(/[^\d.-]/g,''); val = parseFloat(val); }
    return isNaN(val) ? 0 : val;
  }

  function getAnexoValue(anexoWB, cellRef){
    if(!cellRef) return 0;
    for(let i=0; i<anexoWB.SheetNames.length; i++){
      const ws = anexoWB.Sheets[anexoWB.SheetNames[i]];
      const val = getCellValueFromWS(ws, cellRef);
      if(val !== 0) return val;
    }
    const ws0 = anexoWB.Sheets[anexoWB.SheetNames[0]];
    return getCellValueFromWS(ws0, cellRef);
  }

  async function ejecutar(){
    setErr('');setResultado(null);
    if(!empId||!balFile||!anexoFile){setErr('Selecciona empresa y carga ambos archivos');return;}
    setLoading(true);
    try{
      const emp=empresas.find(e=>e.id===parseInt(empId));
      const cfg=safeParseConfigIVA(emp.config_iva);
      const configPT = safeParseConfigPT(emp.config_pt);
      const celdasManual = configPT.anexo_iva || {};
      const readWB=(file)=>new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=e=>{try{res(XLSX.read(new Uint8Array(e.target.result),{type:'array'}));}catch(ex){rej(ex);}};
        r.onerror=()=>rej(new Error('No se pudo leer el archivo'));
        r.readAsArrayBuffer(file);
      });
      const [balWB,anexoWB]=await Promise.all([readWB(balFile),readWB(anexoFile)]);
      const {map:balMap,lista}=parseBalanza(balWB);
      onCuentasLoad(lista);

      // Búsqueda por texto/etiqueta de los 29 conceptos del Anexo de IVA (no por
      // celda fija) — así funciona sin importar en qué fila venga cada concepto.
      // Esto SIGUE igual: alimenta el Papel de Trabajo de IVA (detalle29 se
      // guarda en validarAmarre) y no se toca.
      const detalle29={};
      Object.keys(CONFIG_DEFAULT.iva).forEach(key=>{
        detalle29[key] = buscarValorAnexoPorEtiqueta(anexoWB, key, celdasManual[key]);
      });

      // Semáforo del AMARRE DE BALANZA: se restauró el método anterior — leer
      // directo las celdas de las 4 secciones configuradas en "Config IVA →
      // Anexo Config" (anexoCfg), en vez de sumar los 29 conceptos detectados
      // por texto (SUMA_LEGACY_ANEXO). Ese método por texto puede fallar si el
      // formato del Anexo no coincide exactamente, y aquí necesitamos el dato
      // más confiable posible para comparar contra la balanza.
      const anexoVals={};
      SECCIONES.forEach(s=>{
        anexoVals[s.id] = getAnexoValue(anexoWB, anexoCfg[s.id]);
      });

      const secs={};
      SECCIONES.forEach(s=>{secs[s.id]=calcSeccion(cfg[s.id],balMap);});

      setResultado({emp,balMap,anexoVals,detalle29,secs,mes:parseInt(mes),anio:parseInt(anio),cfg,balWB,anexoWB});
    }catch(e){setErr('Error: '+e.message);}
    finally{setLoading(false);}
  }

  // Guarda la balanza y los valores del Anexo de IVA de este mes, y marca el amarre
  // como validado. A partir de aquí, el Papel de Trabajo de IVA, el de ISR y los
  // Estados Financieros usan estos datos automáticamente — ya no hace falta volver
  // a subir nada en "Papeles de Trabajo".
  async function validarAmarre(){
    if(!resultado) return;
    setValidando(true);setMsgValidacion('');
    try{
      const {emp,balMap,anexoWB,mes:mesR,anio:anioR}=resultado;
      const periodo=`${anioR}-${String(mesR).padStart(2,'0')}`;

      // 1) Balanza completa (cuenta, nombre, cargos, abonos, saldo inicial y final) para ISR y Estados Financieros
      // IMPORTANTE: los objetos en balMap usan la propiedad "cuenta" (no "numero").
      // "numero" solo existe en la lista auxiliar. Usar f.numero dejaba cuenta=undefined
      // y los papeles de trabajo / ISR / EF / analíticas quedaban vacíos.
      const _seenBal = new Set();
      const balanza = Object.values(balMap).filter(f => {
        const c = String(f.cuenta || f.numero || '').trim();
        if (!c || _seenBal.has(c)) return false;
        _seenBal.add(c);
        return true;
      }).map(f => ({
        cuenta: String(f.cuenta || f.numero || '').trim(),
        nombre: f.nombre,
        cargos: f.cargos, abonos: f.abonos,
        si_d: f.si_d, si_a: f.si_a, sf_d: f.sf_d, sf_a: f.sf_a
      }));
      await api('PUT',`/empresas/${emp.id}/balanza`,{periodo,balanza},token);

      // 2) Valores del Anexo de IVA (una celda por cada concepto del papel de trabajo de IVA)
      const configPT = safeParseConfigPT(emp.config_pt);
      const celdasManual = configPT.anexo_iva || {};
      const datosAnexo={};
      Object.keys(CONFIG_DEFAULT.iva).forEach(key=>{
        const r = buscarValorAnexoPorEtiqueta(anexoWB, key, celdasManual[key]);
        datosAnexo[key] = r.valor;
      });
      await api('PUT',`/empresas/${emp.id}/anexo-iva`,{periodo,datos:datosAnexo},token);

      // 3) Marcar el amarre como validado
      await api('PUT',`/empresas/${emp.id}/amarres`,{periodo,validado:true},token);

      setValidado(true);
      setMsgValidacion(' Amarre validado: balanza y Anexo de IVA guardados. Ya puedes ver los papeles de trabajo y Estados Financieros de '+MESES[mesR-1]+' '+anioR+'.');
    }catch(e){
      setMsgValidacion(' Error al validar: '+e.message);
    }finally{
      setValidando(false);
    }
  }

  async function quitarValidacion(){
    if(!resultado) return;
    setValidando(true);setMsgValidacion('');
    try{
      const {emp,mes:mesR,anio:anioR}=resultado;
      const periodo=`${anioR}-${String(mesR).padStart(2,'0')}`;
      await api('PUT',`/empresas/${emp.id}/amarres`,{periodo,validado:false},token);
      setValidado(false);
      setMsgValidacion('El amarre de '+MESES[mesR-1]+' '+anioR+' ya no está validado.');
    }catch(e){
      setMsgValidacion(' Error: '+e.message);
    }finally{
      setValidando(false);
    }
  }

  async function genExcel(){
    if(!resultado) return;
    const {emp,balMap,anexoVals,secs,mes,anio,cfg,balWB}=resultado;

    const wb=XLSX.utils.book_new();
    const wsName=balWB.SheetNames[0];
    const originalWS=balWB.Sheets[wsName];
    const newWS={};
    for(let k in originalWS){
      if(originalWS.hasOwnProperty(k)){
        newWS[k]=JSON.parse(JSON.stringify(originalWS[k]));
      }
    }
    // Se conserva el formato original de la balanza (negritas, rellenos, merges, alto de filas, etc. en columnas A-H)
    if(originalWS['!ref']) newWS['!ref']=originalWS['!ref'];
    if(originalWS['!cols']) newWS['!cols']=[...originalWS['!cols']];
    if(originalWS['!rows']) newWS['!rows']=JSON.parse(JSON.stringify(originalWS['!rows']));
    if(originalWS['!merges']) newWS['!merges']=JSON.parse(JSON.stringify(originalWS['!merges']));

    const range=XLSX.utils.decode_range(newWS['!ref']||'A1:A1');
    const startRow=3;
    const startCol=10;

    // ===== Estilos =====
    const NUMFMT='#,##0.00';
    const borderThin={top:{style:'thin',color:{rgb:'D1D5DB'}},bottom:{style:'thin',color:{rgb:'D1D5DB'}},left:{style:'thin',color:{rgb:'D1D5DB'}},right:{style:'thin',color:{rgb:'D1D5DB'}}};
    const titleStyle={font:{bold:true,sz:14,color:{rgb:'FF6B2B'}},alignment:{horizontal:'left',vertical:'center'}};
    const subtitleStyle={font:{italic:true,sz:10,color:{rgb:'6B7280'}}};
    const headerStyle={font:{bold:true,color:{rgb:'FFFFFF'},sz:11},fill:{fgColor:{rgb:'FF6B2B'}},alignment:{horizontal:'center',vertical:'center'},border:borderThin};
    const conceptStyle={font:{bold:true,color:{rgb:'1F2937'}},fill:{fgColor:{rgb:'FFF3E9'}},border:borderThin,alignment:{vertical:'center'}};
    const numStyle={font:{color:{rgb:'1F2937'}},border:borderThin,alignment:{horizontal:'right',vertical:'center'},numFmt:NUMFMT};
    const okStyleOk={font:{bold:true,color:{rgb:'15803D'}},fill:{fgColor:{rgb:'DCFCE7'}},border:borderThin,alignment:{horizontal:'center',vertical:'center'}};
    const okStyleBad={font:{bold:true,color:{rgb:'B91C1C'}},fill:{fgColor:{rgb:'FEE2E2'}},border:borderThin,alignment:{horizontal:'center',vertical:'center'}};
    const formulaStyle={font:{sz:10,color:{rgb:'1F2937'}},border:borderThin,alignment:{horizontal:'left',vertical:'center',wrapText:true}};

    function setCell(addr,obj,style){
      newWS[addr]=obj;
      if(style){ newWS[addr].s=style; if(style.numFmt) newWS[addr].z=style.numFmt; }
    }

    // Título del reporte
    setCell(XLSX.utils.encode_cell({r:0,c:startCol}), {t:'s',v:' ORANGE MATCH — Comparativo de Balanza vs Anexo IVA'}, titleStyle);
    setCell(XLSX.utils.encode_cell({r:1,c:startCol}), {t:'s',v:`Empresa: ${emp?.nombre||''}   |   Periodo: ${MESES[mes-1]} ${anio}   |   Generado: ${new Date().toLocaleDateString('es-MX')}`}, subtitleStyle);

    // Columnas K-P: Concepto, Valor Balanza, Valor Anexo IVA, Diferencia, ¿Cuadra?, Fórmula (col. P)
    const headers=["Concepto","Valor Balanza","Valor Anexo IVA","Diferencia","¿Cuadra?","Fórmula"];
    headers.forEach((h,ci)=>{
      const addr=XLSX.utils.encode_cell({r:startRow,c:startCol+ci});
      setCell(addr, {t:'s',v:h}, headerStyle);
    });

    let currentRow=startRow+1;

    // Ubica la fila (en la balanza original) donde está cada número de cuenta, para poder
    // construir fórmulas de Excel que apunten directamente a esas celdas.
    function findRowIndex(cuentaNum){
      for(let r=range.s.r; r<=range.e.r; r++){
        const cellAddr=XLSX.utils.encode_cell({r:r,c:0});
        const cell=newWS[cellAddr];
        if(cell && String(cell.v).trim()===cuentaNum) return r;
      }
      return -1;
    }
    const COL_CARGOS=XLSX.utils.encode_col(4); // columna E
    const COL_ABONOS=XLSX.utils.encode_col(5); // columna F
    function refParaOperacion(op,filaExcel){
      if(op==='C') return `${COL_CARGOS}${filaExcel}`;
      if(op==='A') return `${COL_ABONOS}${filaExcel}`;
      if(op==='C-A') return `(${COL_CARGOS}${filaExcel}-${COL_ABONOS}${filaExcel})`;
      return `(${COL_ABONOS}${filaExcel}-${COL_CARGOS}${filaExcel})`; // 'A-C'
    }

    // ===== Hoja aparte con el detalle de las cuentas usadas en cada rubro =====
    const detWS={};
    const detRubroStyle={font:{bold:true,color:{rgb:'1F2937'}},fill:{fgColor:{rgb:'FFF3E9'}},border:borderThin,alignment:{vertical:'center'}};
    const detCellStyle={font:{sz:10,color:{rgb:'4B5563'}},border:borderThin,alignment:{vertical:'center'}};
    const detNumStyle={font:{sz:10,color:{rgb:'1F2937'}},border:borderThin,alignment:{horizontal:'right',vertical:'center'},numFmt:NUMFMT};

    function setDetCell(addr,obj,style){
      detWS[addr]=obj;
      if(style){ detWS[addr].s=style; if(style.numFmt) detWS[addr].z=style.numFmt; }
    }

    setDetCell(XLSX.utils.encode_cell({r:0,c:0}), {t:'s',v:' ORANGE MATCH — Detalle de Formulación por Rubro'}, titleStyle);
    setDetCell(XLSX.utils.encode_cell({r:1,c:0}), {t:'s',v:`Empresa: ${emp?.nombre||''}   |   Periodo: ${MESES[mes-1]} ${anio}   |   Generado: ${new Date().toLocaleDateString('es-MX')}`}, subtitleStyle);

    const detHeaders=["Rubro","No. Cuenta","Nombre de cuenta","Operación","Signo","Valor"];
    let detRow=3;
    detHeaders.forEach((h,ci)=>{
      setDetCell(XLSX.utils.encode_cell({r:detRow,c:ci}), {t:'s',v:h}, headerStyle);
    });
    detRow++;

    for(let idx=0; idx<SECCIONES.length; idx++){
      const s=SECCIONES[idx];
      const reglas=cfg[s.id]||[];
      const cuentasUsadas=[];

      reglas.forEach(reg=>{
        const cuentaNum=reg.cuenta.trim();
        const rowData=balMap[cuentaNum];
        if(!rowData) return;
        const valor=getOp(rowData,reg.operacion);
        cuentasUsadas.push({cuenta:cuentaNum, nombre:rowData.nombre, operacion:reg.operacion, signo:reg.tipo==='suma'?'+':'-', valor});
      });

      const balanzaVal = Number(secs?.[s.id]?.suma) || 0;
      const anexoVal = Number(anexoVals[s.id]) || 0;
      const diffVal = balanzaVal - anexoVal;
      const cuadra = Math.abs(diffVal) < 1;

      const conceptCell=XLSX.utils.encode_cell({r:currentRow,c:startCol});
      setCell(conceptCell, {t:'s',v:s.label}, conceptStyle);

      // ===== Fórmula real de Excel para "Valor Balanza": suma/resta las celdas de cargos/abonos =====
      const terminosFormula = cuentasUsadas.map(cu=>{
        const filaIdx=findRowIndex(cu.cuenta);
        if(filaIdx<0) return null;
        return {ref:refParaOperacion(cu.operacion, filaIdx+1), signo:cu.signo};
      }).filter(Boolean);
      const formulaExcel = terminosFormula.length
        ? terminosFormula.map((t,ti)=> ti===0 ? (t.signo==='-'?'-':'')+t.ref : (t.signo==='+'?'+':'-')+t.ref).join('')
        : '0';

      const balanzaCell=XLSX.utils.encode_cell({r:currentRow,c:startCol+1});
      setCell(balanzaCell, {t:'n',v:balanzaVal,f:formulaExcel}, numStyle);

      const anexoCell=XLSX.utils.encode_cell({r:currentRow,c:startCol+2});
      setCell(anexoCell, {t:'n',v:anexoVal}, numStyle);

      const diffCell=XLSX.utils.encode_cell({r:currentRow,c:startCol+3});
      setCell(diffCell, {t:'n',v:diffVal}, numStyle);

      const okCell=XLSX.utils.encode_cell({r:currentRow,c:startCol+4});
      setCell(okCell, {t:'s',v: cuadra ? ' Sí' : ' No'}, cuadra ? okStyleOk : okStyleBad);

      // ===== Columna "Fórmula" (P): el valor de cada cuenta usada, encadenado con + / - =====
      const formulaTexto = cuentasUsadas.length
        ? cuentasUsadas.map((cu,ci)=>{
            const val=`${fmt(Math.abs(cu.valor))}[${cu.cuenta}]`;
            if(ci===0) return (cu.signo==='-'?'- ':'')+val;
            return (cu.signo==='+'?' + ':' - ')+val;
          }).join('')
        : '(sin cuentas configuradas)';
      const formulaCell=XLSX.utils.encode_cell({r:currentRow,c:startCol+5});
      setCell(formulaCell, {t:'s',v:formulaTexto}, formulaStyle);

      // ===== Detalle de cuentas en la hoja "DETALLE FORMULACION ORANGE" =====
      if(cuentasUsadas.length){
        cuentasUsadas.forEach((cu,ci)=>{
          const rr=detRow+ci;
          setDetCell(XLSX.utils.encode_cell({r:rr,c:0}), {t:'s',v: ci===0?s.label:''}, detRubroStyle);
          setDetCell(XLSX.utils.encode_cell({r:rr,c:1}), {t:'s',v:cu.cuenta}, detCellStyle);
          setDetCell(XLSX.utils.encode_cell({r:rr,c:2}), {t:'s',v:cu.nombre}, detCellStyle);
          setDetCell(XLSX.utils.encode_cell({r:rr,c:3}), {t:'s',v:OPS.find(o=>o.v===cu.operacion)?.l||''}, detCellStyle);
          setDetCell(XLSX.utils.encode_cell({r:rr,c:4}), {t:'s',v:cu.signo}, detCellStyle);
          setDetCell(XLSX.utils.encode_cell({r:rr,c:5}), {t:'n',v:cu.valor}, detNumStyle);
        });
        detRow += cuentasUsadas.length + 1; // fila en blanco entre rubros
      } else {
        setDetCell(XLSX.utils.encode_cell({r:detRow,c:0}), {t:'s',v:s.label}, detRubroStyle);
        setDetCell(XLSX.utils.encode_cell({r:detRow,c:1}), {t:'s',v:'(sin cuentas configuradas)'}, detCellStyle);
        detRow += 2;
      }

      currentRow++;
      currentRow++;
    }

    if(!newWS['!cols']) newWS['!cols']=[];
    newWS['!cols'][startCol]={wch:28};
    for(let i=1;i<5;i++) newWS['!cols'][startCol+i]={wch:18};
    newWS['!cols'][startCol+5]={wch:48};

    newWS['!freeze']={xSplit:0,ySplit:startRow+1};
    newWS['!autofilter']={ref:XLSX.utils.encode_range({s:{r:startRow,c:startCol},e:{r:startRow,c:startCol+5}})};

    const maxRow=Math.max(range.e.r, currentRow+5);
    newWS['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:maxRow,c:startCol+5}});

    XLSX.utils.book_append_sheet(wb,newWS,wsName);

    detWS['!cols']=[{wch:26},{wch:14},{wch:32},{wch:20},{wch:8},{wch:16}];
    detWS['!freeze']={xSplit:0,ySplit:4};
    const detMaxRow=Math.max(detRow+2, 4);
    detWS['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:detMaxRow,c:5}});
    XLSX.utils.book_append_sheet(wb,detWS,'DETALLE FORMULACION ORANGE');

    XLSX.writeFile(wb,`orange-match-${MESES[mes-1]}-${anio}-${emp.nombre}.xlsx`);
  }

  function Semaforo({label,calculado,anexo,missing}){
    const diff=Math.abs(calculado-anexo);const ok=diff<1;
    return <div>
      <div className={'semaforo '+(ok?'sem-ok':'sem-err')}>
        <div className={'dot '+(ok?'dot-ok':'dot-err')}/>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,marginBottom:6}}>{label}</div>
          <div style={{display:'flex',gap:20,fontSize:13,fontWeight:400,flexWrap:'wrap'}}>
            <span>Balanza: <b>${fmt(calculado)}</b></span>
            <span>Anexo: <b>${fmt(anexo)}</b></span>
            <span>Diferencia: <b>${fmt(diff)}</b></span>
          </div>
        </div>
        <div style={{fontSize:22}}>{ok?'':''}</div>
      </div>
      {missing&&missing.length>0&&<div className="alert alert-warn" style={{marginTop:4,borderRadius:'0 0 8px 8px',fontSize:12}}>
         No encontradas: <b>{missing.join(', ')}</b>
      </div>}
    </div>;
  }

  return <div>
    <h2 style={{color:'#fff',fontSize:20,fontWeight:800,marginBottom:20}}> Ejecutar Amarre</h2>
    <div className="card" style={{marginBottom:20}}>
      <div className="grid3" style={{marginBottom:12}}>
        <div className="field"><label className="lbl">Empresa</label>
          <select className="inp" value={empId} onChange={e=>setEmpId(e.target.value)}>
            <option value="">— Selecciona —</option>
            {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select></div>
        <div className="field"><label className="lbl">Mes</label>
          <select className="inp" value={mes} onChange={e=>setMes(e.target.value)}>
            {MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select></div>
        <div className="field"><label className="lbl">Año</label>
          <input className="inp" type="number" value={anio} onChange={e=>setAnio(e.target.value)}/></div>
      </div>
      <div className="grid2" style={{marginBottom:16}}>
        <div className="field"><label className="lbl"> Balanza Excel</label>
          <input className="inp" type="file" accept=".xlsx,.xls" onChange={e=>setBalFile(e.target.files[0])}/></div>
        <div className="field"><label className="lbl"> Anexo de IVA Excel</label>
          <input className="inp" type="file" accept=".xlsx,.xls" onChange={e=>setAnexoFile(e.target.files[0])}/></div>
      </div>
      {err&&<div className="alert alert-error">{err}</div>}
      <button className="btn btn-primary" onClick={ejecutar} disabled={loading}>
        {loading?<><span className="spinner"/>&nbsp;Procesando...</>:' Ejecutar amarre'}
      </button>
    </div>
    {resultado&&<div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <h3 style={{color:'#fff',fontWeight:700}}>{resultado.emp.nombre} — {MESES[resultado.mes-1]} {resultado.anio}</h3>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <button className="btn btn-primary" onClick={genExcel}> Descargar Excel (con amarre)</button>
          {validado && <span style={{color:'#4caf50',fontWeight:700,fontSize:13}}> Este mes ya está validado</span>}
          <button className="btn btn-primary" style={{background:'#4caf50'}} onClick={validarAmarre} disabled={validando}>
            {validando?<><span className="spinner"/>&nbsp;Guardando...</>:(validado?' Re-validar (reemplazar con estos archivos)':' Validar amarre de este mes')}
          </button>
          {validado && (
            <button className="btn btn-secondary" onClick={quitarValidacion} disabled={validando}>
              Quitar validación
            </button>
          )}
        </div>
      </div>
      {validado && (
        <div className="alert alert-info" style={{marginBottom:16}}>
          Si subiste una balanza o un anexo de IVA distinto para este mismo mes, presiona <b>"Re-validar"</b> para
          reemplazar la balanza, los valores del Anexo de IVA y la fecha de validación con los datos que acabas de procesar.
        </div>
      )}
      {msgValidacion&&<div className={'alert '+(msgValidacion.startsWith('')?'alert-error':'alert-info')} style={{marginBottom:16}}>{msgValidacion}</div>}
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {SECCIONES.map(s=>{
          const sec=resultado.secs[s.id];
          return <Semaforo key={s.id} label={SECCIONES.find(x=>x.id===s.id).label}
            calculado={sec.suma} anexo={resultado.anexoVals[s.id]} missing={sec.missing}/>;
        })}
      </div>
      <DiagnosticoAnexoIVA detalle29={resultado.detalle29} anexoWB={resultado.anexoWB}/>
    </div>}
  </div>;
}
