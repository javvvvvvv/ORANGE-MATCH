/**
 * Tests unitarios para el módulo de autenticación 2FA
 * ============================================================================
 * Cubre: generación de secretos, validación TOTP, activación/desactivación
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock de dependencias externas
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(({ name, issuer, length }) => ({
    base32: 'JBSWY3DPEHPK3PXP',
    otpauth_url: `otpauth://totp/${issuer}:${name}?secret=JBSWY3DPEHPK3PXP&issuer=${issuer}`
  })),
  totp: {
    verify: jest.fn(({ secret, token }) => {
      // Simular validación - en producción usa algoritmo real
      return token === '123456';
    })
  }
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn((otpauth_url) => Promise.resolve(`data:image/png;base64,${otpauth_url}`))
}));

// Mock de la base de datos
const mockDb = {
  exec: jest.fn(),
  prepare: jest.fn().mockReturnThis(),
  run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
  get: jest.fn()
};

jest.mock('../src/models/db.js', () => mockDb);

// Importar módulo después de mocks
const { 
  generate2FASecret, 
  verify2FAToken, 
  toggle2FA, 
  get2FAStatus 
} = await import('../src/core/totp.js');

describe('Módulo 2FA/TOTP', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generate2FASecret', () => {
    it('debe generar un secreto válido para un usuario', () => {
      const result = generate2FASecret(1, 'testuser');
      
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('otpauth_url');
      expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(result.otpauth_url).toContain('Orange Match (testuser)');
      expect(result.otpauth_url).toContain('OrangeMatch');
    });

    it('debe guardar el secreto en la base de datos', () => {
      generate2FASecret(1, 'testuser');
      
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'JBSWY3DPEHPK3PXP'
      );
    });
  });

  describe('verify2FAToken', () => {
    beforeEach(() => {
      mockDb.get.mockReturnValue({ secret: 'JBSWY3DPEHPK3PXP', verified: 0 });
    });

    it('debe validar un token correcto', () => {
      const result = verify2FAToken(1, '123456');
      
      expect(result).toBe(true);
    });

    it('debe rechazar un token incorrecto', () => {
      const result = verify2FAToken(1, '999999');
      
      expect(result).toBe(false);
    });

    it('debe marcar el usuario como verificado tras primer éxito', () => {
      verify2FAToken(1, '123456');
      
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users_2fa'),
        1
      );
    });

    it('debe retornar false si el usuario no tiene 2FA configurado', () => {
      mockDb.get.mockReturnValue(null);
      
      const result = verify2FAToken(1, '123456');
      
      expect(result).toBe(false);
    });
  });

  describe('toggle2FA', () => {
    it('debe activar 2FA cuando enable=true', () => {
      toggle2FA(1, true);
      
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        1,
        1
      );
    });

    it('debe desactivar 2FA cuando enable=false', () => {
      toggle2FA(1, false);
      
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        0,
        1
      );
    });
  });

  describe('get2FAStatus', () => {
    it('debe retornar estado completo cuando el usuario tiene 2FA', () => {
      mockDb.get.mockReturnValue({ enabled: 1, verified: 1 });
      
      const status = get2FAStatus(1);
      
      expect(status).toEqual({
        enabled: true,
        verified: true,
        setup_required: false
      });
    });

    it('debe retornar setup_required=true cuando el usuario no tiene 2FA', () => {
      mockDb.get.mockReturnValue(null);
      
      const status = get2FAStatus(1);
      
      expect(status).toEqual({
        enabled: false,
        verified: false,
        setup_required: true
      });
    });

    it('debe retornar setup_required cuando no está verificado', () => {
      mockDb.get.mockReturnValue({ enabled: 0, verified: 0 });
      
      const status = get2FAStatus(1);
      
      expect(status.setup_required).toBe(true);
    });
  });
});
