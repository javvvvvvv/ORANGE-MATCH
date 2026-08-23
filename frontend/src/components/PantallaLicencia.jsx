import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';

export function PantallaLicencia({token,motivo,onActivada}){
  const [clave,setClave]=useState('');
  const [err,setErr]=useState('');
  const [ok,setOk]=useState(false);
  const [loading,setLoading]=useState(false);
  async function activar(){
    setErr('');setLoading(true);
    try{
      await api('POST','/licencia/activar',{clave},token);
      setOk(true);
      setTimeout(()=>onActivada(),1500);
    }catch(e){setErr(e.message);}
    finally{setLoading(false);}
  }
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#111827'}}>
    <div style={{background:'#1f2937',border:'1px solid #374151',borderRadius:20,padding:40,width:420,boxShadow:'0 20px 60px rgba(0,0,0,.5)'}}>
      <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
        <span className="logo-plate"><img src="/assets/orange-match-logo-display.svg" alt="Orange Match" style={{height:32}}/></span>
      </div>
      <div style={{textAlign:'center',fontSize:48,marginBottom:12}}></div>
      <div style={{textAlign:'center',fontSize:22,fontWeight:900,color:'#ff6b2b',marginBottom:8}}>
        {motivo==='LICENCIA_EXPIRADA'?'Licencia Expirada':'Licencia Inactiva'}
      </div>
      <p style={{textAlign:'center',color:'#6b7280',fontSize:13,marginBottom:24,lineHeight:1.6}}>
        {motivo==='LICENCIA_EXPIRADA'
          ?'Tu licencia de Orange Match ha expirado. Ingresa la clave de renovación para continuar.'
          :'Ingresa la clave de activación para usar Orange Match.'}
      </p>
      {err&&<div className="alert alert-error">{err}</div>}
      {ok&&<div className="alert alert-success"> Licencia activada por 4 meses</div>}
      <div className="field"><label className="lbl">Clave de licencia</label>
        <input className="inp" value={clave} onChange={e=>setClave(e.target.value)}
          placeholder="ORANGE-XXXX-XX" autoFocus
          style={{textAlign:'center',fontSize:16,fontFamily:'monospace',letterSpacing:2}}
          onKeyDown={e=>e.key==='Enter'&&activar()}/>
      </div>
      <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginTop:8}} onClick={activar} disabled={loading||ok}>
        {loading?<><span className="spinner"/>&nbsp;Verificando...</>:'Activar licencia'}
      </button>
    </div>
  </div>;
}
