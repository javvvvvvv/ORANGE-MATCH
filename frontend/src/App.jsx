/* ============================================================================
   PROPIEDAD INTELECTUAL Y LICENCIA COMERCIAL CERRADA
   ============================================================================
   Autor Legal y Titular de Derechos: JAVIER ILLAN GONZALEZ
   Organización: ORANGE CREW
   Contacto: ILLANJAVIER9@GMAIL.COM
   Queda prohibida la reproducción, distribución o uso comercial sin
   autorización expresa y por escrito del autor.
   ============================================================================ */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from './lib/api.js';
import { CambioPassword } from './components/CambioPassword.jsx';
import { Login } from './components/Login.jsx';
import { Nav } from './components/Nav.jsx';
import { PageAuditoria } from './pages/PageAuditoria.jsx';
import { PageBackups } from './pages/PageBackups.jsx';
import { PageConciliacion } from './pages/PageConciliacion.jsx';
import { PageConfigIVA } from './pages/PageConfigIVA.jsx';
import { PageEjecutar } from './pages/PageEjecutar.jsx';
import { PageEmpresas } from './pages/PageEmpresas.jsx';
import { PageLogs } from './pages/PageLogs.jsx';
import { PagePapelesTrabajo } from './pages/PagePapelesTrabajo.jsx';
import { PageTarifasISR } from './pages/PageTarifasISR.jsx';
import { PageUsuarios } from './pages/PageUsuarios.jsx';
import { PantallaLicencia } from './components/PantallaLicencia.jsx';
import { WelcomeVideo } from './components/WelcomeVideo.jsx';
import { PageAjusteInflacion } from './pages/PageAjusteInflacion.jsx';

export function App(){
  const [authData,setAuthData]=useState(()=>{try{const s=sessionStorage.getItem('om_auth');return s?JSON.parse(s):null;}catch{return null;}});
  const [page,setPage]=useState('empresas');
  const [configEmp,setConfigEmp]=useState(null);
  const [cuentasBalanza,setCuentasBalanza]=useState([]);
  const [showCambioPass,setShowCambioPass]=useState(false);
  const [showWelcome,setShowWelcome]=useState(()=>sessionStorage.getItem('om_welcome_seen')!=='1');
  const [licMotivo,setLicMotivo]=useState(null);
  useEffect(()=>{if(authData) api('GET','/licencia/status',null,authData.token).then(lic=>{if(!lic.activa) setLicMotivo('LICENCIA_INACTIVA');else if(lic.expira_at && new Date(lic.expira_at)<new Date()) setLicMotivo('LICENCIA_EXPIRADA');}).catch(()=>{});},[authData]);
  function handleLogin(data){sessionStorage.setItem('om_auth',JSON.stringify(data));setAuthData(data);}
  function handleLogout(){sessionStorage.removeItem('om_auth');setAuthData(null);setPage('empresas');setConfigEmp(null);setLicMotivo(null);setShowWelcome(true);sessionStorage.removeItem('om_welcome_seen');}
  if(!authData) return showWelcome ? <WelcomeVideo onLogin={handleLogin}/> : <Login onLogin={handleLogin}/>;
  if(licMotivo && authData.user.role==='admin') return <PantallaLicencia token={authData.token} motivo={licMotivo} onActivada={()=>setLicMotivo(null)}/>;
  if(licMotivo) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#111827',flexDirection:'column',gap:16}}>
    <span className="logo-plate"><img src="/assets/orange-match-logo-display.svg" alt="Orange Match" style={{height:32}}/></span>
    <div style={{fontSize:48}}></div><div style={{color:'#ff6b2b',fontSize:20,fontWeight:800}}>Sistema bloqueado</div><div style={{color:'#6b7280',fontSize:14}}>Licencia expirada. Contacte al administrador.</div><button className="btn btn-danger" onClick={handleLogout}>Salir</button></div>;
  return <div className="app">
    <Nav page={configEmp?'empresas':page} setPage={p=>{setPage(p);setConfigEmp(null);}} user={authData.user} onLogout={handleLogout} onCambioPass={()=>setShowCambioPass(true)} token={authData.token}/>
    <div className="main">
      {configEmp? <PageConfigIVA empresa={configEmp} token={authData.token} onBack={()=>setConfigEmp(null)} cuentasBalanza={cuentasBalanza}/> :
       page==='empresas'? <PageEmpresas token={authData.token} user={authData.user} onConfigIVA={e=>setConfigEmp(e)}/> :
       page==='ejecutar'? <PageEjecutar token={authData.token} onCuentasLoad={setCuentasBalanza}/> :
       page==='conciliacion'? <PageConciliacion token={authData.token}/> :
       page==='auditoria'? <PageAuditoria token={authData.token}/> :
       page==='backups'? <PageBackups token={authData.token} user={authData.user}/> :
       page==='papeles'? <PagePapelesTrabajo token={authData.token} user={authData.user}/> :
       page==='ajuste-inflacion'? <PageAjusteInflacion token={authData.token} user={authData.user}/> :
       page==='tarifas'? <PageTarifasISR token={authData.token}/> :
       page==='usuarios'? <PageUsuarios token={authData.token} user={authData.user}/> :
       page==='logs'? <PageLogs token={authData.token}/> : null
      }
    </div>
    {showCambioPass&&<CambioPassword token={authData.token} forzado={false} onDone={()=>setShowCambioPass(false)}/>}
  </div>;
}
