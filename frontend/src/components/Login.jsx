/* ============================================================================
   PROPIEDAD INTELECTUAL Y LICENCIA COMERCIAL CERRADA
   ============================================================================
   Autor Legal y Titular de Derechos: JAVIER ILLAN GONZALEZ
   Organización: ORANGE CREW
   Contacto: ILLANJAVIER9@GMAIL.COM

   ADVERTENCIA LEGAL (MÉXICO Y GLOBAL):
   Este código fuente y su arquitectura son propiedad intelectual exclusiva de
   JAVIER ILLAN GONZALEZ. Queda estrictamente prohibida su reproducción,
   distribución, modificación, ingeniería inversa, copia o uso comercial sin la
   autorización expresa y por escrito del autor. Obra protegida conforme a la
   Ley Federal del Derecho de Autor y tratados internacionales aplicables.
   ============================================================================ */

import React, { useState } from 'react';
import { api } from '../lib/api.js';

export function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api('POST', '/auth/login', { username, password });
      onLogin(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-plate">
            <img src="/assets/orange-match-logo-display.svg" alt="Orange Match" />
          </span>
        </div>
        <div className="login-sub">Sistema de Amarre de Balanzas IVA</div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label className="lbl" htmlFor="login-username">Usuario</label>
            <input
              id="login-username"
              className="inp"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label className="lbl" htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              className="inp"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
            type="submit"
          >
            {loading ? <><span className="spinner" /> Entrando...</> : 'Entrar'}
          </button>
        </form>
        <div className="login-brand">
          <span className="brand-mark" title="Orange Match es una marca de Orange Crew">
            <img src="/assets/orange-crew-logo-display.svg" alt="Orange Crew" />
          </span>
        </div>
      </div>
    </div>
  );
}
