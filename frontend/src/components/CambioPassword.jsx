import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';

export function CambioPassword({token,onDone,forzado}){
  const [old,setOld]=useState('');
  const [np,setNp]=useState('');
  const [np2,setNp2]=useState('');
  const [err,setErr]=useState('');
  const [ok,setOk]=useState(false);
  async function save(){
    setErr('');
    if(np!==np2){setErr('Las contraseñas no coinciden');return;}
    if(np.length<8){setErr('Mínimo 8 caracteres');return;}
    try{
      await api('POST','/auth/change-password',{oldPassword:old,newPassword:np},token);
      setOk(true);
      setTimeout(()=>onDone(),1500);
    }catch(e){setErr(e.message);}
  }
  return <div className="modal-bg">
    <div className="modal" style={{maxWidth:420}}>
      <div className="modal-title">{forzado?' Tu contraseña expiró — debes cambiarla':' Cambiar contraseña'}</div>
      {forzado&&<div className="alert alert-warn" style={{marginBottom:12}}>Han pasado más de 4 meses. Por seguridad debes establecer una nueva contraseña.</div>}
      {err&&<div className="alert alert-error">{err}</div>}
      {ok&&<div className="alert alert-success"> Contraseña actualizada</div>}
      <div className="field"><label className="lbl">Contraseña actual</label>
        <input className="inp" type="password" value={old} onChange={e=>setOld(e.target.value)} autoFocus/></div>
      <div className="field"><label className="lbl">Nueva contraseña</label>
        <input className="inp" type="password" value={np} onChange={e=>setNp(e.target.value)}/></div>
      <div className="field"><label className="lbl">Confirmar nueva contraseña</label>
        <input className="inp" type="password" value={np2} onChange={e=>setNp2(e.target.value)}/></div>
      <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={save} disabled={ok}>Cambiar contraseña</button>
    </div>
  </div>;
}
