import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';
import { tieneConfigIVA } from '../lib/configEmpresa.js';

export function PageEmpresas({token,user,onConfigIVA}){
  const [list,setList]=useState([]);const [modal,setModal]=useState(null);
  const [form,setForm]=useState({nombre:'',rfc:''});const [msg,setMsg]=useState('');
  const canEdit=user.role!=='viewer';
  async function load(){try{setList(await api('GET','/empresas',null,token));}catch(e){console.error('Error cargando empresas:',e);setMsg('Error al cargar empresas: '+(e.message||e));}}
  useEffect(()=>{load();},[]);
  async function save(){
    try{
      if(modal==='new') await api('POST','/empresas',form,token);
      else {
        // IMPORTANTE: no enviar `...modal`. La empresa que vive en el estado
        // de esta pantalla puede tener un config_pt viejo y eso podía restaurar
        // reglas de amarre anteriores al editar solamente nombre/RFC.
        await api('PUT','/empresas/'+modal.id,{nombre:form.nombre,rfc:form.rfc},token);
      }
      setModal(null);setMsg('Guardado ');load();setTimeout(()=>setMsg(''),2500);
    }catch(e){setMsg(e.message);}
  }
  async function del(e){
    if(!confirm('¿Eliminar '+e.nombre+'?')) return;
    try{await api('DELETE','/empresas/'+e.id,null,token);load();}catch(e){alert(e.message);}
  }
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
      <h2 style={{color:'#fff',fontSize:20,fontWeight:800}}> Empresas</h2>
      {canEdit&&<button className="btn btn-primary" onClick={()=>{setForm({nombre:'',rfc:''});setModal('new');}}>+ Nueva empresa</button>}
    </div>
    {msg&&<div className="alert alert-success">{msg}</div>}
    <div className="card">
      <table className="tbl">
        <thead><tr><th>Empresa</th><th>RFC</th><th>Config IVA</th><th>Acciones</th></tr></thead>
        <tbody>{list.map(e=><tr key={e.id}>
          <td style={{fontWeight:700,color:'#fff'}}>{e.nombre}</td>
          <td>{e.rfc||<span style={{color:'#4b5563'}}>—</span>}</td>
          <td>{tieneConfigIVA(e.config_iva)?<span className="chip"> Configurada</span>:<span style={{color:'#4b5563',fontSize:12}}>Sin configurar</span>}</td>
          <td style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {canEdit&&<button className="btn btn-sm btn-secondary" onClick={()=>onConfigIVA(e)}> Config IVA</button>}
            {canEdit&&<button className="btn btn-sm btn-secondary" onClick={()=>{setForm({nombre:e.nombre,rfc:e.rfc||''});setModal(e);}}> Editar</button>}
            {user.role==='admin'&&<button className="btn btn-sm btn-danger" onClick={()=>del(e)}></button>}
          </td>
         </tr>)}</tbody>
       </table>
    </div>
    {modal&&<div className="modal-bg" onClick={()=>setModal(null)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">{modal==='new'?'Nueva empresa':'Editar empresa'}</div>
        <div className="field"><label className="lbl">Nombre</label>
          <input className="inp" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} autoFocus/></div>
        <div className="field"><label className="lbl">RFC</label>
          <input className="inp" value={form.rfc} onChange={e=>setForm(p=>({...p,rfc:e.target.value}))}/></div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-secondary" onClick={()=>setModal(null)}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>}
  </div>;
}
