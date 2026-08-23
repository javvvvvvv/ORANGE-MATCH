import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';

export function PageUsuarios({token,user}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({username:'', password:'', role:'viewer', expires_at:''});
  const [editForm, setEditForm] = useState({role:'viewer', active:true, password:'', expires_at:''});

  const ROLE_INFO = {
    admin:  { label: 'Admin',  desc: 'Todo: usuarios, empresas, backups, licencia, logs' },
    editor: { label: 'Editor', desc: 'Crear/editar empresas, configuración IVA, backups, papeles' },
    viewer: { label: 'Viewer', desc: 'Solo lectura de empresas y resultados' }
  };

  function loadUsers() {
    setLoading(true); setErr('');
    api('GET','/users',null,token)
      .then(data => { setUsers(data||[]); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }

  useEffect(() => { loadUsers(); }, [token]);

  function isExpired(exp) {
    if (!exp) return false;
    const d = new Date(exp.length === 10 ? exp + 'T23:59:59' : exp);
    return d < new Date();
  }

  function formatExp(exp) {
    if (!exp) return null;
    return String(exp).slice(0,10);
  }

  function daysLeft(exp) {
    if (!exp) return null;
    const d = new Date(exp.length === 10 ? exp + 'T23:59:59' : exp);
    return Math.ceil((d - new Date()) / (1000*60*60*24));
  }

  async function createUser() {
    setErr(''); setMsg('');
    if(!form.username.trim()){ setErr('Usuario requerido'); return; }
    if(!form.password || form.password.length < 8){ setErr('Contraseña mínimo 8 caracteres'); return; }
    try {
      await api('POST','/users',{
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        expires_at: form.expires_at || null
      }, token);
      setMsg('Usuario creado correctamente');
      setShowCreate(false);
      setForm({username:'', password:'', role:'viewer', expires_at:''});
      loadUsers();
    } catch(e){ setErr(e.message); }
  }

  async function saveEdit() {
    setErr(''); setMsg('');
    if(!editUser) return;
    const body = {
      role: editForm.role,
      active: editForm.active ? 1 : 0,
      expires_at: editForm.expires_at || null
    };
    if(editForm.password && editForm.password.length >= 8) body.password = editForm.password;
    else if(editForm.password && editForm.password.length > 0){ setErr('Contraseña mínimo 8 caracteres'); return; }
    try {
      await api('PATCH','/users/'+editUser.id, body, token);
      setMsg('Usuario actualizado');
      setEditUser(null);
      loadUsers();
    } catch(e){ setErr(e.message); }
  }

  async function toggleActive(u) {
    if(u.id === user.id){ setErr('No puedes desactivarte a ti mismo'); return; }
    setErr(''); setMsg('');
    try {
      await api('PATCH','/users/'+u.id, {active: u.active ? 0 : 1}, token);
      setMsg(u.active ? 'Usuario desactivado' : 'Usuario activado');
      loadUsers();
    } catch(e){ setErr(e.message); }
  }

  async function extendMonth(u) {
    setErr(''); setMsg('');
    let base = new Date();
    if (u.expires_at && !isExpired(u.expires_at)) {
      base = new Date(u.expires_at.length === 10 ? u.expires_at + 'T12:00:00' : u.expires_at);
    }
    base.setDate(base.getDate() + 30);
    const newExp = base.toISOString().slice(0,10);
    try {
      await api('PATCH','/users/'+u.id, { expires_at: newExp, active: 1 }, token);
      setMsg('Suscripción extendida +30 días hasta ' + newExp);
      loadUsers();
    } catch(e){ setErr(e.message); }
  }

  async function deleteUser(u) {
    if(u.id === user.id){ setErr('No puedes eliminarte a ti mismo'); return; }
    if(!confirm('¿Eliminar permanentemente al usuario "'+u.username+'"? Esta acción no se puede deshacer.')) return;
    setErr(''); setMsg('');
    try {
      await api('DELETE','/users/'+u.id, null, token);
      setMsg('Usuario eliminado');
      loadUsers();
    } catch(e){ setErr(e.message); }
  }

  function openEdit(u) {
    setEditUser(u);
    setEditForm({
      role: u.role,
      active: !!u.active,
      password: '',
      expires_at: formatExp(u.expires_at) || ''
    });
    setErr(''); setMsg('');
  }

  function statusBadge(u) {
    if (!u.active) return <span style={{color:'#ef4444',fontWeight:600}}> Inactivo</span>;
    if (isExpired(u.expires_at)) return <span style={{color:'#ef4444',fontWeight:600}}> Vencido</span>;
    const left = daysLeft(u.expires_at);
    if (left !== null && left <= 7) return <span style={{color:'#eab308',fontWeight:600}}> {left}d</span>;
    return <span style={{color:'#22c55e',fontWeight:600}}> Activo</span>;
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
        <h3 style={{color:'#fff',margin:0}}> Gestión de usuarios y suscripciones</h3>
        <button className="btn btn-primary" onClick={()=>{setShowCreate(true);setErr('');setMsg('');}}>
          + Nuevo usuario
        </button>
      </div>

      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="card" style={{marginBottom:16}}>
        <div className="card-title"> Roles y permisos</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,fontSize:13}}>
          {Object.entries(ROLE_INFO).map(([k,v]) => (
            <div key={k} style={{background:'#111827',padding:12,borderRadius:8,border:'1px solid #374151'}}>
              <span className={'badge badge-'+k} style={{marginBottom:6}}>{v.label}</span>
              <div style={{color:'#9ca3af',marginTop:6,lineHeight:1.4}}>{v.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="card" style={{marginBottom:16,borderColor:'var(--orange)'}}>
          <div className="card-title">Crear nuevo usuario / cliente</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="field">
              <label className="lbl">Usuario</label>
              <input className="inp" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="nombre.cliente"/>
            </div>
            <div className="field">
              <label className="lbl">Contraseña (mín. 8)</label>
              <input className="inp" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••"/>
            </div>
            <div className="field">
              <label className="lbl">Rol</label>
              <select className="inp" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                <option value="viewer">Viewer (solo ver)</option>
                <option value="editor">Editor (puede editar)</option>
                <option value="admin">Admin (todo)</option>
              </select>
            </div>
            <div className="field">
              <label className="lbl">Vence el (vacío = sin vencimiento)</label>
              <input className="inp" type="date" value={form.expires_at} onChange={e=>setForm({...form,expires_at:e.target.value})}/>
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
            <button className="btn btn-primary" onClick={createUser}>Crear usuario</button>
            <button className="btn btn-secondary" onClick={()=>{
              const d = new Date(); d.setDate(d.getDate()+30);
              setForm({...form, expires_at: d.toISOString().slice(0,10)});
            }}>+30 días desde hoy</button>
            <button className="btn btn-secondary" onClick={()=>setShowCreate(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {editUser && (
        <div className="card" style={{marginBottom:16,borderColor:'#3b82f6'}}>
          <div className="card-title">Editar: <span style={{color:'var(--orange)'}}>{editUser.username}</span></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="field">
              <label className="lbl">Rol</label>
              <select className="inp" value={editForm.role} onChange={e=>setEditForm({...editForm,role:e.target.value})}>
                <option value="viewer">Viewer (solo ver)</option>
                <option value="editor">Editor (puede editar)</option>
                <option value="admin">Admin (todo)</option>
              </select>
            </div>
            <div className="field">
              <label className="lbl">Estado</label>
              <select className="inp" value={editForm.active ? '1' : '0'} onChange={e=>setEditForm({...editForm,active:e.target.value==='1'})}>
                <option value="1"> Activo (puede entrar)</option>
                <option value="0"> Inactivo (bloqueado)</option>
              </select>
            </div>
            <div className="field">
              <label className="lbl">Fecha de vencimiento</label>
              <input className="inp" type="date" value={editForm.expires_at} onChange={e=>setEditForm({...editForm,expires_at:e.target.value})}/>
            </div>
            <div className="field">
              <label className="lbl">Nueva contraseña (vacío = no cambiar)</label>
              <input className="inp" type="password" value={editForm.password} onChange={e=>setEditForm({...editForm,password:e.target.value})} placeholder="••••••••"/>
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
            <button className="btn btn-primary" onClick={saveEdit}>Guardar cambios</button>
            <button className="btn btn-secondary" onClick={()=>{
              const d = new Date(); d.setDate(d.getDate()+30);
              setEditForm({...editForm, expires_at: d.toISOString().slice(0,10), active: true});
            }}>+30 días desde hoy</button>
            <button className="btn btn-secondary" onClick={()=>setEditForm({...editForm, expires_at: ''})}>Quitar vencimiento</button>
            <button className="btn btn-secondary" onClick={()=>setEditUser(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? <div className="alert alert-info">Cargando usuarios...</div> :
         users.length === 0 ? <div className="alert alert-info">No hay usuarios registrados</div> :
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Vencimiento</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={isExpired(u.expires_at) && u.active ? {opacity:0.7} : {}}>
                  <td style={{color:'#6b7280'}}>{u.id}</td>
                  <td style={{fontWeight:600,color:'#f9fafb'}}>
                    {u.username}
                    {u.id === user.id && <span style={{marginLeft:6,fontSize:11,color:'var(--orange)'}}>(tú)</span>}
                  </td>
                  <td><span className={'badge badge-'+u.role}>{u.role}</span></td>
                  <td>{statusBadge(u)}</td>
                  <td style={{fontSize:12}}>
                    {u.expires_at
                      ? (isExpired(u.expires_at)
                          ? <span style={{color:'#ef4444'}}>{formatExp(u.expires_at)} (vencido)</span>
                          : <span style={{color: daysLeft(u.expires_at)<=7 ? '#eab308' : '#9ca3af'}}>{formatExp(u.expires_at)}</span>)
                      : <span style={{color:'#6b7280'}}>Sin límite</span>}
                  </td>
                  <td style={{fontSize:12,color:'#9ca3af'}}>{u.created_at ? String(u.created_at).slice(0,10) : '—'}</td>
                  <td>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      <button className="btn btn-sm btn-secondary" onClick={()=>openEdit(u)}>Editar</button>
                      {u.id !== user.id && (
                        <button className="btn btn-sm btn-primary" onClick={()=>extendMonth(u)} title="Sumar 30 días">+30d</button>
                      )}
                      {u.id !== user.id && (
                        <button className={'btn btn-sm '+(u.active ? 'btn-danger' : 'btn-primary')} onClick={()=>toggleActive(u)}>
                          {u.active ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                      {u.id !== user.id && (
                        <button className="btn btn-sm btn-danger" onClick={()=>deleteUser(u)}>Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>

      <div style={{marginTop:16,padding:12,background:'#1f2937',borderRadius:8,border:'1px solid #374151',fontSize:13,color:'#9ca3af',lineHeight:1.6}}>
        <strong style={{color:'#f9fafb'}}> Suscripciones:</strong> Crea un usuario por cliente → pon fecha de vencimiento → cuando pague usa <strong style={{color:'#22c55e'}}>+30d</strong>. Si no paga, <strong style={{color:'#ef4444'}}>Desactivar</strong> o deja que venza solo.
      </div>
    </div>
  );
}
