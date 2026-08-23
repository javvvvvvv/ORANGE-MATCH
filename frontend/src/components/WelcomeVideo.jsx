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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Login } from './Login.jsx';

const VIDEO_SOURCE = '/videos/orange-match-bienvenida.mp4';
const VIDEO_POSTER = '/videos/orange-match-bienvenida-poster.jpg';

export function WelcomeVideo({ onLogin }) {
  const videoRef = useRef(null);
  const [showLogin, setShowLogin] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);

  const revealLogin = useCallback(() => {
    setShowLogin(true);
  }, []);

  const enableSound = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1;
    setSoundBlocked(false);
    void video.play().catch(() => setSoundBlocked(true));
  }, []);

  useEffect(() => {
    document.body.classList.add('welcome-video-active');

    const video = videoRef.current;
    if (!video) return undefined;

    const startVideo = () => {
      video.playbackRate = 1;
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 1;
      void video.play().then(() => {
        setSoundBlocked(true);
      }).catch(() => {
        setSoundBlocked(true);
      });
    };

    const handleUserInteraction = () => enableSound();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !showLogin) {
        void video.play().catch(() => undefined);
      }
    };

    startVideo();
    window.addEventListener('pointerdown', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.body.classList.remove('welcome-video-active');
      window.removeEventListener('pointerdown', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enableSound, showLogin]);

  const handleLoadedData = (event) => {
    const video = event.currentTarget;
    video.playbackRate = 1;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 1;
    void video.play().catch(() => undefined);
  };

  const handleVideoError = () => {
    setMediaError(true);
    revealLogin();
  };

  return (
    <main className={`welcome-page${showLogin ? ' welcome-page-login-visible' : ''}`}>
      <section className="welcome-video-hero" aria-label="Bienvenida a Orange Match">
        {!mediaError && (
          <video
            ref={videoRef}
            className="welcome-video-element"
            src={VIDEO_SOURCE}
            poster={VIDEO_POSTER}
            autoPlay
            muted
            playsInline
            preload="auto"
            controls={false}
            onLoadedData={handleLoadedData}
            onCanPlay={(event) => {
              event.currentTarget.playbackRate = 1;
              void event.currentTarget.play().catch(() => undefined);
            }}
            onError={handleVideoError}
            onEnded={revealLogin}
          />
        )}

        {mediaError && (
          <div className="welcome-video-fallback" aria-hidden="true">
            <img src="/assets/orange-match-logo-display.svg" alt="" />
          </div>
        )}

        <div className={`welcome-video-shade${showLogin ? ' is-login' : ''}`} aria-hidden="true" />

        {!showLogin && !mediaError && (
          <div className="welcome-video-content">
            <img
              className="welcome-video-logo"
              src="/assets/orange-match-logo-display.svg"
              alt="Orange Match"
            />
            <p className="welcome-video-title">Bienvenido a Orange Match</p>
            <p className="welcome-video-subtitle">
              Sistema profesional de amarre y control contable
            </p>
            {soundBlocked && (
              <button type="button" className="welcome-sound-hint" onClick={enableSound}>
                Activar sonido
              </button>
            )}
          </div>
        )}

        {showLogin && (
          <div className="welcome-login-overlay" aria-label="Acceso a Orange Match">
            <div className="welcome-login-overlay-card">
              <div className="welcome-login-heading">
                <span className="welcome-login-kicker">Acceso seguro</span>
                <h1>Ingresa a Orange Match</h1>
                <p>Continúa con tu sesión para acceder al sistema.</p>
              </div>
              <Login onLogin={onLogin} />
            </div>
          </div>
        )}

        {!showLogin && !mediaError && (
          <div className="welcome-video-status">Cargando bienvenida...</div>
        )}

        <div className="welcome-video-footer">Orange Crew · Orange Match</div>
      </section>
    </main>
  );
}
