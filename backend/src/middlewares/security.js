// ============================================================================
//  enforceHttps.js — Middleware para forzar HTTPS en producción
// ============================================================================
// Redirige todo tráfico HTTP a HTTPS cuando NODE_ENV=production.
// En desarrollo no hace nada para permitir trabajo local sin certificados.
// ============================================================================

export function enforceHttps() {
  return (req, res, next) => {
    // Solo aplicar en producción
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }
    
    // Verificar si la petición ya viene por HTTPS
    const isHttps = req.headers['x-forwarded-proto'] === 'https' ||
                    req.secure ||
                    req.headers['x-forwarded-ssl'] === 'on';
    
    if (!isHttps) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    
    next();
  };
}

// ============================================================================
//  securityHeaders.js — Cabeceras de seguridad adicionales
// ============================================================================

export function securityHeaders() {
  return (req, res, next) => {
    // HSTS - Forzar HTTPS por 1 año (solo en producción)
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    // Prevenir clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevenir MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy (limitar funcionalidades del navegador)
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // X-XSS-Protection (para navegadores antiguos)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    next();
  };
}
