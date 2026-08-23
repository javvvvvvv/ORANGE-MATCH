import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PAGES } from '../lib/navConfig.js';
import { LicenciaBadge } from './LicenciaBadge.jsx';

export function Nav({page,setPage,user,onLogout,onCambioPass,token}){
  return <nav className="nav">
    <span className="nav-logo">
      <span className="logo-plate"><img src="/assets/orange-match-logo-display.svg" alt="Orange Match" /></span>
    </span>
    {PAGES.filter(p=>!p.adminOnly||user.role==='admin').map(p=>
      <button key={p.id} className={'nav-btn'+(page===p.id?' active':'')} onClick={()=>setPage(p.id)}>{p.label}</button>
    )}
    <div className="nav-user">
      <span className="brand-mark" title="Orange Match es una marca de Orange Crew"><img src="/assets/orange-crew-logo-display.svg" alt="Orange Crew" /></span>
      {user.role==='admin'&&<LicenciaBadge token={token}/>}
      <span style={{color:'#f9fafb',fontWeight:600}}>{user.username}</span>
      <span className={'badge badge-'+user.role}>{user.role}</span>
      <button className="btn btn-sm btn-secondary" onClick={onCambioPass}></button>
      <button className="btn btn-sm btn-danger" onClick={onLogout}>Salir</button>
    </div>
  </nav>;
}
