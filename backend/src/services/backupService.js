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

const fs = require('fs');
const path = require('path');
const { createBackupRaw, purgeOldBackups } = require('../models/backupsModel');
const { db } = require('../models/db');
const logger = require('../utils/logger');

class BackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createBackup(config) {
    const { empresaId, userId, motivo = 'Backup manual' } = config;
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupData = await this.extractDatabaseData(empresaId);
      
      const backupPath = path.join(this.backupDir, `backup-${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
      
      const backupRecord = createBackupRaw(
        `BACKUP-${timestamp}`,
        JSON.stringify({ path: backupPath, ...backupData }),
        userId
      );

      await this.purgeOldBackups();
      
      logger.info(`Backup created: ${backupPath}`);
      return { 
        success: true, 
        backupId: backupRecord.lastInsertRowid,
        path: backupPath,
        timestamp 
      };
    } catch (error) {
      logger.error('Backup creation failed:', error.message);
      throw error;
    }
  }

  async extractDatabaseData(empresaId) {
    return new Promise((resolve, reject) => {
      try {
        const data = {
          tipo: 'COMPLETO',
          empresa_id: Number(empresaId),
          timestamp: new Date().toISOString(),
          empresas: db.prepare('SELECT * FROM empresas WHERE id=?').all(empresaId),
          amarres: db.prepare('SELECT * FROM amarres WHERE empresa_id=?').all(empresaId),
          datos_fiscales: db.prepare('SELECT * FROM datos_fiscales WHERE empresa_id=?').all(empresaId),
          anexo_config: db.prepare('SELECT * FROM anexo_config WHERE empresa_id=?').all(empresaId),
          tarifas_isr: db.prepare('SELECT * FROM tarifas_isr').all(),
          usuarios: db.prepare('SELECT id, username, email, rol FROM usuarios WHERE empresa_id=?').all(empresaId)
        };
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }

  async purgeOldBackups(maxBackups = 100) {
    try {
      purgeOldBackups(maxBackups);
      
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (files.length > maxBackups) {
        const toDelete = files.slice(maxBackups);
        toDelete.forEach(file => {
          fs.unlinkSync(path.join(this.backupDir, file));
          logger.info(`Deleted old backup file: ${file}`);
        });
      }
    } catch (error) {
      logger.error('Failed to purge old backups:', error.message);
    }
  }

  async restoreBackup(backupId, userId) {
    try {
      const backup = db.prepare('SELECT * FROM backups WHERE id=?').get(backupId);
      
      if (!backup) {
        throw new Error('Backup not found');
      }

      const backupData = JSON.parse(backup.contenido);
      
      if (backupData.path && fs.existsSync(backupData.path)) {
        const fileData = JSON.parse(fs.readFileSync(backupData.path, 'utf8'));
        
        await this.restoreData(fileData);
        
        logger.info(`Backup ${backupId} restored successfully`);
        return { success: true, restoredAt: new Date().toISOString() };
      } else {
        throw new Error('Backup file not found on disk');
      }
    } catch (error) {
      logger.error('Restore failed:', error.message);
      throw error;
    }
  }

  async restoreData(data) {
    const transaction = db.transaction(() => {
      if (data.empresas && data.empresas.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO empresas 
          (id, nombre, rfc, config_pt, activo, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        data.empresas.forEach(e => stmt.run(e.id, e.nombre, e.rfc, e.config_pt, e.activo, e.created_at, e.updated_at));
      }

      if (data.amarres && data.amarres.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO amarres 
          (id, empresa_id, concepto, cuenta_contable, tipo_mov, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        data.amarres.forEach(a => stmt.run(a.id, a.empresa_id, a.concepto, a.cuenta_contable, a.tipo_mov, a.created_at));
      }

      if (data.datos_fiscales && data.datos_fiscales.length > 0) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO datos_fiscales 
          (id, empresa_id, regimen, cp, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        data.datos_fiscales.forEach(d => stmt.run(d.id, d.empresa_id, d.regimen, d.cp, d.created_at));
      }
    });

    transaction();
  }

  async getBackupList(limit = 50) {
    try {
      const backups = db.prepare(`
        SELECT id, nombre, fecha_creacion, usuario_id, tamano_bytes
        FROM backups
        ORDER BY fecha_creacion DESC
        LIMIT ?
      `).all(limit);

      return { success: true, backups };
    } catch (error) {
      logger.error('Failed to get backup list:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new BackupService();
