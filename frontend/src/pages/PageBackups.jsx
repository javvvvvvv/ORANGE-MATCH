import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';

export function PageBackups({token,user}) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [nombre, setNombre] = useState('');
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true); setErr('');
    api('GET','/backups',null,token)
      .then(data => {
        setBackups((data||[]).map(b => ({
          id: b.id,
          nombre: b.nombre,
          fecha: b.created_at || b.fecha || '',
          created_by: b.created_by,
          tipo: b.tipo || 'MANUAL',
          empresa_id: b.empresa_id || null,
          motivo: b.motivo || ''
        })));
        setLoading(false);
      })
      .catch(e => { setErr(e.message); setLoading(false); });
  }

  useEffect(() => { load(); }, [token]);

  async function crear() {
    setErr(''); setMsg(''); setCreating(true);
    try {
      await api('POST','/backups', { nombre: nombre.trim() || undefined }, token);
      setMsg('Respaldo creado correctamente');
      setNombre('');
      load();
    } catch(e){ setErr(e.message); }
    finally { setCreating(false); }
  }

  async function restaurar(b) {
    const esAutoEmpresa = b.tipo === 'AUTO_EMPRESA' && b.empresa_id;
    const pregunta = esAutoEmpresa
      ? '¿Restaurar SOLO la configuración de la empresa respaldada?\n\nSe recuperarán las reglas de amarre, configuración IVA, datos fiscales y amarres. No se tocarán las demás empresas.'
      : '¿Restaurar el respaldo \"'+b.nombre+'\"?\n\nEsto reemplazará las empresas y la configuración actual. Los respaldos anteriores se conservan.';
    if(!confirm(pregunta)) return;
    setErr(''); setMsg('');
    try {
      if(esAutoEmpresa) await api('POST','/backups/'+b.id+'/restore-empresa', null, token);
      else await api('POST','/backups/'+b.id+'/restore', null, token);
      setMsg(esAutoEmpresa ? 'Configuración de la empresa restaurada correctamente.' : 'Respaldo restaurado. Recarga la página de Empresas para ver los cambios.');
      load();
    } catch(e){ setErr(e.message); }
  }

  async function descargar(b) {
    setErr('');
    try {
      const r = await fetch((window.location.origin)+'/api/backups/'+b.id+'/export', {
        headers: { 'Authorization': 'Bearer '+token }
      });
      if(!r.ok) throw new Error('No se pudo descargar');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (b.nombre || 'backup') + '.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch(e){ setErr(e.message); }
  }

  return (
    <div>
      <h3 style={{color:'#fff', marginBottom:12}}> Respaldos del sistema</h3>
      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      {(user.role === 'admin' || user.role === 'editor') && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-title">Crear nuevo respaldo</div>
          <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
            <div className="field" style={{flex:1,minWidth:200,marginBottom:0}}>
              <label className="lbl">Nombre (opcional)</label>
              <input className="inp" value={nombre} onChange={e=>setNombre(e.target.value)}
                placeholder={'Backup '+new Date().toLocaleDateString('es-MX')}/>
            </div>
            <button className="btn btn-primary" onClick={crear} disabled={creating}>
              {creating ? 'Creando...' : ' Crear respaldo ahora'}
            </button>
          </div>
          <p style={{color:'#6b7280',fontSize:12,marginTop:10}}>
            Los respaldos automáticos se crean antes de importar catálogo, balanza o Anexo IVA. Las reglas de amarre se protegen para evitar que una importación las borre.
          </p>
        </div>
      )}

      <div className="card">
        {loading ? <div className="alert alert-info">Cargando respaldos...</div> :
         backups.length === 0 ? <div className="alert alert-info">No hay respaldos guardados</div> :
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.id}>
                  <td style={{color:'#6b7280'}}>{b.id}</td>
                  <td style={{fontWeight:600,color:'#f9fafb'}}>{b.nombre}</td>
                  <td><span className="chip">{b.tipo === 'AUTO_EMPRESA' ? ' Automático' : 'Manual'}</span></td>
                  <td style={{fontSize:12}}>{b.fecha}</td>
                  <td>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      <button className="btn btn-sm btn-primary" onClick={()=>descargar(b)}>Descargar</button>
                      {user.role === 'admin' && (
                        <button className="btn btn-sm btn-secondary" onClick={()=>restaurar(b)}>Restaurar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>
    </div>
  );
}
