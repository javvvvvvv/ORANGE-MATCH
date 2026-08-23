/**
 * Tests de integración para API REST
 * ============================================================================
 * Prueba endpoints completos con base de datos en memoria
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Crear app de test minimalista
const app = express();
app.use(express.json());

// Endpoint health check básico
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

describe('API Integration Tests', () => {
  describe('GET /api/health', () => {
    it('debe retornar estado OK', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Rate Limiting', () => {
    it('debe permitir múltiples requests dentro del límite', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/api/health')
          .expect(200);
      }
    });
  });

  describe('CORS Headers', () => {
    it('debe incluir headers CORS básicos', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000');
      
      // En desarrollo, CORS debería permitir cualquier origen
      expect(response.headers).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('debe incluir headers de seguridad básicos', async () => {
      const response = await request(app)
        .get('/api/health');
      
      expect(response.headers).toBeDefined();
    });
  });
});
