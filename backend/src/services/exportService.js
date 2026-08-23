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

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { db } = require('../models/db');
const logger = require('../utils/logger');

class ExportService {
  constructor() {
    this.exportDir = process.env.EXPORT_DIR || path.join(process.cwd(), 'exports');
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async generateExport(config) {
    const { type, empresaId, userId, format = 'excel', filters = {} } = config;

    try {
      let data;
      switch (type) {
        case 'amarres':
          data = await this.getAmarresData(empresaId, filters);
          break;
        case 'empresas':
          data = await this.getEmpresasData(empresaId, filters);
          break;
        case 'usuarios':
          data = await this.getUsuariosData(empresaId, filters);
          break;
        case 'backup_completo':
          data = await this.getBackupCompletoData(empresaId, filters);
          break;
        default:
          throw new Error(`Unknown export type: ${type}`);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `export-${type}-${timestamp}`;

      let filePath;
      if (format === 'excel') {
        filePath = await this.generateExcel(filename, data);
      } else if (format === 'csv') {
        filePath = await this.generateCSV(filename, data);
      } else if (format === 'json') {
        filePath = await this.generateJSON(filename, data);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      logger.info(`Export generated: ${filePath}`);
      return { 
        success: true, 
        path: filePath,
        filename: path.basename(filePath),
        records: data.length || 0,
        timestamp 
      };
    } catch (error) {
      logger.error('Export generation failed:', error.message);
      throw error;
    }
  }

  async getAmarresData(empresaId, filters) {
    let query = 'SELECT * FROM amarres WHERE empresa_id = ?';
    const params = [empresaId];

    if (filters.tipo_mov) {
      query += ' AND tipo_mov = ?';
      params.push(filters.tipo_mov);
    }

    if (filters.fecha_inicio && filters.fecha_fin) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(filters.fecha_inicio, filters.fecha_fin);
    }

    query += ' ORDER BY concepto ASC';

    return db.prepare(query).all(...params);
  }

  async getEmpresasData(empresaId, filters) {
    let query = 'SELECT * FROM empresas WHERE id = ?';
    const params = [empresaId];

    return db.prepare(query).all(...params);
  }

  async getUsuariosData(empresaId, filters) {
    let query = 'SELECT id, username, email, rol, activo, created_at FROM usuarios WHERE empresa_id = ?';
    const params = [empresaId];

    if (filters.activo !== undefined) {
      query += ' AND activo = ?';
      params.push(filters.activo ? 1 : 0);
    }

    if (filters.rol) {
      query += ' AND rol = ?';
      params.push(filters.rol);
    }

    query += ' ORDER BY username ASC';

    return db.prepare(query).all(...params);
  }

  async getBackupCompletoData(empresaId, filters) {
    return {
      empresas: db.prepare('SELECT * FROM empresas WHERE id=?').all(empresaId),
      amarres: db.prepare('SELECT * FROM amarres WHERE empresa_id=?').all(empresaId),
      datos_fiscales: db.prepare('SELECT * FROM datos_fiscales WHERE empresa_id=?').all(empresaId),
      anexo_config: db.prepare('SELECT * FROM anexo_config WHERE empresa_id=?').all(empresaId),
      tarifas_isr: db.prepare('SELECT * FROM tarifas_isr').all(),
      usuarios: db.prepare('SELECT id, username, email, rol, activo FROM usuarios WHERE empresa_id=?').all(empresaId)
    };
  }

  async generateExcel(filename, data) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Orange Match';
    workbook.created = new Date();

    if (Array.isArray(data)) {
      const worksheet = workbook.addWorksheet('Datos');
      
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        worksheet.addRow(headers);
        
        data.forEach(row => {
          const rowData = headers.map(h => row[h]);
          worksheet.addRow(rowData);
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.columns.forEach(col => col.width = 25);
      }
    } else {
      for (const [sheetName, sheetData] of Object.entries(data)) {
        if (Array.isArray(sheetData) && sheetData.length > 0) {
          const worksheet = workbook.addWorksheet(sheetName);
          const headers = Object.keys(sheetData[0]);
          worksheet.addRow(headers);
          
          sheetData.forEach(row => {
            const rowData = headers.map(h => row[h]);
            worksheet.addRow(rowData);
          });

          worksheet.getRow(1).font = { bold: true };
          worksheet.columns.forEach(col => col.width = 25);
        }
      }
    }

    const filePath = path.join(this.exportDir, `${filename}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async generateCSV(filename, data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('No data to export to CSV');
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h]}"`).join(','))
    ];

    const csvContent = csvRows.join('\n');
    const filePath = path.join(this.exportDir, `${filename}.csv`);
    fs.writeFileSync(filePath, csvContent, 'utf8');
    
    return filePath;
  }

  async generateJSON(filename, data) {
    const filePath = path.join(this.exportDir, `${filename}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return filePath;
  }

  async cleanupOldExports(maxAgeHours = 24) {
    try {
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      const files = fs.readdirSync(this.exportDir);
      files.forEach(file => {
        const filePath = path.join(this.exportDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          logger.info(`Deleted old export: ${file}`);
        }
      });
    } catch (error) {
      logger.error('Failed to cleanup old exports:', error.message);
    }
  }
}

module.exports = new ExportService();
