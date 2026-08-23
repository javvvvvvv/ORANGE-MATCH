import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';

export function PageAuditoria({token}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    api('GET','/logs',null,token)
      .then(data => {
        setLogs((data||[]).map(l => ({
          fecha: l.ts || l.fecha || '',
          usuario: l.username || l.usuario || '—',
          accion: l.action || l.accion || '',
          detalle: typeof l.detail === 'string'
            ? (l.detail.startsWith('{') ? (()=>{try{return JSON.stringify(JSON.parse(l.detail))}catch{return l.detail}})() : l.detail)
            : (l.detalle||''),
          ip: l.ip || ''
        })));
        setLoading(false);
      })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, [token]);

  return (
    <div>
      <h3 style={{color:'#fff', marginBottom:12}}> Auditoría del sistema</h3>
      {err && <div className="alert alert-error">{err}</div>}
      <div className="card">
        {loading ? <div className="alert alert-info">Cargando eventos...</div> :
         logs.length === 0 ? <div className="alert alert-info">No hay eventos registrados</div> :
          <div style={{overflowX:'auto'}}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l,i) => (
                  <tr key={i}>
                    <td style={{fontSize:12,whiteSpace:'nowrap'}}>{l.fecha}</td>
                    <td style={{fontWeight:600}}>{l.usuario}</td>
                    <td><span className="badge badge-viewer" style={{fontSize:11}}>{l.accion}</span></td>
                    <td style={{fontSize:12,color:'#9ca3af',maxWidth:280,overflow:'hidden',textOverflow:'ellipsis'}} title={l.detalle}>{l.detalle}</td>
                    <td style={{fontSize:11,color:'#6b7280'}}>{l.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  );
}
