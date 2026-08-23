import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';
import { safeParseConfigIVA } from '../lib/configEmpresa.js';
import { OPS, SECCIONES } from '../lib/reglasIva.js';

export function PageConfigIVA({empresa,token,onBack,cuentasBalanza}){
  const [tab,setTab]=useState('base_trasladado');
  const [cfg,setCfg]=useState({});
  const [anexoCfg,setAnexoCfg]=useState({base_trasladado:'',iva_trasladado:'',base_acreditable:'',iva_acreditable:''});
  const [msg,setMsg]=useState('');
  const [masivo,setMasivo]=useState({show:false,secId:'',tipo:'suma',texto:'',operacion:'C'});
  const [busqShow,setBusqShow]=useState({});
  const [busqQ,setBusqQ]=useState({});

  useEffect(()=>{
    setCfg(safeParseConfigIVA(empresa.config_iva));
    api('GET','/anexo-config',null,token).then(d=>{if(d&&Object.keys(d).length) setAnexoCfg(d);}).catch(()=>{});
  },[empresa]);

  function getReglas(s){return cfg[s]||[];}
  function setReglas(s,r){setCfg(p=>({...p,[s]:r}));}
  function addRegla(s,tipo){setReglas(s,[...getReglas(s),{cuenta:'',operacion:'C',tipo}]);}
  function updRegla(s,i,f,v){const r=[...getReglas(s)];r[i]={...r[i],[f]:v};setReglas(s,r);}
  function delRegla(s,i){const r=[...getReglas(s)];r.splice(i,1);setReglas(s,r);}

  function aplicarMasivo(){
    const{secId,tipo,texto,operacion}=masivo;
    const cuentas=texto.split(/[\n,;]+/).map(s=>s.trim()).filter(Boolean);
    if(!cuentas.length) return;
    const nuevas=cuentas.map(c=>({cuenta:c,operacion,tipo}));
    setReglas(secId,[...getReglas(secId),...nuevas]);
    setMasivo(m=>({...m,show:false,texto:''}));
  }

  async function save(){
    try{
      await api('PUT','/empresas/'+empresa.id,{
        nombre:empresa.nombre,
        rfc:empresa.rfc,
        config_iva:cfg
      },token);
      await api('PUT','/anexo-config',anexoCfg,token);
      setMsg('Configuración guardada ');setTimeout(()=>setMsg(''),2500);
    }catch(e){setMsg(e.message);}
  }

  function FormulaPreview({secId}){
    const r=getReglas(secId);
    if(!r.length) return <div className="formula" style={{color:'#4b5563',fontStyle:'italic'}}>Sin cuentas configuradas aún</div>;
    return <div className="formula">
      {r.map((x,i)=><div key={i}>
        <span className={x.tipo==='suma'?'f-plus':'f-minus'}>{x.tipo==='suma'?'  +  ':'  −  '}</span>
        <span className="f-label">[{x.cuenta||'???'}]</span>
        <span style={{color:'#6b7280'}}> ({OPS.find(o=>o.v===x.operacion)?.l})</span>
      </div>)}
    </div>;
  }

  function CuentaInput({secId,idx,value}){
    const key=secId+'_'+idx;
    const show=busqShow[key];
    const q=busqQ[key]||'';
    const filtradas=cuentasBalanza.filter(c=>c.numero.includes(q)||c.nombre.toLowerCase().includes(q.toLowerCase())).slice(0,40);
    return <div style={{position:'relative',flex:2,minWidth:120}}>
      <div style={{display:'flex',gap:4}}>
        <input className="inp" placeholder="No. cuenta" value={value}
          onChange={e=>updRegla(secId,idx,'cuenta',e.target.value)} style={{flex:1,minWidth:80}}/>
        <button className="btn btn-sm btn-secondary" title="Buscar"
          onClick={()=>setBusqShow(p=>({...p,[key]:!p[key]}))}></button>
      </div>
      {show&&<div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200}}>
        <input className="inp" placeholder="Buscar número o nombre..." value={q}
          onChange={e=>setBusqQ(p=>({...p,[key]:e.target.value}))} autoFocus
          style={{borderRadius:'8px 8px 0 0',borderBottom:'none'}}/>
        <div className="search-results">
          {cuentasBalanza.length===0&&<div style={{padding:12,color:'#6b7280',fontSize:12}}>Carga una balanza en "Ejecutar" primero</div>}
          {filtradas.length===0&&cuentasBalanza.length>0&&<div style={{padding:12,color:'#6b7280',fontSize:12}}>Sin resultados</div>}
          {filtradas.map(c=><div key={c.numero} className="search-item"
            onClick={()=>{updRegla(secId,idx,'cuenta',c.numero);setBusqShow(p=>({...p,[key]:false}));setBusqQ(p=>({...p,[key]:''}));}}>
            <b style={{color:'#ff6b2b'}}>{c.numero}</b> — {c.nombre}
          </div>)}
        </div>
      </div>}
    </div>;
  }

  const secActual=SECCIONES.find(s=>s.id===tab);
  return <div>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,flexWrap:'wrap'}}>
      <button className="btn btn-secondary" onClick={onBack}>← Volver</button>
      <h2 style={{color:'#fff',fontSize:17,fontWeight:800}}> Config IVA — {empresa.nombre}</h2>
      <button className="btn btn-primary" style={{marginLeft:'auto'}} onClick={save}> Guardar todo</button>
    </div>
    {msg&&<div className="alert alert-success">{msg}</div>}
    <div className="tabs">
      {SECCIONES.map(s=><button key={s.id} className={'tab'+(tab===s.id?' active':'')} onClick={()=>setTab(s.id)}>{s.label}</button>)}
      <button className={'tab'+(tab==='anexo'?' active':'')} onClick={()=>setTab('anexo')}> Anexo Config</button>
    </div>

    {tab==='anexo'?<div className="card">
      <div className="card-title"> Configuración del Anexo de IVA</div>
      <p style={{color:'#6b7280',fontSize:13,marginBottom:16}}>Indica la <b>celda exacta</b> donde se encuentra cada dato en el archivo Excel del Anexo (Ej: <code>C16</code>, <code>C18</code>, <code>C39</code>, <code>C41</code>).</p>
      {SECCIONES.map(s=><div key={s.id} className="field">
        <label className="lbl">{s.label} — Celda</label>
        <input className="inp" placeholder="Ej: C16" value={anexoCfg[s.id]||''} onChange={e=>setAnexoCfg(p=>({...p,[s.id]:e.target.value}))} style={{maxWidth:200}}/>
      </div>)}
    </div>:
    <div className="card">
      <div className="card-title">{secActual?.label}</div>
      <div className="grid2" style={{marginBottom:16,gap:24}}>
        {['suma','resta'].map(tipo=><div key={tipo}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <p style={{color:tipo==='suma'?'#22c55e':'#ef4444',fontSize:13,fontWeight:700}}>
              {tipo==='suma'?'+ Cuentas que SUMAN':'− Cuentas que RESTAN'}
            </p>
            <div style={{display:'flex',gap:4}}>
              <button className="btn btn-sm btn-secondary" onClick={()=>addRegla(tab,tipo)}>+ Una</button>
              <button className="btn btn-sm btn-secondary" title="Agregar varias cuentas a la vez"
                onClick={()=>setMasivo({show:true,secId:tab,tipo,texto:'',operacion:'C'})}>+ Varias</button>
            </div>
          </div>
          {getReglas(tab).map((r,i)=>r.tipo!==tipo?null:
            <div key={i} className="regla-row">
              <CuentaInput secId={tab} idx={i} value={r.cuenta}/>
              <select className="inp" style={{flex:1,minWidth:100}} value={r.operacion} onChange={e=>updRegla(tab,i,'operacion',e.target.value)}>
                {OPS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <button className="btn btn-sm btn-danger" onClick={()=>delRegla(tab,i)}></button>
            </div>
          )}
          {getReglas(tab).filter(r=>r.tipo===tipo).length===0&&
            <p style={{color:'#374151',fontSize:12,fontStyle:'italic',padding:'8px 0'}}>Sin cuentas</p>}
        </div>)}
      </div>
      <hr className="divider"/>
      <div style={{fontSize:12,color:'#6b7280',fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:'.5px'}}>Vista previa de la fórmula</div>
      <FormulaPreview secId={tab}/>
    </div>}

    {masivo.show&&<div className="modal-bg" onClick={()=>setMasivo(m=>({...m,show:false}))}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title"> Agregar varias cuentas</div>
        <div className="alert alert-info">Números de cuenta separados por coma, punto y coma o salto de línea</div>
        <textarea className="inp" rows={6} value={masivo.texto} onChange={e=>setMasivo(m=>({...m,texto:e.target.value}))}/>
        <select className="inp" value={masivo.operacion} onChange={e=>setMasivo(m=>({...m,operacion:e.target.value}))}>
          {OPS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
          <button className="btn btn-secondary" onClick={()=>setMasivo(m=>({...m,show:false}))}>Cancelar</button>
          <button className="btn btn-primary" onClick={aplicarMasivo}>Agregar</button>
        </div>
      </div>
    </div>}
  </div>;
}
