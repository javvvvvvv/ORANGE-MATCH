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

module.exports = {
  apps: [
    {
      name: 'orange-match-api',
      script: './server.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-api-error.log',
      out_file: './logs/pm2-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '500M',
      watch: false
    },
    {
      name: 'orange-match-email-worker',
      script: './src/core/queues/workers/emailWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-email-error.log',
      out_file: './logs/pm2-email-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '200M',
      watch: false
    },
    {
      name: 'orange-match-backup-worker',
      script: './src/core/queues/workers/backupWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-backup-error.log',
      out_file: './logs/pm2-backup-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '300M',
      watch: false
    },
    {
      name: 'orange-match-export-worker',
      script: './src/core/queues/workers/exportWorker.js',
      instances: 2,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-export-error.log',
      out_file: './logs/pm2-export-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '400M',
      watch: false
    },
    {
      name: 'orange-match-notification-worker',
      script: './src/core/queues/workers/notificationWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-notification-error.log',
      out_file: './logs/pm2-notification-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '200M',
      watch: false
    }
  ]
};
