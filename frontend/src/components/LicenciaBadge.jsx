import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';

export function LicenciaBadge({token}){
  const [lic,setLic]=useState(null);
  useEffect(()=>{api('GET','/licencia/status',null,token).then(setLic).catch(()=>{});},[]);
  if(!lic||!lic.expira_at) return null;
  const dias=Math.ceil((new Date(lic.expira_at)-Date.now())/(1000*60*60*24));
  const color=dias>30?'#22c55e':dias>7?'#eab308':'#ef4444';
  return <span style={{fontSize:11,color,fontWeight:700,background:'rgba(0,0,0,.3)',padding:'3px 8px',borderRadius:8}}> {dias>0?`Licencia: ${dias}d`:'¡Expirada!'}</span>;
}
