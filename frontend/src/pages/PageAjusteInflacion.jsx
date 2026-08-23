import React from 'react';
import { api } from '../lib/api.js';
import { normCuenta } from '../lib/balanza.js';
import { fmt } from '../lib/format.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function num(v) {
  const n = Number(String(v ?? '').replace(/,/g,''));
  return Number.isFinite(n) ? n : 0;
}

function splitCodes(value) {
  return String(value || '').split(/[,;\s]+/).map(normCuenta).filter(Boolean);
}

function saldoCuenta(codigo, balanza) {
  const fila = (balanza || []).find(f => normCuenta(f.cuenta) === codigo);
  if (!fila) return 0;
  // El saldo final de una cuenta se expresa como Deudor - Acreedor en activos
  // y como Acreedor - Deudor en pasivos. Para este papel de trabajo interesa
  // el saldo monetario positivo de la cuenta seleccionada, por lo que se toma
  // el valor absoluto del saldo final.
  return Math.abs((Number(fila.sf_d) || 0) - (Number(fila.sf_a) || 0));
}

function factorInflacion(inpcFin, inpcPrev) {
  if (!inpcFin || !inpcPrev) return null;
  return (inpcFin / inpcPrev) - 1;
}

export function PageAjusteInflacion({ token }) {
  const [empresas, setEmpresas] = React.useState([]);
  const [empresa, setEmpresa] = React.useState(null);
  const [anio, setAnio] = React.useState(new Date().getFullYear() - 1);
  const [catalogo, setCatalogo] = React.useState([]);
  const [balanzas, setBalanzas] = React.useState({});
  const [config, setConfig] = React.useState({ creditos:'', deudas:'', manual:{} });
  const [inpcFin, setInpcFin] = React.useState('');
  const [inpcPrev, setInpcPrev] = React.useState('');
  const [cargando, setCargando] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [mensaje, setMensaje] = React.useState('');

  React.useEffect(() => {
    api('GET','/empresas',null,token).then(setEmpresas).catch(e=>setMensaje(' '+e.message));
  }, [token]);

  React.useEffect(() => {
    if (!empresa) return;
    cargarTodo();
  }, [empresa, anio]);

  async function cargarTodo() {
    setCargando(true);
    setMensaje('');
    try {
      const catResp = await api('GET', `/empresas/${empresa.id}/catalogo`, null, token);
      setCatalogo(catResp.catalogo || []);
      const cfg = await api('GET', `/empresas/${empresa.id}/ajuste-inflacion?anio=${anio}`, null, token);
      const d = cfg.datos || {};
      const c = d.config || {};
      setConfig({
        creditos: c.creditos || '',
        deudas: c.deudas || '',
        manual: c.manual || {}
      });
      const INPC_CIERRE = {
        2025: { fin: 143.042, prev: 137.949 },
        2024: { fin: 137.949, prev: 132.373 },
        2023: { fin: 132.373, prev: 128.389 },
        2022: { fin: 126.478, prev: 117.308 }
      };
      const baseInpc = INPC_CIERRE[anio] || {};
      setInpcFin(d.inpc_fin ?? baseInpc.fin ?? '');
      setInpcPrev(d.inpc_prev ?? baseInpc.prev ?? '');

      const pares = await Promise.all(Array.from({length:12}, async (_,i)=>{
        const m=i+1;
        const periodo=`${anio}-${String(m).padStart(2,'0')}`;
        try {
          const r=await api('GET',`/empresas/${empresa.id}/balanza?periodo=${periodo}`,null,token);
          return [m,r.balanza||[]];
        } catch { return [m,[]]; }
      }));
      const b={}; pares.forEach(([m,v])=>b[m]=v); setBalanzas(b);
    } catch(e) {
      setMensaje(' Error cargando el papel de trabajo: '+e.message);
    } finally { setCargando(false); }
  }

  async function guardar() {
    if (!empresa) return;
    setGuardando(true);
    try {
      await api('PUT', `/empresas/${empresa.id}/ajuste-inflacion`, {
        anio, inpc_fin: inpcFin, inpc_prev: inpcPrev, config
      }, token);
      setMensaje(' Configuración del Ajuste Anual por Inflación guardada');
      setTimeout(()=>setMensaje(''),3500);
    } catch(e) {
      setMensaje(' '+e.message);
    } finally { setGuardando(false); }
  }

  const creditCodes = splitCodes(config.creditos);
  const debtCodes = splitCodes(config.deudas);

  function autoTotal(codes, mes) {
    return codes.reduce((acc,c)=>acc+saldoCuenta(c,balanzas[mes]||[]),0);
  }

  function valoresMes(mes) {
    const manual = config.manual?.[mes];
    if (manual?.enabled) return { creditos:num(manual.creditos), deudas:num(manual.deudas), manual:true };
    return { creditos:autoTotal(creditCodes,mes), deudas:autoTotal(debtCodes,mes), manual:false };
  }

  const filas = Array.from({length:12},(_,i)=>({mes:i+1,...valoresMes(i+1)}));
  const mesesFaltantes = filas.filter(r=>!r.manual && !(balanzas[r.mes]||[]).length).length;
  const promedioCreditos = filas.reduce((a,r)=>a+r.creditos,0)/12;
  const promedioDeudas = filas.reduce((a,r)=>a+r.deudas,0)/12;
  const factor = factorInflacion(num(inpcFin),num(inpcPrev));
  const diferencia = promedioDeudas-promedioCreditos;
  const acumulable = factor==null || diferencia<=0 ? 0 : diferencia*factor;
  const deducible = factor==null || diferencia>=0 ? 0 : Math.abs(diferencia)*factor;

  function updateManual(mes, field, value) {
    setConfig(prev=>({
      ...prev,
      manual:{
        ...(prev.manual||{}),
        [mes]:{...(prev.manual?.[mes]||{}),enabled:true,[field]:value}
      }
    }));
  }
  function toggleManual(mes, enabled) {
    setConfig(prev=>{
      const next={...(prev.manual||{})};
      if (enabled) next[mes]={...(next[mes]||{}),enabled:true,creditos:next[mes]?.creditos||0,deudas:next[mes]?.deudas||0};
      else delete next[mes];
      return {...prev,manual:next};
    });
  }

  function exportar() {
    const XLSX = window.XLSX;
    if (!XLSX) return alert('No está disponible el motor de Excel.');
    const rows=[
      ['PAPEL DE TRABAJO — AJUSTE ANUAL POR INFLACIÓN',''],
      ['Empresa',empresa?.nombre||''],
      ['Ejercicio',anio],
      ['INPC último mes ejercicio',num(inpcFin)||''],
      ['INPC último mes ejercicio anterior',num(inpcPrev)||''],
      ['Factor de ajuste anual',factor==null?'':factor],
      [],
      ['Mes','Saldo promedio créditos','Saldo promedio deudas','Diferencia deudas-créditos','Origen']
    ];
    filas.forEach(r=>rows.push([MESES[r.mes-1],r.creditos,r.deudas,r.deudas-r.creditos,r.manual?'Manual':'Balanza']));
    rows.push([]);
    rows.push(['PROMEDIOS',promedioCreditos,promedioDeudas,diferencia,'']);
    rows.push(['AJUSTE ANUAL POR INFLACIÓN ACUMULABLE',acumulable,'','','']);
    rows.push(['AJUSTE ANUAL POR INFLACIÓN DEDUCIBLE',deducible,'','','']);
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:42},{wch:24},{wch:24},{wch:28},{wch:15}];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Ajuste Inflación');
    XLSX.writeFile(wb,`Ajuste_Inflacion_${empresa?.nombre||'Empresa'}_${anio}.xlsx`);
  }

  return <div>
    <div className="card" style={{marginBottom:16}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <div>
          <div className="card-title" style={{marginBottom:4}}> Ajuste Anual por Inflación</div>
          <div style={{fontSize:12,color:'#9ca3af'}}>Papel de trabajo para personas morales · Art. 44 y correlativos de la LISR</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <select className="inp" value={empresa?.id||''} onChange={e=>setEmpresa(empresas.find(x=>String(x.id)===e.target.value)||null)} style={{minWidth:230}}>
            <option value="">Selecciona empresa</option>
            {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre} {e.rfc?`· ${e.rfc}`:''}</option>)}
          </select>
          <input className="inp" type="number" value={anio} onChange={e=>setAnio(Number(e.target.value)||anio)} style={{width:100}}/>
        </div>
      </div>
    </div>

    {!empresa ? <div className="card"><div style={{color:'#9ca3af'}}>Selecciona una empresa para comenzar.</div></div> :
    <React.Fragment>
      <div className="grid2" style={{marginBottom:16}}>
        <div className="card">
          <div className="card-title"> Configuración de cuentas</div>
          <div className="field">
            <label className="lbl">Cuentas que integran CRÉDITOS</label>
            <input className="inp" value={config.creditos} onChange={e=>setConfig({...config,creditos:e.target.value})}
              placeholder="Ejemplo: 105-01, 105-02, 105-03"/>
            <div style={{fontSize:11,color:'#6b7280',marginTop:5}}>Separa cuentas con comas, espacios o punto y coma. Se toma el saldo final de cada mes.</div>
          </div>
          <div className="field">
            <label className="lbl">Cuentas que integran DEUDAS</label>
            <input className="inp" value={config.deudas} onChange={e=>setConfig({...config,deudas:e.target.value})}
              placeholder="Ejemplo: 201-01, 201-02, 202-01"/>
            <div style={{fontSize:11,color:'#6b7280',marginTop:5}}>Evita seleccionar simultáneamente una cuenta padre y sus subcuentas para no duplicar saldos.</div>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?'Guardando…':' Guardar configuración'}</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title"> INPC y factor de ajuste</div>
          <div className="grid2">
            <div className="field">
              <label className="lbl">INPC último mes del ejercicio</label>
              <input className="inp" type="number" step="0.001" value={inpcFin} onChange={e=>setInpcFin(e.target.value)} placeholder="Ej. 145.000"/>
            </div>
            <div className="field">
              <label className="lbl">INPC último mes del ejercicio anterior</label>
              <input className="inp" type="number" step="0.001" value={inpcPrev} onChange={e=>setInpcPrev(e.target.value)} placeholder="Ej. 137.000"/>
            </div>
          </div>
          <div style={{background:'#111827',border:'1px solid #374151',borderRadius:10,padding:14}}>
            <div style={{fontSize:11,color:'#9ca3af'}}>FACTOR DE AJUSTE ANUAL</div>
            <div style={{fontSize:24,fontWeight:800,color:'var(--orange)',marginTop:3}}>{factor==null?'—':(factor*100).toFixed(6)+'%'}</div>
            <div style={{fontSize:11,color:'#6b7280',marginTop:5}}>INPC final / INPC final anterior − 1</div>
          </div>
        </div>
      </div>

      {cargando ? <div className="card"> Cargando balanzas…</div> :
      <div className="card" style={{padding:0,overflow:'hidden',marginBottom:16}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #374151'}}>
          <div className="card-title" style={{marginBottom:4}}> Integración de saldos mensuales</div>
          <div style={{fontSize:12,color:'#9ca3af'}}>La ley toma el saldo al último día de cada mes y el promedio anual se divide entre los meses del ejercicio.</div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr>
              <th>Mes</th><th style={{textAlign:'right'}}>Créditos</th><th style={{textAlign:'right'}}>Deudas</th>
              <th style={{textAlign:'right'}}>Deudas − Créditos</th><th>Fuente</th><th>Captura manual</th>
            </tr></thead>
            <tbody>
              {filas.map(r=><tr key={r.mes}>
                <td style={{fontWeight:700,color:'#fff'}}>{MESES[r.mes-1]}</td>
                <td style={{textAlign:'right',fontFamily:'monospace'}}>{r.manual ? (
                  <input className="inp" style={{width:150,textAlign:'right'}} value={config.manual?.[r.mes]?.creditos??0} onChange={e=>updateManual(r.mes,'creditos',e.target.value)}/>
                ):fmt(r.creditos)}</td>
                <td style={{textAlign:'right',fontFamily:'monospace'}}>{r.manual ? (
                  <input className="inp" style={{width:150,textAlign:'right'}} value={config.manual?.[r.mes]?.deudas??0} onChange={e=>updateManual(r.mes,'deudas',e.target.value)}/>
                ):fmt(r.deudas)}</td>
                <td style={{textAlign:'right',fontFamily:'monospace',fontWeight:700,color:r.deudas-r.creditos>=0?'#fca5a5':'#86efac'}}>{fmt(r.deudas-r.creditos)}</td>
                <td>{r.manual?<span className="chip">MANUAL</span>:((balanzas[r.mes]||[]).length?<span style={{color:'#22c55e'}}>● Balanza</span>:<span style={{color:'#ef4444'}}>● Falta balanza</span>)}</td>
                <td><input type="checkbox" checked={!!r.manual} onChange={e=>toggleManual(r.mes,e.target.checked)}/></td>
              </tr>)}
            </tbody>
            <tfoot><tr>
              <td style={{fontWeight:800,color:'#fff'}}>PROMEDIO ANUAL</td>
              <td style={{textAlign:'right',fontFamily:'monospace',fontWeight:800}}>{fmt(promedioCreditos)}</td>
              <td style={{textAlign:'right',fontFamily:'monospace',fontWeight:800}}>{fmt(promedioDeudas)}</td>
              <td style={{textAlign:'right',fontFamily:'monospace',fontWeight:800}}>{fmt(diferencia)}</td>
              <td colSpan="2"></td>
            </tr></tfoot>
          </table>
        </div>
      </div>}

      <div className="grid2" style={{marginBottom:16}}>
        <div className="card" style={{borderColor:'#7f1d1d'}}>
          <div style={{fontSize:12,color:'#fca5a5',fontWeight:800}}>AJUSTE ANUAL POR INFLACIÓN ACUMULABLE</div>
          <div style={{fontSize:28,fontWeight:900,color:'#fca5a5',marginTop:8}}>{fmt(acumulable)}</div>
          <div style={{fontSize:11,color:'#9ca3af',marginTop:5}}>Cuando el promedio de deudas es mayor que el de créditos.</div>
        </div>
        <div className="card" style={{borderColor:'#14532d'}}>
          <div style={{fontSize:12,color:'#86efac',fontWeight:800}}>AJUSTE ANUAL POR INFLACIÓN DEDUCIBLE</div>
          <div style={{fontSize:28,fontWeight:900,color:'#86efac',marginTop:8}}>{fmt(deducible)}</div>
          <div style={{fontSize:11,color:'#9ca3af',marginTop:5}}>Cuando el promedio de créditos es mayor que el de deudas.</div>
        </div>
      </div>

      {mesesFaltantes>0 && <div className="alert alert-warn">
         Faltan {mesesFaltantes} balanza(s) mensual(es) y no tienen captura manual. Para un ejercicio completo de 12 meses, el promedio debe integrar los saldos al último día de cada mes.
      </div>}

      <div className="card" style={{marginTop:16}}>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap'}}>
          <button className="btn btn-secondary" onClick={exportar}> Exportar Excel</button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando?'Guardando…':' Guardar papel de trabajo'}</button>
        </div>
        {mensaje && <div className="alert alert-info" style={{margin:'12px 0 0'}}>{mensaje}</div>}
      </div>

      <div style={{marginTop:12,fontSize:11,color:'#6b7280',lineHeight:1.6}}>
        <strong style={{color:'#9ca3af'}}>Nota fiscal:</strong> el sistema calcula con la fórmula del Art. 44 LISR.
        La integración de créditos/deudas debe revisarse contra los Art. 45 y 46 y las reglas aplicables al caso particular.
        El papel de trabajo no sustituye la revisión fiscal del contador.
      </div>
    </React.Fragment>}
  </div>;
}
