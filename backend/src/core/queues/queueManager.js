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
const Redis = require('ioredis');
const logger = require('../utils/logger');

class QueueManager {
  constructor() {
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 50, 2000);
      }
    };

    this.connection = new Redis(this.redisConfig);
    this.queues = {};
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await this.connection.ping();
      
      this.queues.email = new Queue('email-queue', {
        redis: this.redisConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 1000
        }
      });

      this.queues.backup = new Queue('backup-queue', {
        redis: this.redisConfig,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'fixed', delay: 5000 },
          timeout: 300000,
          removeOnComplete: 50,
          removeOnFail: 500
        }
      });

      this.queues.export = new Queue('export-queue', {
        redis: this.redisConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          timeout: 120000,
          removeOnComplete: 200,
          removeOnFail: 1000
        }
      });

      this.queues.notification = new Queue('notification-queue', {
        redis: this.redisConfig,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'fixed', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 500
        }
      });

      this.setupQueueEvents();
      this.initialized = true;
      logger.info('Queue manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize queue manager:', error.message);
      throw error;
    }
  }

  setupQueueEvents() {
    Object.entries(this.queues).forEach(([name, queue]) => {
      queue.on('completed', (job) => {
        logger.debug(`Job ${job.id} completed in ${name}-queue`);
      });

      queue.on('failed', (job, err) => {
        logger.error(`Job ${job?.id} failed in ${name}-queue:`, err.message);
      });

      queue.on('error', (err) => {
        logger.error(`Queue error in ${name}-queue:`, err.message);
      });

      queue.on('stalled', (jobId) => {
        logger.warn(`Job ${jobId} stalled in ${name}-queue`);
      });
    });
  }

  async addEmailJob(emailData) {
    return this.queues.email.add({
      type: 'email',
      data: emailData,
      timestamp: Date.now()
    }, {
      priority: emailData.priority || 1,
      jobId: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
  }

  async addBackupJob(backupConfig) {
    return this.queues.backup.add({
      type: 'backup',
      config: backupConfig,
      timestamp: Date.now()
    }, {
      priority: 10,
      jobId: `backup-${Date.now()}`,
      timeout: 300000
    });
  }

  async addExportJob(exportConfig) {
    return this.queues.export.add({
      type: 'export',
      config: exportConfig,
      timestamp: Date.now()
    }, {
      priority: exportConfig.priority || 5,
      jobId: `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timeout: 120000
    });
  }

  async addNotificationJob(notificationData) {
    return this.queues.notification.add({
      type: 'notification',
      data: notificationData,
      timestamp: Date.now()
    }, {
      priority: notificationData.priority || 3,
      jobId: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
  }

  async getQueueStats() {
    const stats = {};
    for (const [name, queue] of Object.entries(this.queues)) {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount()
      ]);
      stats[name] = { waiting, active, completed, failed };
    }
    return stats;
  }

  async cleanOldJobs() {
    for (const queue of Object.values(this.queues)) {
      await queue.clean(1000, 3600000, 'completed');
      await queue.clean(1000, 3600000, 'failed');
    }
  }

  async close() {
    await Promise.all(Object.values(this.queues).map(queue => queue.close()));
    await this.connection.quit();
    this.initialized = false;
  }
}

module.exports = new QueueManager();
