// ============================================================================
//  twoFactorAuth.js — Middleware para requerir 2FA en administradores
// ============================================================================
// Verifica que los usuarios con rol 'admin' tengan 2FA habilitado y válido.
// Se aplica después de la autenticación JWT normal.
// ============================================================================

import { validate2FAForUser } from '../core/totp.js';

export function require2FA() {
  return (req, res, next) => {
    // Solo requerir 2FA para administradores en producción
    if (process.env.NODE_ENV !== 'production' || req.user?.role !== 'admin') {
      return next();
    }
    
    // Buscar token 2FA en headers
    const totpToken = req.headers['x-totp-token'];
    
    if (!totpToken) {
      return res.status(403).json({ 
        error: '2FA requerido',
        code: '2FA_REQUIRED'
      });
    }
    
    // Validar token TOTP
    if (!validate2FAForUser(req.user.id, totpToken)) {
      return res.status(403).json({ 
        error: 'Código 2FA inválido o expirado',
        code: '2FA_INVALID'
      });
    }
    
    next();
  };
}
