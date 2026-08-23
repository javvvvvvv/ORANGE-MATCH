# ============================================================================
#  totp.js — Generación y validación de códigos 2FA (TOTP)
# ============================================================================
# Implementa autenticación de dos factores para administradores usando TOTP
# (Time-based One-Time Password) compatible con Google Authenticator, Authy,
# Microsoft Authenticator, etc.
# ============================================================================

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { db } from '../models/db.js';

// Inicializar tabla para almacenar secretos 2FA
db.exec(`
  CREATE TABLE IF NOT EXISTS users_2fa (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret     TEXT NOT NULL,
    enabled    INTEGER DEFAULT 0,
    verified   INTEGER DEFAULT 0
  )
`);

/**
 * Genera un nuevo secreto TOTP para un usuario
 */
export function generate2FASecret(userId, username) {
  const secret = speakeasy.generateSecret({
    name: `Orange Match (${username})`,
    issuer: 'OrangeMatch',
    length: 32
  });
  
  db.prepare(`
    INSERT OR REPLACE INTO users_2fa (user_id, secret, enabled, verified)
    VALUES (?, ?, 0, 0)
  `).run(userId, secret.base32);
  
  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url
  };
}

/**
 * Genera URL del código QR para escanear con authenticator app
 */
export async function getQRCodeDataURL(otpauth_url) {
  return await QRCode.toDataURL(otpauth_url);
}

/**
 * Verifica el código TOTP ingresado por el usuario
 */
export function verify2FAToken(userId, token) {
  const record = db.prepare('SELECT secret, verified FROM users_2fa WHERE user_id = ?').get(userId);
  if (!record) return false;
  
  const verified = speakeasy.totp.verify({
    secret: record.secret,
    encoding: 'base32',
    token: token,
    window: 1 // Permite ±1 período de desfase
  });
  
  if (verified && !record.verified) {
    db.prepare('UPDATE users_2fa SET verified = 1, enabled = 1 WHERE user_id = ?').run(userId);
  }
  
  return verified;
}

/**
 * Activa/desactiva 2FA para un usuario
 */
export function toggle2FA(userId, enable) {
  db.prepare('UPDATE users_2fa SET enabled = ? WHERE user_id = ?').run(enable ? 1 : 0, userId);
}

/**
 * Valida si un usuario tiene 2FA habilitado y verifica el token
 */
export function validate2FAForUser(userId, token) {
  const record = db.prepare('SELECT secret, enabled FROM users_2fa WHERE user_id = ?').get(userId);
  if (!record || !record.enabled) return true; // Si no tiene 2FA activado, pasa directo
  
  return speakeasy.totp.verify({
    secret: record.secret,
    encoding: 'base32',
    token: token,
    window: 1
  });
}

/**
 * Obtiene el estado 2FA de un usuario
 */
export function get2FAStatus(userId) {
  const record = db.prepare('SELECT enabled, verified FROM users_2fa WHERE user_id = ?').get(userId);
  return {
    enabled: !!record?.enabled,
    verified: !!record?.verified,
    setup_required: !record || !record.verified
  };
}
