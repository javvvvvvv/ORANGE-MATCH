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

const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.channels = {
      email: true,
      push: false,
      sms: false
    };
  }

  async sendNotification(data) {
    const { type, userId, message, priority = 'normal' } = data;

    try {
      switch (type) {
        case 'backup_completed':
          await this.sendBackupCompletedNotification(userId, message);
          break;
        case 'export_ready':
          await this.sendExportReadyNotification(userId, message);
          break;
        case 'error_alert':
          await this.sendErrorAlertNotification(userId, message, priority);
          break;
        case 'system_maintenance':
          await this.sendSystemMaintenanceNotification(userId, message);
          break;
        default:
          logger.warn(`Unknown notification type: ${type}`);
      }

      await this.logNotification(userId, type, message, 'sent');
      return { success: true };
    } catch (error) {
      logger.error(`Failed to send notification ${type} to user ${userId}:`, error.message);
      await this.logNotification(userId, type, message, 'failed', error.message);
      throw error;
    }
  }

  async sendBackupCompletedNotification(userId, message) {
    if (!this.channels.email) {
      logger.debug('Email channel disabled, skipping backup notification');
      return;
    }

    const queueManager = require('../core/queues/queueManager');
    await queueManager.addEmailJob({
      type: 'custom',
      to: await this.getUserEmail(userId),
      subject: 'Backup completado exitosamente',
      html: `
        <h1>Backup Completado</h1>
        <p>${message}</p>
        <p>El backup ha sido generado y almacenado correctamente.</p>
      `,
      priority: 5
    });

    logger.info(`Backup completion notification queued for user ${userId}`);
  }

  async sendExportReadyNotification(userId, message) {
    if (!this.channels.email) {
      logger.debug('Email channel disabled, skipping export notification');
      return;
    }

    const queueManager = require('../core/queues/queueManager');
    await queueManager.addEmailJob({
      type: 'custom',
      to: await this.getUserEmail(userId),
      subject: 'Exportación lista para descarga',
      html: `
        <h1>Exportación Lista</h1>
        <p>${message}</p>
        <p>Tu archivo está listo para ser descargado desde el panel de exportaciones.</p>
      `,
      priority: 5
    });

    logger.info(`Export ready notification queued for user ${userId}`);
  }

  async sendErrorAlertNotification(userId, message, priority) {
    const alertLevel = priority === 'high' ? 'CRÍTICO' : 'ALERTA';
    
    logger.error(`[${alertLevel}] Error notification for user ${userId}: ${message}`);

    if (priority === 'high' && this.channels.email) {
      const queueManager = require('../core/queues/queueManager');
      await queueManager.addEmailJob({
        type: 'custom',
        to: await this.getUserEmail(userId),
        subject: `[${alertLevel}] Alerta de Error en Orange Match`,
        html: `
          <h1 style="color: red;">${alertLevel}</h1>
          <p><strong>Error detectado:</strong></p>
          <p>${message}</p>
          <p>Por favor contacta al equipo de soporte si el problema persiste.</p>
        `,
        priority: 10
      });
    }
  }

  async sendSystemMaintenanceNotification(userId, message) {
    if (!this.channels.email) {
      logger.debug('Email channel disabled, skipping maintenance notification');
      return;
    }

    const queueManager = require('../core/queues/queueManager');
    await queueManager.addEmailJob({
      type: 'custom',
      to: await this.getUserEmail(userId),
      subject: 'Mantenimiento Programado - Orange Match',
      html: `
        <h1>Mantenimiento Programado</h1>
        <p>${message}</p>
        <p>Agradecemos tu comprensión.</p>
      `,
      priority: 3
    });

    logger.info(`Maintenance notification queued for user ${userId}`);
  }

  async getUserEmail(userId) {
    const { db } = require('../models/db');
    const user = db.prepare('SELECT email FROM usuarios WHERE id = ?').get(userId);
    return user ? user.email : null;
  }

  async logNotification(userId, type, message, status, error = null) {
    const { db } = require('../models/db');
    
    try {
      db.prepare(`
        INSERT INTO notification_logs 
        (usuario_id, tipo, mensaje, estado, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        type,
        message,
        status,
        error,
        new Date().toISOString()
      );
    } catch (logError) {
      logger.error('Failed to log notification:', logError.message);
    }
  }

  async getNotificationHistory(userId, limit = 50) {
    const { db } = require('../models/db');
    
    try {
      const logs = db.prepare(`
        SELECT id, tipo, mensaje, estado, created_at
        FROM notification_logs
        WHERE usuario_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(userId, limit);

      return { success: true, logs };
    } catch (error) {
      logger.error('Failed to get notification history:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();
