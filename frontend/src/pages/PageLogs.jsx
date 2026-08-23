import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';

export function PageLogs({token}) {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    api('GET','/logs?limit=50',null,token).then(setLogs).catch(()=>{});
  }, []);
  return <div>
    <h3 style={{color:'#fff', marginBottom:12}}> Registro de logs</h3>
    <div className="card">
      {logs.length === 0 ? <div className="alert alert-info">No hay logs disponibles</div> :
        <table className="tbl">
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>{logs.map((l,i) => <tr key={i}><td>{l.fecha}</td><td>{l.usuario}</td><td>{l.accion}</td><td>{l.detalle}</td></tr>)}</tbody>
        </table>
      }
    </div>
  </div>;
}
