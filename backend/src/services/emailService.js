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

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      logger.warn('SMTP credentials not configured. Email service disabled.');
      this.initialized = true;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });

    this.initialized = true;
    logger.info('Email service initialized');
  }

  async sendWelcomeEmail(to, user) {
    if (!this.initialized || !this.transporter) {
      logger.warn('Email service not initialized, skipping welcome email');
      return { success: false, reason: 'service_not_configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Orange Match" <${process.env.SMTP_FROM || 'noreply@orangematch.com'}>`,
        to,
        subject: 'Bienvenido a Orange Match',
        html: `
          <h1>Bienvenido ${user.name || 'Usuario'}</h1>
          <p>Tu cuenta ha sido creada exitosamente.</p>
          <p>Email: ${user.email}</p>
        `
      });

      logger.info(`Welcome email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send welcome email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetEmail(to, token) {
    if (!this.initialized || !this.transporter) {
      logger.warn('Email service not initialized, skipping password reset email');
      return { success: false, reason: 'service_not_configured' };
    }

    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
      
      const info = await this.transporter.sendMail({
        from: `"Orange Match" <${process.env.SMTP_FROM || 'noreply@orangematch.com'}>`,
        to,
        subject: 'Restablecimiento de contraseña',
        html: `
          <h1>Solicitud de restablecimiento de contraseña</h1>
          <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
          <a href="${resetUrl}">${resetUrl}</a>
          <p>Este enlace expira en 1 hora.</p>
        `
      });

      logger.info(`Password reset email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send password reset email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async sendVerificationEmail(to, code) {
    if (!this.initialized || !this.transporter) {
      logger.warn('Email service not initialized, skipping verification email');
      return { success: false, reason: 'service_not_configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Orange Match" <${process.env.SMTP_FROM || 'noreply@orangematch.com'}>`,
        to,
        subject: 'Código de verificación',
        html: `
          <h1>Verifica tu cuenta</h1>
          <p>Tu código de verificación es:</p>
          <h2 style="font-size: 32px; letter-spacing: 5px;">${code}</h2>
          <p>Este código expira en 10 minutos.</p>
        `
      });

      logger.info(`Verification email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send verification email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async sendCustomEmail(to, subject, html) {
    if (!this.initialized || !this.transporter) {
      logger.warn('Email service not initialized, skipping custom email');
      return { success: false, reason: 'service_not_configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Orange Match" <${process.env.SMTP_FROM || 'noreply@orangematch.com'}>`,
        to,
        subject,
        html
      });

      logger.info(`Custom email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send custom email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
