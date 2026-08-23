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

const Queue = require('bull');
const logger = require('../utils/logger');
const emailService = require('./emailService');
const backupService = require('./backupService');
const exportService = require('./exportService');
const notificationService = require('./notificationService');

class EmailWorker {
  constructor() {
    this.queue = null;
  }

  async initialize(redisConfig) {
    this.queue = new Queue('email-queue', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
      }
    });

    this.queue.process(async (job) => {
      try {
        await this.processEmailJob(job);
      } catch (error) {
        logger.error(`Email job ${job.id} failed:`, error.message);
        throw error;
      }
    });

    logger.info('Email worker initialized');
  }

  async processEmailJob(job) {
    const { data } = job.data;
    
    switch (data.type) {
      case 'welcome':
        await emailService.sendWelcomeEmail(data.to, data.user);
        break;
      case 'password_reset':
        await emailService.sendPasswordResetEmail(data.to, data.token);
        break;
      case 'verification':
        await emailService.sendVerificationEmail(data.to, data.code);
        break;
      case 'custom':
        await emailService.sendCustomEmail(data.to, data.subject, data.html);
        break;
      default:
        logger.warn(`Unknown email type: ${data.type}`);
    }

    return { success: true, emailType: data.type };
  }

  async close() {
    if (this.queue) {
      await this.queue.close();
    }
  }
}

class BackupWorker {
  constructor() {
    this.queue = null;
  }

  async initialize(redisConfig) {
    this.queue = new Queue('backup-queue', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 2,
        timeout: 300000
      }
    });

    this.queue.process(async (job) => {
      try {
        await this.processBackupJob(job);
      } catch (error) {
        logger.error(`Backup job ${job.id} failed:`, error.message);
        throw error;
      }
    });

    logger.info('Backup worker initialized');
  }

  async processBackupJob(job) {
    const { config } = job.data;
    const result = await backupService.createBackup(config);
    return result;
  }

  async close() {
    if (this.queue) {
      await this.queue.close();
    }
  }
}

class ExportWorker {
  constructor() {
    this.queue = null;
  }

  async initialize(redisConfig) {
    this.queue = new Queue('export-queue', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        timeout: 120000
      }
    });

    this.queue.process(async (job) => {
      try {
        await this.processExportJob(job);
      } catch (error) {
        logger.error(`Export job ${job.id} failed:`, error.message);
        throw error;
      }
    });

    logger.info('Export worker initialized');
  }

  async processExportJob(job) {
    const { config } = job.data;
    const result = await exportService.generateExport(config);
    return result;
  }

  async close() {
    if (this.queue) {
      await this.queue.close();
    }
  }
}

class NotificationWorker {
  constructor() {
    this.queue = null;
  }

  async initialize(redisConfig) {
    this.queue = new Queue('notification-queue', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 2
      }
    });

    this.queue.process(async (job) => {
      try {
        await this.processNotificationJob(job);
      } catch (error) {
        logger.error(`Notification job ${job.id} failed:`, error.message);
        throw error;
      }
    });

    logger.info('Notification worker initialized');
  }

  async processNotificationJob(job) {
    const { data } = job.data;
    await notificationService.sendNotification(data);
    return { success: true };
  }

  async close() {
    if (this.queue) {
      await this.queue.close();
    }
  }
}

module.exports = {
  EmailWorker,
  BackupWorker,
  ExportWorker,
  NotificationWorker
};
