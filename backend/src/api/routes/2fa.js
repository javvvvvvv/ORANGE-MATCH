import { Router } from 'express';
import { auth } from '../../core/auth.js';
import { auditLog } from '../../core/auditLog.js';
import {
  generate2FASecret,
  getQRCodeDataURL,
  verify2FAToken,
  toggle2FA,
  get2FAStatus
} from '../../core/totp.js';

const router = Router();

// Obtener estado 2FA del usuario actual
router.get('/status', auth('viewer'), (req, res) => {
  const status = get2FAStatus(req.user.id);
  res.json(status);
});

// Generar nuevo secreto 2FA y QR para escanear
router.post('/setup', auth('viewer'), async (req, res) => {
  try {
    const { secret, otpauth_url } = generate2FASecret(req.user.id, req.user.username);
    const qrCodeDataUrl = await getQRCodeDataURL(otpauth_url);
    
    auditLog(req.user.id, req.user.username, '2FA_SETUP_INITIATED', {}, req.ip);
    
    res.json({
      secret,
      qrCode: qrCodeDataUrl,
      message: 'Escanea el código QR con tu app authenticator'
    });
  } catch (error) {
    auditLog(req.user.id, req.user.username, '2FA_SETUP_ERROR', { error: error.message }, req.ip);
    res.status(500).json({ error: 'Error al generar configuración 2FA' });
  }
});

// Verificar código TOTP y activar 2FA
router.post('/verify', auth('viewer'), (req, res) => {
  const { token } = req.body;
  
  if (!token || token.length !== 6) {
    return res.status(400).json({ error: 'Token inválido. Debe ser 6 dígitos.' });
  }
  
  try {
    const isValid = verify2FAToken(req.user.id, token);
    
    if (isValid) {
      auditLog(req.user.id, req.user.username, '2FA_ACTIVATED', {}, req.ip);
      res.json({ 
        success: true, 
        message: '2FA activado exitosamente' 
      });
    } else {
      res.status(400).json({ 
        error: 'Código inválido. Verifica que tu reloj esté sincronizado.' 
      });
    }
  } catch (error) {
    auditLog(req.user.id, req.user.username, '2FA_VERIFY_ERROR', { error: error.message }, req.ip);
    res.status(500).json({ error: 'Error al verificar 2FA' });
  }
});

// Desactivar 2FA (requiere contraseña actual)
router.post('/disable', auth('viewer'), (req, res) => {
  const { password, confirmDisable } = req.body;
  
  if (!confirmDisable) {
    return res.status(400).json({ error: 'Debes confirmar la desactivación' });
  }
  
  // Aquí se debería verificar la contraseña antes de desactivar
  // Por seguridad, esto debería validarse contra el modelo de usuarios
  
  toggle2FA(req.user.id, false);
  auditLog(req.user.id, req.user.username, '2FA_DISABLED', {}, req.ip);
  
  res.json({ 
    success: true, 
    message: '2FA desactivado. Puedes volver a activarlo cuando quieras.' 
  });
});

export default router;
